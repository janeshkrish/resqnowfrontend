import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { addComplaintNote, assignComplaintTo, createComplaintEntry, getComplaint, getRequestDetails, listComplaints, resolveComplaintWith, type Complaint } from "../api/portalApi";
import { ago, clock, day, dayAndTime, rupees, service } from "../format";
import { Btn, Dialog, Empty, ErrorState, Icon, Loading, Note, Pill, Timeline, usePortalHeader, type Tone } from "../ui";

// Problems from customers and technicians, and who is looking after each one.

type Filter = "open" | "mine" | "resolved";
const SEVERITY: Record<string, [string, Tone]> = { critical: ["Critical", "bad"], high: ["High", "bad"], medium: ["Medium", "warn"], low: ["Low", ""] };
const severity = (value: string) => SEVERITY[value?.toLowerCase()] || [value || "—", ""];
const requestIn = (complaint: Complaint) => {
  const match = /#(\d{2,9})\b/.exec(`${complaint.title} ${complaint.description || ""}`);
  return match ? Number(match[1]) : null;
};
const who = (value: string | null | undefined) => (value ? value.split("@")[0] : "Nobody yet");

export default function ComplaintsPage() {
  usePortalHeader("Complaints", "Problems from customers and technicians, and who is looking after each one.");
  const params = useParams();
  const navigate = useNavigate();
  const { adminUser } = useAdminAuth();
  const me = adminUser?.email || "admin";
  const [filter, setFilter] = useState<Filter>("open");
  const [adding, setAdding] = useState(false);
  const list = useQuery({ queryKey: ["portal", "complaints"], queryFn: () => listComplaints(), refetchInterval: 60_000 });
  const all = list.data?.complaints || [];
  const open = all.filter((row) => row.status !== "resolved");
  const shown = (filter === "resolved" ? all.filter((row) => row.status === "resolved") : filter === "mine" ? open.filter((row) => row.assigned_admin_id === me) : open)
    .sort((a, b) => (filter === "resolved" ? Date.parse(b.updated_at || "") - Date.parse(a.updated_at || "") : Date.parse(a.created_at || "") - Date.parse(b.created_at || "")));
  const selectedId = params.complaintId ? Number(params.complaintId) : shown[0]?.id ?? null;
  if (list.isError) return <ErrorState error={list.error} onRetry={() => void list.refetch()} />;
  if (!list.data) return <Loading height={420} label="Loading complaints" />;
  return (
    <div className="sp-split" data-testid="complaints-page">
      <div className="sp-list">
        <div className="ap-row">
          <span className="ap-seg" role="radiogroup" aria-label="Complaints">
            {([["open", `Open · ${open.length}`], ["mine", `Mine · ${open.filter((row) => row.assigned_admin_id === me).length}`], ["resolved", "Resolved"]] as [Filter, string][]).map(([key, label]) => (
              <button key={key} type="button" role="radio" aria-checked={filter === key} className={filter === key ? "is-on" : undefined} onClick={() => { setFilter(key); navigate("/admin/complaints"); }}>{label}</button>
            ))}
          </span>
          <span className="ap-grow" />
          <Btn size="sm" variant="dark" icon="add" onClick={() => setAdding(true)}>New</Btn>
        </div>
        {shown.length === 0 ? <Empty icon="task_alt" title={filter === "resolved" ? "Nothing resolved yet" : "No open complaints"} /> : shown.map((row) => {
          const [label, tone] = severity(row.severity);
          const old = row.status !== "resolved" && row.created_at && Date.now() - Date.parse(row.created_at) > 86_400_000;
          return (
            <button key={row.id} type="button" className={`sp-li${row.id === selectedId ? " is-on" : ""}`} aria-label={row.title} onClick={() => navigate(`/admin/complaints/${row.id}`)}>
              <div className="sp-li-top"><Pill tone={tone}>{label}</Pill><b>{row.title}</b></div>
              <span>{row.description ? row.description.slice(0, 90) : `C-${row.id}`}</span>
              <div className="sp-li-bot"><span className={old ? "is-warn" : undefined}>{ago(row.created_at)}</span><span>{who(row.assigned_admin_id)}</span></div>
            </button>
          );
        })}
      </div>
      {selectedId ? <Detail key={selectedId} id={selectedId} me={me} /> : <Empty icon="support_agent" title="Pick a complaint" />}
      {adding ? <NewComplaint onClose={() => setAdding(false)} onAdded={(id) => { setAdding(false); setFilter("open"); navigate(`/admin/complaints/${id}`); }} /> : null}
    </div>
  );
}

