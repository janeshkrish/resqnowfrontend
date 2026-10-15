import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiUrl } from "@/lib/api";
import { closeAdminRequest, escalateAdminRequest, escalateCommandCenterJob, markAdminRequestHighPriority, overrideAdminRequestPricing } from "@/pages/adminExtended/api/adminExtendedApi";
import { addRequestNote, getRequestReplay, type ReplayDetail, type TimelineItem as MonitorItem } from "@/pages/adminExtended/api/adminMonitorApi";
import { useAdminEvents } from "@/pages/adminExtended/monitor/adminLive";
import { getDispatchAudit, getRequestDetails, type DispatchAudit, type RequestDetails } from "./api/portalApi";
import { AssignDialog } from "./AssignDialog";
import { clock, dayAndTime, dispatchReason, duration, initials, paymentMethod, rupees, service } from "./format";
import { PaymentChecks } from "./PaymentChecks";
import { Btn, Dialog, ErrorState, Icon, KV, Loading, Note, Panel, Pill, Radio, Strip, Timeline, UnderTabs, type TimelineItem, type Tone } from "./ui";

// One request, start to end: what happened, who dispatch could offer it to, and its payment checks.

type Tab = "story" | "dispatch" | "payment";
const LIVE_DONE = new Set(["done", "cancelled"]);

export function statusOf(phase: string, status: string): { label: string; tone: Tone } {
  if (phase === "done") return { label: "Completed", tone: "ok" };
  if (phase === "cancelled") return { label: "Cancelled", tone: "" };
  if (phase === "payment_due") return { label: "Payment due", tone: "warn" };
  if (phase === "finding" || phase === "offered") return { label: "Finding", tone: "hot" };
  if (phase === "arrived" || phase === "working" || phase === "towing") return { label: "Working", tone: "go" };
  return { label: status === "assigned" ? "Assigned" : "On the way", tone: "go" };
}

function storyOf(items: MonitorItem[]): TimelineItem[] {
  return items.filter((item) => item.kind !== "admin_note").map((item) => {
    const tone: TimelineItem["tone"] = item.kind === "alert" ? "warn" : item.kind === "cancelled" ? "bad" : ["completed", "work_done", "payment_completed", "paid"].includes(item.kind) ? "ok" : item.kind === "admin_action" || item.source === "actions" ? "note" : "";
    let sub = item.description || "";
    if (item.kind === "offer") sub = ({ accepted: "Accepted", declined: "Declined", expired: "Missed · time ran out", pending: "Waiting for an answer" } as Record<string, string>)[String(item.meta.result)] || String(item.meta.result || "");
    if (item.kind === "accepted" && typeof item.meta.promisedAt === "string") sub = [sub, `Promised by ${clock(item.meta.promisedAt)}`].filter(Boolean).join(" · ");
    if (item.actorType === "admin" && item.actorId) sub = [sub, `by ${item.actorId}`].filter(Boolean).join(" · ");
    return { time: clock(item.at), tone, title: item.title, sub };
  });
}

const fileUrl = (path: string) => (/^(https?:|blob:|data:)/.test(path) ? path : apiUrl(path));
const BREAKDOWN_SKIP = /final|total|estimated|override|surge|tax|gst|platform|technician|commission|margin/;
function fareLines(breakdown: Record<string, unknown>) {
  return Object.entries(breakdown)
    .filter(([key, value]) => typeof value === "number" && value > 0 && /(charge|fee|price|amount|labour|cost)$/.test(key) && !BREAKDOWN_SKIP.test(key))
    .slice(0, 6)
    .map(([key, value]) => [key.replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase()), rupees(value as number)] as [string, string]);
}

