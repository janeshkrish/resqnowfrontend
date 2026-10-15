import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { getLiveRequests, type MonitorRequest } from "@/pages/adminExtended/api/adminMonitorApi";
import { useAdminEvents, useNow } from "@/pages/adminExtended/monitor/adminLive";
import { ALERT_SHORT, attentionOf, liveLine } from "@/pages/adminExtended/monitor/monitorFormat";
import { getToday, type Today } from "../api/portalApi";
import { CityMap, type CityPin } from "../CityMap";
import { ago, count, rupees, service } from "../format";
import { PORTAL_EVENTS } from "../AdminPortalLayout";
import { Btn, Columns, ErrorState, HBars, Icon, Kpis, KV, Loading, usePortalHeader } from "../ui";

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const india = (ms: number) => new Date(ms + 330 * 60_000);
const hourLabel = (hour: number) => (hour === 0 ? "12 am" : hour < 12 ? `${hour} am` : hour === 12 ? "12 pm" : `${hour - 12} pm`);

function pinFor(request: MonitorRequest, now: number, open: (id: number) => void): CityPin | null {
  const lat = request.live?.lat ?? request.location.lat;
  const lng = request.live?.lng ?? request.location.lng;
  if (lat == null || lng == null) return null;
  const attention = attentionOf(request, now);
  const towing = /tow/i.test(request.serviceType || "");
  const base = { id: `r${request.id}`, lat, lng, label: `#${request.id} ${service(request.serviceType)}`, onClick: () => open(request.id) };
  if (attention) return { ...base, tone: "warn", icon: attention.code.includes("gps") ? "location_off" : "warning", tag: `#${request.id} · ${attention.label}`, tagWarn: true };
  if (request.phase === "finding" || request.phase === "offered") return { ...base, tone: "hot", icon: "radar", tag: `#${request.id} · finding` };
  if (request.phase === "on_the_way" || request.phase === "accepted" || request.phase === "towing") {
    const minutes = request.live?.etaSeconds != null ? `${Math.max(1, Math.round(request.live.etaSeconds / 60))} min` : null;
    return { ...base, tone: "", icon: towing ? "auto_towing" : "two_wheeler", tag: minutes ? `#${request.id} · ${minutes}` : null };
  }
  if (request.phase === "arrived") return { ...base, tone: "ok", icon: "check" };
  if (request.phase === "payment_due") return { ...base, tone: "soft", icon: "payments" };
  return { ...base, tone: "soft", icon: "build" };
}

