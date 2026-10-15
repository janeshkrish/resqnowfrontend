import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { addCustomerNote, getCustomer, type CustomerDetail } from "../api/portalApi";
import { EditCustomerDialog } from "../CustomerDialogs";
import { clock, dateLong, day, initials, paymentMethod, planName, rupees, service, vehicleLabel, vehiclePicture } from "../format";
import RequestPanel, { statusOf } from "../RequestPanel";
import { Btn, Card, Cell, Empty, ErrorState, Icon, Kpis, Loading, Pill, Row, Table, Two, UnderTabs, usePortalHeader } from "../ui";

type Tab = "overview" | "requests" | "payments" | "vehicles" | "notes";
const SIGN_IN: Record<CustomerDetail["signsInWith"], string> = { phone: "signs in with a phone code", email: "signs in with email and password", google: "signs in with Google" };

export default function CustomerPage() {
  const params = useParams();
  const id = Number(params.customerId);
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("overview");
  const [openId, setOpenId] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const query = useQuery({ queryKey: ["portal", "customer", id], queryFn: () => getCustomer(id), enabled: id > 0, refetchInterval: 60_000 });
  usePortalHeader("Customers", "Everyone who uses ResQNow.");
  if (!(id > 0)) return <Empty icon="error" title="That customer does not exist" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const c = query.data;
  if (!c) return <Loading height={360} label="Loading the customer" />;
  const name = c.name || c.email || `Customer ${c.id}`;
  return (
    <div className="adm-stack" data-testid="customer-page">
      <div className="pp-who">
        <span className="ap-av is-lg" aria-hidden="true">{initials(name)}</span>
        <div className="pp-id">
          <span className="pp-name">{name}{c.plan ? <Pill tone="dark" icon="workspace_premium">{planName(c.plan)}</Pill> : null}</span>
          <span className="pp-meta">
            {c.phoneMasked ? <span><Icon name="call" />{c.phoneMasked}</span> : null}
            {c.email ? <span><Icon name="mail" />{c.email}</span> : null}
            {c.joinedAt ? <span><Icon name="calendar_month" />joined {dateLong(c.joinedAt)}</span> : null}
            <span><Icon name="lock" />{SIGN_IN[c.signsInWith]}</span>
          </span>
        </div>
        <div className="pp-btns">
          {c.phone ? <a className="ap-btn" href={`tel:${c.phone.replace(/\s+/g, "")}`}><Icon name="call" />Call</a> : null}
          {c.phone ? <a className="ap-btn" href={`sms:${c.phone.replace(/\s+/g, "")}`}><Icon name="sms" />Message</a> : null}
          <Btn icon="edit" onClick={() => setEditing(true)}>Edit</Btn>
        </div>
      </div>
      {c.live ? (
        <div className="pp-livebar"><Icon name="radar" /><span>On a live request now: <b>#{c.live.id} {service(c.live.service)}</b>{c.live.technician ? ` · ${c.live.technician}` : " · finding a technician"}</span>
          <Btn size="sm" variant="dark" icon="monitoring" onClick={() => navigate(`/admin/live?open=${c.live?.id}`)}>Monitor</Btn></div>
      ) : null}
      <UnderTabs<Tab> label="Customer" value={tab} onChange={setTab} items={[
        { key: "overview", label: "Overview" }, { key: "requests", label: "Requests", count: c.totals.requests }, { key: "payments", label: "Payments", count: c.payments.length },
        { key: "vehicles", label: "Vehicles", count: c.vehicles.length }, { key: "notes", label: "Notes", count: c.notes.length },
      ]} />
      {tab === "overview" ? (
        <div className="pp-cols3">
          <div className="pp-colstack" style={{ gridColumn: "span 2" }}>
            <Kpis items={[
              { label: "Requests", value: c.totals.requests, note: c.live ? "1 live now" : `${c.totals.paidJobs} paid` , testId: "kpi-requests" },
              { label: "Spent", value: rupees(c.totals.spent), note: `${c.totals.paidJobs} paid job${c.totals.paidJobs === 1 ? "" : "s"}` },
              { label: "Cancelled", value: c.totals.cancelled, note: c.totals.cancelled ? "by them or the system" : "never", warn: c.totals.cancelled >= 3 },
              { label: "Rates technicians", value: c.totals.ratingGiven ?? "—", note: `${c.totals.ratings} rating${c.totals.ratings === 1 ? "" : "s"}` },
            ]} />
            <Requests c={c} onOpen={setOpenId} limit={5} />
            <Payments c={c} limit={5} />
          </div>
          <div className="pp-colstack">
            <Card title="Vehicles" aside={`${c.vehicles.length} saved`} style={{ gap: 10 }}><Vehicles c={c} /></Card>
            {c.plan ? <div className="pp-plan"><div><Icon name="workspace_premium" />{planName(c.plan)} member</div><span>Priority help and the plan's benefits apply to their requests.</span></div> : null}
            <Notes c={c} />
          </div>
        </div>
      ) : null}
      {tab === "requests" ? <Requests c={c} onOpen={setOpenId} /> : null}
      {tab === "payments" ? <Payments c={c} /> : null}
      {tab === "vehicles" ? <Card title="Vehicles" aside={`${c.vehicles.length} saved`}><Vehicles c={c} /></Card> : null}
      {tab === "notes" ? <Notes c={c} /> : null}
      {openId != null ? <RequestPanel requestId={openId} onClose={() => setOpenId(null)} /> : null}
      {editing ? <EditCustomerDialog customer={{ id: c.id, name: c.name, email: c.email, phoneMasked: c.phoneMasked, liveRequestId: c.live?.id ?? null }} onClose={() => setEditing(false)} onDeleted={() => navigate("/admin/customers")} /> : null}
    </div>
  );
}

function Requests({ c, onOpen, limit }: { c: CustomerDetail; onOpen: (id: number) => void; limit?: number }) {
  const rows = limit ? c.requests.slice(0, limit) : c.requests;
  const cols = "110px minmax(0,1fr) minmax(0,1fr) 80px 120px";
  if (!rows.length) return <Empty icon="receipt_long" title="No requests yet" />;
  return (
    <Table label={`${c.name || "Customer"}'s requests`} testId="customer-requests" cols={cols} minWidth={620} head={["Request", "Service", "Technician", { label: "Fare", right: true }, "Status"]}
      foot={limit && c.requests.length > limit ? <span>Showing {limit} of {c.requests.length} · see the Requests tab</span> : undefined}>
      {rows.map((row) => {
        const state = statusOf(row.phase, row.status);
        return (
          <Row key={row.id} cols={cols} label={`Request ${row.id}`} onClick={() => onOpen(row.id)}>
            <Cell><Two top={`#${row.id}`} bottom={row.createdAt ? `${day(row.createdAt)} ${clock(row.createdAt)}` : "—"} /></Cell>
            <Cell><Two top={service(row.service)} bottom={row.vehicleModel || vehicleLabel(row.vehicleType)} /></Cell>
            <Cell>{row.technician ? `${row.technician.name}${row.rating != null ? ` · ${row.rating} ★` : ""}` : <span className="ap-faint">None</span>}</Cell>
            <Cell right className="ap-num ap-strong">{rupees(row.fare)}</Cell>
            <Cell><Pill tone={state.tone}>{state.label}</Pill></Cell>
          </Row>
        );
      })}
    </Table>
  );
}

function Payments({ c, limit }: { c: CustomerDetail; limit?: number }) {
  const rows = limit ? c.payments.slice(0, limit) : c.payments;
  const cols = "110px minmax(0,1fr) minmax(0,1fr) 80px 120px";
  if (!rows.length) return <Empty icon="payments" title="No payments yet" />;
  return (
    <Table label={`${c.name || "Customer"}'s payments`} testId="customer-payments" cols={cols} minWidth={620} head={["Paid", "For", "How", { label: "Amount", right: true }, "State"]}>
      {rows.map((row) => (
        <Row key={row.id} cols={cols} tight>
          <Cell><Two top={day(row.at)} bottom={clock(row.at)} /></Cell>
          <Cell>{row.requestId ? `#${row.requestId}` : "—"}</Cell>
          <Cell><Two top={paymentMethod(row.method)} bottom={row.reference || ""} /></Cell>
          <Cell right className="ap-num ap-strong">{rupees(row.amount)}</Cell>
          <Cell>{row.refunded > 0 ? <Pill tone="warn">Refunded {rupees(row.refunded)}</Pill> : <Pill tone={["completed", "paid", "captured", "success"].includes(row.status.toLowerCase()) ? "ok" : ""}>{row.status}</Pill>}</Cell>
        </Row>
      ))}
    </Table>
  );
}

function Vehicles({ c }: { c: CustomerDetail }) {
  if (!c.vehicles.length) return <p className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}>None saved</p>;
  return <>{c.vehicles.map((vehicle) => (
    <div key={vehicle.id} className="pp-veh"><img src={vehiclePicture(vehicle.type)} alt="" /><div><b>{[vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicleLabel(vehicle.type)}</b><span>{[vehicle.plate, vehicleLabel(vehicle.type)].filter(Boolean).join(" · ")}</span></div></div>
  ))}</>;
}

function Notes({ c }: { c: CustomerDetail }) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await addCustomerNote(c.id, note.trim());
      setNote("");
      toast.success("Note saved");
      await queryClient.invalidateQueries({ queryKey: ["portal", "customer", c.id] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the note.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Card title="Notes" aside={`${c.notes.length}`} style={{ gap: 10 }} testId="customer-notes">
      <div className="ap-field"><textarea aria-label="New note" placeholder="Write a note for the team" value={note} onChange={(event) => setNote(event.target.value)} /></div>
      <div className="ap-row" style={{ justifyContent: "flex-end" }}><Btn size="sm" icon="add" disabled={!note.trim() || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save note"}</Btn></div>
      <div className="pp-notes">{c.notes.map((item) => <div key={item.id}><b>{item.by} · {day(item.at)}</b>{item.text}</div>)}</div>
    </Card>
  );
}
