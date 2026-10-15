import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { toast } from "@/components/ui/sonner";
import { getLiveRequests, type MonitorRequest } from "../api/adminMonitorApi";
import { useAdminEvents, useNow, useWatchList, WATCH_LIMIT } from "./adminLive";
import {
  TABS, attentionOf, chipOf, dayAndTime, inTab, initials, liveLine, money, service, servicePicture, stepClasses, type TabKey,
} from "./monitorFormat";
import RequestMonitorPanel from "./RequestMonitorPanel";

const LIVE_KEY = ["admin", "monitor", "live"] as const;

function Kpi({ label, value, unit, warn }: { label: string; value: string; unit?: string; warn?: boolean }) {
  return (
    <div className={`am-kpi${warn ? " is-warn" : ""}`}>
      <span>{label}</span>
      <b>
        {value}
        {unit ? <small>{unit}</small> : null}
      </b>
    </div>
  );
}

function Row({ request, now, pinned, selected, onPin, onOpen }: { request: MonitorRequest; now: number; pinned: boolean; selected: boolean; onPin: () => void; onOpen: () => void }) {
  const attention = attentionOf(request, now);
  const chip = chipOf(request, now);
  const line = liveLine(request, now);
  const picture = servicePicture(request.serviceType);
  const finding = request.phase === "finding" || request.phase === "offered";
  return (
    <div className={`am-row${attention ? " is-risk" : ""}${selected ? " is-sel" : ""}`} role="row" data-testid={`live-row-${request.id}`}>
      <div className="am-id">
        <b>#{request.id}</b>
        <span>{dayAndTime(request.createdAt, now)}</span>
      </div>
      <div className="am-who">
        <span className="am-thumb">{picture ? <img src={picture} alt="" /> : <MaterialSymbol name="build" />}</span>
        <div>
          <b>{service(request.serviceType)}</b>
          <span>{[request.customer.name, request.vehicleModel].filter(Boolean).join(" · ")}</span>
        </div>
      </div>
      <div className="am-tech">
        <span className={`am-av${finding ? " is-find" : ""}`}>{finding ? <MaterialSymbol name="radar" /> : initials(request.technician?.name)}</span>
        <div>
          <b>{finding ? "Finding a technician" : request.technician?.name || "—"}</b>
          <span>
            {finding ? (
              `${request.search.sent} offered${request.search.declined ? ` · ${request.search.declined} declined` : ""}`
            ) : (
              <>
                <MaterialSymbol name="star" />
                {request.technician?.rating != null ? Number(request.technician.rating).toFixed(1) : "new"}
              </>
            )}
          </span>
        </div>
      </div>
      <div className="am-live">
        <div className="am-live-top">
          <span className={chip.cls}>
            <MaterialSymbol name={chip.icon} />
            {chip.label}
          </span>
          <span className="am-live-txt">{line.main}</span>
        </div>
        <div className="am-live-bot">
          <ol className="am-steps" aria-hidden="true">
            {stepClasses(request, Boolean(attention)).map((cls, i) => (
              <li key={i} className={cls} />
            ))}
          </ol>
          <span>{line.sub}</span>
        </div>
      </div>
      <div className="am-fare">
        <b>{money(request.fare)}</b>
        <span>{request.paymentMethod ? `${request.paymentMethod}${request.paymentStatus === "paid" ? ", paid" : ""}` : "—"}</span>
      </div>
      <div className="am-acts">
        <button type="button" className={`am-btn is-icon${pinned ? " is-pinned" : ""}`} aria-label={pinned ? `Unpin #${request.id}` : `Pin #${request.id} to the watch list`} aria-pressed={pinned} onClick={onPin}>
          <MaterialSymbol name="push_pin" />
        </button>
        <button type="button" className={`am-btn ${attention ? "is-hot" : "is-dark"}`} onClick={onOpen}>
          <MaterialSymbol name="monitoring" />
          Monitor
        </button>
      </div>
    </div>
  );
}

