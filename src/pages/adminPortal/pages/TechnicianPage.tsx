import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { apiUrl } from "@/lib/api";
import { addAdminTechnicianNote, getAdminTechnicianLoginActivity, sendAdminTechnicianLoginReminder } from "@/pages/adminExtended/api/adminExtendedApi";
import { getTechnicianRecord } from "@/pages/adminExtended/api/adminMonitorApi";
import { useAdminEvents } from "@/pages/adminExtended/monitor/adminLive";
import RequestMonitorPanel from "@/pages/adminExtended/monitor/RequestMonitorPanel";
import { Jobs, Overview, Reliability, Reviews } from "@/pages/adminExtended/monitor/TechnicianRecordPage";
import {
  getPriceMedians, getPricingTemplate, getTechnicianApprovalAudit, getTechnicianNotes, getTechnicianPayouts, getTechnicianProfile, getTechnicianServicePricing,
  type PricingTemplate, type ServicePricingRow,
} from "../api/portalApi";
import { dateLong, day, duration, initials, rupees, service, servicePicture, vehicleLabel } from "../format";
import { DeleteTechnicianDialog, useVisibility } from "../TechnicianDialogs";
import { Btn, Card, Cell, Columns, Empty, ErrorState, Icon, Kpis, KV, Loading, Pill, Row, Switch, Table, Timeline, UnderTabs, usePortalHeader } from "../ui";

type TabKey = "overview" | "jobs" | "reliability" | "reviews" | "profile" | "pricing" | "payouts" | "activity";
const TAB_KEYS: TabKey[] = ["overview", "jobs", "reliability", "reviews", "profile", "pricing", "payouts", "activity"];
type Profile = Record<string, unknown>;

const json = <T,>(value: unknown, fallback: T): T => {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value as T;
  try { return JSON.parse(String(value)) as T; } catch { return fallback; }
};
const text = (value: unknown) => (value == null || value === "" ? null : String(value));
const fileUrl = (path: string | null) => (!path ? null : /^(https?:|blob:|data:)/.test(path) ? path : apiUrl(path));
const LANG_HOURS = (hours: { is_24x7?: boolean; opening_time?: string; closing_time?: string; weekly_off?: string }) =>
  hours.is_24x7 ? "24 × 7" : hours.opening_time && hours.closing_time ? `${hours.opening_time} to ${hours.closing_time}${hours.weekly_off && hours.weekly_off !== "None" ? ` · off on ${hours.weekly_off}` : ""}` : "Not set";