export default function RequestPanel({ requestId, onClose, initialTab = "story" }: { requestId: number; onClose: () => void; initialTab?: Tab }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [dialog, setDialog] = useState<"fare" | "close" | "assign" | "escalate" | null>(null);
  const replay = useQuery({ queryKey: ["portal", "request", requestId, "replay"], queryFn: () => getRequestReplay(requestId) });
  const details = useQuery({ queryKey: ["portal", "request", requestId, "details"], queryFn: () => getRequestDetails(requestId) });
  const audit = useQuery({ queryKey: ["portal", "dispatch", requestId], queryFn: () => getDispatchAudit(requestId), enabled: tab === "dispatch" });
  useAdminEvents((_event, payload) => {
    const data = payload as { requestId?: number | string } | null;
    if (data && data.requestId != null && Number(data.requestId) !== requestId) return;
    void queryClient.invalidateQueries({ queryKey: ["portal", "request", requestId] });
  }, 1_500);

  const r = replay.data;
  const d = details.data;
  if (replay.isError) {
    return <Panel label={`Request ${requestId}`} title={`#${requestId}`} onClose={onClose} testId="request-panel"><div className="ap-pcol"><ErrorState error={replay.error} onRetry={() => void replay.refetch()} /></div></Panel>;
  }
  if (!r) return <Panel label={`Request ${requestId}`} title={`#${requestId}`} onClose={onClose} testId="request-panel"><div className="ap-pcol"><Loading height={360} label="Loading the request" /></div></Panel>;

  const live = !LIVE_DONE.has(r.phase);
  const state = statusOf(r.phase, r.status);
  const high = d?.request.priority === "High";
  const paid = ["paid", "completed"].includes(String(r.bill.paymentStatus || r.paymentStatus || "").toLowerCase());
  const vehicle = [d?.vehicle.model || r.vehicleModel, d?.vehicle.number].filter(Boolean).join(" · ");
  const sub = [r.customer.name, vehicle, r.address, dayAndTime(r.createdAt)].filter(Boolean).join(" · ");

  const markHigh = async () => {
    try {
      await markAdminRequestHighPriority({ requestId, note: "Marked from the request panel" });
      toast.success(`#${requestId} marked high priority`);
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not mark it.");
    }
  };

  return (
    <>
      <Panel label={`Request ${requestId}`} testId="request-panel" width={820} onClose={onClose}
        title={<>#{requestId} · {service(r.serviceType)}</>} badge={<Pill tone={state.tone}>{state.label}</Pill>} sub={sub}
        actions={<>
          {high ? <Pill tone="hot" icon="flag">High priority</Pill> : <Btn size="sm" icon="flag" onClick={() => void markHigh()}>Mark high priority</Btn>}
          {!live ? <Btn size="sm" icon="replay" onClick={() => navigate(`/admin/requests/${requestId}/replay`)}>Replay route</Btn> : null}
        </>}
        footNote="Every change is saved with your name"
        foot={<>
          {live ? <Btn icon="priority_high" onClick={() => setDialog("escalate")}>Escalate</Btn> : null}
          {live ? <Btn icon="cancel" onClick={() => setDialog("close")}>Close request</Btn> : null}
          {live ? <Btn icon="assignment_ind" onClick={() => setDialog("assign")}>Reassign</Btn> : null}
          {paid ? <Btn icon="currency_rupee" onClick={() => navigate(`/admin/payments?refund=${requestId}`)}>Refund</Btn> : null}
          <Btn variant="dark" icon="edit" disabled={paid} title={paid ? "The fare cannot change after payment" : undefined} onClick={() => setDialog("fare")}>Change fare</Btn>
        </>}
        strip={<div style={{ padding: "0 20px" }}><UnderTabs<Tab> label="Request" value={tab} onChange={setTab} items={[
          { key: "story", label: "What happened" },
          { key: "dispatch", label: "Who could take it", count: audit.data?.summary.total_technicians },
          { key: "payment", label: "Payment" },
        ]} /></div>}>
        {tab === "story" ? <Story r={r} d={d} onNote={() => void queryClient.invalidateQueries({ queryKey: ["portal", "request", requestId] })} /> : null}
        {tab === "dispatch" ? <Dispatch audit={audit.data} loading={audit.isLoading} error={audit.error} live={live} onAssign={() => setDialog("assign")} onWiden={async (km) => {
          try {
            await escalateCommandCenterJob({ requestId, radiusKm: km });
            toast.success(`Searching within ${km} km`);
            await audit.refetch();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not widen the search.");
          }
        }} /> : null}
        {tab === "payment" ? <PaymentChecks requestId={requestId} /> : null}
      </Panel>
      {dialog === "fare" ? <FareDialog requestId={requestId} fare={r.bill.total ?? r.fare} onClose={() => setDialog(null)} /> : null}
      {dialog === "close" ? <CloseDialog requestId={requestId} onClose={() => setDialog(null)} /> : null}
      {dialog === "escalate" ? <EscalateDialog requestId={requestId} onClose={() => setDialog(null)} /> : null}
      {dialog === "assign" ? <AssignDialog onClose={() => setDialog(null)} request={{ id: requestId, service: r.serviceType, customer: r.customer.name, address: r.address, technicianId: r.technician?.id ?? null, technicianName: r.technician?.name ?? null }} /> : null}
    </>
  );
}

function Story({ r, d, onNote }: { r: ReplayDetail; d: RequestDetails | undefined; onNote: () => void }) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const s = r.summary;
  const late = s.lateMinutes != null && s.lateMinutes > 0;
  const notes = r.timeline.filter((item) => item.kind === "admin_note");
  const photos = (d?.attachments || []).filter((file) => /^image\//.test(file.mimeType || "") || /photo|image|before|after/i.test(file.type));
  const fare = d?.fare;
  const total = r.bill.total ?? r.fare;
  const save = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await addRequestNote(r.id, note.trim());
      setNote("");
      toast.success("Note saved");
      onNote();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the note.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Strip items={[
        { label: "Arrived", value: s.arrivedAt ? clock(s.arrivedAt) : "—", tone: late ? "warn" : undefined, sub: s.arrivedAt ? (s.promisedAt ? `${late ? `${s.lateMinutes} min late` : "on time"} · promised ${clock(s.promisedAt)}` : "no promise recorded") : r.technician ? "not yet" : "no technician" },
        { label: "Work took", value: duration(s.workMinutes), sub: r.workStartedAt && r.completedAt ? `${clock(r.workStartedAt)} to ${clock(r.completedAt)}` : "—" },
        { label: "Fare", value: rupees(total), sub: [paymentMethod(r.bill.paymentMethod || r.paymentMethod), r.bill.paymentStatus || r.paymentStatus].filter((x) => x && x !== "—").join(", ") || "—" },
        { label: "Rating", value: s.rating != null ? `${s.rating} ★` : "—", sub: s.ratingComment ? `“${s.ratingComment.slice(0, 40)}”` : s.rating != null ? "no comment" : "not rated" },
      ]} />
      <div className="ap-pcols" style={{ gridTemplateColumns: "minmax(0, 1fr) 280px" }}>
        <div className="ap-pcol">
          <p className="ap-cap">What happened</p>
          <Timeline items={storyOf(r.timeline)} />
          {r.cancellationReason ? <Note tone="warn" icon="cancel">Cancelled: {r.cancellationReason}</Note> : null}
          <p className="ap-cap">Fare</p>
          <div className="ap-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <KV rows={fare ? fareLines(fare.breakdown) : []} total={["Customer pays", rupees(total)]} />
            {fare ? <KV rows={[["To the technician", rupees(fare.technicianEarnings)], ["ResQNow margin", rupees(fare.platformMargin)], ["GST", rupees(fare.tax)]]} /> : <Loading height={80} />}
          </div>
        </div>
        <div className="ap-pcol">
          <p className="ap-cap">People</p>
          <div className="rq-person">
            <span className="ap-who"><span className="ap-av" aria-hidden="true">{initials(r.customer.name)}</span><div><b>{r.customer.name}</b><span>{r.customer.phoneMasked || "No phone"}{r.customer.requestNumber ? ` · request ${r.customer.requestNumber}` : ""}</span></div></span>
            <div className="ap-acts">
              {r.customer.phone ? <a className="ap-btn is-sm" href={`tel:${r.customer.phone.replace(/\s+/g, "")}`}><Icon name="call" />Call</a> : null}
              {r.customer.id ? <Link className="ap-btn is-sm" to={`/admin/customers/${r.customer.id}`}><Icon name="person" />Profile</Link> : null}
            </div>
          </div>
          {r.technician ? (
            <div className="rq-person">
              <span className="ap-who"><span className="ap-av" aria-hidden="true">{initials(r.technician.name)}</span><div><b>{r.technician.name}</b><span>{r.technician.rating != null ? `★ ${r.technician.rating}` : "No rating"}{r.technician.jobsCompleted != null ? ` · ${r.technician.jobsCompleted} jobs` : ""}</span></div></span>
              <div className="ap-acts">
                {r.technician.phone ? <a className="ap-btn is-sm" href={`tel:${r.technician.phone.replace(/\s+/g, "")}`}><Icon name="call" />Call</a> : null}
                <Link className="ap-btn is-sm" to={`/admin/technicians/${r.technician.id}`}><Icon name="history" />Record</Link>
              </div>
            </div>
          ) : <p className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}>No technician yet</p>}
          <p className="ap-cap">Photos from the technician</p>
          {photos.length ? (
            <div className="rq-photos">
              {photos.map((file) => (
                <a key={file.id} className="ap-photo" href={fileUrl(file.url)} target="_blank" rel="noreferrer" style={{ backgroundImage: `url("${fileUrl(file.url)}")`, backgroundSize: "cover", backgroundPosition: "center", color: "#FFFFFF" }}>
                  <span style={{ marginTop: "auto", padding: "2px 6px", borderRadius: 6, background: "rgba(16,24,40,.6)" }}>{file.type.replace(/_/g, " ")} · {clock(file.createdAt)}</span>
                </a>
              ))}
            </div>
          ) : <p className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}>None sent</p>}
          <p className="ap-cap">Notes</p>
          {notes.map((item, index) => <div key={index} className="rq-noteby"><b>{item.actorId || "Admin"} · {clock(item.at)}</b>{item.description}</div>)}
          {d?.customer.notes ? <div className="rq-noteby"><b>From the customer</b>{d.customer.notes}</div> : null}
          <div className="ap-field"><textarea aria-label="New note" placeholder="Write a note for the team" value={note} onChange={(event) => setNote(event.target.value)} /></div>
          <div className="ap-row" style={{ justifyContent: "flex-end" }}><Btn size="sm" icon="edit_note" disabled={!note.trim() || saving} onClick={() => void save()}>{saving ? "Saving…" : "Add note"}</Btn></div>
        </div>
      </div>
    </>
  );
}

