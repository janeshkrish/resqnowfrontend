import { vehicleClassInfo } from "@/lib/vehicleClasses";

/**
 * What the customer told us in the request form, as the technician sees it on the job
 * alert, the active job and the request list. The backend sends it ready-made
 * (resqnowbackend/services/technicianJobDetails.js); older rows only carry request_details_json.
 */
export type TechnicianJobDetails = {
  vehicleLine: string | null;
  towTruckLabel: string | null;
  problem: string[];
  landmark: string | null;
  plate: string | null;
  customerNote: string | null;
  urgent: boolean;
  urgentReason: string | null;
  attachments: Array<{ type: "photo" | "voice"; url: string }>;
};

type Row = Record<string, unknown>;

const TRUCKS: Record<string, string> = { flatbed: "Flatbed", "wheel-lift": "Wheel-lift", "heavy-duty-wrecker": "Heavy-duty wrecker" };
const UPLOAD_PATH = /^\/api\/upload\/files\/[A-Za-z0-9._-]+$/;

const text = (value: unknown) => {
  const clean = String(value ?? "").trim();
  return clean || null;
};

const asRow = (value: unknown): Row | null => {
  if (!value) return null;
  if (typeof value === "object") return value as Row;
  try {
    const parsed: unknown = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? (parsed as Row) : null;
  } catch {
    return null;
  }
};

const rows = (value: unknown): Row[] => (Array.isArray(value) ? value.filter((entry): entry is Row => Boolean(entry) && typeof entry === "object") : []);

export function readJobDetails(input: unknown): TechnicianJobDetails | null {
  const raw = asRow(typeof input === "object" ? input : null);
  if (!raw) return null;
  const stored = asRow(raw.request_details_json ?? raw.requestDetails ?? raw.details);
  const answers = Array.isArray(raw.answers) ? rows(raw.answers) : rows(stored?.answers);
  const problem = (Array.isArray(raw.problem) ? raw.problem : answers.map((answer) => answer.label))
    .map((entry) => text(entry))
    .filter((entry): entry is string => Boolean(entry));

  const brand = text(raw.vehicleBrand ?? raw.vehicle_brand);
  const model = text(raw.vehicleName ?? raw.vehicle_model ?? raw.vehicleModel);
  const subtype = text(raw.vehicleSubtype ?? raw.vehicle_subtype);
  const subtypeLabel = text(raw.vehicleSubtypeLabel) ?? vehicleClassInfo(subtype)?.label ?? null;
  const name = brand && model && !model.toLowerCase().startsWith(brand.toLowerCase()) ? `${brand} ${model}` : model;
  const vehicleLine = text(raw.vehicleLine) ?? ([name, subtypeLabel].filter(Boolean).join(" · ") || null);
  const truck = text(raw.towTruckType ?? raw.tow_truck_type);

  const answerValue = (id: string) => answers.find((answer) => answer.id === id)?.value;
  const inside = answerValue("inside") === "yes";
  const hurt = answerValue("hurt") === "yes";
  const urgent = Boolean(raw.urgent ?? stored?.urgent) || inside || hurt;

  const attachments = (Array.isArray(raw.attachments) ? rows(raw.attachments) : rows(stored?.attachments))
    .filter((item) => (item.type === "photo" || item.type === "voice") && UPLOAD_PATH.test(String(item.url || "")))
    .map((item) => ({ type: item.type as "photo" | "voice", url: String(item.url) }));

  const details: TechnicianJobDetails = {
    vehicleLine,
    towTruckLabel: text(raw.towTruckLabel) ?? (truck ? TRUCKS[truck] ?? truck : null),
    problem,
    landmark: text(raw.landmark ?? stored?.landmark),
    plate: text(raw.plate ?? stored?.plate),
    customerNote: text(raw.customerNote ?? stored?.note),
    urgent,
    urgentReason: inside ? "Someone is stuck inside the vehicle" : hurt ? "Someone is hurt" : urgent ? "Marked urgent by the customer" : null,
    attachments,
  };
  const hasAnything =
    details.problem.length || details.landmark || details.plate || details.customerNote || details.attachments.length ||
    details.towTruckLabel || subtypeLabel || urgent;
  return hasAnything ? details : null;
}
