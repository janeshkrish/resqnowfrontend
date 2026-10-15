import { useEffect, useMemo, useRef, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import type { PricingRow, PricingTemplate as SignupTemplate } from "@/components/technician/DynamicPricingStep";
import { canonicalizeServiceKey, canonicalizeVehicleKey, normalizeSpecialtiesForApi, normalizeVehicleTypesForApi } from "@/config/technicianNormalization";
import { apiFetch, apiUrl } from "@/lib/api";
import { searchLocations, type LocationSearchResult } from "@/lib/geo";
import { MapplsMapSurface } from "@/lib/mapProvider/MapplsMapSurface";
import { technicianSchema } from "@/services/technicianAuthService";
import { buildTechnicianSignupPayload } from "@/utils/technicianSignupPayload";
import { filterSignupPricing, getSelectedSignupVehicleTypes, getSignupPricingError, SIGNUP_EV_CONNECTORS, SIGNUP_SERVICES, SIGNUP_SUBTYPES, SIGNUP_VEHICLES, signupCsvTokens, type SignupVehicle } from "@/utils/technicianSignupPricing";
import { createTechnician, getPriceMedians, getPricingTemplate, getTechnicianProfile, getTechnicianServicePricing, updateTechnicianProfile } from "../api/portalApi";
import { rupees } from "../format";
import { Btn, Check, ErrorState, Icon, Loading, Note, Pill, Radio, usePortalHeader } from "../ui";

// Add or edit a technician with the same steps, fields, checks and saved shape as the app's technician sign-up.

type Vehicle = SignupVehicle;
type FormState = {
  proprietor_name: string; name: string; phone: string; alternate_phone: string; email: string; password: string; confirmPassword: string;
  location: { latitude: number | null; longitude: number | null; address: string; locality: string; city: string; district: string; state: string; pincode: string };
  serviceAreaRange: number | string; experience: number | string;
  vehicle_types: Record<Vehicle, boolean>; specialties: string[]; towing_fleet_types: string[];
  aadhaar_number: string; gst_number: string;
  documents: { garage_front: string; profile_photo: string; tools_photo: string; facilities_photo: string };
  working_hours: { opening_time: string; closing_time: string; weekly_off: string; is_24x7: boolean };
  app_readiness: { has_smartphone: boolean; preferred_language: string };
  pricing_config: PricingRow[];
  payment_details: { modes: Record<string, boolean>; upi_id: string; bank_name: string; bank_account_number: string; ifsc_code: string };
  consent: { agreed: boolean };
};
type DocKey = keyof FormState["documents"];

const BLANK: FormState = {
  proprietor_name: "", name: "", phone: "", alternate_phone: "", email: "", password: "", confirmPassword: "",
  location: { latitude: null, longitude: null, address: "", locality: "", city: "", district: "", state: "", pincode: "" },
  serviceAreaRange: 10, experience: 0,
  vehicle_types: { bike: false, car: false, commercial: false, ev: false }, specialties: [], towing_fleet_types: [],
  aadhaar_number: "", gst_number: "",
  documents: { garage_front: "", profile_photo: "", tools_photo: "", facilities_photo: "" },
  working_hours: { opening_time: "", closing_time: "", weekly_off: "None", is_24x7: false },
  app_readiness: { has_smartphone: false, preferred_language: "English" },
  pricing_config: [],
  payment_details: { modes: { cash: true }, upi_id: "", bank_name: "", bank_account_number: "", ifsc_code: "" },
  consent: { agreed: false },
};

const STEPS = [["Personal", "Details"], ["Services", "Offerings"], ["Verify", "Docs"], ["Operations", "Hours"], ["Pricing", "Rates"], ["Banking", "Payouts"], ["Preview", "Review"], ["Finish", "Submit"]] as const;
const INTRO = ["About the technician and their shop", "What do they work on?", "Identity and shop photos", "Their hours and app language", "Their prices", "Where their earnings go", "Check everything once", ""];
const SUBS = [
  "Fields marked * are needed. Email and password are optional; with an email, a password is needed.",
  "Pick the vehicles and services they can confidently handle.",
  "The Aadhaar number is needed before they can take jobs. Photos up to 10 MB each.",
  "Customers only reach them inside these hours, while they are on duty.",
  "Only the services and vehicles picked in step 2 appear. Amounts in rupees.",
  "Payouts go by UPI first; the bank account is the fallback.",
  "Use Edit on any part to change it, then come back here.",
  "Confirm the two agreements, then choose what happens next.",
];
/** The fields each step checks, as in the app sign-up. */
const STEP_FIELDS: string[][] = [
  ["proprietor_name", "name", "email", "password", "confirmPassword", "phone", "location", "experience", "serviceAreaRange"],
  ["specialties", "vehicle_types", "towing_fleet_types"],
  ["aadhaar_number", "documents"],
  ["working_hours", "app_readiness"],
  [], [], [], ["consent"],
];
const FLEETS = [
  { id: "flatbed", label: "Flatbed Trucks", description: "For luxury and damaged cars", icon: "directions_car" },
  { id: "wheel-lift", label: "Front-Lift / Wheel-Lift Trucks", description: "For rapid urban towing", icon: "local_shipping" },
  { id: "heavy-duty-wrecker", label: "Heavy-Duty Wreckers", description: "For commercial vehicles", icon: "airport_shuttle" },
];
const DOCS: [DocKey, string][] = [["garage_front", "Shop front"], ["profile_photo", "Profile photo"], ["tools_photo", "Tools / bay"], ["facilities_photo", "Facilities"]];
const DAYS = ["None", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LANGUAGES = ["English", "Tamil", "Hindi"];
const AGREEMENT = ["Independent service partner", "Professional conduct", "Transparent pricing and payments", "Responsible use of the app", "Customer privacy", "Reliability and cancellations", "Performance and ratings", "Account review and termination", "Commitment to growth", "Acceptance"];

const json = <T,>(value: unknown, fallback: T): T => {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value as T;
  try { return JSON.parse(String(value)) as T; } catch { return fallback; }
};
const text = (value: unknown) => (value == null ? "" : String(value));
const num = (value: unknown) => (value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));
const photoSrc = (value: string) => (!value ? "" : /^(https?:|blob:|data:)/.test(value) ? value : apiUrl(value));
const placeholderEmail = (email: string) => /@resqnow\.invalid$/i.test(email);

/** A stored technician, read back into the sign-up form. */
function fromProfile(profile: Record<string, unknown>, rows: unknown[]): FormState {
  const specialties = normalizeSpecialtiesForApi(json<string[]>(profile.specialties, [])).filter((id) => SIGNUP_SERVICES.some((service) => service.id === id));
  const vehicles = normalizeVehicleTypesForApi(json<Record<string, boolean> | string[]>(profile.vehicle_types, {}));
  const costs = json<Array<{ towing_fleet_types?: string[] }>>(profile.service_costs, []);
  const hours = json<Partial<FormState["working_hours"]>>(profile.working_hours, {});
  const app = json<Partial<FormState["app_readiness"]>>(profile.app_readiness, {});
  const pay = json<Partial<FormState["payment_details"]>>(profile.payment_details, {});
  const docs = json<Partial<FormState["documents"]>>(profile.documents, {});
  const email = text(profile.email);
  return {
    ...BLANK,
    proprietor_name: text(profile.proprietor_name), name: text(profile.name), phone: text(profile.phone), alternate_phone: text(profile.alternate_phone),
    email: placeholderEmail(email) ? "" : email,
    location: {
      latitude: num(profile.latitude), longitude: num(profile.longitude), address: text(profile.address), locality: text(profile.locality),
      city: text(profile.region), district: text(profile.district), state: text(profile.state), pincode: text(profile.pincode),
    },
    serviceAreaRange: num(profile.serviceAreaRange ?? profile.service_area_range) ?? 10, experience: num(profile.experience) ?? 0,
    vehicle_types: { bike: Boolean(vehicles.bike), car: Boolean(vehicles.car), commercial: Boolean(vehicles.commercial), ev: Boolean(vehicles.ev) },
    specialties,
    towing_fleet_types: [...new Set((Array.isArray(costs) ? costs : []).flatMap((entry) => entry?.towing_fleet_types || []))],
    aadhaar_number: text(profile.aadhaar_number), gst_number: text(profile.gst_number),
    documents: { garage_front: text(docs.garage_front), profile_photo: text(docs.profile_photo), tools_photo: text(docs.tools_photo), facilities_photo: text(docs.facilities_photo) },
    working_hours: { opening_time: text(hours.opening_time), closing_time: text(hours.closing_time), weekly_off: text(hours.weekly_off) || "None", is_24x7: Boolean(hours.is_24x7) },
    app_readiness: { has_smartphone: Boolean(app.has_smartphone), preferred_language: text(app.preferred_language) || "English" },
    pricing_config: rows.map((raw) => {
      const row = raw as Record<string, unknown>;
      return { service_id: Number(row.service_id), vehicle_category_id: Number(row.vehicle_category_id), vehicle_subcategory_id: num(row.vehicle_subcategory_id), pricing_json: json<Record<string, string | number>>(row.pricing_json, {}) };
    }).filter((row) => row.pricing_json.vehicle_subtype),
    payment_details: { modes: pay.modes && Object.keys(pay.modes).length ? pay.modes : { cash: true }, upi_id: text(pay.upi_id), bank_name: text(pay.bank_name), bank_account_number: text(pay.bank_account_number), ifsc_code: text(pay.ifsc_code) },
  };
}

/** The app's own checks for the fields of one step, as messages by field. */
function problemsFor(form: FormState, fields: string[], editing: boolean) {
  const result = technicianSchema.safeParse({ ...form, consent: editing ? { agreed: true } : form.consent });
  const out: Record<string, string> = {};
  if (result.success) return out;
  for (const issue of result.error.issues) {
    const path = issue.path.join(".");
    if (editing && path === "password" && /required when you enter an email/.test(issue.message)) continue;
    if (fields.some((field) => path === field || path.startsWith(`${field}.`)) && !out[path]) out[path] = issue.message;
  }
  return out;
}

export default function TechnicianFormPage({ mode }: { mode: "add" | "edit" }) {
  const editing = mode === "edit";
  const params = useParams();
  const technicianId = Number(params.technicianId);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  usePortalHeader(editing ? "Edit technician" : "Add technician", "The same form technicians fill in when they sign up in the app.");
  const template = useQuery({ queryKey: ["portal", "pricing-template"], queryFn: getPricingTemplate, staleTime: 10 * 60_000 });
  const medians = useQuery({ queryKey: ["portal", "price-medians"], queryFn: getPriceMedians, staleTime: 10 * 60_000 });
  const profile = useQuery({ queryKey: ["portal", "tech-profile", technicianId], queryFn: () => getTechnicianProfile(technicianId), enabled: editing && technicianId > 0 });
  const pricing = useQuery({ queryKey: ["portal", "tech-pricing", technicianId], queryFn: () => getTechnicianServicePricing(technicianId), enabled: editing && technicianId > 0 });
  const [form, setForm] = useState<FormState>(BLANK);
  const [loaded, setLoaded] = useState(!editing);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(editing ? 6 : 0);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [pricingProblem, setPricingProblem] = useState("");
  const [uploading, setUploading] = useState<string[]>([]);
  const [agreement, setAgreement] = useState(false);
  const [then, setThen] = useState<"pending" | "approved">("pending");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const topRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (editing && !loaded && profile.data && pricing.data) {
      setForm(fromProfile(profile.data, Array.isArray(pricing.data) ? pricing.data : []));
      setLoaded(true);
    }
  }, [editing, loaded, profile.data, pricing.data]);
  useEffect(() => { topRef.current?.scrollIntoView({ block: "start" }); }, [step]);
  // Once a step has been checked, its messages follow the fields as they change, like the app sign-up.
  useEffect(() => {
    setProblems((current) => {
      if (!Object.keys(current).length) return current;
      const fields = step === 6 ? STEP_FIELDS.slice(0, 6).flat() : STEP_FIELDS[step];
      const fresh = problemsFor(form, fields, editing);
      if (current.agreement && !agreement) fresh.agreement = current.agreement;
      return fresh;
    });
  }, [form, step, editing, agreement]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const tpl = template.data as unknown as SignupTemplate | undefined;
  const vehicles = getSelectedSignupVehicleTypes(form.vehicle_types);
  const lastStep = editing ? 6 : 7;
  const name = form.proprietor_name.trim() || "the technician";

  const pricingError = () => {
    if (!tpl) return "The price setup could not load. Try again.";
    return getSignupPricingError(filterSignupPricing(form.pricing_config, tpl, form.specialties, vehicles), tpl, form.specialties, vehicles) || "";
  };
  const check = (index: number) => {
    if (uploading.length) { toast.error("Wait for the photos to finish uploading."); return false; }
    const fields = index === 6 ? STEP_FIELDS.slice(0, 6).flat().concat(["alternate_phone", "gst_number", "pricing_config", "payment_details"]) : STEP_FIELDS[index];
    const found = problemsFor(form, fields, editing);
    setProblems(found);
    if (index === 4 || index >= 6) {
      const message = pricingError();
      setPricingProblem(message);
      if (message) { toast.error(message); return false; }
    }
    if (Object.keys(found).length) { toast.error("Fill in the fields marked in red."); return false; }
    if (index === 7 && !agreement) { setProblems({ agreement: "Confirm the Technician Agreement." }); toast.error("Confirm the Technician Agreement."); return false; }
    return true;
  };
  const next = async () => {
    if (!check(step)) return;
    if (step < lastStep) {
      setStep(step + 1);
      setReached((value) => Math.max(value, step + 1));
      return;
    }
    await save();
  };
  const save = async () => {
    if (!tpl) return;
    setSaving(true);
    setSaveError("");
    try {
      const payload = buildTechnicianSignupPayload(form, tpl, editing ? true : agreement);
      if (editing) {
        await updateTechnicianProfile(technicianId, payload);
        toast.success(`${form.name || "Technician"} saved`);
        await queryClient.invalidateQueries({ queryKey: ["portal"] });
        await queryClient.invalidateQueries({ queryKey: ["admin"] });
        navigate(`/admin/technicians/${technicianId}?tab=profile`);
      } else {
        const created = await createTechnician({ ...payload, status: then });
        await queryClient.invalidateQueries({ queryKey: ["portal"] });
        toast.success(then === "approved" ? `${form.name} added and approved` : `${form.name} added · waiting in Applications`);
        navigate(then === "approved" ? `/admin/technicians/${created.id}?tab=profile` : `/admin/applications/${created.id}`);
      }
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  if (editing && (profile.isError || pricing.isError)) return <ErrorState error={profile.error || pricing.error} onRetry={() => { void profile.refetch(); void pricing.refetch(); }} />;
  if (template.isError) return <ErrorState error={template.error} onRetry={() => void template.refetch()} />;
  if (!loaded || !tpl) return <Loading height={420} label="Loading the form" />;

  const err = (path: string) => problems[path] || null;
  const step2Count = form.specialties.length * vehicles.length;
  return (
    <div className="adm-stack" data-testid="technician-form" ref={topRef}>
      <div className="ad-grid">
        <aside className="ad-rail" aria-label="Steps">
          <p>{editing ? "Edit technician" : "Add technician"}</p>
          {STEPS.slice(0, lastStep + 1).map(([title, sub], index) => (
            <button key={title} type="button" className={`ad-step${index < step ? " is-done" : index === step ? " is-now" : ""}`} disabled={index > reached || uploading.length > 0}
              aria-current={index === step ? "step" : undefined} onClick={() => setStep(index)}>
              <i>{index < step ? <Icon name="check" /> : String(index + 1).padStart(2, "0")}</i><div><b>{title}</b><small>{sub}</small></div>
            </button>
          ))}
          <div className="ad-railnote"><Icon name="verified_user" /><span>Same steps and checks as the technician sign-up, so every partner's record looks alike.</span></div>
        </aside>
        <div className="ad-main">
          <div className="ad-intro">
            <div>
              <span className="ad-kick">STEP {String(step + 1).padStart(2, "0")} / {String(lastStep + 1).padStart(2, "0")}</span>
              <h2 className="pj">{step === 7 ? `Add ${name} to ResQNow` : step === 6 && editing ? `Save the changes for ${form.name || "this technician"}` : INTRO[step]}</h2>
              <p>{editing && step === 6 ? "Check the details, then save. The technician's app shows the new details at once." : SUBS[step]}</p>
            </div>
            <span className="ad-same"><Icon name="sync_alt" />Same as the app sign-up</span>
          </div>
          {step === 0 ? <Personal form={form} set={set} err={err} editing={editing} /> : null}
          {step === 1 ? <Services form={form} set={set} err={err} count={step2Count} /> : null}
          {step === 2 ? <Verify form={form} set={set} err={err} onUploading={(label, busy) => setUploading((list) => (busy ? [...new Set([...list, label])] : list.filter((item) => item !== label)))} /> : null}
          {step === 3 ? <Operations form={form} set={set} err={err} /> : null}
          {step === 4 ? <Pricing form={form} set={set} template={tpl} medians={medians.data || []} problem={pricingProblem} /> : null}
          {step === 5 ? <Banking form={form} set={set} /> : null}
          {step === 6 ? <Preview form={form} template={tpl} onEdit={setStep} /> : null}
          {step === 7 ? <Finish form={form} set={set} err={err} agreement={agreement} setAgreement={setAgreement} then={then} setThen={setThen} pricedSets={filterSignupPricing(form.pricing_config, tpl, form.specialties, vehicles).length} /> : null}
          {pricingProblem && step !== 4 ? <Note tone="bad" icon="error"><b>{pricingProblem}</b> <button type="button" className="ad-link" onClick={() => setStep(4)}>Open the prices</button></Note> : null}
          {saveError ? <Note tone="bad" icon="error">{saveError}</Note> : null}
          <div className="ad-foot">
            <span>Step {step + 1} of {lastStep + 1}<b>{STEPS[step][0]}</b></span>
            {step === 0 ? <Btn onClick={() => navigate(editing ? `/admin/technicians/${technicianId}?tab=profile` : "/admin/technicians")}>Cancel</Btn> : <Btn disabled={uploading.length > 0} onClick={() => setStep(step - 1)}>Back</Btn>}
            <Btn variant="hot" icon={step === lastStep ? "check" : "arrow_forward"} disabled={saving} onClick={() => void next()}>
              {saving ? "Saving…" : step === lastStep ? (editing ? "Save changes" : "Add technician") : "Continue"}
            </Btn>
          </div>
        </div>
      </div>
    </div>
  );
}

type StepProps = { form: FormState; set: <K extends keyof FormState>(key: K, value: FormState[K]) => void; err: (path: string) => string | null };

function Card({ icon, title, sub, children, testId }: { icon: string; title: string; sub: string; children: ReactNode; testId?: string }) {
  return <section className="ad-card" data-testid={testId}><div className="ad-ch"><Icon name={icon} /><div><b>{title}</b><span>{sub}</span></div></div>{children}</section>;
}
function Field({ label, need, optional, error, children, id }: { label: string; need?: boolean; optional?: boolean; error?: string | null; children: ReactNode; id: string }) {
  return (
    <div className={`ad-field${error ? " has-error" : ""}`}>
      <label htmlFor={id}>{label}{need ? " *" : ""}{optional ? <em>Optional</em> : null}</label>
      {children}
      {error ? <small className="ad-err" role="alert">{error}</small> : null}
    </div>
  );
}
const Input = ({ id, value, onChange, ...rest }: { id: string; value: string | number; onChange: (value: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "id">) => (
  <input id={id} className="ad-in" value={value} onChange={(event) => onChange(event.target.value)} {...rest} />
);

function Personal({ form, set, err, editing }: StepProps & { editing: boolean }) {
  const loc = form.location;
  const setLoc = (patch: Partial<FormState["location"]>) => set("location", { ...loc, ...patch });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [mapDown, setMapDown] = useState(false);
  const [readAgreement, setReadAgreement] = useState(false);
  useEffect(() => {
    if (query.trim().length < 3) { setResults([]); return; }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try { setResults(await searchLocations(query, 5)); } catch { setResults([]); } finally { setSearching(false); }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [query]);
  const pin = async (lat: number, lng: number, label?: string) => {
    const point = { latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) };
    setLoc(point);
    setResults([]);
    try {
      const response = await apiFetch(`/api/public/reverse-geocode?lat=${point.latitude}&lng=${point.longitude}`);
      const data = await response.json();
      const addr = (data?.address || {}) as Record<string, string>;
      set("location", {
        ...loc, ...point,
        locality: addr.suburb || addr.neighbourhood || addr.village || loc.locality,
        city: addr.city || addr.town || addr.municipality || loc.city,
        district: addr.county || addr.district || addr.state_district || loc.district,
        state: addr.state || loc.state,
        pincode: addr.postcode || loc.pincode,
        address: loc.address || label || data?.display_name || "",
      });
    } catch {
      set("location", { ...loc, ...point, address: loc.address || label || "" });
    }
  };
  const markers = useMemo(() => (loc.latitude != null && loc.longitude != null ? [{ id: "shop", position: { lat: loc.latitude, lng: loc.longitude }, html: '<span class="cm-pin is-hot"><span class="rq-symbol" aria-hidden="true">storefront</span></span>', width: 30, height: 30 }] : []), [loc.latitude, loc.longitude]);
  const camera = useMemo(() => ({ mode: "fit" as const, points: loc.latitude != null && loc.longitude != null ? [{ lat: loc.latitude, lng: loc.longitude }] : [{ lat: 11.0168, lng: 76.9558 }], padding: { top: 40, right: 40, bottom: 40, left: 40 }, maxZoom: 15, revision: (loc.latitude || 0) + (loc.longitude || 0) }), [loc.latitude, loc.longitude]);
  return (
    <>
      <div className="ad-cols">
        <Card icon="person" title="Personal and contact details" sub="As on their ID. Fields marked * are needed.">
          <Field id="t-owner" label="Owner's name" need error={err("proprietor_name")}><Input id="t-owner" value={form.proprietor_name} onChange={(value) => set("proprietor_name", value)} placeholder="Their full name" /></Field>
          <Field id="t-shop" label="Shop name" need error={err("name")}><Input id="t-shop" value={form.name} onChange={(value) => set("name", value)} placeholder="For example: PV Towing & Tyres" /></Field>
          <div className="ad-row2">
            <Field id="t-phone" label="Mobile number" need error={err("phone")}><Input id="t-phone" type="tel" inputMode="tel" value={form.phone} onChange={(value) => set("phone", value)} /></Field>
            <Field id="t-alt" label="Alternate mobile" optional><Input id="t-alt" type="tel" inputMode="tel" value={form.alternate_phone} onChange={(value) => set("alternate_phone", value)} /></Field>
          </div>
          <Field id="t-email" label="Email address" optional error={err("email")}><Input id="t-email" type="email" value={form.email} onChange={(value) => set("email", value)} placeholder="contact@example.com" /></Field>
          <div className="ad-row2">
            <Field id="t-pass" label={editing ? "New password" : "Password"} need={Boolean(form.email.trim()) && !editing} optional={!form.email.trim() || editing} error={err("password")}><Input id="t-pass" type="password" autoComplete="new-password" value={form.password} onChange={(value) => set("password", value)} placeholder={editing ? "Leave blank to keep" : "At least 8 characters"} /></Field>
            <Field id="t-pass2" label="Confirm password" need={Boolean(form.password)} optional={!form.password} error={err("confirmPassword")}><Input id="t-pass2" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(value) => set("confirmPassword", value)} /></Field>
          </div>
          <p className="ad-hint"><Icon name="info" />{editing ? "Leave the password blank to keep the current one." : "An email is optional. Once one is entered, a password of 8 or more characters is needed."}</p>
        </Card>
        <Card icon="location_on" title="Operating area *" sub="The shop's pin is needed. Locality, district and pincode fill in from it.">
          <div className="ad-field">
            <label htmlFor="t-where">Find the shop</label>
            <input id="t-where" className="ad-in" value={query} placeholder="Search the shop's address or area" onChange={(event) => setQuery(event.target.value)} />
            {searching ? <small className="ap-faint">Searching…</small> : null}
            {results.length ? (
              <div className="ad-results" role="listbox" aria-label="Places found">
                {results.map((result) => <button key={result.id} type="button" role="option" aria-selected={false} onClick={() => { setQuery(""); void pin(result.lat, result.lng, result.address); }}><Icon name="location_on" /><span><b>{result.name}</b><small>{result.address}</small></span></button>)}
              </div>
            ) : null}
          </div>
          <div className="ad-map" style={{ height: 180 }}>
            {mapDown ? <div className="ap-state"><Icon name="map" /><span>The map could not load. Search for the place instead.</span></div> : (
              <MapplsMapSurface ariaLabel="The shop's location. Tap the map to move the pin." className="h-full w-full" markers={markers} polylines={[]} circles={[]} camera={camera}
                onMapClick={(position) => void pin(position.lat, position.lng)} onUnavailable={() => setMapDown(true)} fallbackDescription="The map could not load. Search for the shop's address instead." />
            )}
          </div>
          <div className="ad-found" data-testid="pin-found">
            <span><Icon name="pin_drop" />{loc.latitude != null && loc.longitude != null ? `${loc.latitude}, ${loc.longitude}` : "No pin yet"}</span>
            {loc.locality ? <><b>{loc.locality}</b><i>locality</i></> : null}
            {loc.district ? <><b>{loc.district}</b><i>district</i></> : null}
            {loc.pincode ? <><b>{loc.pincode}</b><i>pincode</i></> : null}
          </div>
          {err("location.latitude") ? <small className="ad-err" role="alert">Place the shop's pin: search for it, or tap the map.</small> : null}
          <div className="ad-row2">
            <Field id="t-city" label="City / town"><Input id="t-city" value={loc.city} onChange={(value) => setLoc({ city: value })} /></Field>
            <Field id="t-state" label="State" need error={err("location.state")}><Input id="t-state" value={loc.state} onChange={(value) => setLoc({ state: value })} /></Field>
          </div>
          <Field id="t-address" label="Full address" need error={err("location.address")}><textarea id="t-address" className="ad-in is-area" value={loc.address} onChange={(event) => setLoc({ address: event.target.value })} /></Field>
          <div className="ad-big">
            <Field id="t-exp" label="Experience (years)" error={err("experience")}><Input id="t-exp" type="number" min={0} value={form.experience} onChange={(value) => set("experience", value)} /></Field>
            <Field id="t-range" label="Range (km)" error={err("serviceAreaRange")}><Input id="t-range" type="number" min={1} value={form.serviceAreaRange} onChange={(value) => set("serviceAreaRange", value)} /></Field>
          </div>
        </Card>
      </div>
      <div className="ad-agree">
        <Icon name="gavel" />
        <div><b>Technician Agreement and responsibilities</b><span>{readAgreement ? AGREEMENT.map((item, index) => `${index + 1}. ${item}`).join(" · ") : "The 10 points they agree to: conduct, fair prices, no offline payments, privacy, cancellations"}</span></div>
        <Btn size="sm" icon={readAgreement ? "expand_less" : "expand_more"} onClick={() => setReadAgreement(!readAgreement)}>{readAgreement ? "Hide" : "Read"}</Btn>
      </div>
    </>
  );
}

function Choice({ on, onClick, picture, icon, title, sub, label }: { on: boolean; onClick: () => void; picture?: string; icon?: string; title: string; sub: string; label: string }) {
  return (
    <button type="button" className={`ad-choice${on ? " is-on" : ""}`} aria-pressed={on} aria-label={label} onClick={onClick}>
      {picture ? <img src={picture} alt="" /> : icon ? <Icon name={icon} /> : null}
      <div><b>{title}</b><span>{sub}</span></div>
      <i>{on ? <Icon name="check" /> : null}</i>
    </button>
  );
}

function Services({ form, set, err, count }: StepProps & { count: number }) {
  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  const picked = Object.values(form.vehicle_types).filter(Boolean).length;
  return (
    <>
      <Card icon="directions_car" title="Vehicle types *" sub={`${picked} picked · each one gets its own prices for every service`}>
        <div className="ad-veh">{SIGNUP_VEHICLES.map((vehicle) => <Choice key={vehicle.id} label={vehicle.label} on={form.vehicle_types[vehicle.id]} picture={vehicle.image} title={vehicle.label} sub={vehicle.description}
          onClick={() => set("vehicle_types", { ...form.vehicle_types, [vehicle.id]: !form.vehicle_types[vehicle.id] })} />)}</div>
        {err("vehicle_types") ? <small className="ad-err" role="alert">{err("vehicle_types")}</small> : null}
      </Card>
      <Card icon="build" title="Services offered *" sub={`${form.specialties.length} picked${count ? ` · ${count} price set${count === 1 ? "" : "s"} in step 5` : ""}`}>
        <div className="ad-svc">{SIGNUP_SERVICES.map((service) => <Choice key={service.id} label={service.label} on={form.specialties.includes(service.id)} picture={`/images/home/services/${service.id}.webp`} title={service.label} sub={service.description}
          onClick={() => set("specialties", toggle(form.specialties, service.id))} />)}</div>
        {err("specialties") ? <small className="ad-err" role="alert">{err("specialties")}</small> : null}
      </Card>
      {form.specialties.includes("towing") ? (
        <Card icon="local_shipping" title="Tow truck fleet *" sub="Shown because Towing is picked · at least one is needed">
          <div className="ad-fleet">{FLEETS.map((fleet) => <Choice key={fleet.id} label={fleet.label} on={form.towing_fleet_types.includes(fleet.id)} icon={fleet.icon} title={fleet.label} sub={fleet.description}
            onClick={() => set("towing_fleet_types", toggle(form.towing_fleet_types, fleet.id))} />)}</div>
          {err("towing_fleet_types") ? <small className="ad-err" role="alert">{err("towing_fleet_types")}</small> : null}
        </Card>
      ) : null}
    </>
  );
}

function Upload({ value, label, onChange, onUploading }: { value: string; label: string; onChange: (url: string) => void; onUploading: (label: string, busy: boolean) => void }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Choose an image."); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Choose an image smaller than 10 MB."); return; }
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    onUploading(label, true);
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch(apiUrl("/api/upload"), { method: "POST", body });
      const data = await response.json();
      if (!response.ok || typeof data.url !== "string" || !data.url) throw new Error("Upload failed");
      onChange(data.url);
      toast.success(`${label} uploaded`);
    } catch (error) {
      setPreview("");
      toast.error(error instanceof Error ? error.message : "Upload failed. Try again.");
    } finally {
      setBusy(false);
      onUploading(label, false);
    }
  };
  const src = preview || photoSrc(value);
  return (
    <div className={`ad-up${src ? " has-photo" : ""}${busy ? " is-busy" : ""}`} style={src ? { backgroundImage: `url("${src}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
      {busy ? <><Icon name="progress_activity" />Uploading {label}<small>Continue waits for it</small></> : src ? <em><Icon name="check" />{label}</em> : <><Icon name="add_photo_alternate" />{label}<small>Tap to add a photo</small></>}
      <input type="file" accept="image/*" aria-label={`Upload ${label}`} className="ad-file" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} />
      {src && !busy ? <button type="button" className="ad-x" aria-label={`Remove ${label}`} onClick={() => { setPreview(""); onChange(""); }}><Icon name="close" /></button> : null}
    </div>
  );
}

function Verify({ form, set, err, onUploading }: StepProps & { onUploading: (label: string, busy: boolean) => void }) {
  return (
    <>
      <Card icon="badge" title="Identity verification" sub="The Aadhaar number is needed; GSTIN is optional.">
        <div className="ad-row2">
          <Field id="t-aadhaar" label="Aadhaar number" need error={err("aadhaar_number")}><Input id="t-aadhaar" className="ad-in is-mono" inputMode="numeric" value={form.aadhaar_number} onChange={(value) => set("aadhaar_number", value.replace(/\D/g, "").slice(0, 12))} /></Field>
          <Field id="t-gst" label="GSTIN" optional><Input id="t-gst" className="ad-in is-mono" value={form.gst_number} onChange={(value) => set("gst_number", value.toUpperCase())} /></Field>
        </div>
        <p className="ad-hint"><Icon name="info" />Exactly 12 digits, without spaces. The number is saved as typed; there is no automatic check against UIDAI.</p>
      </Card>
      <Card icon="photo_camera" title="Shop photos" sub="All four are optional. Images only, up to 10 MB each.">
        <div className="ad-photos">{DOCS.map(([key, label]) => <Upload key={key} label={label} value={form.documents[key]} onUploading={onUploading} onChange={(url) => set("documents", { ...form.documents, [key]: url })} />)}</div>
      </Card>
    </>
  );
}

function Operations({ form, set, err }: StepProps) {
  const hours = form.working_hours;
  const setHours = (patch: Partial<FormState["working_hours"]>) => set("working_hours", { ...hours, ...patch });
  const scheduled = Boolean(hours.opening_time || hours.closing_time);
  return (
    <div className="ad-cols">
      <Card icon="schedule" title="Working hours" sub="Fixed hours, or round the clock. One of the two is needed.">
        <div className="ad-row3">
          <Field id="t-open" label="Open" error={err("working_hours.opening_time")}><Input id="t-open" type="time" disabled={hours.is_24x7} value={hours.opening_time} onChange={(value) => setHours({ opening_time: value })} /></Field>
          <Field id="t-close" label="Close" error={err("working_hours.closing_time")}><Input id="t-close" type="time" disabled={hours.is_24x7} value={hours.closing_time} onChange={(value) => setHours({ closing_time: value })} /></Field>
          <Field id="t-off" label="Weekly off"><select id="t-off" className="ad-in" disabled={hours.is_24x7} value={hours.weekly_off} onChange={(event) => setHours({ weekly_off: event.target.value })}>{DAYS.map((day) => <option key={day}>{day}</option>)}</select></Field>
        </div>
        {scheduled ? <button type="button" className="ad-link" onClick={() => setHours({ opening_time: "", closing_time: "", weekly_off: "None" })}>Clear hours to choose 24/7</button> : null}
        <div className={`ad-avail${scheduled ? "" : " is-ready"}`}>
          <Check on={hours.is_24x7} label="Available 24 × 7" onChange={(on) => { if (!scheduled) setHours({ is_24x7: on }); }}>
            <span style={{ display: "flex", flexDirection: "column", gap: 1 }}><b>Available 24 × 7</b><span>Ready to help, any day and any time.{scheduled ? " Locked while hours are set." : ""}</span></span>
          </Check>
        </div>
      </Card>
      <Card icon="smartphone" title="Application usage" sub="Preferences for the ResQNow Partner app.">
        <Field id="t-lang" label="Preferred language"><select id="t-lang" className="ad-in" value={form.app_readiness.preferred_language} onChange={(event) => set("app_readiness", { ...form.app_readiness, preferred_language: event.target.value })}>{LANGUAGES.map((language) => <option key={language}>{language}</option>)}</select></Field>
        <p className="ad-hint"><Icon name="info" />English, Tamil or Hindi. Job alerts and buttons in the Partner app use it.</p>
      </Card>
    </div>
  );
}

function Pricing({ form, set, template, medians, problem }: { form: FormState; set: StepProps["set"]; template: SignupTemplate; medians: { serviceId: number; vehicleType: string; subtype: string; field: string; median: number; technicians: number }[]; problem: string }) {
  const vehicles = getSelectedSignupVehicleTypes(form.vehicle_types) as Vehicle[];
  const [serviceKey, setServiceKey] = useState(form.specialties[0] || "");
  const [vehicleKey, setVehicleKey] = useState<Vehicle>(vehicles[0] || "car");
  const service = template.services.find((item) => canonicalizeServiceKey(item.service_slug || item.service_name) === serviceKey);
  const category = template.categories.find((item) => canonicalizeVehicleKey(item.category_name) === vehicleKey);
  const fields = template.pricingFields.filter((field) => String(field.service_id) === String(service?.id));
  const rowsFor = (serviceId: number | undefined, categoryId: number | undefined) => form.pricing_config.filter((row) => row.service_id === serviceId && row.vehicle_category_id === categoryId);
  const usual = (subtype: string, field: string) => medians.find((item) => item.serviceId === service?.id && item.vehicleType === vehicleKey && item.subtype === subtype && item.field === field);
  const statusOf = (key: string) => {
    const svc = template.services.find((item) => canonicalizeServiceKey(item.service_slug || item.service_name) === key);
    const parts = vehicles.map((vehicle) => {
      const cat = template.categories.find((item) => canonicalizeVehicleKey(item.category_name) === vehicle);
      const n = rowsFor(svc?.id, cat?.id).length;
      return `${SIGNUP_VEHICLES.find((item) => item.id === vehicle)?.label} ${n ? `${n} type${n === 1 ? "" : "s"}` : "not yet"}`;
    });
    const error = getSignupPricingError(filterSignupPricing(form.pricing_config, template, [key], vehicles), template, [key], vehicles);
    return { text: parts.join(" · "), tone: error ? (parts.some((part) => part.endsWith("not yet")) ? "" : "is-bad") : "is-ok" };
  };
  const toggle = (subtype: { id: string; label: string }) => {
    if (!service || !category) return;
    const existing = form.pricing_config.find((row) => row.service_id === service.id && row.vehicle_category_id === category.id && row.pricing_json.vehicle_subtype === subtype.id);
    if (existing) { set("pricing_config", form.pricing_config.filter((row) => row !== existing)); return; }
    const master = template.subcategories.find((item) => String(item.vehicle_category_id) === String(category.id) && item.subcategory_name.toLowerCase().replace(/^ev |^electric /, "") === subtype.label.toLowerCase());
    set("pricing_config", [...form.pricing_config, { service_id: service.id, vehicle_category_id: category.id, vehicle_subcategory_id: master?.id || null,
      pricing_json: { service_domain: serviceKey, vehicle_type: vehicleKey, vehicle_subtype: subtype.id, vehicle_subtype_label: subtype.label } }]);
  };
  const setValue = (row: PricingRow, key: string, value: string) => {
    const clean = value.replace(/[^\d.]/g, "");
    set("pricing_config", form.pricing_config.map((item) => (item === row ? { ...item, pricing_json: { ...item.pricing_json, [key]: clean === "" ? "" : Number(clean) } } : item)));
  };
  /** Text kept as typed, like the app sign-up's connector and brand fields for EV charging. */
  const setText = (row: PricingRow, key: string, value: string) => {
    set("pricing_config", form.pricing_config.map((item) => (item === row ? { ...item, pricing_json: { ...item.pricing_json, [key]: value } } : item)));
  };
  const chargingRows = serviceKey === "ev-charging" ? rowsFor(service?.id, category?.id) : [];
  if (!form.specialties.length || !vehicles.length) return <Note tone="warn" icon="info">Pick at least one vehicle and one service in step 2 first.</Note>;
  const grid = `34px 150px repeat(${Math.max(1, fields.length)}, minmax(96px, 1fr))`;
  return (
    <>
      <div className="ad-tip"><Icon name="credit_card" /><div><b>Clear prices. Confident customers.</b><span>Prices are asked for every picked service on every picked vehicle. Each service asks for its own fields.</span></div></div>
      <section className="ad-card" data-testid="pricing-step">
        <div className="ad-svctabs" role="tablist" aria-label="Services">
          {form.specialties.map((key) => {
            const status = statusOf(key);
            return (
              <button key={key} type="button" role="tab" aria-selected={key === serviceKey} className={`ad-svctab${key === serviceKey ? " is-on" : ""}`} onClick={() => setServiceKey(key)}>
                <img src={`/images/home/services/${key}.webp`} alt="" /><div><b>{SIGNUP_SERVICES.find((item) => item.id === key)?.label || key}</b><span className={status.tone}>{status.text}</span></div>
              </button>
            );
          })}
        </div>
        <div className="ap-row" style={{ flexWrap: "wrap" }}>
          <span className="ap-cap">Vehicle</span>
          <span className="ap-seg" role="radiogroup" aria-label="Vehicle">
            {vehicles.map((vehicle) => {
              const n = rowsFor(service?.id, template.categories.find((item) => canonicalizeVehicleKey(item.category_name) === vehicle)?.id).length;
              const info = SIGNUP_VEHICLES.find((item) => item.id === vehicle);
              return <button key={vehicle} type="button" role="radio" aria-checked={vehicle === vehicleKey} className={vehicle === vehicleKey ? "is-on" : undefined} onClick={() => setVehicleKey(vehicle)}>
                <img src={info?.image} alt="" style={{ width: 30, height: 18, objectFit: "contain" }} />{info?.label} · {n ? `${n} type${n === 1 ? "" : "s"}` : "none yet"}
              </button>;
            })}
          </span>
          <span className="ap-grow" />
          <span className="ap-faint" style={{ fontSize: 12, fontWeight: 700 }}>Tick the types they take, then fill every field for each</span>
        </div>
        {!service || !fields.length ? <Note tone="bad" icon="error">Pricing is unavailable for this service. Try loading the page again.</Note> : (
          <div className="ad-ptable" role="table" aria-label={`${SIGNUP_SERVICES.find((item) => item.id === serviceKey)?.label} prices for ${vehicleKey}`}>
            <div className="ad-pt is-head" role="row" style={{ gridTemplateColumns: grid }}><span role="columnheader">Takes</span><span role="columnheader">Type</span>{fields.map((field) => <span key={field.id} role="columnheader">{field.field_label}{field.required ? " *" : ""}</span>)}</div>
            {SIGNUP_SUBTYPES[vehicleKey].map((subtype) => {
              const row = rowsFor(service.id, category?.id).find((item) => item.pricing_json.vehicle_subtype === subtype.id);
              return (
                <div key={subtype.id} role="row" aria-label={subtype.label} className={`ad-pt${row ? "" : " is-skip"}`} style={{ gridTemplateColumns: grid }}>
                  <span role="cell"><Check on={Boolean(row)} label={`Takes ${subtype.label}`} onChange={() => toggle(subtype)} /></span>
                  <span role="cell" className="ad-sub"><img src={SIGNUP_VEHICLES.find((item) => item.id === vehicleKey)?.image} alt="" /><span className="ap-two"><b>{subtype.label}</b><span>{row ? subtype.detail || "" : "not taken"}</span></span></span>
                  {fields.map((field) => {
                    const km = /distance|free_km/i.test(field.field_key);
                    const raw = row?.pricing_json[field.field_key];
                    const median = usual(subtype.id, field.field_key);
                    const high = median && median.technicians >= 3 && raw !== "" && raw != null && Number(raw) > median.median * 1.15;
                    return row ? (
                      <span role="cell" key={field.id} className="ad-pcell">
                        <label className={`ad-cell${raw === "" || raw == null ? " is-empty" : ""}${high ? " is-high" : ""}`}>
                          {km ? null : <em>₹</em>}
                          <input aria-label={`${subtype.label} ${field.field_label}`} inputMode="decimal" value={raw == null ? "" : String(raw)} onChange={(event) => setValue(row, field.field_key, event.target.value)} />
                          {km ? <em>km</em> : null}
                        </label>
                        {median ? <small className={high ? "ap-warn" : "ap-faint"}>usual {km ? `${median.median} km` : rupees(median.median)}</small> : null}
                      </span>
                    ) : <span role="cell" key={field.id} className="ad-off">—</span>;
                  })}
                </div>
              );
            })}
          </div>
        )}
        {chargingRows.length ? (
          <div className="ad-connectors" data-testid="ev-connectors">
            <p className="ap-cap">Supported charging connectors *</p>
            {chargingRows.map((row) => {
              const label = String(row.pricing_json.vehicle_subtype_label || row.pricing_json.vehicle_subtype);
              const chosen = signupCsvTokens(row.pricing_json.supported_connectors);
              return (
                <div key={String(row.pricing_json.vehicle_subtype)} className="ad-connector" role="group" aria-label={`Connectors for ${label}`}>
                  <b>{label}</b>
                  <div className="ad-connector-list">
                    {SIGNUP_EV_CONNECTORS.map((connector) => {
                      const on = chosen.includes(connector.id);
                      return <Check key={connector.id} on={on} label={`${label} ${connector.label}`} onChange={() => setText(row, "supported_connectors", (on ? chosen.filter((item) => item !== connector.id) : [...chosen, connector.id]).join(","))}>{connector.label}</Check>;
                    })}
                  </div>
                  {chosen.includes("brand") ? (
                    <div className="ad-field"><label htmlFor={`brands-${row.pricing_json.vehicle_subtype}`}>Supported EV brands *</label>
                      <input id={`brands-${row.pricing_json.vehicle_subtype}`} className="ad-in" value={String(row.pricing_json.supported_ev_brands ?? "")} placeholder="For example: Ather, Ola, TVS" onChange={(event) => setText(row, "supported_ev_brands", event.target.value)} /></div>
                  ) : null}
                </div>
              );
            })}
            <p className="ad-hint"><Icon name="info" />Only the connectors and brands their equipment supports for each vehicle type, as in the app sign-up.</p>
          </div>
        ) : null}
        <Note icon="info">Types left unticked are not offered: a customer with one of them is not matched to this technician for this service. At least one type per vehicle is needed.</Note>
        {problem ? <Note tone="bad" icon="error"><b>{problem}</b> The same message the app shows; Continue stays blocked until it is fixed.</Note> : null}
      </section>
    </>
  );
}

function Banking({ form, set }: { form: FormState; set: StepProps["set"] }) {
  const pay = form.payment_details;
  const setPay = (patch: Partial<FormState["payment_details"]>) => set("payment_details", { ...pay, ...patch });
  return (
    <div className="ad-cols">
      <Card icon="account_balance_wallet" title="Payout methods" sub="How they receive their earnings.">
        <Field id="t-upi" label="UPI ID" optional><Input id="t-upi" className="ad-in is-mono" value={pay.upi_id} placeholder="For example: number@upi" onChange={(value) => setPay({ upi_id: value.trim() })} /></Field>
        <p className="ad-hint"><Icon name="info" />Saved as typed. It is not checked with the bank.</p>
      </Card>
      <Card icon="account_balance" title="Bank details" sub="An alternative payout method.">
        <Field id="t-bank" label="Bank name" optional><Input id="t-bank" value={pay.bank_name} onChange={(value) => setPay({ bank_name: value })} /></Field>
        <Field id="t-acct" label="Account number" optional><Input id="t-acct" className="ad-in is-mono" type="password" autoComplete="off" value={pay.bank_account_number} onChange={(value) => setPay({ bank_account_number: value.replace(/\s/g, "") })} /></Field>
        <Field id="t-ifsc" label="IFSC code" optional><Input id="t-ifsc" className="ad-in is-mono" value={pay.ifsc_code} onChange={(value) => setPay({ ifsc_code: value.toUpperCase() })} /></Field>
      </Card>
    </div>
  );
}

function Review({ title, step, onEdit, children }: { title: string; step: number; onEdit: (step: number) => void; children: ReactNode }) {
  return <section className="ad-rv"><div className="ad-rv-h"><b>{title}</b><button type="button" aria-label={`Edit ${title}`} onClick={() => onEdit(step)}><Icon name="edit" />Edit</button></div>{children}</section>;
}
function Facts({ items }: { items: [string, ReactNode, boolean?][] }) {
  return <dl>{items.map(([label, value, wide]) => <div key={label} style={wide ? { gridColumn: "span 2" } : undefined}><dt>{label}</dt><dd className={value === "" || value == null ? "is-miss" : undefined}>{value === "" || value == null ? "Not given" : value}</dd></div>)}</dl>;
}

function Preview({ form, template, onEdit }: { form: FormState; template: SignupTemplate; onEdit: (step: number) => void }) {
  const vehicles = getSelectedSignupVehicleTypes(form.vehicle_types);
  const rows = filterSignupPricing(form.pricing_config, template, form.specialties, vehicles);
  const loc = form.location;
  const label = (id: string) => SIGNUP_VEHICLES.find((item) => item.id === id)?.label || id;
  const modes = Object.entries(form.payment_details.modes).filter(([, on]) => on).map(([mode]) => (mode === "upi" ? "UPI" : mode[0].toUpperCase() + mode.slice(1).replace(/_/g, " ")));
  return (
    <div className="ad-review" data-testid="technician-preview">
      <Review title="Personal details" step={0} onEdit={onEdit}>
        <Facts items={[["Owner", form.proprietor_name], ["Shop", form.name], ["Mobile", form.phone], ["Alternate", form.alternate_phone], ["Email", form.email], ["Password", form.password ? "Set (hidden)" : "Not set"],
          ["Address", loc.address, true], ["Locality", loc.locality], ["City / town", loc.city], ["District", loc.district], ["State", loc.state], ["Pincode", loc.pincode],
          ["GPS", loc.latitude != null && loc.longitude != null ? `${loc.latitude}, ${loc.longitude}` : ""], ["Experience", `${form.experience} years`], ["Range", `${form.serviceAreaRange} km`]]} />
      </Review>
      <Review title="Services" step={1} onEdit={onEdit}>
        <Facts items={[["Vehicle types", vehicles.map(label).join(" · "), true], ["Services", form.specialties.map((id) => SIGNUP_SERVICES.find((item) => item.id === id)?.label || id).join(" · "), true],
          ...(form.specialties.includes("towing") ? [["Towing fleet", form.towing_fleet_types.map((id) => FLEETS.find((item) => item.id === id)?.label || id).join(" · "), true] as [string, string, boolean]] : [])]} />
      </Review>
      <Review title="Verification" step={2} onEdit={onEdit}>
        <Facts items={[["Aadhaar", form.aadhaar_number], ["GSTIN", form.gst_number]]} />
        <div className="ad-thumbs">{DOCS.map(([key, name]) => <figure key={key}>{form.documents[key] ? <div style={{ backgroundImage: `url("${photoSrc(form.documents[key])}")`, backgroundSize: "cover", backgroundPosition: "center" }} /> : <div className="is-empty"><Icon name="image" /></div>}<figcaption>{name}</figcaption></figure>)}</div>
      </Review>
      <Review title="Operations" step={3} onEdit={onEdit}>
        <Facts items={[["Availability", form.working_hours.is_24x7 ? "24 × 7" : "Scheduled hours"], ...(!form.working_hours.is_24x7 ? [["Open", form.working_hours.opening_time], ["Close", form.working_hours.closing_time], ["Weekly off", form.working_hours.weekly_off]] as [string, string][] : []), ["Language", form.app_readiness.preferred_language]]} />
      </Review>
      <Review title="Pricing" step={4} onEdit={onEdit}>
        <div className="ad-plines">{form.specialties.map((id) => (
          <div key={id}><b>{SIGNUP_SERVICES.find((item) => item.id === id)?.label || id}</b>
            <span>{vehicles.map((vehicle) => {
              const types = rows.filter((row) => row.pricing_json.service_domain === id && row.pricing_json.vehicle_type === vehicle).map((row) => row.pricing_json.vehicle_subtype_label);
              return `${label(vehicle)}: ${types.length ? types.join(", ") : "not added"}`;
            }).join(" · ")}</span></div>
        ))}</div>
      </Review>
      <Review title="Banking" step={5} onEdit={onEdit}>
        <Facts items={[["Payout methods", modes.join(" · ")], ["UPI ID", form.payment_details.upi_id], ["Bank", form.payment_details.bank_name], ["Account", form.payment_details.bank_account_number ? `•••• ${form.payment_details.bank_account_number.slice(-4)}` : ""], ["IFSC", form.payment_details.ifsc_code]]} />
      </Review>
    </div>
  );
}

function Finish({ form, set, err, agreement, setAgreement, then, setThen, pricedSets }: StepProps & { agreement: boolean; setAgreement: (on: boolean) => void; then: "pending" | "approved"; setThen: (value: "pending" | "approved") => void; pricedSets: number }) {
  const photos = Object.values(form.documents).filter(Boolean).length;
  const who = form.proprietor_name.trim() || "The technician";
  const services = form.specialties.map((id) => SIGNUP_SERVICES.find((item) => item.id === id)?.label.toLowerCase() || id).join(", ");
  return (
    <div className="ad-finish">
      <section className="ad-done"><span className="ad-tick"><Icon name="check" /></span><h3 className="pj">Ready to add {who}</h3>
        <p>{form.name}{services ? ` · ${services}` : ""}{form.location.locality ? ` around ${form.location.locality}` : ""}.</p>
        <Pill tone="ok" icon="verified">{pricedSets} price set{pricedSets === 1 ? "" : "s"} · {photos} of 4 photos · Aadhaar given</Pill>
      </section>
      <section className="ad-card">
        <div className="ad-ch"><Icon name="task_alt" /><div><b>Before adding</b><span>Both are needed, as in the app sign-up.</span></div></div>
        <div className="ad-consent"><Check on={form.consent.agreed} label="The details are correct and they agree to the Terms" onChange={(on) => set("consent", { agreed: on })}><span style={{ display: "flex", flexDirection: "column", gap: 2 }}><b>The details are correct, and {who} agrees to the Terms *</b><span>Including the ResQNow Partner Platform conditions and background verification.</span></span></Check></div>
        {err("consent.agreed") ? <small className="ad-err" role="alert">Confirm the details and the Terms.</small> : null}
        <div className="ad-consent"><Check on={agreement} label="They have read and agreed to the Technician Agreement" onChange={setAgreement}><span style={{ display: "flex", flexDirection: "column", gap: 2 }}><b>{who} has read and agreed to the ResQNow Technician Agreement *</b><span>Read it with them if they have not seen it in the app.</span></span></Check></div>
        {err("agreement") ? <small className="ad-err" role="alert">{err("agreement")}</small> : null}
        <p className="ap-cap" style={{ marginTop: 4 }}>Then</p>
        <div className={`ad-opt${then === "pending" ? " is-on" : ""}`}><Radio on={then === "pending"} name="then" onChange={() => setThen("pending")}><span style={{ display: "flex", flexDirection: "column", gap: 2 }}><b>Send to Applications for a second look</b><span>Saved as waiting, exactly like an app sign-up. This is what the old Add technician page did.</span></span></Radio></div>
        <div className={`ad-opt${then === "approved" ? " is-on" : ""}`}><Radio on={then === "approved"} name="then" onChange={() => setThen("approved")}><span style={{ display: "flex", flexDirection: "column", gap: 2 }}><b>Approve now</b><span>You met {who} and checked the papers. They can come on duty today.</span></span></Radio></div>
        <p className="ad-hint"><Icon name="info" />See <Link to="/admin/applications">Applications</Link> for everyone waiting.</p>
      </section>
    </div>
  );
}
