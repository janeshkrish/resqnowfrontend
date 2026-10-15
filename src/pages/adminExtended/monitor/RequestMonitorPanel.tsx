import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import LiveTrackingMap from "@/components/user/LiveTrackingMap";
import { toast } from "@/components/ui/sonner";
import { serviceOf } from "@/lib/services";
import {
  callCommandCenterTechnician,
  closeAdminRequest,
  escalateAdminRequest,
  reassignCommandCenterJob,
  remindCommandCenterTechnician,
} from "../api/adminExtendedApi";
import { addRequestNote, getRequestMonitor, type MonitorDetail, type TimelineItem } from "../api/adminMonitorApi";
import { useAdminEvents, useNow, useRequestLive } from "./adminLive";
import { ago, attentionOf, chipOf, clock, initials, minutesLabel, money, PHASE_LABEL, runningFor, service } from "./monitorFormat";

const ACTIVE = new Set(["accepted", "on_the_way", "arrived", "working", "towing"]);

function timelineTone(item: TimelineItem) {
  if (item.kind === "alert") return "is-warn";
  if (item.kind === "cancelled" || item.kind === "declined") return "is-muted";
  if (item.kind === "offer") return item.meta.result === "accepted" ? "is-done" : "is-muted";
  return "is-done";
}

function timelineSub(item: TimelineItem) {
  if (item.kind === "offer") {
    const result = String(item.meta.result || "pending");
    return { pending: "Waiting for an answer", accepted: "Accepted", rejected: "Declined", expired: "Let it expire" }[result] || result;
  }
  if (item.kind === "accepted" && typeof item.meta.promisedAt === "string") return `Promised arrival ${clock(item.meta.promisedAt)}`;
  if (item.kind === "admin_note" || item.kind === "admin_action") return [item.description, item.actorId ? `by ${item.actorId}` : null].filter(Boolean).join(" · ");
  if (item.actorType === "technician") return item.description || "By the technician";
  if (item.actorType === "user") return item.description || "By the customer";
  return item.description || (item.source === "stored" ? "From the request's stored times" : "");
}

function useDetail(requestId: number) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["admin", "monitor", "request", requestId], queryFn: () => getRequestMonitor(requestId), refetchInterval: 30_000 });
  useAdminEvents((_event, data) => {
    const id = Number((data as { requestId?: unknown } | null)?.requestId);
    if (!id || id === requestId) void queryClient.invalidateQueries({ queryKey: ["admin", "monitor", "request", requestId] });
  });
  return query;
}