export default function TechnicianPage() {
  const params = useParams();
  const technicianId = Number(params.technicianId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useSearchParams();
  const tab: TabKey = TAB_KEYS.includes(search.get("tab") as TabKey) ? (search.get("tab") as TabKey) : "overview";
  const setTab = (next: string) => setSearch((current) => { const copy = new URLSearchParams(current); copy.set("tab", next); return copy; }, { replace: true });
  const [openId, setOpenId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const visibility = useVisibility();

  const valid = Number.isInteger(technicianId) && technicianId > 0;
  const record = useQuery({ queryKey: ["admin", "monitor", "tech", technicianId], queryFn: () => getTechnicianRecord(technicianId), enabled: valid, refetchInterval: 60_000 });
  const profile = useQuery({ queryKey: ["portal", "tech-profile", technicianId], queryFn: () => getTechnicianProfile(technicianId), enabled: valid });
  useAdminEvents(() => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "monitor", "tech"] });
    void queryClient.invalidateQueries({ queryKey: ["portal", "tech-profile", technicianId] });
  }, 5_000);

  const data = record.data;
  const t = data?.technician;
  const p = profile.data;
  const hidden = Boolean(p?.admin_hidden);
  usePortalHeader("Technicians", "Every partner's jobs, reliability, reviews and details in one place.");

  if (!valid) return <Empty icon="error" title="That technician does not exist" />;
  if (record.isError) return <ErrorState error={record.error} onRetry={() => void record.refetch()} />;
  if (!data || !t) return <Loading height={320} label="Loading the technician" />;

  const tabs = [
    { key: "overview" as const, label: "Overview" },
    { key: "jobs" as const, label: "Jobs", count: data.kpis.jobsCompleted },
    { key: "reliability" as const, label: "Cancellations and delays", count: data.kpis.removedByAdmin + data.kpis.customerCancelledAfterAccepting },
    { key: "reviews" as const, label: "Reviews", count: data.kpis.ratingCount },
    { key: "profile" as const, label: "Profile and documents" },
    { key: "pricing" as const, label: "Services and prices" },
    { key: "payouts" as const, label: "Payouts" },
    { key: "activity" as const, label: "Log-in activity" },
  ];
  const owner = text(p?.proprietor_name);
  return (
    <div className="adm-stack" data-testid="technician-page">
      <div className="pp-who">
        <span className="ap-av is-lg" aria-hidden="true">{initials(t.name)}</span>
        <div className="pp-id">
          <span className="pp-name">{t.name}{owner ? ` · ${owner}` : ""}{t.status === "approved" ? <Icon name="verified" /> : null}{hidden ? <Pill tone="warn" icon="visibility_off">Hidden</Pill> : null}</span>
          <span className="pp-meta">
            <span className={t.onDuty ? "pp-duty" : "ap-faint"}>{t.onDuty ? <i aria-hidden="true" /> : null}{t.onDuty ? (t.currentRequestId ? `On duty · on job #${t.currentRequestId}` : "On duty · free") : "Off duty"}</span>
            {t.serviceType ? <span><Icon name="build" />{service(t.serviceType)}</span> : null}
            {t.place ? <span><Icon name="location_on" />{t.place}</span> : null}
            {t.joinedAt ? <span><Icon name="calendar_month" />Joined {dateLong(t.joinedAt)}</span> : null}
            {t.phoneMasked ? <span><Icon name="call" />{t.phoneMasked}</span> : null}
          </span>
        </div>
        <div className="pp-btns">
          {t.currentRequestId ? <Btn icon="monitoring" onClick={() => setOpenId(t.currentRequestId)}>Live job</Btn> : null}
          {t.phone ? <a className="ap-btn" href={`tel:${t.phone.replace(/\s+/g, "")}`}><Icon name="call" />Call</a> : null}
          <Btn icon="edit" onClick={() => navigate(`/admin/technicians/${technicianId}/edit`)}>Edit</Btn>
          <Btn icon={hidden ? "visibility" : "visibility_off"} disabled={visibility.busy || !p} onClick={() => void visibility.set(technicianId, t.name, hidden)}>{hidden ? "Show again" : "Hide from new jobs"}</Btn>
        </div>
      </div>
      <UnderTabs label="Technician record" items={tabs} value={tab} onChange={setTab} />
      {tab === "overview" ? <section className="at"><Overview record={data} go={(next) => setTab(next)} /></section> : null}
      {tab === "jobs" ? <section className="at"><Jobs technicianId={technicianId} onOpen={setOpenId} /></section> : null}
      {tab === "reliability" ? <section className="at"><Reliability record={data} onOpen={setOpenId} /></section> : null}
      {tab === "reviews" ? <section className="at"><Reviews record={data} technicianId={technicianId} /></section> : null}
      {tab === "profile" ? (p ? <ProfileTab technicianId={technicianId} profile={p} onDelete={() => setDeleting(true)} /> : profile.isError ? <ErrorState error={profile.error} onRetry={() => void profile.refetch()} /> : <Loading height={320} />) : null}
      {tab === "pricing" ? <PricingTab technicianId={technicianId} profile={p} /> : null}
      {tab === "payouts" ? <PayoutsTab technicianId={technicianId} /> : null}
      {tab === "activity" ? <ActivityTab technicianId={technicianId} name={t.name} /> : null}
      {openId != null ? <RequestMonitorPanel requestId={openId} onClose={() => setOpenId(null)} /> : null}
      {deleting ? <DeleteTechnicianDialog technician={{ id: technicianId, name: t.name, onJob: Boolean(t.currentRequestId), dues: data.kpis.duesOwed }} onClose={() => setDeleting(false)}
        onDeleted={() => { void queryClient.invalidateQueries({ queryKey: ["portal"] }); navigate("/admin/technicians"); }} /> : null}
    </div>
  );
}