export default function TodayPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const now = useNow(15_000);
  const sub = `${india(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} · ${india(now).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "UTC" })}`;
  usePortalHeader("Today", sub);

  const live = useQuery({ queryKey: ["admin", "monitor", "live"], queryFn: getLiveRequests, refetchInterval: 15_000 });
  const today = useQuery({ queryKey: ["portal", "today"], queryFn: getToday, refetchInterval: 60_000 });
  useAdminEvents(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "monitor", "live"] });
    void queryClient.invalidateQueries({ queryKey: ["portal", "today"] });
  }, 2000, PORTAL_EVENTS);

  const requests = useMemo(() => live.data?.requests ?? [], [live.data]);
  const attention = requests.filter((request) => attentionOf(request, now));
  const pins = useMemo(() => requests.map((request) => pinFor(request, now, (id) => navigate(`/admin/live?open=${id}`))).filter((pin): pin is CityPin => pin !== null), [requests, now, navigate]);
  const t = today.data;
  const k = live.data?.kpis;

  if (today.isError && live.isError) return <ErrorState error={today.error} onRetry={() => { void today.refetch(); void live.refetch(); }} />;

  const moving = requests.filter((request) => ["accepted", "on_the_way", "towing"].includes(request.phase) && !attentionOf(request, now)).length;
  const atVehicle = requests.filter((request) => ["arrived", "working", "payment_due"].includes(request.phase) && !attentionOf(request, now)).length;
  const finding = requests.filter((request) => request.phase === "finding" || request.phase === "offered").length;
  const lastWeekDay = WEEKDAY[india(now).getUTCDay()];

  return (
    <div className="adm-stack" data-testid="today">
      <Kpis items={[
        { label: "Live now", value: k ? count(k.live) : "—", note: k ? `${k.finding} finding a technician` : undefined, testId: "kpi-live" },
        { label: "Needs attention", value: String(attention.length), note: attention.length ? attention.slice(0, 2).map((r) => attentionOf(r, now)?.label).join(", ") : "nothing right now", warn: attention.length > 0, testId: "kpi-attention" },
        { label: "Completed today", value: t ? count(t.completed.today) : "—", note: t ? `${t.completed.today - t.completed.sameTimeLastWeek >= 0 ? "+" : ""}${t.completed.today - t.completed.sameTimeLastWeek} on last ${lastWeekDay}` : undefined, tone: t && t.completed.today >= t.completed.sameTimeLastWeek ? "up" : "down", testId: "kpi-completed" },
        { label: "Collected today", value: t ? rupees(t.money.collected) : "—", note: t ? `${rupees(t.money.cash.amount)} of it in cash` : undefined, testId: "kpi-collected" },
        { label: "Technicians on duty", value: t ? count(t.technicians.onDuty) : "—", note: t ? `${t.technicians.onJob} on a job, ${t.technicians.free} free` : undefined, testId: "kpi-duty" },
        { label: "Average arrival", value: k?.arrivalMinutesToday != null ? String(k.arrivalMinutesToday) : "—", unit: k?.arrivalMinutesToday != null ? "min" : undefined, note: k?.acceptSecondsToday != null ? `accepted in ${k.acceptSecondsToday} s avg` : "no arrivals yet today", testId: "kpi-arrival" },
      ]} cols={6} />

      <div className="td-row2" style={{ height: "auto" }}>
        <section className="ap-card is-flush" aria-label="Live map">
          <div className="td-maphead">
            <div><b>Live across the city</b><span>Every live job and every free technician · updates every few seconds</span></div>
            <Btn size="sm" icon="open_in_new" onClick={() => navigate("/admin/live")}>Open live requests</Btn>
          </div>
          <div className="td-map" data-testid="city-map">
            <CityMap pins={pins} dots={(t?.technicians.freePositions || []).map((tech) => ({ id: `t${tech.id}`, lat: tech.position.lat, lng: tech.position.lng, label: `${tech.name} · free` }))} />
            <div className="ap-mbox" style={{ left: 12, bottom: 12 }}>
              <span><span className="ap-dot" style={{ background: "#283048", boxShadow: "none" }} /><b>{moving}</b> moving</span>
              <span><span className="ap-dot" style={{ background: "#667085" }} /><b>{atVehicle}</b> at the vehicle</span>
              <span><span className="ap-dot" style={{ background: "#B01F2A" }} /><b>{finding}</b> finding</span>
              <span><span className="ap-dot is-warn" /><b>{attention.length}</b> need a look</span>
              <span><span className="ap-dot is-ok" /><b>{t?.technicians.free ?? "—"}</b> free technicians</span>
            </div>
          </div>
        </section>
        <NeedsYou now={now} attention={attention} today={t} loading={today.isLoading} />
      </div>

      <div className="td-row3">
        <section className="ap-card" aria-label="Requests today by hour">
          <div className="ap-h"><b>Requests today, by hour</b><span>{t ? `${t.requestsToday} so far` : ""}</span></div>
          {t ? (() => {
            const current = t.requestsByHour.currentHour;
            const first = Math.min(6, current);
            const hours = Array.from({ length: current - first + 1 }, (_, i) => first + i);
            return (
              <>
                <Columns label={`Requests each hour today, ${t.requestsToday} in all`} height={170} gap={hours.length > 14 ? 4 : 8} highlightLast
                  values={hours.map((h) => t.requestsByHour.today[h])} ghost={hours.map((h) => t.requestsByHour.lastWeek[h])}
                  labels={hours.map((h, i) => (i % 2 === 0 ? hourLabel(h) : ""))} />
                <div className="ap-legend"><span><i />Today</span><span><i style={{ background: "#B01F2A" }} />This hour, so far</span><span><i style={{ height: 2, background: "#98A2B3" }} />Last {lastWeekDay}</span></div>
              </>
            );
          })() : <Loading height={190} />}
        </section>
        <section className="ap-card" aria-label="What people asked for">
          <div className="ap-h"><b>What people asked for</b><span>{t ? `${t.requestsToday} request${t.requestsToday === 1 ? "" : "s"} today` : ""}</span></div>
          {t ? (t.serviceMix.length ? (
            <HBars label="Requests today by service" cols="128px minmax(0,1fr) 26px"
              items={t.serviceMix.map((row, index) => ({ label: service(row.service), value: row.count, fraction: row.count / Math.max(1, t.serviceMix[0].count), tone: index === 0 ? "" : "soft" }))} />
          ) : <p className="ap-faint" style={{ fontSize: 13, fontWeight: 600 }}>No requests yet today.</p>) : <Loading height={190} />}
        </section>
        <section className="ap-card" style={{ gap: 10 }} aria-label="Money today">
          <div className="ap-h"><b>Money today</b><button type="button" className="ap-link ap-btn is-ghost is-sm" onClick={() => navigate("/admin/payments")}>Payments<Icon name="chevron_right" /></button></div>
          {t ? (
            <>
              <div className="td-big"><b>{rupees(t.money.collected)}</b><span>collected from {t.money.payments} payment{t.money.payments === 1 ? "" : "s"}</span></div>
              <div className="td-split" role="img" aria-label={`${Math.round((t.money.online.amount / Math.max(1, t.money.collected)) * 100)} percent online`}>
                <i style={{ width: `${(t.money.online.amount / Math.max(1, t.money.collected)) * 100}%`, background: "#283048" }} />
                <i style={{ width: `${(t.money.cash.amount / Math.max(1, t.money.collected)) * 100}%`, background: "#98A2B3" }} />
              </div>
              <KV rows={[
                [`Online · ${t.money.online.count} payment${t.money.online.count === 1 ? "" : "s"}`, rupees(t.money.online.amount)],
                [`Cash · ${t.money.cash.count} job${t.money.cash.count === 1 ? "" : "s"}`, rupees(t.money.cash.amount)],
                ["To technicians", rupees(t.money.toTechnicians)],
                ["ResQNow margin and tax", rupees(t.money.toResqnow)],
              ]} />
              <div className="td-due">
                <div><b>{rupees(t.money.payoutsWaiting.amount)} to pay out</b><span>{t.money.payoutsWaiting.count} waiting · {rupees(t.money.cashDues.amount)} cash dues to collect</span></div>
                <Btn size="sm" variant="dark" onClick={() => navigate("/admin/payouts")}>Pay</Btn>
              </div>
            </>
          ) : <Loading height={220} />}
        </section>
      </div>
    </div>
  );
}

