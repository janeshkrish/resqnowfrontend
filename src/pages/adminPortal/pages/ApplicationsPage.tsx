import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { PricingRow, PricingTemplate as SignupTemplate } from "@/components/technician/DynamicPricingStep";
import { apiUrl } from "@/lib/api";
import { useAdminEvents } from "@/pages/adminExtended/monitor/adminLive";
import { filterSignupPricing, getSelectedSignupVehicleTypes, getSignupPricingError, SIGNUP_SERVICES, SIGNUP_VEHICLES } from "@/utils/technicianSignupPricing";
import { approveTechnician, getPriceMedians, getPricingTemplate, getTechnicianApprovalAudit, getTechnicianServicePricing, listAllTechniciansRaw, rejectTechnician } from "../api/portalApi";
import { ago, dateLong, dayAndTime, initials, rupees } from "../format";
import { Btn, Dialog, Empty, ErrorState, Icon, Loading, Note, Pill, usePortalHeader } from "../ui";

// People who want to join as technicians: check, call, then decide.

type Applicant = Record<string, unknown> & { id: string; name: string; status?: string; verification_status?: string; created_at?: string | null };
type Filter = "pending" | "approved" | "rejected";
const json = <T,>(value: unknown, fallback: T): T => {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value as T;
  try { return JSON.parse(String(value)) as T; } catch { return fallback; }
};
const text = (value: unknown) => (value == null ? "" : String(value).trim());
const statusOf = (row: Applicant): Filter => (row.verification_status === "verified" ? "approved" : row.verification_status === "rejected" ? "rejected" : "pending");
const servicesOf = (row: Applicant) => json<string[]>(row.specialties, []).map((id) => SIGNUP_SERVICES.find((item) => item.id === id)?.label || id);
const photoSrc = (value: string) => (!value ? "" : /^(https?:|blob:|data:)/.test(value) ? value : apiUrl(value));
const APPLICATION_EVENTS = ["admin:technician_audit_update", "admin:notification"];
const DOCS: [string, string][] = [["garage_front", "Shop front"], ["profile_photo", "Profile photo"], ["tools_photo", "Tools / bay"], ["facilities_photo", "Facilities"]];

export default function ApplicationsPage() {
  usePortalHeader("Applications", "People who want to join as technicians. Check, call, then decide.");
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>("pending");
  const all = useQuery({ queryKey: ["portal", "applications"], queryFn: async () => (await listAllTechniciansRaw()) as Applicant[], refetchInterval: 60_000 });
  useAdminEvents(() => void queryClient.invalidateQueries({ queryKey: ["portal", "applications"] }), 2_000, APPLICATION_EVENTS);
  const rows = useMemo(() => (Array.isArray(all.data) ? all.data : []), [all.data]);
  const counts = { pending: 0, approved: 0, rejected: 0 } as Record<Filter, number>;
  rows.forEach((row) => { counts[statusOf(row)] += 1; });
  const shown = rows.filter((row) => statusOf(row) === filter).sort((a, b) => filter === "pending" ? Date.parse(a.created_at || "") - Date.parse(b.created_at || "") : Date.parse(b.created_at || "") - Date.parse(a.created_at || "")).slice(0, 100);
  const selectedId = params.technicianId || shown[0]?.id || null;
  const selected = rows.find((row) => row.id === selectedId) || null;
  useEffect(() => {
    if (selected && statusOf(selected) !== filter) setFilter(statusOf(selected));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- follow the opened application's status once it loads
  }, [selected?.id]);

  if (all.isError) return <ErrorState error={all.error} onRetry={() => void all.refetch()} />;
  if (!all.data) return <Loading height={420} label="Loading applications" />;
  return (
    <div className="pp-split" data-testid="applications-page">
      <div className="pp-list">
        <div style={{ display: "flex" }}>
          <span className="ap-seg" role="radiogroup" aria-label="Applications">
            {(["pending", "approved", "rejected"] as Filter[]).map((key) => (
              <button key={key} type="button" role="radio" aria-checked={filter === key} className={filter === key ? "is-on" : undefined} onClick={() => { setFilter(key); navigate("/admin/applications"); }}>
                {key === "pending" ? "Waiting" : key === "approved" ? "Approved" : "Rejected"} · {counts[key]}
              </button>
            ))}
          </span>
        </div>
        {shown.length === 0 ? <Empty icon="how_to_reg" title={filter === "pending" ? "Nobody is waiting" : "None yet"} sub={filter === "pending" ? "New sign-ups from the app show up here." : undefined} /> : shown.map((row) => (
          <ListItem key={row.id} row={row} on={row.id === selected?.id} onOpen={() => navigate(`/admin/applications/${row.id}`)} />
        ))}
      </div>
      {selected ? <Detail key={selected.id} row={selected} onDone={(nextId) => navigate(nextId ? `/admin/applications/${nextId}` : "/admin/applications")}
        nextId={shown.find((row) => row.id !== selected.id)?.id || null} /> : <Empty icon="inbox" title="Pick an application" />}
    </div>
  );
}

