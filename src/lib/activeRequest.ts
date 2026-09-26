// Which of the customer's requests to show on home, and how far along it is.

export type RequestSummary = {
  id?: string | number;
  _id?: string;
  service_type?: string | null;
  vehicle_type?: string | null;
  vehicle_model?: string | null;
  status?: string | null;
  serviceStatus?: string | null;
  updated_at?: string;
  created_at?: string;
  technician?: { name?: string | null; phone?: string | null; rating?: number | null } | null;
};

export type ActiveStage = "pending" | "assigned" | "on_the_way" | "arrived" | "in_progress";

const STAGE_BY_STATUS: Record<string, ActiveStage> = {
  pending: "pending",
  accepted: "assigned",
  assigned: "assigned",
  technician_assigned: "assigned",
  on_the_way: "on_the_way",
  "on-the-way": "on_the_way",
  en_route: "on_the_way",
  "en-route": "on_the_way",
  arrived: "arrived",
  in_progress: "in_progress",
  "in-progress": "in_progress",
  service_started: "in_progress",
};

export const STAGE_COPY: Record<ActiveStage, { title: string; step: number }> = {
  pending: { title: "Finding a technician", step: 0 },
  assigned: { title: "Technician assigned", step: 1 },
  on_the_way: { title: "Help is on the way", step: 1 },
  arrived: { title: "Your technician has arrived", step: 2 },
  in_progress: { title: "Fixing your vehicle", step: 3 },
};

export const REQUEST_STEPS = ["Assigned", "On the way", "Arrived", "Fixing"];

export function activeStage(request: RequestSummary): ActiveStage | null {
  const raw = String(request.serviceStatus || request.status || "").trim().toLowerCase();
  return STAGE_BY_STATUS[raw] || null;
}

export function pickActiveRequest(requests: RequestSummary[]): (RequestSummary & { stage: ActiveStage }) | null {
  const active = requests
    .map((request) => ({ ...request, stage: activeStage(request) }))
    .filter((request): request is RequestSummary & { stage: ActiveStage } => request.stage != null)
    .sort((a, b) => String(b.updated_at || b.created_at || "").localeCompare(String(a.updated_at || a.created_at || "")));
  return active[0] || null;
}