const OFFER: Record<string, [string, Tone]> = { accepted: ["Accepted", "ok"], declined: ["Declined", ""], expired: ["Missed", "warn"], pending: ["Waiting", "go"], cancelled: ["Withdrawn", ""] };

function Dispatch({ audit, loading, error, live, onAssign, onWiden }: { audit: DispatchAudit | undefined; loading: boolean; error: unknown; live: boolean; onAssign: () => void; onWiden: (km: number) => void }) {
  const [all, setAll] = useState(false);
  if (error) return <div className="ap-pcol"><ErrorState error={error} /></div>;
  if (loading || !audit) return <div className="ap-pcol"><Loading height={260} label="Checking every technician" /></div>;
  const offered = audit.technicians.filter((row) => row.dispatch_offer_status);
  const reasons = Object.entries(audit.summary.rejection_reason_counts || {}).sort((a, b) => b[1] - a[1]);
  const radius = Number((audit.criteria as { radiusKm?: unknown }).radiusKm);
  const rows = all ? audit.technicians : audit.technicians.slice(0, 12);
  const grid = "minmax(0,1.1fr) 76px minmax(0,1.4fr) 120px";
  return (
    <div className="ap-pcol" style={{ gap: 12 }} data-testid="dispatch-check">
      <div className="ap-strip" style={{ gridTemplateColumns: "repeat(4, minmax(0, 1fr))", border: "1px solid #EAECF0", borderRadius: 14, overflow: "hidden" }}>
        <div><span>Checked</span><b>{audit.summary.total_technicians}</b><small>every technician</small></div>
        <div><span>Can take it</span><b className="is-ok">{audit.summary.eligible_count}</b><small>{service(audit.request.service_type)}, near, on duty</small></div>
        <div><span>Offered</span><b>{offered.length}</b><small>{offered.filter((row) => row.dispatch_offer_status === "declined").length} declined, {offered.filter((row) => row.dispatch_offer_status === "expired").length} missed</small></div>
        <div><span>Search</span><b>{Number.isFinite(radius) && radius > 0 ? `${radius} km` : "Their range"}</b><small>{Number.isFinite(radius) && radius > 0 ? "set for this request" : "each technician's own"}</small></div>
      </div>
      <div className="ex-chips">
        <span className="is-ok"><b>{audit.summary.eligible_count}</b> can take it</span>
        {reasons.map(([code, n]) => <span key={code}><b>{n}</b> {dispatchReason(code)}</span>)}
      </div>
      <div className="ap-table" role="table" aria-label="Who could take it" style={{ borderRadius: 14, ["--ap-table-min" as string]: "560px" }}>
        <div className="ap-tr is-head" role="row" style={{ gridTemplateColumns: grid }}><span role="columnheader">Technician</span><span role="columnheader">Distance</span><span role="columnheader">Can take it?</span><span role="columnheader">Offer</span></div>
        {rows.map((row) => {
          const offer = row.dispatch_offer_status ? OFFER[row.dispatch_offer_status] || [row.dispatch_offer_status, ""] : null;
          return (
            <div key={row.technician_id} role="row" className="ap-tr is-tight" style={{ gridTemplateColumns: grid }}>
              <span role="cell" className="ap-who"><span className="ap-av is-sm" aria-hidden="true">{initials(row.name)}</span><div><b>{row.name || `#${row.technician_id}`}</b><span>{service(row.service_type)}</span></div></span>
              <span role="cell" className="ap-num">{row.distance_km == null ? "—" : `${row.distance_km} km`}</span>
              <span role="cell" className="ex-why">{row.eligible ? <span className="is-ok">Yes</span> : row.reject_reasons.map((code) => <span key={code}>{dispatchReason(code)}{code === "out_of_range" && row.service_area_range ? ` · works within ${row.service_area_range} km` : ""}</span>)}</span>
              <span role="cell">{offer ? <Pill tone={offer[1]}>{offer[0]}</Pill> : <span className="ap-faint">Not sent</span>}</span>
            </div>
          );
        })}
        <div className="ap-foot"><span>Showing {rows.length} of {audit.technicians.length} · those who can take it first, then nearest</span>{audit.technicians.length > 12 ? <Btn size="sm" onClick={() => setAll(!all)}>{all ? "Show fewer" : "Show all"}</Btn> : null}</div>
      </div>
      <p className="ad-hint"><Icon name="info" />The same check dispatch runs: approved, on duty, not busy, not hidden, has a location, does this service and this vehicle, and within range.</p>
      {live ? (
        <div className="ap-row" style={{ gap: 8, flexWrap: "wrap" }}>
          <Btn icon="zoom_out_map" onClick={() => onWiden(10)}>Look within 10 km</Btn>
          <Btn variant="dark" icon="assignment_ind" onClick={onAssign}>Assign a technician</Btn>
        </div>
      ) : null}
    </div>
  );
}

