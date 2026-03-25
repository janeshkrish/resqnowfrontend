import axios from "axios";
import { apiFetch, apiUrl, readJsonSafely } from "@/lib/api";

const adminApi = axios.create({
  baseURL: apiUrl("/api/admin"),
  timeout: 20000,
  headers: {
    "Content-Type": "application/json",
  },
});

function getAdminExtendedAuthToken(): string {
  return (
    window.localStorage.getItem("resqnow_admin_token") ||
    window.localStorage.getItem("adminToken") ||
    window.localStorage.getItem("token") ||
    ""
  );
}

adminApi.interceptors.request.use((config) => {
  const token = getAdminExtendedAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      "Request failed.";
    return Promise.reject(new Error(message));
  }
);

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export type DashboardMetrics = {
  activeRequests: number;
  availableTechnicians: number;
  completedToday: number;
  avgResponseTime: number;
  todayRevenue: number;
  pendingPayments: number;
};

export type AdminRequestRow = {
  requestId: number;
  user: string;
  issueType: string;
  location: string;
  assignedTechnician: string;
  status: string;
  priority: string;
  createdTime: string;
};

export type CommandCenterReason = {
  id: number;
  code: string;
  text: string;
  riskLevel: "yellow" | "red" | "green" | string;
  lastDetectedAt: string;
};

export type CommandCenterJob = {
  requestId: number;
  jobId: number;
  serviceType: string;
  status: string;
  customerLocation: {
    address: string;
    lat: number | null;
    lng: number | null;
  };
  technician: {
    id: number;
    name: string;
    phone: string;
    rating: number | null;
    acceptanceRate: number | null;
    currentLat: number | null;
    currentLng: number | null;
  };
  reasons: CommandCenterReason[];
  etaMinutes: number | null;
  etaArrival: string | null;
  slaDeadline: string | null;
  timeRemainingMs: number | null;
  riskLevel: "yellow" | "red" | "green" | string;
  firstDetectedAt: string;
  lastDetectedAt: string;
};

export type CommandCenterExceptionsResponse = {
  title: string;
  monitor: {
    running: boolean;
    intervalMs: number;
    lastRunAt: string | null;
    lastError: string | null;
  };
  data: CommandCenterJob[];
};

export type CommandCenterMonitorRunResponse = {
  success: boolean;
  trigger: string;
  jobsScanned: number;
  alertsDetected: number;
  alertsResolved: number;
  workerFailures?: number;
  workerErrors?: Array<{ index: number; message: string }>;
  googleCallsRemaining?: number;
};

export type TechnicianRow = {
  technicianId: number;
  name: string;
  status: "Online" | "Offline";
  loginStatus: "Logged In" | "Logged Out" | string;
  activeJobs: number;
  rating: number;
  visibility: boolean;
  adminNote: string;
  lastLoginAt: string | null;
  lastLogoutAt: string | null;
  lastSeenAt: string | null;
  currentSessionStartedAt: string | null;
  currentSessionHours: number;
  loggedInHours24h: number;
  loggedInHoursTotal: number;
  inactivityAlertSentAt: string | null;
};

export type BroadcastTechnician = {
  id: number;
  category?: string;
  categories?: string[];
  region?: string;
  status?: string;
};

export type BroadcastTechnicianFilters = {
  categories?: string[];
  region?: string;
  status?: string;
};

export type TechnicianLoginActivityDetails = {
  technicianId: number;
  name: string;
  email: string;
  approvalStatus: string;
  availabilityStatus: "Online" | "Offline" | string;
  loginStatus: "Logged In" | "Logged Out" | string;
  visibility: boolean;
  lastLoginAt: string | null;
  lastLogoutAt: string | null;
  lastSeenAt: string | null;
  inactivityAlertSentAt: string | null;
  currentSessionStartedAt: string | null;
  currentSessionHours: number;
  loggedInHours24h: number;
  loggedInHours7d: number;
  loggedInHoursTotal: number;
};

