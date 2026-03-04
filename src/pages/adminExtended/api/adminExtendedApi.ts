import axios from "axios";
import { apiUrl } from "@/lib/api";

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

export type TechnicianRow = {
  technicianId: number;
  name: string;
  status: "Online" | "Offline";
  activeJobs: number;
  rating: number;
  visibility: boolean;
  adminNote: string;
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
  amount: number;
  status: string;
  date: string;
};

export type AnalyticsPayload = {
  requestsPerDay: Array<{ day: string; requestCount: number }>;
  peakHours: Array<{ hourOfDay: number; requestCount: number }>;
  issueCategoryBreakdown: Array<{ issueCategory: string; requestCount: number }>;
  technicianUtilization: Array<{
    technicianId: number;
    technicianName: string;
    activeRequests: number;
    totalAssigned: number;
    utilizationRate: number;
  }>;
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
  const { data } = await adminApi.post("/close", payload);
  return data;
}

export async function getAdminTechnicians(params: {
  page: number;
  limit: number;
  search?: string;
  status?: string;
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
  const { data } = await adminApi.post("/notifications/broadcast", payload);
  return data;
}