function Detail({ id, me }: { id: number; me: string }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["portal", "complaint", id], queryFn: () => getComplaint(id) });
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [handing, setHanding] = useState(false);
  const [handTo, setHandTo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const complaint = query.data?.complaint;
  const requestId = complaint ? requestIn(complaint) : null;
  const request = useQuery({ queryKey: ["portal", "request", requestId, "details"], queryFn: () => getRequestDetails(requestId as number), enabled: requestId != null, retry: false });
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["portal", "complaint", id] });
    await queryClient.invalidateQueries({ queryKey: ["portal", "complaints"] });
    await queryClient.invalidateQueries({ queryKey: ["portal", "nav-counts"] });
  };
  const run = async (key: string, action: () => Promise<unknown>, done: string) => {
    setBusy(key);
    setError("");
    try {
      await action();
      toast.success(done);
      await refresh();
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That did not work.");
      return false;
    } finally {
      setBusy(null);
    }
  };
  if (query.isError) return <section className="sp-detail"><ErrorState error={query.error} onRetry={() => void query.refetch()} /></section>;
  if (!complaint) return <section className="sp-detail"><Loading height={360} /></section>;
  const [label, tone] = severity(complaint.severity);
  const resolved = complaint.status === "resolved";
  const updates = query.data?.updates || [];
  const r = request.data;
  return (
    <section className="sp-detail" aria-label="Complaint" data-testid="complaint">
      <div className="sp-dh">
        <div>
          <h2 className="pj">{complaint.title} <Pill tone={tone}>{label}</Pill>{resolved ? <Pill tone="ok">Resolved</Pill> : null}</h2>
          <span>C-{complaint.id} · logged by {who(complaint.created_by)} · {dayAndTime(complaint.created_at)}</span>
        </div>
        {!resolved ? (
          handing ? (
            <span className="ap-row" style={{ gap: 6 }}>
              <input className="ap-in" style={{ width: 170 }} aria-label="Hand to" placeholder="Name or email" value={handTo} onChange={(event) => setHandTo(event.target.value)} />
              <Btn size="sm" variant="dark" disabled={!handTo.trim() || busy != null} onClick={() => void run("assign", () => assignComplaintTo(id, handTo.trim(), `Handed to ${handTo.trim()}`), `Handed to ${handTo.trim()}`).then((ok) => { if (ok) { setHanding(false); setHandTo(""); } })}>Hand over</Btn>
              <Btn size="sm" onClick={() => setHanding(false)}>Cancel</Btn>
            </span>
          ) : (
            <span className="ap-row" style={{ gap: 6 }}>
              <span className="ap-faint" style={{ fontSize: 12.5, fontWeight: 700 }}>{complaint.assigned_admin_id ? `With ${who(complaint.assigned_admin_id)}` : "Nobody has it yet"}</span>
              {complaint.assigned_admin_id !== me ? <Btn size="sm" icon="person" disabled={busy != null} onClick={() => void run("take", () => assignComplaintTo(id, me, "Taken"), "It's yours now")}>Take it</Btn> : null}
              <Btn size="sm" icon="swap_horiz" onClick={() => setHanding(true)}>Hand over</Btn>
            </span>
          )
        ) : null}
      </div>
      <div className="sp-cols">
        <div className="sp-col">
          <p className="ap-cap">What was reported</p>
          <div className="sp-quote">{complaint.description || "No details were written down."}</div>
          <p className="ap-cap">What has happened</p>
          <Timeline items={updates.map((update) => ({
            time: `${day(update.created_at)} ${clock(update.created_at)}`, tone: update.update_type === "resolve" ? "ok" : update.update_type === "create" ? "" : "note",
            title: update.update_type === "create" ? `Logged by ${who(update.created_by)}` : update.update_type === "assign" ? `${update.note_text || "Handed over"}` : update.update_type === "resolve" ? `Resolved by ${who(update.created_by)}` : `Note by ${who(update.created_by)}`,
            sub: update.update_type === "create" || update.update_type === "assign" ? (update.update_type === "assign" ? `to ${who(String(update.metadata?.assignedAdminId || ""))}` : "") : update.note_text || "",
          }))} />
          {!resolved ? (
            <div className="sp-reply">
              <div className="ap-field"><textarea aria-label="Internal note" placeholder="Write a note for the team: who you called, what they said" value={note} onChange={(event) => setNote(event.target.value)} /></div>
              <div className="ap-row" style={{ justifyContent: "flex-end" }}><Btn size="sm" icon="lock" disabled={!note.trim() || busy != null} onClick={() => void run("note", () => addComplaintNote(id, note.trim()), "Note added").then((ok) => { if (ok) setNote(""); })}>Add internal note</Btn></div>
            </div>
          ) : null}
        </div>
        <div className="sp-col">
          <p className="ap-cap">The request</p>
          {requestId == null ? <p className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}>None linked. Write the request number, like #5486, in the details to link it.</p>
            : request.isError ? <p className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}>#{requestId} was not found.</p>
            : !r ? <Loading height={80} /> : (
              <>
                <div className="sp-req"><div><b>#{requestId} · {service(r.request.serviceType)}</b><span>{[r.vehicle.model, r.location.pickupAddress].filter(Boolean).join(" · ")}</span><span>{rupees(r.fare.total)} · {r.request.status}</span></div></div>
                <p className="ap-cap">People</p>
                <div className="sp-person"><span className="ap-who"><span className="ap-av is-sm" aria-hidden="true">{(r.customer.name || "C").slice(0, 2).toUpperCase()}</span><div><b>{r.customer.name || "Customer"}</b><span>customer</span></div></span>{r.customer.phone ? <a className="ap-btn is-icon is-sm" aria-label={`Call ${r.customer.name}`} href={`tel:${r.customer.phone}`}><Icon name="call" /></a> : null}</div>
                <p className="ap-cap">Put it right</p>
                <div className="sp-fix">
                  <Link className="ap-btn is-sm" to={`/admin/requests/${requestId}`}><Icon name="open_in_new" />Open the request</Link>
                  <Link className="ap-btn is-sm" to={`/admin/payments?refund=${requestId}`}><Icon name="currency_rupee" />Refund</Link>
                </div>
              </>
            )}
        </div>
      </div>
      {error ? <div style={{ padding: "0 20px 12px" }}><Note tone="bad" icon="error">{error}</Note></div> : null}
      {!resolved ? (
        <div className="sp-foot">
          <input className="ap-in" aria-label="How it was put right" placeholder="How it was put right" value={resolution} onChange={(event) => setResolution(event.target.value)} />
          <Btn variant="dark" icon="check" disabled={!resolution.trim() || busy != null} onClick={() => void run("resolve", () => resolveComplaintWith(id, resolution.trim()), "Complaint resolved")}>Resolve</Btn>
        </div>
      ) : null}
    </section>
  );
}