function ProfileTab({ technicianId, profile, onDelete }: { technicianId: number; profile: Profile; onDelete: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const visibility = useVisibility();
  const audit = useQuery({ queryKey: ["portal", "tech-audit", technicianId], queryFn: () => getTechnicianApprovalAudit(technicianId) });
  const notes = useQuery({ queryKey: ["portal", "tech-notes", technicianId], queryFn: () => getTechnicianNotes(technicianId) });
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const docs = json<Record<string, string>>(profile.documents, {});
  const pay = json<{ modes?: Record<string, boolean>; upi_id?: string; bank_name?: string; bank_account_number?: string; ifsc_code?: string }>(profile.payment_details, {});
  const hours = json<{ is_24x7?: boolean; opening_time?: string; closing_time?: string; weekly_off?: string }>(profile.working_hours, {});
  const app = json<{ preferred_language?: string }>(profile.app_readiness, {});
  const costs = json<Array<{ towing_fleet_types?: string[] }>>(profile.service_costs, []);
  const fleet = [...new Set((Array.isArray(costs) ? costs : []).flatMap((entry) => entry?.towing_fleet_types || []))];
  const FLEET: Record<string, [string, string]> = { flatbed: ["Flatbed Trucks", "For luxury and damaged cars"], "wheel-lift": ["Front-Lift / Wheel-Lift Trucks", "For rapid urban towing"], "heavy-duty-wrecker": ["Heavy-Duty Wreckers", "For commercial vehicles"] };
  const aadhaar = text(profile.aadhaar_number);
  const photos: [string, string][] = [["garage_front", "Shop front"], ["profile_photo", "Profile photo"], ["tools_photo", "Tools / bay"], ["facilities_photo", "Facilities"]];
  const auditRows = Array.isArray(audit.data) ? (audit.data as { action: string; reason: string | null; admin_email: string | null; created_at: string }[]) : [];
  const hidden = Boolean(profile.admin_hidden);
  const address = [profile.address, profile.locality, profile.district, profile.state].map(text).filter(Boolean).join(", ");
  const saveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await addAdminTechnicianNote({ technicianId, note: note.trim() });
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["portal", "tech-notes", technicianId] });
      toast.success("Note saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the note.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="pp-cols3" data-testid="tech-profile">
      <div className="pp-colstack">
        <Card title="Business" aside={<Btn size="sm" icon="edit" onClick={() => navigate(`/admin/technicians/${technicianId}/edit`)}>Edit</Btn>}>
          <div className="ap-facts">
            <div className="ap-fact"><span>Owner</span><b>{text(profile.proprietor_name) || "—"}</b></div>
            <div className="ap-fact"><span>Experience</span><b>{profile.experience != null ? `${profile.experience} years` : "—"}</b></div>
            <div className="ap-fact" style={{ gridColumn: "span 2" }}><span>Address</span><b>{address || "—"}</b></div>
            <div className="ap-fact"><span>Working hours</span><b>{LANG_HOURS(hours)}</b></div>
            <div className="ap-fact"><span>App language</span><b>{app.preferred_language || "—"}</b></div>
            <div className="ap-fact"><span>Range</span><b>{profile.serviceAreaRange != null ? `${profile.serviceAreaRange} km` : "—"}</b></div>
            <div className="ap-fact"><span>Shop pin</span><b>{profile.latitude != null && profile.longitude != null ? `${Number(profile.latitude).toFixed(4)}, ${Number(profile.longitude).toFixed(4)}` : "Not set"}</b></div>
          </div>
          {profile.latitude == null ? <div className="ap-note is-warn"><Icon name="location_off" /><span>No shop location: dispatch cannot offer jobs until a pin is set in Edit.</span></div> : null}
        </Card>
        {fleet.length ? (
          <Card title="Tow truck fleet" aside="from sign-up">
            {fleet.map((key) => (
              <div key={key} className="pp-truck"><img src={servicePicture("towing") || ""} alt="" /><div><b>{FLEET[key]?.[0] || key}</b><span>{FLEET[key]?.[1] || ""}</span></div></div>
            ))}
          </Card>
        ) : null}
      </div>
      <div className="pp-colstack">
        <Card title="Identity">
          <div className="pp-doc"><Icon name="badge" /><div><b>Aadhaar number</b><span>{aadhaar ? `•••• •••• ${aadhaar.slice(-4)} · given at sign-up` : "Not given"}</span></div></div>
          <div className={`pp-doc${text(profile.gst_number) ? "" : " is-off"}`}><Icon name={text(profile.gst_number) ? "receipt_long" : "radio_button_unchecked"} /><div><b>GSTIN</b><span>{text(profile.gst_number) || "Not given · optional"}</span></div></div>
        </Card>
        <Card title="Shop photos" aside={`${photos.filter(([key]) => docs[key]).length} of 4 · from sign-up`}>
          <div className="pp-shots">
            {photos.map(([key, label]) => {
              const src = fileUrl(docs[key] || null);
              return src ? (
                <a key={key} className="pp-shot" href={src} target="_blank" rel="noreferrer" style={{ backgroundImage: `url("${src}")`, backgroundSize: "cover", backgroundPosition: "center" }}><span>{label}</span></a>
              ) : <div key={key} className="pp-shot is-empty"><Icon name="add_photo_alternate" /><span>{label}</span></div>;
            })}
          </div>
        </Card>
        <Card title="Payouts go to">
          <KV rows={[
            ["UPI", pay.upi_id || text(profile.upi_id) || "Not given"],
            ["Bank", pay.bank_name ? `${pay.bank_name}${pay.bank_account_number ? ` ••${String(pay.bank_account_number).slice(-4)}` : ""}` : "Not given"],
            ["IFSC", pay.ifsc_code || "—"],
            ["Takes", Object.entries(pay.modes || {}).filter(([, on]) => on).map(([mode]) => (mode === "upi" ? "UPI" : mode[0].toUpperCase() + mode.slice(1))).join(", ") || "—"],
          ]} />
        </Card>
      </div>
      <div className="pp-colstack">
        <Card title="Approval">
          {audit.isLoading ? <Loading height={80} /> : auditRows.length ? (
            <Timeline items={auditRows.map((row) => ({ time: day(row.created_at), tone: row.action === "approved" ? "ok" : row.action === "rejected" ? "bad" : "", title: `${row.action[0].toUpperCase()}${row.action.slice(1)}${row.admin_email ? ` by ${row.admin_email}` : ""}`, sub: row.reason || undefined }))} />
          ) : <p className="ap-faint" style={{ fontSize: 13, fontWeight: 600 }}>No approval history recorded.</p>}
        </Card>
        <Card title="Admin notes">
          <div className="ap-field"><textarea aria-label="New note" placeholder="Write a note for the team" value={note} onChange={(event) => setNote(event.target.value)} /></div>
          <div className="ap-row"><span className="ap-grow" /><Btn size="sm" icon="add" disabled={!note.trim() || saving} onClick={() => void saveNote()}>Save note</Btn></div>
          <div className="pp-notes">
            {(notes.data || []).filter((row) => row.noteType !== "visibility").slice(0, 6).map((row) => <div key={row.id}><b>{row.adminId} · {day(row.createdAt)}</b>{row.note}</div>)}
          </div>
        </Card>
        <Card>
          <div className="pp-toggle"><div>Shown to customers<span>Gets new job offers while on duty</span></div><Switch on={!hidden} label="Shown to customers" disabled={visibility.busy} onChange={(on) => void visibility.set(technicianId, String(profile.name || "Technician"), on)} /></div>
          <div className="ap-row"><span className="ap-faint ap-grow" style={{ fontSize: 12, fontWeight: 600 }}>Removes the account for good.</span><Btn size="sm" variant="danger" icon="delete" onClick={onDelete}>Delete technician</Btn></div>
        </Card>
      </div>
    </div>
  );
}

