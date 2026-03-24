export const TECHNICIAN_STATUS_FLOW = [
  "pending",
  "assigned",
  "accepted",
  "en-route",
  "arrived",
  "in-progress",
  "payment_pending",
  "paid",
  "completed",
  "cancelled",
  "rejected",
] as const;

export type TechnicianStatus = (typeof TECHNICIAN_STATUS_FLOW)[number];

export const TECHNICIAN_COMPLETION_STATUSES = ["paid", "completed"] as const;

export function normalizeTechnicianStatus(status: unknown): TechnicianStatus {
  const raw = String(status || "").trim().toLowerCase();
  const map: Record<string, TechnicianStatus> = {
    "on-the-way": "en-route",
    "on_the_way": "en-route",
    "on the way": "en-route",
    "en_route": "en-route",
    "in_progress": "in-progress",
    "payment-pending": "payment_pending",
    "awaiting_payment": "payment_pending",
    "awaiting-payment": "payment_pending",
    "awaiting payment": "payment_pending",
  };
  const normalized = map[raw] || raw;
  return (TECHNICIAN_STATUS_FLOW as readonly string[]).includes(normalized)
    ? (normalized as TechnicianStatus)
    : "pending";
}

export function formatTechnicianStatus(status: unknown): string {
  const s = normalizeTechnicianStatus(status);
  if (s === "payment_pending") return "payment pending";
  return s.replace(/-/g, " ");
}

export function isTechnicianCompletionStatus(status: unknown): boolean {
  const normalized = normalizeTechnicianStatus(status);
  return (TECHNICIAN_COMPLETION_STATUSES as readonly string[]).includes(normalized);
}