export default function RequestMonitorPanel({ requestId, onClose }: { requestId: number; onClose: () => void }) {
  const queryClient = useQueryClient();
  const now = useNow(1000);
  const detail = useDetail(requestId);
  const data = detail.data as MonitorDetail | undefined;
  const live = useRequestLive(requestId, data?.technician?.id ?? null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [confirm, setConfirm] = useState<null | "reassign" | "close">(null);
  const [closeReason, setCloseReason] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // A status change on the request's own feed refreshes the panel at once.
  useEffect(() => {
    if (live.statusChangedAt) void queryClient.invalidateQueries({ queryKey: ["admin", "monitor", "request", requestId] });
  }, [live.statusChangedAt, queryClient, requestId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "monitor"] });
  const run = async (key: string, action: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await action();
      toast.success(done);
      refresh();
      return true;
    } catch (error) {
      toast.error((error as Error).message || "That did not work.");
      return false;
    } finally {
      setBusy(null);
    }
  };

  const phase = data?.phase;
  const active = phase ? ACTIVE.has(phase) : false;
  const point = live.point ?? (data?.live?.lat != null && data.live.lng != null ? { lat: data.live.lat, lng: data.live.lng, at: Date.parse(data.live.lastSeenAt || "") || now } : null);
  const etaSeconds = live.eta && now - live.eta.receivedAt < 3 * 60_000 ? live.eta.etaSeconds : data?.live?.etaSeconds ?? null;
  const distanceKm = live.eta && now - live.eta.receivedAt < 3 * 60_000 ? Math.round(live.eta.distanceMeters / 100) / 10 : data?.live?.distanceKm ?? null;
  const towing = serviceOf(data?.serviceType)?.id === "towing";
  const destination = phase === "towing" && data?.drop?.lat != null && data.drop.lng != null ? { lat: data.drop.lat, lng: data.drop.lng } : data?.location?.lat != null && data.location.lng != null ? { lat: data.location.lat, lng: data.location.lng } : null;
  const attention = data ? attentionOf({ ...data, live: data.live && point ? { ...data.live, lastSeenAt: new Date(point.at).toISOString(), gpsStale: now - point.at > 120_000 } : data.live }, now) : null;
  const chip = data ? chipOf(data, now) : null;
  const arrivesAt = etaSeconds != null ? now + etaSeconds * 1000 : null;
  const late = arrivesAt != null && data?.promisedAt ? Math.round((arrivesAt - Date.parse(data.promisedAt)) / 60_000) : null;
  const acceptedIn = data?.acceptedAt && data.createdAt ? Math.round((Date.parse(data.acceptedAt) - Date.parse(data.createdAt)) / 1000) : null;
  const tech = data?.technician;

  const strip = data
    ? [
        active
          ? { label: "Arrives", value: arrivesAt != null ? clock(arrivesAt) : data.arrivedAt ? `Arrived ${clock(data.arrivedAt)}` : "—", cls: late != null && late > 0 ? "is-warn" : arrivesAt != null ? "is-ok" : "", sub: data.promisedAt ? `promised ${clock(data.promisedAt)}${late != null && late > 0 ? ` · ${late} min late` : ""}` : "no promise recorded" }
          : { label: "Status", value: PHASE_LABEL[data.phase], cls: "", sub: `since ${clock(data.updatedAt)}` },
        { label: "Distance left", value: distanceKm != null ? `${distanceKm} km` : "—", cls: "", sub: live.eta?.trafficAware || data.live?.trafficAware ? "live traffic" : data.live?.distanceSource === "straight" ? "straight line" : "" },
        { label: "Accepted in", value: acceptedIn != null ? (acceptedIn < 120 ? `${acceptedIn} s` : `${Math.round(acceptedIn / 60)} min`) : "—", cls: "", sub: data.search.sent ? `${data.search.sent} offer${data.search.sent === 1 ? "" : "s"} sent` : "" },
        { label: "Last GPS", value: point ? ago(point.at, now) ?? "—" : "—", cls: point && now - point.at > 120_000 ? "is-warn" : "", sub: point ? `${live.subscribed ? "live feed" : "stored"}${live.point?.speedKmh != null ? ` · ${live.point.speedKmh} km/h` : ""}` : "no position yet" },
      ]
    : [];

  return (
    <div className="am-overlay">
      <button type="button" className="am-scrim" aria-label="Close the monitor" onClick={onClose} />
      <aside className="am-panel" role="dialog" aria-modal="true" aria-label={`Monitor request ${requestId}`} data-testid="request-monitor">
        <div className="am-ph">
          <div>
            <h2>#{requestId}{data ? ` · ${service(data.serviceType)}` : ""}</h2>
            <span>{data ? [data.customer.name, data.vehicleModel, data.address, `requested ${clock(data.createdAt)}`].filter(Boolean).join(" · ") : "Loading…"}</span>
          </div>
          {chip ? (
            <span className={chip.cls}>
              <MaterialSymbol name={chip.icon} />
              {chip.label}
            </span>
          ) : null}
          {active ? (
            <span className="am-livetag">
              <i aria-hidden="true" />
              Live
            </span>
          ) : null}
          <button type="button" className="am-btn is-icon" aria-label="Close" onClick={onClose}>
            <MaterialSymbol name="close" />
          </button>
        </div>

        {detail.isError ? <p className="am-error" role="alert">{(detail.error as Error).message}</p> : null}

        {data ? (
          <div className="am-pbody">
            <div className="am-map">
              {destination ? (
                <LiveTrackingMap
                  variant="card"
                  className="am-map-canvas"
                  techLocation={point ? { lat: point.lat, lng: point.lng } : null}
                  technicianHeading={live.point?.heading ?? data.live?.heading ?? null}
                  technicianRecordedAt={point?.at ?? null}
                  userLocation={data.location.lat != null && data.location.lng != null ? { lat: data.location.lat, lng: data.location.lng } : null}
                  dropLocation={data.drop?.lat != null && data.drop.lng != null ? { lat: data.drop.lat, lng: data.drop.lng } : null}
                  routeDestination={point ? destination : null}
                  showRoutePath={Boolean(point) && active}
                  showStatusOverlay={false}
                  eta={etaSeconds != null ? minutesLabel(etaSeconds) ?? undefined : undefined}
                  status={data.status}
                  technicianVehicle={towing ? "tow" : "bike"}
                  userLabel={data.customer.name}
                  trackingSessionId={requestId}
                />
              ) : (
                <p className="am-empty">No location on this request.</p>
              )}
            </div>

            <div className="am-strip">
              {strip.map((k) => (
                <div key={k.label}>
                  <span>{k.label}</span>
                  <b className={k.cls}>{k.value}</b>
                  <small>{k.sub}</small>
                </div>
              ))}
            </div>

            <div className="am-cols">
              <div className="am-col">
                {attention && tech ? (
                  <div className="am-alert" role="alert">
                    <div className="am-alert-top">
                      <MaterialSymbol name="warning" />
                      <div>
                        <b>{attention.label}</b>
                        <span>{data.alerts[0]?.text || (attention.code === "late" ? `Promised ${clock(data.promisedAt)}; not arrived yet.` : `Last position ${point ? ago(point.at, now) : "unknown"}.`)}</span>
                      </div>
                    </div>
                    <div className="am-alert-acts">
                      <a className="am-btn is-dark" href={tech.phone ? `tel:${tech.phone.replace(/\s+/g, "")}` : undefined} onClick={() => void callCommandCenterTechnician({ requestId }).catch(() => undefined)}>
                        <MaterialSymbol name="call" />
                        Call {tech.name.split(" ")[0]}
                      </a>
                      <button type="button" className="am-btn" disabled={busy === "remind"} onClick={() => void run("remind", () => remindCommandCenterTechnician({ requestId }), "Reminder sent")}>
                        <MaterialSymbol name="notifications_active" />
                        Send reminder
                      </button>
                      <button type="button" className="am-btn" onClick={() => setConfirm("reassign")}>
                        <MaterialSymbol name="swap_horiz" />
                        Reassign
                      </button>
                    </div>
                  </div>
                ) : null}

                <p className="am-h">Timeline</p>
                <ol className="am-tl">
                  {data.timeline.length === 0 ? <li className="is-muted"><time /><i aria-hidden="true" /><div><b>Nothing recorded yet</b></div></li> : null}
                  {data.timeline.map((item, index) => (
                    <li key={`${item.kind}-${item.at}-${index}`} className={timelineTone(item)}>
                      <time>{clock(item.at)}</time>
                      <i aria-hidden="true" />
                      <div>
                        <b>{item.title}</b>
                        <span>{timelineSub(item)}</span>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="am-col">
                <p className="am-h">People</p>
                {tech ? (
                  <div className="am-person">
                    <div className="am-person-top">
                      <span className="am-av">{initials(tech.name)}</span>
                      <div>
                        <b>
                          <Link to={`/admin/technicians/${tech.id}`}>{tech.name}</Link>
                        </b>
                        <span>{[tech.rating != null ? `★ ${Number(tech.rating).toFixed(1)}` : null, tech.jobsCompleted != null ? `${tech.jobsCompleted} jobs` : null, tech.phoneMasked].filter(Boolean).join(" · ")}</span>
                      </div>
                    </div>
                    {tech.phone ? (
                      <a className="am-btn is-icon" href={`tel:${tech.phone.replace(/\s+/g, "")}`} aria-label={`Call ${tech.name}`} onClick={() => void callCommandCenterTechnician({ requestId }).catch(() => undefined)}>
                        <MaterialSymbol name="call" />
                      </a>
                    ) : null}
                  </div>
                ) : (
                  <p className="am-muted">No technician yet.</p>
                )}
                <div className="am-person">
                  <div className="am-person-top">
                    <span className="am-av">{initials(data.customer.name)}</span>
                    <div>
                      <b>{data.customer.name}</b>
                      <span>{[data.customer.phoneMasked, data.customer.requestNumber ? `request ${data.customer.requestNumber}` : null].filter(Boolean).join(" · ")}</span>
                    </div>
                  </div>
                  {data.customer.phone ? (
                    <a className="am-btn is-icon" href={`tel:${data.customer.phone.replace(/\s+/g, "")}`} aria-label={`Call ${data.customer.name}`}>
                      <MaterialSymbol name="call" />
                    </a>
                  ) : null}
                </div>

                <p className="am-h">Offered to</p>
                {data.offers.length === 0 ? <p className="am-muted">No offers recorded.</p> : null}
                <div className="am-offers">
                  {data.offers.map((o, i) => (
                    <div key={`${o.technicianId}-${i}`} className="am-offer">
                      <b>{o.name}</b>
                      <span className={`am-chip ${o.result === "accepted" ? "is-ok" : o.result === "expired" ? "is-warn" : ""}`}>{{ pending: "Waiting", accepted: "Accepted", rejected: "Declined", expired: "Missed" }[o.result] || o.result}</span>
                      <span>{clock(o.sentAt)}</span>
                    </div>
                  ))}
                </div>

                <p className="am-h">Bill</p>
                <dl className="am-kv">
                  {data.bill.base != null ? <div><dt>Technician charge</dt><dd>{money(data.bill.base)}</dd></div> : null}
                  {data.bill.platformFee != null ? <div><dt>Platform fee</dt><dd>{money(data.bill.platformFee)}</dd></div> : null}
                  <div><dt>Total</dt><dd>{money(data.bill.total)}</dd></div>
                  <div><dt>Pays by</dt><dd>{data.bill.paymentMethod || "—"}{data.bill.paymentStatus ? ` · ${data.bill.paymentStatus}` : ""}</dd></div>
                </dl>
              </div>
            </div>

            {noteOpen ? (
              <form
                className="am-confirm"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run("note", () => addRequestNote(requestId, note), "Note added to the timeline").then((ok) => {
                    if (ok) {
                      setNote("");
                      setNoteOpen(false);
                    }
                  });
                }}
              >
                <label htmlFor="am-note">Note for the timeline</label>
                <textarea id="am-note" value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} placeholder="What happened, what you did" />
                <div>
                  <button type="button" className="am-btn" onClick={() => setNoteOpen(false)}>Cancel</button>
                  <button type="submit" className="am-btn is-dark" disabled={!note.trim() || busy === "note"}>Save note</button>
                </div>
              </form>
            ) : null}

            {confirm === "reassign" ? (
              <div className="am-confirm" role="alertdialog" aria-label="Reassign this job">
                <p><b>Reassign #{requestId}?</b> {tech ? `${tech.name} is taken off the job and ` : ""}the nearest free technicians get the offer.</p>
                <div>
                  <button type="button" className="am-btn" onClick={() => setConfirm(null)}>Keep {tech ? tech.name.split(" ")[0] : "it"}</button>
                  <button type="button" className="am-btn is-hot" disabled={busy === "reassign"} onClick={() => void run("reassign", () => reassignCommandCenterJob({ requestId }), "Reassigned").then(() => setConfirm(null))}>Reassign</button>
                </div>
              </div>
            ) : null}

            {confirm === "close" ? (
              <div className="am-confirm" role="alertdialog" aria-label="Close this request">
                <p><b>Close #{requestId}?</b> The customer and technician are told it is cancelled.</p>
                <input value={closeReason} onChange={(event) => setCloseReason(event.target.value)} placeholder="Reason (required)" aria-label="Reason for closing" />
                <div>
                  <button type="button" className="am-btn" onClick={() => setConfirm(null)}>Keep it open</button>
                  <button type="button" className="am-btn is-danger" disabled={!closeReason.trim() || busy === "close"} onClick={() => void run("close", () => closeAdminRequest({ requestId, status: "cancelled", reason: closeReason.trim() }), "Request closed").then(() => setConfirm(null))}>Close request</button>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="am-empty">{detail.isLoading ? "Loading the request…" : ""}</p>
        )}

        {data ? (
          <div className="am-pfoot">
            <span>{data.updatedAt ? `Updated ${ago(data.updatedAt, now)}` : ""}</span>
            {phase === "done" || phase === "cancelled" ? (
              <Link className="am-btn" to={`/admin/requests/${requestId}/replay`}>
                <MaterialSymbol name="replay" />
                Replay
              </Link>
            ) : null}
            <button type="button" className="am-btn" onClick={() => setNoteOpen(true)}>
              <MaterialSymbol name="edit_note" />
              Add note
            </button>
            {phase !== "done" && phase !== "cancelled" ? (
              <>
                <button type="button" className="am-btn" disabled={busy === "escalate"} onClick={() => void run("escalate", () => escalateAdminRequest({ requestId, reason: "Escalated from the monitor" }), "Escalated: the search is widened")}>
                  <MaterialSymbol name="priority_high" />
                  Escalate
                </button>
                <button type="button" className="am-btn" onClick={() => setConfirm("reassign")}>
                  <MaterialSymbol name="swap_horiz" />
                  Reassign
                </button>
                <button type="button" className="am-btn is-danger" onClick={() => setConfirm("close")}>
                  <MaterialSymbol name="block" />
                  Close request
                </button>
              </>
            ) : null}
          </div>
        ) : null}
        <span className="am-sr" aria-live="polite">{data && active ? `${PHASE_LABEL[data.phase]}${etaSeconds != null ? `, ${minutesLabel(etaSeconds)} away` : ""}` : ""}{data?.phase === "working" ? ` for ${runningFor(data.workStartedAt, now)}` : ""}</span>
      </aside>
    </div>
  );
}