const rowJson = (row: ServicePricingRow) => (typeof row.pricing_json === "string" ? json<Record<string, string | number>>(row.pricing_json, {}) : row.pricing_json || {});
const isDistance = (key: string) => /distance|free_km/i.test(key);

function PricingTab({ technicianId, profile }: { technicianId: number; profile: Profile | undefined }) {
  const navigate = useNavigate();
  const rows = useQuery({ queryKey: ["portal", "tech-pricing", technicianId], queryFn: () => getTechnicianServicePricing(technicianId) });
  const template = useQuery({ queryKey: ["portal", "pricing-template"], queryFn: getPricingTemplate, staleTime: 10 * 60_000 });
  const medians = useQuery({ queryKey: ["portal", "price-medians"], queryFn: getPriceMedians, staleTime: 5 * 60_000 });
  const groups = useMemo(() => groupPricing((rows.data || []) as ServicePricingRow[], template.data), [rows.data, template.data]);
  if (rows.isError) return <ErrorState error={rows.error} onRetry={() => void rows.refetch()} />;
  if (rows.isLoading || template.isLoading) return <Loading height={300} />;
  const median = (serviceId: number, vehicle: string, subtype: string, field: string) =>
    medians.data?.find((item) => item.serviceId === serviceId && item.vehicleType === vehicle && item.subtype === subtype && item.field === field);
  const specialties = json<string[]>(profile?.specialties, []);
  return (
    <div className="adm-stack" data-testid="tech-pricing">
      <div className="ap-bar">
        <span className="ap-faint" style={{ fontSize: 13, fontWeight: 600 }}>Prices per service, vehicle and type, next to the middle price of approved technicians.</span>
        <Btn variant="dark" icon="edit" onClick={() => navigate(`/admin/technicians/${technicianId}/edit?step=pricing`)}>Edit prices</Btn>
      </div>
      {!groups.length ? (
        <Empty icon="sell" title="No type-by-type prices yet" sub={specialties.length ? `Services on file: ${specialties.map((s) => service(s)).join(", ")}. Open Edit prices to set them as the sign-up form does.` : "Open Edit prices to set them."} />
      ) : groups.map((group) => (
        <Card key={group.serviceId} title={<span className="ap-row" style={{ gap: 10 }}>{servicePicture(group.domain) ? <img src={servicePicture(group.domain) || ""} alt="" style={{ width: 36, height: 36, objectFit: "contain" }} /> : null}{service(group.domain)}</span>} aside={`${group.vehicles.length} vehicle type${group.vehicles.length === 1 ? "" : "s"}`}>
          {group.vehicles.map((vehicle) => {
            const cols = `150px ${group.fields.map(() => "minmax(0,1fr)").join(" ")}`;
            return (
              <div key={vehicle.key} className="adm-stack" style={{ gap: 6 }}>
                <p className="ap-cap">{vehicleLabel(vehicle.key)}</p>
                <Table label={`${service(group.domain)} prices for ${vehicleLabel(vehicle.key)}`} cols={cols} head={["Type", ...group.fields.map((field) => field.label)]} minWidth={700}>
                  {vehicle.rows.map((row) => (
                    <Row key={row.subtype} cols={cols} tight>
                      <Cell className="ap-strong">{row.label}</Cell>
                      {group.fields.map((field) => {
                        const value = row.values[field.key];
                        const mid = median(group.serviceId, vehicle.key, row.subtype, field.key);
                        const high = value != null && mid && mid.technicians >= 3 && Number(value) > mid.median * 1.15;
                        return (
                          <Cell key={field.key}>
                            <span className="ap-two"><b className={high ? "ap-warn" : undefined}>{value == null || value === "" ? "—" : isDistance(field.key) ? `${value} km` : rupees(Number(value))}</b>
                              <span>{mid && mid.technicians >= 3 ? `usual ${isDistance(field.key) ? `${mid.median} km` : rupees(mid.median)}` : ""}</span></span>
                          </Cell>
                        );
                      })}
                    </Row>
                  ))}
                </Table>
              </div>
            );
          })}
        </Card>
      ))}
    </div>
  );
}