export default function LiveRequestsBoard({ initialOpenId = null }: { initialOpenId?: number | null } = {}) {
  const queryClient = useQueryClient();
  const now = useNow(1000);
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<number | null>(initialOpenId);
  const watch = useWatchList();

  const live = useQuery({ queryKey: LIVE_KEY, queryFn: getLiveRequests, refetchInterval: 15_000, refetchIntervalInBackground: true });
  useAdminEvents(() => void queryClient.invalidateQueries({ queryKey: ["admin", "monitor"] }));

  const requests = useMemo(() => live.data?.requests ?? [], [live.data]);
  const term = search.trim().toLowerCase();
  const shown = requests.filter((r) => inTab(r, tab, now) && (!term || [`#${r.id}`, String(r.id), r.customer.name, r.technician?.name, service(r.serviceType)].some((v) => String(v || "").toLowerCase().includes(term))));
  const counts = Object.fromEntries(TABS.map((t) => [t.key, requests.filter((r) => inTab(r, t.key, now)).length])) as Record<TabKey, number>;
  const k = live.data?.kpis;

  const pin = (id: number) => {
    const result = watch.toggle(id);
    if (result.full) toast.error(`The watch list holds ${WATCH_LIMIT}. Unpin one first.`);
    else toast.success(result.pinned ? `#${id} pinned to the watch list` : `#${id} removed from the watch list`);
  };

  return (
    <div className="am" data-testid="live-requests">
      <div className="am-kpis">
        <Kpi label="Live now" value={k ? String(k.live) : "—"} />
        <Kpi label="Finding a technician" value={k ? String(k.finding) : "—"} />
        <Kpi label="Needs attention" value={String(counts.attention)} warn={counts.attention > 0} />
        <Kpi label="Time to accept, today" value={k?.acceptSecondsToday != null ? String(k.acceptSecondsToday) : "—"} unit={k?.acceptSecondsToday != null ? "s avg" : undefined} />
        <Kpi label="Arrival, today" value={k?.arrivalMinutesToday != null ? String(k.arrivalMinutesToday) : "—"} unit={k?.arrivalMinutesToday != null ? `min avg · ${k.arrivalsMeasuredToday} jobs` : undefined} />
        <Kpi label="Completed today" value={k ? String(k.completedToday) : "—"} />
      </div>

      <div className="am-bar">
        <div className="am-tabs" role="tablist" aria-label="Live requests">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`am-tab${tab === t.key ? " is-on" : ""}${t.key === "attention" && counts.attention ? " is-warn" : ""}`} onClick={() => setTab(t.key)}>
              {t.label}
              <i>{counts[t.key]}</i>
            </button>
          ))}
        </div>
        <label className="am-search">
          <MaterialSymbol name="search" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests" aria-label="Search requests" />
        </label>
      </div>

      {live.isError ? <p className="am-error" role="alert">{(live.error as Error).message}</p> : null}

      <div className="am-table" role="table" aria-label="Live requests">
        <div className="am-head" role="row">
          <span>Request</span>
          <span>Customer and vehicle</span>
          <span>Technician</span>
          <span>Live status</span>
          <span>Fare</span>
          <span />
        </div>
        {live.isLoading ? <p className="am-empty">Loading live requests…</p> : null}
        {!live.isLoading && shown.length === 0 ? (
          <p className="am-empty">{requests.length === 0 ? "No live requests right now." : "Nothing here in this view."}</p>
        ) : null}
        {shown.map((request) => (
          <Row key={request.id} request={request} now={now} pinned={watch.list.includes(request.id)} selected={openId === request.id} onPin={() => pin(request.id)} onOpen={() => setOpenId(request.id)} />
        ))}
      </div>

      {openId != null ? <RequestMonitorPanel requestId={openId} onClose={() => setOpenId(null)} /> : null}
    </div>
  );
}