function ListItem({ row, on, onOpen }: { row: Applicant; on: boolean; onOpen: () => void }) {
  const docs = json<Record<string, string>>(row.documents, {});
  const checks = [text(row.aadhaar_number).length === 12, row.latitude != null && row.longitude != null, DOCS.some(([key]) => docs[key])];
  const done = checks.filter(Boolean).length;
  const services = servicesOf(row);
  return (
    <button type="button" className={`pp-li${on ? " is-on" : ""}`} aria-current={on ? "true" : undefined} aria-label={text(row.name)} onClick={onOpen}>
      <div className="pp-li-top"><b>{text(row.name)}</b><span>{row.created_at ? `${ago(row.created_at)}` : ""}</span></div>
      <span>{[text(row.proprietor_name), services.join(", "), text(row.locality) || text(row.district)].filter(Boolean).join(" · ")}</span>
      {statusOf(row) === "pending" ? <div className="pp-meter"><div><i className={done === checks.length ? "is-ok" : "is-warn"} style={{ width: `${(done / checks.length) * 100}%` }} /></div>{done === checks.length ? "Ready to decide" : `${done} of ${checks.length} checks done`}</div> : null}
    </button>
  );
}

function Detail({ row, onDone, nextId }: { row: Applicant; onDone: (nextId: string | null) => void; nextId: string | null }) {
  const queryClient = useQueryClient();
  const id = Number(row.id);
  const status = statusOf(row);
  const template = useQuery({ queryKey: ["portal", "pricing-template"], queryFn: getPricingTemplate, staleTime: 10 * 60_000 });
  const medians = useQuery({ queryKey: ["portal", "price-medians"], queryFn: getPriceMedians, staleTime: 10 * 60_000 });
  const pricing = useQuery({ queryKey: ["portal", "tech-pricing", id], queryFn: () => getTechnicianServicePricing(id) });
  const audit = useQuery({ queryKey: ["portal", "tech-audit", id], queryFn: () => getTechnicianApprovalAudit(id) });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");

  const docs = json<Record<string, string>>(row.documents, {});
  const hours = json<{ is_24x7?: boolean; opening_time?: string; closing_time?: string; weekly_off?: string }>(row.working_hours, {});
  const app = json<{ has_smartphone?: boolean; preferred_language?: string }>(row.app_readiness, {});
  const pay = json<{ upi_id?: string; bank_name?: string; bank_account_number?: string }>(row.payment_details, {});
  const vehicles = getSelectedSignupVehicleTypes(json<Record<string, boolean>>(row.vehicle_types, {}));
  const specialties = json<string[]>(row.specialties, []);
  const rows: PricingRow[] = (Array.isArray(pricing.data) ? pricing.data : []).map((raw) => {
    const item = raw as Record<string, unknown>;
    return { service_id: Number(item.service_id), vehicle_category_id: Number(item.vehicle_category_id), vehicle_subcategory_id: item.vehicle_subcategory_id == null ? null : Number(item.vehicle_subcategory_id), pricing_json: json<Record<string, string | number>>(item.pricing_json, {}) };
  });
  const tpl = template.data as unknown as SignupTemplate | undefined;
  const pricingError = tpl ? getSignupPricingError(filterSignupPricing(rows, tpl, specialties, vehicles), tpl, specialties, vehicles) : null;
  const photos = DOCS.filter(([key]) => docs[key]).length;
  const aadhaar = text(row.aadhaar_number);
  const pinned = row.latitude != null && row.longitude != null;
  const checks: { icon: string; tone: "" | "is-warn" | "is-off"; title: string; sub: string }[] = [
    { icon: aadhaar.length === 12 ? "check_circle" : "error", tone: aadhaar.length === 12 ? "" : "is-warn", title: "Aadhaar number given", sub: aadhaar.length === 12 ? `•••• •••• ${aadhaar.slice(-4)}` : "missing" },
    { icon: pinned ? "check_circle" : "error", tone: pinned ? "" : "is-warn", title: "Shop pinned on the map", sub: pinned ? [text(row.locality), text(row.district)].filter(Boolean).join(", ") || `${row.latitude}, ${row.longitude}` : "no pin" },
    { icon: !pricing.data ? "pending" : pricingError ? "error" : "check_circle", tone: !pricing.data || pricingError ? "is-warn" : "", title: "Prices for every service and vehicle", sub: !pricing.data ? "loading" : pricingError || `${servicesOf(row).join(", ")} · ${vehicles.map((v) => SIGNUP_VEHICLES.find((item) => item.id === v)?.label || v).join(", ")}` },
    { icon: rows.length ? "check_circle" : "radio_button_unchecked", tone: rows.length ? "" : "is-off", title: "Agreements accepted", sub: rows.length ? "in the app, at sign-up" : "not recorded for older sign-ups" },
    { icon: photos ? "image" : "add_photo_alternate", tone: photos === 4 ? "" : "is-warn", title: "Shop photos", sub: `${photos} of 4 added` },
    { icon: text(row.gst_number) ? "check_circle" : "radio_button_unchecked", tone: text(row.gst_number) ? "" : "is-off", title: "GSTIN", sub: text(row.gst_number) || "not given · optional" },
  ];
  const priceLines = rows.flatMap((item) => {
    const service = tpl?.services.find((svc) => svc.id === item.service_id);
    const fields = tpl?.pricingFields.filter((field) => field.service_id === item.service_id) || [];
    return fields.filter((field) => item.pricing_json[field.field_key] !== "" && item.pricing_json[field.field_key] != null).map((field) => {
      const value = Number(item.pricing_json[field.field_key]);
      const usual = medians.data?.find((m) => m.serviceId === item.service_id && m.vehicleType === item.pricing_json.vehicle_type && m.subtype === item.pricing_json.vehicle_subtype && m.field === field.field_key);
      const km = /distance|free_km/i.test(field.field_key);
      const above = usual && usual.technicians >= 3 && value > usual.median * 1.15 ? Math.round((value / usual.median - 1) * 100) : null;
      return { key: `${item.service_id}-${item.pricing_json.vehicle_subtype}-${field.field_key}`, service: SIGNUP_SERVICES.find((svc) => svc.id === item.pricing_json.service_domain)?.label || service?.service_name || "", what: field.field_label, for: String(item.pricing_json.vehicle_subtype_label || ""), asks: km ? `${value} km` : rupees(value), usual: usual ? (km ? `${usual.median} km` : rupees(usual.median)) : "—", above };
    });
  });
  const high = priceLines.filter((line) => line.above != null);
  const decided = (Array.isArray(audit.data) ? audit.data : []) as { action: string; reason: string | null; admin_email: string | null; created_at: string }[];

  const decide = async (kind: "approve" | "reject") => {
    if (kind === "reject" && !note.trim()) { setError("Write the reason first. It is sent to the applicant."); return; }
    setBusy(kind);
    setError("");
    try {
      if (kind === "approve") await approveTechnician(id, note.trim() || "Documents checked");
      else await rejectTechnician(id, note.trim());
      toast.success(kind === "approve" ? `${text(row.name)} approved · they can take jobs now` : `${text(row.name)} rejected`);
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
      onDone(nextId);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "That did not work.");
    } finally {
      setBusy(null);
    }
  };
  const owner = text(row.proprietor_name);
  const grid = "minmax(0,1.5fr) 64px 64px 76px";
  return (
    <section className="pp-detail" aria-label="Application" data-testid="application">
      <div className="pp-dh">
        <span className="ap-av is-lg" aria-hidden="true">{initials(owner || text(row.name))}</span>
        <div>
          <h2 className="pj">{owner ? `${owner} · ` : ""}{text(row.name)}{status !== "pending" ? <Pill tone={status === "approved" ? "ok" : "bad"}>{status === "approved" ? "Approved" : "Rejected"}</Pill> : null}</h2>
          <span>
            <span><Icon name="build" />{servicesOf(row).join(", ") || "No services"}</span>
            <span><Icon name="location_on" />{[text(row.locality), text(row.district)].filter(Boolean).join(", ") || "—"}</span>
            <span><Icon name="workspace_premium" />{Number(row.experience) || 0} years</span>
            {row.created_at ? <span><Icon name="schedule" />applied {dayAndTime(row.created_at)}</span> : null}
          </span>
        </div>
        {text(row.phone) ? <a className="ap-btn" href={`tel:${text(row.phone).replace(/\s+/g, "")}`}><Icon name="call" />Call {owner.split(" ")[0] || ""}</a> : null}
      </div>
      <div className="pp-dbody">
        <div className="pp-sec">
          <p className="ap-cap">Checks</p>
          <div className="pp-check">{checks.map((check) => <div key={check.title} className={check.tone}><Icon name={check.icon} /><span>{check.title}</span><small>{check.sub}</small></div>)}</div>
          <p className="ap-cap" style={{ marginTop: 8 }}>How they will work</p>
          <div className="ap-facts">
            <div className="ap-fact"><span>Hours</span><b>{hours.is_24x7 ? "24 × 7" : hours.opening_time ? `${hours.opening_time} to ${hours.closing_time}${hours.weekly_off && hours.weekly_off !== "None" ? `, off ${hours.weekly_off}` : ", every day"}` : "Not set"}</b></div>
            <div className="ap-fact"><span>Area</span><b>Within {Number(row.serviceAreaRange) || 0} km{text(row.locality) ? ` of ${text(row.locality)}` : ""}</b></div>
            <div className="ap-fact"><span>Vehicles</span><b>{vehicles.map((v) => SIGNUP_VEHICLES.find((item) => item.id === v)?.label || v).join(", ") || "—"}</b></div>
            <div className="ap-fact"><span>App language</span><b>{app.preferred_language || "English"}</b></div>
            <div className="ap-fact"><span>Phone</span><b>{text(row.phone) || "—"}</b></div>
            <div className="ap-fact"><span>Payouts to</span><b>{pay.upi_id || pay.bank_name || "Cash only"}</b></div>
          </div>
          {decided.length ? <><p className="ap-cap" style={{ marginTop: 8 }}>Decisions</p>{decided.map((entry, index) => <p key={index} className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}><b className="ap-strong">{entry.action === "approved" ? "Approved" : entry.action === "rejected" ? "Rejected" : entry.action}</b> by {entry.admin_email || "admin"} · {dateLong(entry.created_at)}{entry.reason ? ` · “${entry.reason}”` : ""}</p>)}</> : null}
        </div>
        <div className="pp-sec">
          <p className="ap-cap">Shop photos</p>
          <div className="pp-docs">{DOCS.map(([key, label]) => docs[key] ? (
            <a key={key} className="ap-photo" href={photoSrc(docs[key])} target="_blank" rel="noreferrer" style={{ backgroundImage: `url("${photoSrc(docs[key])}")`, backgroundSize: "cover", backgroundPosition: "center", color: "#FFFFFF" }}><span style={{ marginTop: "auto", padding: "1px 6px", borderRadius: 6, background: "rgba(16,24,40,.6)" }}>{label}</span></a>
          ) : <div key={key} className="ap-photo" style={{ border: "1.5px dashed #D0D5DD", background: "#FCFCFD" }}><Icon name="add_photo_alternate" />{label}</div>)}</div>
          <p className="ap-cap" style={{ marginTop: 6 }}>Prices they asked for</p>
          {pricing.isLoading ? <Loading height={100} /> : priceLines.length === 0 ? <p className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}>No prices given</p> : (
            <div className="pp-prices">
              <div className="pp-mini is-head" style={{ gridTemplateColumns: grid }}><span>Service</span><span>For</span><span>Asks</span><span>City usual</span></div>
              {priceLines.slice(0, 12).map((line, index, shownLines) => (
                <div key={line.key} className="pp-mini" style={{ gridTemplateColumns: grid }}><span>{index === 0 || shownLines[index - 1].service !== line.service ? <b className="ap-strong">{line.service} · </b> : null}{line.what}</span><span>{line.for}</span><span className={`ap-num ${line.above != null ? "ap-warn" : "ap-strong"}`}>{line.asks}</span><span className="ap-num ap-faint">{line.usual}</span></div>
              ))}
              {priceLines.length > 12 ? <p className="ap-faint" style={{ fontSize: 12, fontWeight: 600 }}>and {priceLines.length - 12} more</p> : null}
            </div>
          )}
          {high.length ? <Note tone="warn"><b>{high.length} price{high.length === 1 ? " is" : "s are"} more than 15% above</b> the city usual, for example the {high[0].service.toLowerCase()} {high[0].what.toLowerCase()} for {high[0].for} ({high[0].above}% above). Worth asking before approving.</Note> : null}
        </div>
      </div>
      {error ? <div style={{ padding: "0 20px 12px" }}><Note tone="bad" icon="error">{error}</Note></div> : null}
      {status === "pending" ? (
        <div className="pp-dfoot">
          <input className="ap-in" aria-label="Note for the record" placeholder="Note for the record (sent to them if rejected)" value={note} onChange={(event) => setNote(event.target.value)} />
          <Btn variant="danger" disabled={busy != null} onClick={() => void decide("reject")}>{busy === "reject" ? "Rejecting…" : "Reject"}</Btn>
          <Btn icon="mail" onClick={() => setAsking(true)}>Ask for documents</Btn>
          <Btn variant="dark" icon="check" disabled={busy != null} onClick={() => void decide("approve")}>{busy === "approve" ? "Approving…" : "Approve"}</Btn>
        </div>
      ) : (
        <div className="pp-dfoot">
          <span className="ap-faint ap-grow" style={{ fontSize: 12.5, fontWeight: 700 }}>{status === "approved" ? "Approved technicians are managed under Technicians." : "Rejected applications stay here for the record."}</span>
          {status === "approved" ? <Link className="ap-btn is-dark" to={`/admin/technicians/${row.id}?tab=profile`}><Icon name="open_in_new" />Open their record</Link> : null}
        </div>
      )}
      {asking ? <AskDialog row={row} missing={[aadhaar.length !== 12 ? "your 12-digit Aadhaar number" : "", photos < 4 ? `shop photos (${4 - photos} missing)` : "", !text(row.gst_number) ? "your GST certificate, if you have one" : ""].filter(Boolean)} onClose={() => setAsking(false)} /> : null}
    </section>
  );
}