function groupPricing(rows: ServicePricingRow[], template: PricingTemplate | undefined) {
  if (!template) return [];
  const byService = new Map<number, { serviceId: number; domain: string; fields: { key: string; label: string }[]; vehicles: Map<string, { key: string; rows: { subtype: string; label: string; values: Record<string, string | number> }[] }> }>();
  for (const row of rows) {
    const svc = template.services.find((item) => Number(item.id) === Number(row.service_id));
    if (!svc) continue;
    const pricing = rowJson(row);
    if (!byService.has(svc.id)) {
      const fields = template.pricingFields.filter((field) => Number(field.service_id) === Number(svc.id)).map((field) => ({ key: field.field_key, label: field.field_label }));
      byService.set(svc.id, { serviceId: svc.id, domain: String(pricing.service_domain || svc.service_slug || svc.service_name), fields, vehicles: new Map() });
    }
    const group = byService.get(svc.id)!;
    const vehicleKey = String(pricing.vehicle_type || template.categories.find((item) => Number(item.id) === Number(row.vehicle_category_id))?.category_name || "").toLowerCase();
    if (!group.vehicles.has(vehicleKey)) group.vehicles.set(vehicleKey, { key: vehicleKey, rows: [] });
    group.vehicles.get(vehicleKey)!.rows.push({ subtype: String(pricing.vehicle_subtype || ""), label: String(pricing.vehicle_subtype_label || pricing.vehicle_subtype || "Any"), values: pricing });
  }
  return [...byService.values()].map((group) => ({ ...group, vehicles: [...group.vehicles.values()] }));
}

