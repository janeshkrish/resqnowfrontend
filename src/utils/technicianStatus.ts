export const TECHNICIAN_STATUS_FLOW = [
  "pending",
  "assigned",
  "accepted",
  "en_route_pickup",
  "arrived_pickup",
  "vehicle_loaded",
  "enroute_drop",
  "arrived_drop",
  "service_completed",
  "en-route",
  "arrived",
  "in-progress",
  "payment_pending",
  "paid",
  "completed",
  "closed",
  "cancelled",
  "rejected",
] as const;

export type TechnicianStatus = (typeof TECHNICIAN_STATUS_FLOW)[number];

export const TECHNICIAN_COMPLETION_STATUSES = ["paid", "completed", "closed"] as const;

export function normalizeTechnicianStatus(status: unknown): TechnicianStatus {
  const raw = String(status || "").trim().toLowerCase();
  const map: Record<string, TechnicianStatus> = {
    requested: "pending",
    "on-the-way": "en-route",
    "on_the_way": "en-route",
    "on the way": "en-route",
    "en_route": "en-route",
    "en route pickup": "en_route_pickup",
    "en-route-pickup": "en_route_pickup",
    "arrived pickup": "arrived_pickup",
    "arrived-pickup": "arrived_pickup",
    "vehicle loaded": "vehicle_loaded",
    "vehicle-loaded": "vehicle_loaded",
    "tow_started": "enroute_drop",
    "tow-started": "enroute_drop",
    "tow started": "enroute_drop",
    "start_tow": "enroute_drop",
    "start tow": "enroute_drop",
    "en_route_drop": "enroute_drop",
    "en-route-drop": "enroute_drop",
    "enroute drop": "enroute_drop",
    "arrived_drop": "arrived_drop",
    "arrived-drop": "arrived_drop",
    "arrived drop": "arrived_drop",
    "service_completed": "service_completed",
    "service-completed": "service_completed",
    "service completed": "service_completed",
    service_started: "in-progress",
    "service-started": "in-progress",
    "service started": "in-progress",
    "in_progress": "in-progress",
    completed_pending_payment: "payment_pending",
    payment_in_progress: "payment_pending",
    "payment-pending": "payment_pending",
    "awaiting_payment": "payment_pending",
    "awaiting-payment": "payment_pending",
    "awaiting payment": "payment_pending",
    cancelled_by_user: "cancelled",
    job_closed: "closed",
    "job-closed": "closed",
  };
  const normalized = map[raw] || raw;
  return (TECHNICIAN_STATUS_FLOW as readonly string[]).includes(normalized)
    ? (normalized as TechnicianStatus)
    : "pending";
}

export function formatTechnicianStatus(status: unknown): string {
  const s = normalizeTechnicianStatus(status);
  if (s === "payment_pending") return "payment pending";
  if (s === "en_route_pickup") return "en route to pickup";
  if (s === "arrived_pickup") return "arrived at pickup";
  if (s === "vehicle_loaded") return "vehicle loaded";
  if (s === "enroute_drop") return "towing to drop";
  if (s === "arrived_drop") return "arrived at drop";
  if (s === "service_completed") return "service completed";
  return s.replace(/-/g, " ");
}

export function isTechnicianCompletionStatus(status: unknown): boolean {
  const normalized = normalizeTechnicianStatus(status);
  return (TECHNICIAN_COMPLETION_STATUSES as readonly string[]).includes(normalized);
}