/** Pending applicants cannot sign in to the app yet, so the request goes by WhatsApp or SMS from the admin's phone. */
function AskDialog({ row, missing, onClose }: { row: Applicant; missing: string[]; onClose: () => void }) {
  const owner = text(row.proprietor_name) || text(row.name);
  const [message, setMessage] = useState(`Hello ${owner}, this is ResQNow. To finish your technician application, please send ${missing.length ? missing.join(", ") : "the remaining documents"}. Reply here or call us. Thank you.`);
  const digits = text(row.phone).replace(/\D/g, "");
  const number = digits.length === 10 ? `91${digits}` : digits;
  const copy = async () => {
    try { await navigator.clipboard.writeText(message); toast.success("Message copied"); } catch { toast.error("Could not copy. Select the text instead."); }
  };
  return (
    <Dialog label="Ask for documents" title={`Ask ${owner} for documents`} sub="They cannot sign in to the app until approved, so this goes by WhatsApp or SMS from your phone." width={560} onClose={onClose} testId="ask-dialog"
      foot={<>
        <Btn icon="content_copy" onClick={() => void copy()}>Copy message</Btn>
        {number ? <a className="ap-btn" href={`sms:+${number}?body=${encodeURIComponent(message)}`}><Icon name="sms" />SMS</a> : null}
        {number ? <a className="ap-btn is-dark" href={`https://wa.me/${number}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><Icon name="chat" />Open WhatsApp</a> : null}
      </>}>
      <div className="ap-field"><label htmlFor="ask-text">Message</label><textarea id="ask-text" value={message} onChange={(event) => setMessage(event.target.value)} /></div>
      <p className="ad-hint"><Icon name="info" />To {text(row.phone) || "no phone on file"}. Nothing is sent until you press send in WhatsApp or SMS.</p>
    </Dialog>
  );
}