function PayoutsTab({ technicianId }: { technicianId: number }) {
  const payouts = useQuery({ queryKey: ["portal", "tech-payouts", technicianId], queryFn: () => getTechnicianPayouts(technicianId) });
  if (payouts.isError) return <ErrorState error={payouts.error} onRetry={() => void payouts.refetch()} />;
  if (!payouts.data) return <Loading height={300} />;
  const { wallet, requests, payouts: paid, dues } = payouts.data;
  const pendingDues = dues.filter((row) => row.status === "pending").reduce((total, row) => total + row.amount, 0);
  return (
    <div className="adm-stack" data-testid="tech-payouts">
      <Kpis items={[
        { label: "Can withdraw now", value: rupees(wallet.withdrawable), note: wallet.lastActivityAt ? `last change ${day(wallet.lastActivityAt)}` : "no activity yet" },
        { label: "On hold", value: rupees(wallet.onHold), note: "held for checks" },
        { label: "Earned in all", value: rupees(wallet.totalEarned), note: `${rupees(wallet.paidOut)} paid out` },
        { label: "Cash dues to ResQNow", value: rupees(pendingDues), note: pendingDues ? "taken from the next payout" : "nothing owed", warn: pendingDues >= 1000 },
      ]} />
      <Table label="Withdrawal requests" cols="110px 100px minmax(0,1fr) 120px minmax(0,1fr)" head={["Asked", { label: "Amount", right: true }, "UPI", "State", "UTR or reason"]} minWidth={640}
        foot={<span>{requests.length ? `${requests.length} request${requests.length === 1 ? "" : "s"}` : "No withdrawal requests yet"}</span>}>
        {requests.map((row) => (
          <Row key={row.id} cols="110px 100px minmax(0,1fr) 120px minmax(0,1fr)" tight>
            <Cell className="ap-faint">{day(row.at)}</Cell>
            <Cell right className="ap-num ap-strong">{rupees(row.amount)}</Cell>
            <Cell>{row.upi || "—"}</Cell>
            <Cell><Pill tone={row.status === "paid" ? "ok" : row.status === "rejected" || row.status === "cancelled" ? "bad" : "warn"}>{row.status}</Pill></Cell>
            <Cell className="ap-faint">{row.utr || row.reason || "—"}</Cell>
          </Row>
        ))}
      </Table>
      <Table label="Payouts" cols="110px 100px 110px minmax(0,1fr) 110px" head={["Paid", { label: "Amount", right: true }, "How", "UTR", "State"]} minWidth={600}
        foot={<span>{paid.length ? `${paid.length} payout${paid.length === 1 ? "" : "s"}` : "No payouts yet"}</span>}>
        {paid.map((row) => (
          <Row key={row.id} cols="110px 100px 110px minmax(0,1fr) 110px" tight>
            <Cell className="ap-faint">{day(row.at)}</Cell>
            <Cell right className="ap-num ap-strong">{rupees(row.amount)}</Cell>
            <Cell>{row.method || "—"}</Cell>
            <Cell className="ap-num">{row.utr || "—"}</Cell>
            <Cell><Pill tone={row.status === "paid" ? "ok" : "warn"}>{row.status}</Pill></Cell>
          </Row>
        ))}
      </Table>
    </div>
  );
}

