import { adminApi } from "./adminExtendedApi";

// Live request monitoring and the technician record. Every value comes from the backend;
// fields that are not recorded yet arrive as null and are shown as such.

export type MonitorPhase =
  | "finding" | "offered" | "accepted" | "on_the_way" | "arrived" | "working" | "towing" | "payment_due" | "done" | "cancelled";

export type MonitorAlert = { code: string; text: string; level: string; since: string | null; etaMinutes: number | null };

export type MonitorLive = {
  lat: number | null;
  lng: number | null;
  heading: number | null;
  speedKmh: number | null;
  lastSeenAt: string | null;
  gpsStale: boolean;
  etaSeconds: number | null;
  etaCalculatedAt: string | null;
  trafficAware: boolean;
  distanceKm: number | null;
  distanceSource: "route" | "straight" | null;
};

export type MonitorRequest = {
  id: number;
  createdAt: string | null;
  updatedAt: string | null;
  status: string;
  phase: MonitorPhase;
  steps: { done: number; now: number };
  serviceType: string | null;
  vehicleType: string | null;
  vehicleModel: string | null;
  customer: { id: number | null; name: string; phoneMasked: string | null };
  technician: { id: number; name: string; rating: number | null; serviceType: string | null } | null;
  address: string | null;
  location: { lat: number | null; lng: number | null };
  drop: { lat: number | null; lng: number | null; address: string | null } | null;
  fare: number | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  acceptedAt: string | null;
  promisedAt: string | null;
  promiseSource: "accepted" | "sla" | null;
  arrivedAt: string | null;
  workStartedAt: string | null;
  completedAt: string | null;
  search: { sent: number; declined: number; expired: number; pending: number; accepted: number; startedAt: string | null };
  alerts: MonitorAlert[];
  live: MonitorLive | null;
};

export type LiveRequestsResponse = {
  generatedAt: string;
  kpis: {
    live: number;
    finding: number;
    needsAttention: number;
    acceptSecondsToday: number | null;
    arrivalMinutesToday: number | null;
    arrivalsMeasuredToday: number;
    completedToday: number;
  };
  requests: MonitorRequest[];
};

export type TimelineItem = {
  at: string;
  kind: string;
  title: string;
  description: string | null;
  actorType: string | null;
  actorId: string | null;
  meta: Record<string, unknown>;
  source: "timeline" | "stored" | "offers" | "alerts" | "actions";
};

export type MonitorDetail = MonitorRequest & {
  customer: MonitorRequest["customer"] & { phone: string | null; requestNumber: number | null };
  technician: (NonNullable<MonitorRequest["technician"]> & { phone: string | null; phoneMasked: string | null; jobsCompleted: number | null }) | null;
  bill: { total: number | null; base: number | null; platformFee: number | null; paymentMethod: string | null; paymentStatus: string | null };
  cancellationReason: string | null;
  timeline: TimelineItem[];
  offers: Array<{ technicianId: number; name: string; result: string; sentAt: string | null }>;
  trail: Array<{ lat: number; lng: number; at: string | null }>;
};

export type ReplayDetail = Omit<MonitorDetail, "trail"> & {
  trail: Array<{ lat: number; lng: number; at: string | null; speedKmh: number | null }>;
  summary: {
    promisedAt: string | null;
    arrivedAt: string | null;
    lateMinutes: number | null;
    distanceKm: number | null;
    workMinutes: number | null;
    rating: number | null;
    ratingComment: string | null;
  };
};

export type TechnicianRecord = {
  technician: {
    id: number;
    name: string;
    phone: string | null;
    phoneMasked: string | null;
    serviceType: string | null;
    status: string | null;
    onDuty: boolean;
    available: boolean;
    currentRequestId: number | null;
    place: string | null;
    joinedAt: string | null;
    lastSeenAt: string | null;
  };
  kpis: {
    jobsCompleted: number;
    jobsThisWeek: number;
    jobsLastWeek: number;
    offers: { sent: number; accepted: number; declined: number; expired: number; pending: number };
    acceptanceRate: number | null;
    removedByAdmin: number;
    customerCancelledAfterAccepting: number;
    onTimeRate: number | null;
    arrivalsJudged: number;
    averageMinutesToArrive: number | null;
    arrivalsMeasured: number;
    rating: number | null;
    ratingCount: number;
    lowRatings: number;
    earnedThisMonth: number;
    earnedTotal: number;
    duesOwed: number;
  };
  weekly: Array<{ weekStart: string; jobs: number }>;
  flags: Array<{ kind: "late" | "review" | "expired"; title: string; text: string; at?: string; tab: "reliability" | "reviews" }>;
  reliability: {
    offers: { sent: number; accepted: number; declined: number; expired: number; pending: number };
    removedByAdmin: Array<{ requestId: number; at: string | null }>;
    customerCancelled: Array<{ requestId: number; at: string | null; reason: string | null; serviceType: string | null }>;
    arrivals: { onTime: number; late1to5: number; late6to10: number; lateOver10: number };
    arrivalsJudged: number;
    late: Array<{ requestId: number; serviceType: string | null; promisedAt: string | null; arrivedAt: string | null; lateMinutes: number | null }>;
    alerts: Array<{ code: string; label: string; count: number }>;
    alertsSince: string;
  };
  reviews: { average: number | null; count: number; distribution: Array<{ stars: number; count: number }> };
};

export type Paged<T> = { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } };

export type TechnicianJob = {
  id: number;
  createdAt: string | null;
  status: string;
  phase: MonitorPhase;
  serviceType: string | null;
  customer: string;
  distanceKm: number | null;
  promisedAt: string | null;
  arrivedAt: string | null;
  lateMinutes: number | null;
  workMinutes: number | null;
  fare: number | null;
  paymentMethod: string | null;
  paymentStatus: string | null;
  rating: number | null;
};

export type TechnicianReview = { id: number; requestId: number | null; rating: number | null; comment: string | null; createdAt: string | null; customer: string; serviceType: string | null };

export async function getLiveRequests() {
  const { data } = await adminApi.get<LiveRequestsResponse>("/monitor/live");
  return data;
}

export async function getRequestMonitor(requestId: number) {
  const { data } = await adminApi.get<MonitorDetail>(`/monitor/requests/${requestId}`);
  return data;
}

export async function getRequestReplay(requestId: number) {
  const { data } = await adminApi.get<ReplayDetail>(`/monitor/requests/${requestId}/replay`);
  return data;
}

export async function addRequestNote(requestId: number, note: string) {
  const { data } = await adminApi.post(`/monitor/requests/${requestId}/notes`, { note });
  return data;
}

export async function getTechnicianRecord(technicianId: number) {
  const { data } = await adminApi.get<TechnicianRecord>(`/monitor/technicians/${technicianId}/record`);
  return data;
}

export async function getTechnicianJobs(technicianId: number, params: { page: number; limit?: number; days?: number | null; status?: string; search?: string }) {
  const { data } = await adminApi.get<Paged<TechnicianJob>>(`/monitor/technicians/${technicianId}/jobs`, { params });
  return data;
}

export async function getTechnicianReviews(technicianId: number, params: { page: number; limit?: number }) {
  const { data } = await adminApi.get<Paged<TechnicianReview>>(`/monitor/technicians/${technicianId}/reviews`, { params });
  return data;
}