function NeedsYou({ now, attention, today, loading }: { now: number; attention: MonitorRequest[]; today: Today | undefined; loading: boolean }) {
  const navigate = useNavigate();
  const items: { key: string; tone: string; icon: string; title: string; sub: string; action: string; go: () => void }[] = [];
  for (const request of attention.slice(0, 3)) {
    const flag = attentionOf(request, now);
    const line = liveLine(request, now);
    items.push({
      key: `r${request.id}`, tone: "is-warn", icon: flag?.code.includes("gps") ? "location_off" : "warning",
      title: `#${request.id} · ${request.technician?.name || "Technician"}: ${flag ? ALERT_SHORT[flag.code] || flag.label : ""}`.replace(/: $/, ""),
      sub: `${service(request.serviceType)} for ${request.customer.name || "a customer"} · ${line.main}`,
      action: "Open", go: () => navigate(`/admin/live?open=${request.id}`),
    });
  }
  const n = today?.needs;
  if (n?.applications.count) items.push({ key: "apps", tone: "", icon: "how_to_reg", title: `${n.applications.count} technician application${n.applications.count === 1 ? "" : "s"} waiting`, sub: n.applications.oldest ? `The oldest, ${n.applications.oldest.name}, applied ${ago(n.applications.oldest.since, now)}` : "", action: "Review", go: () => navigate("/admin/applications") });
  if (n?.payouts.count) items.push({ key: "payouts", tone: "", icon: "account_balance", title: `${n.payouts.count} payout request${n.payouts.count === 1 ? "" : "s"} · ${rupees(n.payouts.amount)}`, sub: n.payouts.names.length ? `${n.payouts.names.join(", ")} asked to withdraw` : "", action: "Pay", go: () => navigate("/admin/payouts") });
  if (n?.complaints.count) items.push({ key: "complaints", tone: n.complaints.olderThanDay ? "is-bad" : "", icon: "support_agent", title: `${n.complaints.count} open complaint${n.complaints.count === 1 ? "" : "s"}${n.complaints.olderThanDay ? ` · ${n.complaints.olderThanDay} older than a day` : ""}`, sub: n.complaints.latest ? `Latest: “${n.complaints.latest.title}”` : "", action: "See", go: () => navigate("/admin/complaints") });
  return (
    <section className="ap-card" aria-label="Needs you now" data-testid="needs-you">
      <div className="ap-h"><b>Needs you now</b><span>{items.length ? `${items.length} thing${items.length === 1 ? "" : "s"} · most urgent first` : ""}</span></div>
      {loading && !items.length ? <Loading height={240} /> : null}
      {!loading && !items.length ? <div className="ap-state" style={{ border: 0, padding: "28px 8px" }}><Icon name="task_alt" /><b>All clear</b><span>No alerts, applications, payouts or complaints waiting.</span></div> : null}
      <div className="ap-items" style={{ gap: 6 }}>
        {items.map((item) => (
          <div key={item.key} className={`ap-item td-item ${item.tone}`}>
            <Icon name={item.icon} />
            <div><b>{item.title}</b>{item.sub ? <span>{item.sub}</span> : null}</div>
            <Btn size="sm" onClick={item.go}>{item.action}</Btn>
          </div>
        ))}
      </div>
    </section>
  );
}