export type TechnicianLoginSessionRow = {
  sessionId: number;
  loginAt: string | null;
  lastSeenAt: string | null;
  logoutAt: string | null;
  isActive: boolean;
  endedReason: string | null;
  source: string | null;
  durationSeconds: number;
  durationHours: number;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type TechnicianLoginAlertRow = {
  alertId: number;
  alertType: string;
  status: string;
  message: string;
  sentAt: string | null;
  createdAt: string | null;
  metadata: Record<string, unknown> | null;
};

export type TechnicianLoginActivityResponse = {
  generatedAt?: string;
  technician: TechnicianLoginActivityDetails;
  sessions: TechnicianLoginSessionRow[];
  alerts: TechnicianLoginAlertRow[];
};

export type FinanceSummary = {
  todayRevenue: number;
  pendingPayments: number;
  completedTransactions: number;
};

export type FinanceTransactionRow = {
  transactionId: number;
  requestId?: number | null;
  user: string;
  technician: string;
  upiId?: string | null;
  amount: number;
  platformFee?: number;
  paymentFee?: number;
  platformRevenue?: number;
  technicianAmount: number;
  paymentToTechnicianStatus: "pending" | "processing" | "completed" | "not_applicable" | string;
  status: string;
  date: string;
};

export type PayoutQueueRow = {
  walletId: number;
  technicianId: number;
  technicianName: string;
  technicianEmail: string;
  upiId?: string | null;
  currency: string;
  withdrawableBalance: number;
  totalEarned: number;
  totalPaidOut: number;
  lastTransactionAt?: string | null;
};

export type TechnicianWalletBalanceRow = {
  walletId: number;
  technicianId: number;
  technicianName: string;
  technicianEmail: string;
  upiId?: string | null;
  currency: string;
  withdrawableBalance: number;
  totalEarned: number;
  totalPaidOut: number;
  onHoldBalance: number;
  lastTransactionAt?: string | null;
  walletUpdatedAt?: string | null;
};

export type PayoutHistoryRow = {
  id: number;
  payoutReference: string;
  idempotencyKey?: string | null;
  technicianId: number;
  technicianName: string;
  upiId?: string | null;
  amount: number;
  currency: string;
  status: string;
  payoutMethod?: string | null;
  externalReference?: string | null;
  destinationReference?: string | null;
  notes?: string | null;
  processedBy?: string | null;
  processedAt?: string | null;
  createdAt: string;
};

export type AnalyticsPayload = {
  totalTechnicians: number;
  totalRequests: number;
  activeUsers: number;
  revenue: number;
  requestsOverTime: Array<{ date: string; count: number }>;
  serviceDistribution: Array<{ name: string; value: number; color?: string }>;
  requestsPerDay?: Array<{ day: string; requestCount: number }>;
  peakHours?: Array<{ hourOfDay: number; requestCount: number }>;
  issueCategoryBreakdown?: Array<{ issueCategory: string; requestCount: number }>;
  technicianUtilization?: Array<{
    technicianId: number;
    technicianName: string;
    activeRequests: number;
    totalAssigned: number;
    utilizationRate: number;
  }>;
};

export type AdminNotificationRow = {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean | number;
  created_at: string;
};

export type ComplaintRow = {
  complaintId: number;
  complaintTitle: string;
  description: string;
  user: string;
  assignedAdmin: string;
  status: string;
  severity: string;
  createdDate: string;
};

export async function getDashboardMetrics() {
  const { data } = await adminApi.get<DashboardMetrics>("/dashboard");
  return data;
}

export async function getAdminRequests(params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  priority?: string;
}) {
  const { data } = await adminApi.get<{ data: AdminRequestRow[]; pagination: Pagination }>("/requests", {
    params,
  });
  return data;
}

export async function assignAdminRequest(payload: { requestId: number; technicianId: number }) {
  const { data } = await adminApi.post("/assign", payload);
  return data;
}

export async function escalateAdminRequest(payload: { requestId: number; reason?: string; radiusKm?: number }) {
  const { data } = await adminApi.post("/escalate", payload);
  return data;
}

export async function markAdminRequestHighPriority(payload: { requestId: number; note?: string }) {
  const { data } = await adminApi.post("/requests/high-priority", payload);
  return data;
}

export async function closeAdminRequest(payload: { requestId: number; status?: string; reason?: string }) {
  const { data } = await adminApi.post("/requests/close", payload);
  return data;
}

export async function getCommandCenterExceptions() {
  const { data } = await adminApi.get<CommandCenterExceptionsResponse>("/command-center/exceptions");
  return data;
}

export async function getCommandCenterTrack(requestId: number, limit = 80) {
  const { data } = await adminApi.get<{ requestId: number; points: Array<{ id: number; lat: number | null; lng: number | null; capturedAt: string }> }>(
    `/command-center/tracks/${requestId}`,
    { params: { limit } }
  );
  return data;
}

export async function runCommandCenterMonitorCycle() {
  const { data } = await adminApi.post<CommandCenterMonitorRunResponse>("/command-center/monitor/run");
  return data;
}

export async function remindCommandCenterTechnician(payload: { requestId: number }) {
  const { data } = await adminApi.post("/command-center/actions/remind-technician", payload);
  return data;
}

export async function callCommandCenterTechnician(payload: { requestId: number }) {
  const { data } = await adminApi.post("/command-center/actions/call-technician", payload);
  return data;
}