function NewComplaint({ onClose, onAdded }: { onClose: () => void; onAdded: (id: number) => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestNo, setRequestNo] = useState("");
  const [level, setLevel] = useState("medium");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const details = [requestNo.trim() ? `Request #${requestNo.replace(/\D/g, "")}.` : "", description.trim()].filter(Boolean).join(" ");
      const created = await createComplaintEntry({ title: title.trim(), description: details || undefined, severity: level });
      toast.success("Complaint logged");
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
      onAdded(created.complaintId);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not log it.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog label="New complaint" title="Log a complaint" sub="For problems told by phone, WhatsApp or in person." width={560} onClose={onClose} testId="new-complaint"
      footNote="Saved with your name" foot={<><Btn onClick={onClose}>Cancel</Btn><Btn variant="dark" icon="add" disabled={!title.trim() || busy} onClick={() => void save()}>{busy ? "Saving…" : "Log complaint"}</Btn></>}>
      <div className="ap-field"><label htmlFor="cp-title">What is the problem?</label><input id="cp-title" value={title} placeholder="For example: technician asked for ₹200 extra in cash" onChange={(event) => setTitle(event.target.value)} /></div>
      <div className="ad-row2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div className="ap-field"><label htmlFor="cp-request">Request number</label><input id="cp-request" inputMode="numeric" value={requestNo} placeholder="Optional, like 5486" onChange={(event) => setRequestNo(event.target.value)} /></div>
        <div className="ap-field"><label htmlFor="cp-level">How serious</label><select id="cp-level" value={level} onChange={(event) => setLevel(event.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></select></div>
      </div>
      <div className="ap-field"><label htmlFor="cp-details">Details</label><textarea id="cp-details" value={description} placeholder="Who told you, and what they said" onChange={(event) => setDescription(event.target.value)} /></div>
      {error ? <Note tone="bad" icon="error">{error}</Note> : null}
    </Dialog>
  );
}