function useAction(requestId: number, onClose: () => void) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setError("");
    try {
      await action();
      toast.success(done);
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run, requestId };
}

function FareDialog({ requestId, fare, onClose }: { requestId: number; fare: number | null; onClose: () => void }) {
  const action = useAction(requestId, onClose);
  const [amount, setAmount] = useState(fare != null ? String(fare) : "");
  const [reason, setReason] = useState("");
  const value = Number(amount);
  const ok = amount.trim() !== "" && Number.isFinite(value) && value > 0 && reason.trim().length > 0;
  return (
    <Dialog label={`Change the fare for ${requestId}`} title={`Change the fare for #${requestId}`} sub="The customer sees the new fare in the app. Refused once a price has been agreed or paid." onClose={onClose} width={480} testId="fare-dialog"
      footNote="Saved with your name" foot={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="dark" icon="check" disabled={!ok || action.busy} onClick={() => void action.run(() => overrideAdminRequestPricing({ requestId, baseAmount: value, finalPrice: value, reason: reason.trim() }), `Fare for #${requestId} is now ${rupees(value)}`)}>Save the fare</Btn></>}>
      <div className="ap-field"><label htmlFor="fare-amount">New fare (₹)</label><input id="fare-amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))} /><small>Now {rupees(fare)}</small></div>
      <div className="ap-field"><label htmlFor="fare-reason">Why</label><input id="fare-reason" value={reason} placeholder="For example: a part was needed; the customer agreed" onChange={(event) => setReason(event.target.value)} /></div>
      {action.error ? <Note tone="bad" icon="error">{action.error}</Note> : null}
    </Dialog>
  );
}