export async function reassignCommandCenterJob(payload: { requestId: number; radiusKm?: number; maxCandidates?: number }) {
  const { data } = await adminApi.post("/command-center/actions/reassign", payload);
  return data;
}

export async function escalateCommandCenterJob(payload: { requestId: number; radiusKm?: number }) {
  const { data } = await adminApi.post("/command-center/actions/escalate", payload);
  return data;
}

export async function getAdminTechnicians(params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
  loginStatus?: string;
  visibility?: string;
}) {
  const { data } = await adminApi.get<{ data: TechnicianRow[]; pagination: Pagination }>("/technicians", {
    params,
  });
  return data;
}

export async function toggleAdminTechnicianVisibility(payload: {
  technicianId: number;
  isVisible?: boolean;
  note?: string;
}) {
  const { data } = await adminApi.post("/technician/toggle", payload);
  return data;
}

export async function addAdminTechnicianNote(payload: { technicianId: number; note: string }) {
  const { data } = await adminApi.post("/technician/note", payload);
  return data;
}

export async function sendAdminTechnicianLoginReminder(payload: {
  technicianId: number;
  message?: string;
}) {
  const { data } = await adminApi.post("/technician/send-login-reminder", payload);
  return data;
}

export async function getAdminTechnicianLoginActivity(
  technicianId: number,
  params: { sessionLimit?: number; alertLimit?: number } = {}
) {
  const { data } = await adminApi.get<TechnicianLoginActivityResponse>(
    `/technician/${technicianId}/login-activity`,
    { params }
  );
  return data;
}

export async function getFinanceSummary() {
  const { data } = await adminApi.get<FinanceSummary>("/finance/summary");
  return data;
}

export async function getFinanceTransactions(params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
}) {
  const { data } = await adminApi.get<{ data: FinanceTransactionRow[]; pagination: Pagination }>(
    "/finance/transactions",
    { params }
  );
  return data;
}

export async function markTechnicianPaymentCompleted(transactionId: number) {
  const { data } = await adminApi.post<{
    success: boolean;
    transactionId: number;
    paymentToTechnicianStatus: "completed";
    alreadyCompleted?: boolean;
    payoutId?: number | null;
  }>(`/pay-technician/${transactionId}`);
  return data;
}

export async function getTechnicianWalletBalances(params: {
  page: number;
  limit: number;
  search?: string;
  onlyPositiveBalance?: boolean;
}) {
  const { data } = await adminApi.get<{ data: TechnicianWalletBalanceRow[]; pagination: Pagination }>(
    "/finance/wallets",
    { params }
  );
  return data;
}

export async function triggerWalletPayout(payload: {
  technicianId: number;
  amount?: number | null;
  payoutMethod?: string;
  notes?: string;
  externalReference?: string;
  idempotencyKey?: string;
}) {
  const { data } = await adminApi.post<{
    success: boolean;
    payoutId: number;
    technicianId: number;
    amount: number;
    alreadyProcessed?: boolean;
    idempotencyReused?: boolean;
    wallet?: {
      total_earned: number;
      withdrawable_balance: number;
      total_paid_out: number;
      on_hold_balance: number;
      currency: string;
    };
  }>("/finance/payouts", payload);
  return data;
}

export async function getPayoutHistory(params: {
  page: number;
  limit: number;
  search?: string;
}) {
  const { data } = await adminApi.get<{ data: PayoutHistoryRow[]; pagination: Pagination }>(
    "/finance/payouts",
    { params }
  );
  return data;
}

export async function getPayoutQueue(limit = 500) {
  const { data } = await adminApi.get<{ data: PayoutQueueRow[]; total: number }>("/finance/payout-queue", {
    params: { limit },
  });
  return data;
}

export async function exportPayoutQueueCsv(limit = 500) {
  const response = await adminApi.get("/finance/payout-queue/export", {
    params: { limit },
    responseType: "blob",
  });
  return response.data as Blob;
}

export async function exportFinanceCsv(days = 30) {
  const response = await adminApi.get("/finance/export", {
    params: { days },
    responseType: "blob",
  });
  return response.data as Blob;
}

export async function getFlaggedPayments(limit = 100) {
  const { data } = await adminApi.get<{ data: Array<FinanceTransactionRow & { flagReason: string }> }>(
    "/finance/flagged",
    { params: { limit } }
  );
  return data;
}

export async function getFinanceAuditLogs(limit = 50) {
  const { data } = await adminApi.get<{ data: Array<{ id: number; action_type: string; created_at: string }> }>(
    "/finance/audit-logs",
    { params: { limit } }
  );
  return data;
}