function ActivityTab({ technicianId, name }: { technicianId: number; name: string }) {
  const activity = useQuery({ queryKey: ["portal", "tech-activity", technicianId], queryFn: () => getAdminTechnicianLoginActivity(technicianId, { sessionLimit: 200, alertLimit: 30 }), refetchInterval: 60_000 });
  const [sending, setSending] = useState(false);
  if (activity.isError) return <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />;
  if (!activity.data) return <Loading height={300} />;
  const { technician, sessions, alerts } = activity.data;
  const now = Date.now();
  const dayKey = (ms: number) => new Date(ms + 330 * 60_000).toISOString().slice(0, 10);
  const days = Array.from({ length: 14 }, (_, index) => dayKey(now - (13 - index) * 86_400_000));
  const hoursByDay = new Map<string, number>(days.map((key) => [key, 0]));
  let lastSeven = 0;
  for (const session of sessions) {
    const start = Date.parse(session.loginAt || "");
    if (!Number.isFinite(start)) continue;
    const end = session.logoutAt ? Date.parse(session.logoutAt) : session.isActive ? now : Date.parse(session.lastSeenAt || session.loginAt || "");
    const hours = Math.max(0, (end - start) / 3_600_000);
    const key = dayKey(start);
    if (hoursByDay.has(key)) hoursByDay.set(key, (hoursByDay.get(key) || 0) + hours);
    if (start >= now - 7 * 86_400_000) lastSeven += hours;
  }
  const values = days.map((key) => Math.round((hoursByDay.get(key) || 0) * 10) / 10);
  const average = values.reduce((a, b) => a + b, 0) / 14;
  const remind = async () => {
    setSending(true);
    try {
      await sendAdminTechnicianLoginReminder({ technicianId });
      toast.success(`Log-in reminder sent to ${name}`);
      void activity.refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the reminder.");
    } finally {
      setSending(false);
    }
  };
  const loggedIn = technician.loginStatus === "logged_in" || technician.loginStatus === "Logged In";
  return (
    <div className="adm-stack" data-testid="tech-activity">
      <Kpis items={[
        { label: "On duty now", value: technician.currentSessionHours ? duration(technician.currentSessionHours * 60) : loggedIn ? "Just started" : "Off", note: technician.currentSessionStartedAt ? `since ${new Date(technician.currentSessionStartedAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : technician.lastSeenAt ? `last seen ${day(technician.lastSeenAt)}` : undefined },
        { label: "Last 7 days", value: duration(lastSeven * 60), note: "logged in" },
        { label: "Average a day", value: duration(average * 60), note: "over 14 days" },
        { label: "Logged in, all time", value: technician.loggedInHoursTotal != null ? duration(technician.loggedInHoursTotal * 60) : "—", note: `${sessions.length} sessions loaded` },
      ]} />
      <div className="pp-cols3" style={{ gridTemplateRows: "auto" }}>
        <Card title="Hours logged in, each day" aside="last 14 days" style={{ gridColumn: "span 2" }}>
          <Columns label="Hours logged in each day for 14 days" height={170} highlightLast values={values} labels={days.map((key, i) => (i % 2 === 0 || i === 13 ? (i === 13 ? "Today" : new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })) : ""))} />
        </Card>
        <Card title="Reminders sent" aside={<Btn size="sm" icon="notifications" disabled={sending || loggedIn} onClick={() => void remind()}>{loggedIn ? "On duty" : "Remind now"}</Btn>}>
          {alerts.length ? (
            <div className="ap-items" style={{ gap: 6 }}>
              {alerts.slice(0, 5).map((alert) => (
                <div key={alert.alertId} className="ap-item"><Icon name="notifications_active" /><div><b>{day(alert.sentAt || alert.createdAt)} · {alert.alertType.replace(/_/g, " ")}</b><span>{alert.message || alert.status}</span></div></div>
              ))}
            </div>
          ) : <p className="ap-faint" style={{ fontSize: 13, fontWeight: 600 }}>No reminders sent yet.</p>}
        </Card>
      </div>
      <Table label="Sessions" cols="minmax(0,1fr) minmax(0,1fr) 90px minmax(0,1.2fr) 90px" head={["Came on duty", "Went off", { label: "Length", right: true }, "How it ended", "From"]} minWidth={680}
        foot={<span>{sessions.length} session{sessions.length === 1 ? "" : "s"}</span>}>
        {sessions.slice(0, 20).map((session) => (
          <Row key={session.sessionId} cols="minmax(0,1fr) minmax(0,1fr) 90px minmax(0,1.2fr) 90px" tight>
            <Cell className="ap-strong">{session.loginAt ? `${day(session.loginAt)} ${new Date(session.loginAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : "—"}</Cell>
            <Cell>{session.isActive ? <Pill tone="ok">On duty now</Pill> : session.logoutAt ? `${day(session.logoutAt)} ${new Date(session.logoutAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}` : "—"}</Cell>
            <Cell right className="ap-num">{duration(session.durationHours * 60)}</Cell>
            <Cell className={session.endedReason && /timeout|signal|inactive|stale/i.test(session.endedReason) ? "ap-warn" : undefined}>{session.isActive ? "—" : (session.endedReason || "Went off duty").replace(/_/g, " ")}</Cell>
            <Cell className="ap-faint">{session.source || "—"}</Cell>
          </Row>
        ))}
      </Table>
      <p className="ap-faint" style={{ fontSize: 12, fontWeight: 600 }}><Link className="ap-link" to={`/admin/technicians/${technicianId}?tab=overview`}>Back to the overview</Link></p>
    </div>
  );
}