function CloseDialog({ requestId, onClose }: { requestId: number; onClose: () => void }) {
  const action = useAction(requestId, onClose);
  const [status, setStatus] = useState<"cancelled" | "completed">("cancelled");
  const [reason, setReason] = useState("");
  return (
    <Dialog label={`Close request ${requestId}`} title={`Close #${requestId}?`} sub="The customer and the technician see the request end. Payments are updated to match." onClose={onClose} width={480} testId="close-dialog"
      footNote="Saved with your name" foot={<><Btn onClick={onClose}>Keep it open</Btn><Btn variant="hot" icon="cancel" disabled={!reason.trim() || action.busy} onClick={() => void action.run(() => closeAdminRequest({ requestId, status, reason: reason.trim() }), `#${requestId} closed as ${status}`)}>Close the request</Btn></>}>
      <Radio on={status === "cancelled"} name="close-as" onChange={() => setStatus("cancelled")}><b>Cancelled</b> · nothing more will happen</Radio>
      <Radio on={status === "completed"} name="close-as" onChange={() => setStatus("completed")}><b>Completed</b> · the work was done</Radio>
      <div className="ap-field"><label htmlFor="close-reason">Why</label><input id="close-reason" value={reason} placeholder="For example: a duplicate request" onChange={(event) => setReason(event.target.value)} /></div>
      {action.error ? <Note tone="bad" icon="error">{action.error}</Note> : null}
    </Dialog>
  );
}

function EscalateDialog({ requestId, onClose }: { requestId: number; onClose: () => void }) {
  const action = useAction(requestId, onClose);
  const [reason, setReason] = useState("");
  return (
    <Dialog label={`Escalate request ${requestId}`} title={`Escalate #${requestId}`} sub="Flags the request for the whole team and records why. It does not change who has the job." onClose={onClose} width={480} testId="escalate-dialog"
      footNote="Saved with your name" foot={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="dark" icon="priority_high" disabled={!reason.trim() || action.busy} onClick={() => void action.run(() => escalateAdminRequest({ requestId, reason: reason.trim() }), `#${requestId} escalated`)}>Escalate</Btn></>}>
      <div className="ap-field"><label htmlFor="escalate-reason">Why</label><input id="escalate-reason" value={reason} placeholder="For example: the customer called twice" onChange={(event) => setReason(event.target.value)} /></div>
      {action.error ? <Note tone="bad" icon="error">{action.error}</Note> : null}
    </Dialog>
  );
}