export async function getAnalytics() {
  const { data } = await adminApi.get<AnalyticsPayload>("/analytics");
  return data;
}

export async function createComplaint(payload: { title: string; description?: string }) {
  const { data } = await adminApi.post("/complaints", payload);
  return data;
}

export async function getComplaints(params: { page: number; limit: number; status?: string }) {
  const { data } = await adminApi.get<{ data: ComplaintRow[]; pagination: Pagination }>("/complaints", {
    params,
  });
  return data;
}

export async function assignComplaint(payload: {
  complaintId: number;
  assignedAdminId: string;
  note?: string;
}) {
  const { data } = await adminApi.post("/complaints/assign", payload);
  return data;
}

export async function resolveComplaint(payload: { complaintId: number; resolutionNote?: string }) {
  const { data } = await adminApi.post("/complaints/resolve", payload);
  return data;
}

export async function addComplaintInternalNote(payload: {
  complaintId: number;
  note: string;
  metadata?: Record<string, unknown>;
}) {
  const { data } = await adminApi.post("/complaints/internal-note", payload);
  return data;
}

export async function broadcastNotification(payload: {
  type: "system" | "technician" | "emergency";
  title: string;
  message: string;
  technicianIds?: number[];
}) {
  if (payload.type === "technician") {
    const { data } = await adminApi.post("/notifications/technician", payload);
    return data;
  }
  if (payload.type === "emergency") {
    const { data } = await adminApi.post("/notifications/emergency", payload);
    return data;
  }
  const { data } = await adminApi.post("/notifications/system", payload);
  return data;
}

export async function sendSystemAnnouncement(payload: { title: string; message: string }) {
  const { data } = await adminApi.post("/notifications/system", payload);
  return data;
}

export async function sendTechnicianBroadcast(payload: {
  title: string;
  message: string;
  technicianIds: number[];
}) {
  const { data } = await adminApi.post("/notifications/technician", payload);
  return data;
}

const normalizeBroadcastTechnician = (value: any): BroadcastTechnician | null => {
  const rawId = Number(value?.id ?? value?.technicianId);
  if (!Number.isInteger(rawId) || rawId <= 0) return null;

  const categoryValues = Array.isArray(value?.categories)
    ? value.categories
    : Array.isArray(value?.specialties)
      ? value.specialties
      : typeof value?.category === "string"
        ? value.category.split(",")
        : [];

  const categories = categoryValues
    .map((item: unknown) => String(item || "").trim())
    .filter(Boolean);

  const region = String(
    value?.region ??
      value?.city ??
      value?.zone ??
      value?.area ??
      value?.location?.city ??
      value?.location?.zone ??
      value?.location?.area ??
      ""
  ).trim();

  const status = String(
    value?.status ??
      value?.availability_status ??
      (typeof value?.is_active === "boolean" ? (value.is_active ? "online" : "offline") : "")
  )
    .trim()
    .toLowerCase();

  return {
    id: rawId,
    category: categories[0] || (typeof value?.category === "string" ? value.category.trim() : ""),
    categories,
    region,
    status,
  };
};

export async function getBroadcastTechnicians(
  filters: BroadcastTechnicianFilters = {}
): Promise<BroadcastTechnician[]> {
  const params = new URLSearchParams();
  if (filters.categories?.length) {
    params.set("category", filters.categories.join(","));
  }
  if (filters.region) {
    params.set("region", filters.region);
  }
  if (filters.status) {
    params.set("status", filters.status);
  }

  const path = params.size ? `/api/technicians?${params.toString()}` : "/api/technicians";

  try {
    const response = await apiFetch(path, { admin: true });
    if (!response.ok) {
      const body = await readJsonSafely<{ error?: string; message?: string }>(response);
      throw new Error(body?.error || body?.message || "Unable to load technicians.");
    }

    const data = await readJsonSafely<any>(response);
    const technicians = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];

    return technicians
      .map((item: unknown) => normalizeBroadcastTechnician(item))
      .filter((item: BroadcastTechnician | null): item is BroadcastTechnician => Boolean(item));
  } catch (error: any) {
    const message =
      error?.response?.data?.error ||
      error?.response?.data?.message ||
      error?.message ||
      "Unable to load technicians.";
    throw new Error(message);
  }
}

export async function sendEmergencyMessage(payload: { title: string; message: string }) {
  const { data } = await adminApi.post("/notifications/emergency", payload);
  return data;
}

export async function getAdminNotifications(params: { limit?: number; offset?: number } = {}) {
  const { data } = await adminApi.get<AdminNotificationRow[]>("/notifications", { params });
  return data;
}

export async function deleteAdminNotification(id: number) {
  const { data } = await adminApi.delete(`/notifications/${id}`);
  return data;
}
