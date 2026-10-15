import axios from "axios";
import { apiUrl } from "@/lib/api";
import { adminApi } from "@/pages/adminExtended/api/adminExtendedApi";

// The admin portal's reads. Every value comes from the backend; things that are not recorded come back as null.

/** Calls outside /api/admin (technician sign-up and approval routes) with the same admin token. */
export const rootApi = axios.create({ baseURL: apiUrl("/api"), timeout: 30000, headers: { "Content-Type": "application/json" } });
rootApi.interceptors.request.use((config) => {
  const token = window.localStorage.getItem("resqnow_admin_token") || window.localStorage.getItem("adminToken") || "";
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
rootApi.interceptors.response.use((response) => response, (error) => {
  const message = error?.response?.data?.error || error?.response?.data?.message || error?.message || "Request failed.";
  return Promise.reject(new Error(message));
});

export type Paged<T> = { rows: T[]; total: number; page: number; limit: number; totalPages: number };

export type NavCounts = { live: number; alerts: number; applications: number; payouts: number; complaints: number };
export const getNavCounts = async () => (await adminApi.get<NavCounts>("/portal/nav-counts")).data;

export type TodayAlert = { requestId: number; code: string; text: string; level: string; since: string | null; service: string | null; customer: string | null; technician: string | null };
export type Today = {
  generatedAt: string;
  completed: { today: number; sameTimeLastWeek: number };
  cancelledToday: number;
  requestsToday: number;
  requestsByHour: { today: number[]; lastWeek: number[]; currentHour: number };
  serviceMix: { service: string; count: number }[];
  money: {
    collected: number; payments: number; online: { amount: number; count: number }; cash: { amount: number; count: number };
    toTechnicians: number; toResqnow: number; payoutsWaiting: { amount: number; count: number }; cashDues: { amount: number; technicians: number };
  };
  technicians: { approved: number; onDuty: number; onJob: number; free: number; freePositions: { id: number; name: string; position: { lat: number; lng: number } }[] };
  needs: {
    alerts: TodayAlert[];
    applications: { count: number; oldest: { id: number; name: string; since: string | null } | null };
    payouts: { count: number; amount: number; names: string[] };
    complaints: { count: number; olderThanDay: number; latest: { id: number; title: string } | null };
  };
};
export const getToday = async () => (await adminApi.get<Today>("/portal/today")).data;

export type SearchResults = {
  query: string;
  requests: { id: number; status: string; phase: string; service: string | null; vehicleType: string | null; vehicleModel: string | null; area: string | null; createdAt: string | null; fare: number | null; customer: string | null; technician: string | null }[];
  customers: { id: number; name: string | null; email: string | null; phoneMasked: string | null; joinedAt: string | null; plan: string | null; requests: number }[];
  technicians: { id: number; name: string; owner: string | null; phoneMasked: string | null; status: string; onDuty: boolean; currentJobId: number | null; service: string | null }[];
  payments: { kind: "payment" | "payout"; id: number; requestId?: number; technicianId?: number; technician?: string | null; method?: string; status: string; amount: number | null; reference: string | null; at: string | null }[];
};
export const searchEverything = async (q: string) => (await adminApi.get<SearchResults>("/portal/search", { params: { q } })).data;

export type RequestRow = {
  id: number; status: string; phase: string; createdAt: string | null; completedAt: string | null;
  service: string | null; vehicleType: string | null; vehicleModel: string | null; area: string | null; drop: string | null;
  customer: { id: number; name: string | null } | null;
  technician: { id: number; name: string | null; rating: number | null } | null;
  promisedAt: string | null; arrivedAt: string | null; lateMinutes: number | null; workMinutes: number | null;
  fare: number | null; margin: number | null;
  payment: { method: string | null; state: string | null; paid: boolean; refunded: number };
  priority: "high" | "normal";
};
export type RequestTab = "all" | "live" | "completed" | "cancelled" | "payment_due" | "refunded";
export type RequestList = Paged<RequestRow> & { counts: Record<RequestTab, number>; from: string; to: string };
export type RequestQuery = { tab?: RequestTab; days?: number; service?: string; payment?: string; priority?: string; technicianId?: number; customerId?: number; search?: string; page?: number; limit?: number };
export const listRequests = async (params: RequestQuery) => (await adminApi.get<RequestList>("/portal/requests", { params })).data;

export type TechnicianRow = {
  id: number; name: string; owner: string | null; phoneMasked: string | null; area: string | null; services: string[]; vehicles: string[];
  now: { state: "on_job"; jobId: number; jobStatus: string | null; jobService: string | null; alert: { code: string; text: string } | null }
    | { state: "free" } | { state: "offline"; lastSeenAt: string | null };
  hidden: boolean; jobs30: number; onTimeRate: number | null; rating: number | null; reviews: number; acceptRate: number | null; offers30: number;
  onDutyTodayMinutes: number; dues: number; joinedAt: string | null; needsLook: boolean;
};
export type TechnicianTab = "all" | "on_duty" | "on_job" | "offline" | "hidden" | "needs_look";
export type TechnicianList = Paged<TechnicianRow> & { counts: Record<TechnicianTab, number> };
export const listTechnicians = async (params: { tab?: TechnicianTab; search?: string; service?: string; page?: number; limit?: number }) =>
  (await adminApi.get<TechnicianList>("/portal/technicians", { params })).data;

export type TechnicianPayouts = {
  wallet: { totalEarned: number; withdrawable: number; paidOut: number; onHold: number; lastActivityAt: string | null };
  requests: { id: number; amount: number; status: string; upi: string | null; reason: string | null; utr: string | null; at: string | null; paidAt: string | null }[];
  payouts: { id: number; amount: number; status: string; method: string | null; utr: string | null; to: string | null; at: string | null }[];
  dues: { id: number; requestId: number | null; amount: number; status: string; at: string | null }[];
};
export const getTechnicianPayouts = async (id: number) => (await adminApi.get<TechnicianPayouts>(`/portal/technicians/${id}/payouts`)).data;

export type CustomerRow = {
  id: number; name: string | null; email: string | null; phoneMasked: string | null; joinedAt: string | null; plan: string | null; status: string | null;
  vehicles: string[]; requests: number; cancelled: number; spent: number; lastRequestAt: string | null; liveRequestId: number | null;
};
export type CustomerTab = "all" | "active" | "members" | "live";
export type CustomerList = Paged<CustomerRow> & { counts: Record<CustomerTab, number>; joinedThisMonth: number };
export const listCustomers = async (params: { tab?: CustomerTab; search?: string; page?: number; limit?: number }) =>
  (await adminApi.get<CustomerList>("/portal/customers", { params })).data;

export type CustomerDetail = {
  id: number; name: string | null; email: string | null; phoneMasked: string | null; phone: string | null; joinedAt: string | null; plan: string | null; status: string | null;
  signsInWith: "phone" | "email" | "google";
  live: { id: number; status: string; phase: string; service: string | null; technician: string | null } | null;
  totals: { requests: number; cancelled: number; spent: number; paidJobs: number; ratingGiven: number | null; ratings: number };
  requests: { id: number; status: string; phase: string; service: string | null; vehicleType: string | null; vehicleModel: string | null; createdAt: string | null; fare: number | null; technician: { id: number; name: string } | null; rating: number | null }[];
  payments: { id: number; requestId: number | null; method: string | null; status: string; amount: number | null; refunded: number; reference: string | null; at: string | null }[];
  vehicles: { id: number; type: string; make: string | null; model: string | null; plate: string | null }[];
  notes: { id: number; by: string; text: string; at: string | null }[];
};
export const getCustomer = async (id: number) => (await adminApi.get<CustomerDetail>(`/portal/customers/${id}`)).data;
export const addCustomerNote = async (id: number, note: string) => (await adminApi.post(`/portal/customers/${id}/notes`, { note })).data;

export type Reports = {
  days: number; from: string; to: string;
  kpis: { requests: number; previousRequests: number; completed: number; completedRate: number | null; averageArrivalMinutes: number | null;
    collected: number; previousCollected: number; margin: number; cancelledRate: number | null; previousCancelledRate: number | null };
  perDay: { date: string; completed: number; cancelled: number; other: number }[];
  funnel: { step: string; count: number }[];
  busyHours: number[][];
  serviceMix: { service: string; count: number }[];
  cancellations: { total: number; reasons: { reason: string; count: number }[] };
};
export const getReports = async (days: number) => (await adminApi.get<Reports>("/portal/reports", { params: { days } })).data;

export type ServiceStat = { id: number; name: string; slug: string; domain: string; active: boolean; technicians: number; priceMin: number | null; priceMax: number | null; requests30: number };
export const getServiceStats = async () => (await adminApi.get<ServiceStat[]>("/portal/services/stats")).data;

export type PriceMedian = { serviceId: number; vehicleType: string; subtype: string; field: string; median: number; technicians: number };
export const getPriceMedians = async () => (await adminApi.get<PriceMedian[]>("/portal/prices/medians")).data;

export type CashDue = { technicianId: number; name: string | null; phoneMasked: string | null; jobs: number; amount: number; oldest: string | null };
export const getCashDues = async () => (await adminApi.get<CashDue[]>("/portal/cash-dues")).data;

export type HandledAlert = { id: number; requestId: number; code: string; text: string; technician: string | null; flaggedAt: string | null; resolvedAt: string | null; actions: { type: string; by: string; at: string | null }[] };
export const getHandledAlerts = async () => (await adminApi.get<HandledAlert[]>("/portal/alerts/handled")).data;
export type MonitoringRules = { intervalSeconds: number; rules: { code: string; label: string; threshold: string }[] };
export const getAlertRules = async () => (await adminApi.get<MonitoringRules>("/portal/alerts/rules")).data;

export type AuditRow = { id: number; by: string; type: string; group: string; targetType: string | null; targetId: string | null; metadata: Record<string, unknown> | null; at: string | null };
export type AuditList = Paged<AuditRow> & { days: number; counts: Record<string, number> };
export const listAudit = async (params: { group?: string; days?: number; search?: string; page?: number; limit?: number }) => (await adminApi.get<AuditList>("/portal/audit", { params })).data;

export const markAllNotificationsRead = async () => (await adminApi.post("/portal/notifications/read-all")).data;

export type PortalSettings = {
  admin: { email: string | null };
  dispatch: { offerTimeoutSeconds: number; retryDelaySeconds: number; maxRetries: number; recoveryWindowMinutes: number };
  monitoring: MonitoringRules;
  phoneSignIn: { configured: boolean };
};
export const getPortalSettings = async () => (await adminApi.get<PortalSettings>("/portal/settings")).data;

// --- Technician sign-up, approval and editing (the app's own routes) ---
export const getTechnicianProfile = async (id: number) => (await rootApi.get<Record<string, unknown>>(`/technicians/${id}`)).data;
export const getTechnicianApprovalAudit = async (id: number) => (await rootApi.get<unknown>(`/technicians/${id}/approval-audit`)).data;
export const getTechnicianServicePricing = async (id: number) => (await rootApi.get<unknown[]>(`/technicians/${id}/service-pricing`)).data;
export const createTechnician = async (payload: Record<string, unknown>) => (await rootApi.post<{ id: string; status: string }>("/technicians/create", payload)).data;
export const updateTechnicianProfile = async (id: number, payload: Record<string, unknown>) => (await rootApi.put(`/technicians/${id}/profile`, payload)).data;
export const approveTechnician = async (id: number, reason: string) => (await rootApi.patch(`/technicians/${id}/approve`, { reason })).data;
export const rejectTechnician = async (id: number, reason: string) => (await rootApi.patch(`/technicians/${id}/reject`, { reason })).data;
export const listPendingTechnicians = async () => (await rootApi.get<unknown>("/technicians/pending")).data;
export const listAllTechniciansRaw = async () => (await rootApi.get<unknown>("/technicians/list")).data;

export type PricingTemplate = {
  services: { id: number; service_name: string; service_slug?: string }[];
  categories: { id: number; category_name: string }[];
  subcategories: { id: number; vehicle_category_id: number; subcategory_name: string }[];
  pricingFields: { id: number; service_id: number; field_key: string; field_label: string; field_type?: string; required?: boolean | number }[];
  fleets?: { id: number; fleet_name: string }[];
};
export const getPricingTemplate = async () => (await rootApi.get<PricingTemplate>("/technicians/pricing-template")).data;
export type ServicePricingRow = { id?: number; service_id: number; vehicle_category_id: number; vehicle_subcategory_id?: number | null; pricing_json: Record<string, string | number> | string };
export type AdminNote = { id: number; adminId: string; noteType: string; note: string; metadata: Record<string, unknown> | null; createdAt: string | null };
export const getTechnicianNotes = async (id: number) => (await rootApi.get<{ notes: AdminNote[] }>(`/admin-extended/technicians/${id}/admin-notes`)).data.notes;
export const deleteTechnician = async (id: number) => (await adminApi.delete(`/technicians/${id}`)).data;

// --- One request: the full record, who dispatch could offer it to, and its payment checks ---
export type RequestDetails = {
  request: { id: number; createdTime: string | null; status: string; priority: "High" | "Normal"; serviceType: string; description: string; paymentStatus: string; cancellationReason: string | null };
  customer: { id: number; name: string; phone: string; email: string; notes: string | null };
  vehicle: { number: string | null; type: string | null; category: string | null; model: string | null };
  location: { pickupAddress: string; destinationAddress: string | null; distanceKm: number | null };
  fare: { customerFare: number; technicianEarnings: number; platformMargin: number; tax: number; total: number; breakdown: Record<string, unknown> };
  attachments: { id: number; fileName: string | null; url: string; mimeType: string | null; type: string; uploadedByType: string | null; createdAt: string | null }[];
};
export const getRequestDetails = async (id: number) => (await adminApi.get<RequestDetails>(`/requests/${id}`)).data;

export type DispatchAudit = {
  request: { id: number; status: string; service_type: string; vehicle_type: string | null; canonical_service_domain: string; canonical_vehicle_type: string; address: string | null; created_at: string | null };
  criteria: Record<string, unknown>;
  summary: { total_technicians: number; eligible_count: number; rejected_count: number; rejection_reason_counts: Record<string, number> };
  technicians: {
    technician_id: number; name: string | null; status: string | null; is_active: unknown; is_available: unknown; service_type: string | null; service_area_range: number | null;
    distance_km: number | null; eligible: boolean; reject_reasons: string[]; dispatch_offer_status: string | null; dispatch_offer_sent_at: string | null; dispatch_offer_expires_at: string | null;
  }[];
};
export const getDispatchAudit = async (requestId: number) => (await adminApi.get<DispatchAudit>(`/dispatch-audit/${requestId}`)).data;

export type PaymentDiagnostics = {
  requestId: string; generatedAt: string;
  request: { id: number; status: string; payment_status: string | null; payment_method: string | null; amount: number | null; service_type: string | null; updated_at: string | null };
  payments: { id: number; payment_method: string | null; status: string; amount: number | string | null; platform_fee: number | string | null; technician_amount: number | string | null; is_settled: unknown; created_at: string | null; razorpay_order_id: string | null; razorpay_payment_id: string | null }[];
  invoices: { id: number; total_amount: number | string | null; status: string | null; has_invoice_pdf: unknown; created_at: string | null }[];
  technicianDues: { id: number; technician_id: number; amount: number | string; status: string; created_at: string | null }[];
  checks: Record<"request_exists" | "paid_status_consistent" | "payment_row_exists_if_paid" | "invoice_exists_if_paid" | "invoice_pdf_present" | "cash_due_record_present", boolean>;
};
export const getPaymentDiagnostics = async (requestId: number) => (await rootApi.get<PaymentDiagnostics>(`/payments/diagnostics/request/${requestId}`)).data;

export type Candidate = { technicianId: number; name: string; phone: string; location: string; distanceKm: number | null; rating: number; jobsCompleted: number; availability: string; status: string; services: string[]; matchesService: boolean };
export const getAssignCandidates = async (requestId: number, search = "") =>
  (await adminApi.get<{ requestId: number; data: Candidate[] }>(`/requests/${requestId}/candidates`, { params: { search: search || undefined, limit: 30 } })).data.data;

// --- Customer accounts (the old portal's add, edit and delete) ---
export const createCustomer = async (payload: { name: string; email: string; password: string }) => (await adminApi.post<{ id: number; message: string }>("/users", payload)).data;
export const updateCustomer = async (id: number, payload: { name: string; password?: string }) => (await adminApi.put(`/users/${id}`, payload)).data;
export const deleteCustomer = async (id: number) => (await adminApi.delete(`/users/${id}`)).data;

// --- Payments: the same payment records and checks the old Payment Logs page used ---
export type PaymentRecord = {
  payment_id: number; service_request_id: number; payment_method: string | null; payment_row_status: string | null; payment_total_amount: number | string | null;
  platform_fee: number | string | null; technician_amount: number | string | null; is_settled: unknown; payment_created_at: string | null;
  razorpay_order_id: string | null; razorpay_payment_id: string | null; request_status: string | null; request_payment_status: string | null; request_payment_method: string | null;
  service_type: string | null; customer_name: string | null; technician_name: string | null;
  checks: { request_paid_consistent: boolean; payment_method_consistent: boolean };
};
export const getPaymentOverview = async (limit = 200) =>
  (await rootApi.get<{ generatedAt: string; stats: Record<string, number | string | null>; records: PaymentRecord[] }>("/payments/diagnostics/overview", { params: { limit } })).data;
export type FlaggedPayment = { payment_id: number; service_request_id: number; flag_reason: string };
export const getFlaggedPayments = async () => (await rootApi.get<{ flaggedPayments: FlaggedPayment[] }>("/admin-extended/finance/flagged-payments", { params: { limit: 200 } })).data.flaggedPayments;
export type RefundHistory = {
  paymentId: number; totalAmount: number; refundedAmount: number; remainingRefundable: number; refundStatus: string; paymentStatus: string | null; paymentMethod: string | null;
  refunds: { id: number; refundReference: string | null; amount: number; technicianAdjustmentAmount: number; status: string; reason: string | null; requestedBy: string | null; createdAt: string | null }[];
};
export const getRefundHistory = async (paymentId: number) => (await adminApi.get<RefundHistory>(`/finance/refunds/${paymentId}`)).data;
export const refundPayment = async (paymentId: number, body: { refundAmount: number; reason: string; idempotencyKey: string }) =>
  (await adminApi.post(`/finance/refund/${paymentId}`, body)).data;
export const downloadFinanceCsv = async (days = 30) => (await adminApi.get<Blob>("/finance/export", { params: { days }, responseType: "blob" })).data;

// --- Payouts: withdrawal requests, wallets, settling one payment, payout history ---
export type Withdrawal = {
  id: number; technicianId: number; technicianName: string | null; amount: number; status: string; upiId: string | null; beneficiaryName: string | null;
  note: string | null; rejectionReason: string | null; externalReference: string | null; paidAt: string | null; createdAt: string | null; upiLink: string | null;
};
type PagedData<T> = { data: T[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
export const listWithdrawals = async (status: string) => (await adminApi.get<PagedData<Withdrawal>>("/finance/withdrawal-requests", { params: { status, limit: 100 } })).data;
export const markWithdrawalPaid = async (id: number, body: { externalReference: string; notes?: string }) => (await adminApi.post(`/finance/withdrawal-requests/${id}/mark-paid`, body)).data;
export const rejectWithdrawal = async (id: number, reason: string) => (await adminApi.post(`/finance/withdrawal-requests/${id}/reject`, { reason })).data;
export type Wallet = { technicianId: number; technicianName: string | null; upiId: string | null; upiName: string | null; totalEarned: number; withdrawableBalance: number; totalPaidOut: number; onHoldBalance: number; lastTransactionAt: string | null };
export const listWallets = async () => (await adminApi.get<PagedData<Wallet>>("/finance/wallets", { params: { page: 1, limit: 100, onlyPositiveBalance: true } })).data;
export const payWholeWallet = async (body: { technicianId: number; amount: number; externalReference: string; notes?: string; idempotencyKey: string }) => (await adminApi.post("/finance/payouts", body)).data;
export type Payout = { id: number; technicianId: number; technicianName: string | null; upiId: string | null; amount: number; status: string; payoutMethod: string | null; externalReference: string | null; processedBy: string | null; processedAt: string | null; createdAt: string | null };
export const listPayouts = async () => (await adminApi.get<PagedData<Payout>>("/finance/payouts", { params: { page: 1, limit: 100 } })).data;
export type UnsettledPayment = { transactionId: number; requestId: number | null; user: string | null; technician: string | null; upiId: string | null; amount: number; technicianAmount: number; platformFee: number; paymentToTechnicianStatus: string; status: string; date: string | null };
export const listUnsettled = async () => (await adminApi.get<PagedData<UnsettledPayment>>("/finance/transactions", { params: { status: "payment_pending", page: 1, limit: 100 } })).data;
export const settleOnePayment = async (transactionId: number, body: { externalReference: string; notes?: string }) => (await adminApi.post(`/pay-technician/${transactionId}`, { ...body, idempotencyKey: `portal-settle-${transactionId}` })).data;
export const downloadPayoutCsv = async () => (await adminApi.get<Blob>("/finance/payout-queue/export", { responseType: "blob" })).data;

// --- Complaints (the admin complaint log) ---
export type Complaint = { id: number; title: string; description: string | null; severity: string; status: string; assigned_admin_id: string | null; created_by: string | null; created_at: string | null; updated_at: string | null; updates_count?: number };
export type ComplaintUpdate = { id: number; update_type: string; note_text: string | null; metadata: Record<string, unknown> | null; created_by: string | null; created_at: string | null };
export const listComplaints = async (status?: string) =>
  (await rootApi.get<{ complaints: Complaint[]; pagination: { total: number } }>("/admin-extended/complaints", { params: { status: status || undefined, limit: 200 } })).data;
export const getComplaint = async (id: number) => (await rootApi.get<{ complaint: Complaint; updates: ComplaintUpdate[] }>(`/admin-extended/complaints/${id}`)).data;
export const createComplaintEntry = async (body: { title: string; description?: string; severity: string }) => (await rootApi.post<{ complaintId: number }>("/admin-extended/complaints", body)).data;
export const assignComplaintTo = async (id: number, assignedAdminId: string, note?: string) => (await rootApi.post(`/admin-extended/complaints/${id}/assign`, { assignedAdminId, note })).data;
export const resolveComplaintWith = async (id: number, resolutionNote: string) => (await rootApi.post(`/admin-extended/complaints/${id}/resolve`, { resolutionNote })).data;
export const addComplaintNote = async (id: number, note: string) => (await rootApi.post(`/admin-extended/complaints/${id}/internal-note`, { note })).data;

// --- Messages to technicians (logged in the audit log with their title) ---
type Sent = { success: boolean; payload: { technicianIds: number[]; targetCount: number; title: string } };
export const sendAnnouncement = async (title: string, message: string) => (await rootApi.post<Sent>("/admin-extended/notifications/system-announcement", { title, message })).data;
export const sendToTechnicians = async (title: string, message: string, technicianIds: number[]) => (await rootApi.post<Sent>("/admin-extended/notifications/technician-broadcast", { title, message, technicianIds })).data;
export const sendUrgent = async (title: string, message: string) => (await rootApi.post<Sent>("/admin-extended/notifications/emergency-message", { title, message })).data;

// --- Services, vehicle types, sub-types, price fields and tow trucks (the price setup technicians fill in) ---
export type ServiceMaster = { id: number; service_name: string; service_slug: string; description: string | null; icon: string | null; active: number | boolean };
export type VehicleCategory = { id: number; category_name: string; description?: string | null; active?: number | boolean };
export type VehicleSubcategory = { id: number; vehicle_category_id: number; subcategory_name: string; active?: number | boolean };
export type PricingField = { id: number; service_id: number; field_key: string; field_label: string; field_type: string | null; required: number | boolean; sort_order: number | null };
export type Fleet = { id: number; fleet_name: string; description?: string | null; active?: number | boolean };
export const listServiceMaster = async () => (await adminApi.get<ServiceMaster[]>("/services")).data;
export const createServiceMaster = async (body: { service_name: string; description?: string; active?: boolean }) => (await adminApi.post("/services", body)).data;
export const updateServiceMaster = async (id: number, body: { service_name: string; description?: string | null; icon?: string | null; active: boolean }) => (await adminApi.put(`/services/${id}`, body)).data;
export const deleteServiceMaster = async (id: number) => (await adminApi.delete(`/services/${id}`)).data;
export const listVehicleCategories = async () => (await adminApi.get<VehicleCategory[]>("/vehicle-categories")).data;
export const createVehicleCategory = async (category_name: string) => (await adminApi.post("/vehicle-categories", { category_name, active: true })).data;
export const deleteVehicleCategory = async (id: number) => (await adminApi.delete(`/vehicle-categories/${id}`)).data;
export const listVehicleSubcategories = async () => (await adminApi.get<VehicleSubcategory[]>("/vehicle-subcategories")).data;
export const createVehicleSubcategory = async (vehicle_category_id: number, subcategory_name: string) => (await adminApi.post("/vehicle-subcategories", { vehicle_category_id, subcategory_name, active: true })).data;
export const deleteVehicleSubcategory = async (id: number) => (await adminApi.delete(`/vehicle-subcategories/${id}`)).data;
export const listPricingFields = async () => (await adminApi.get<PricingField[]>("/pricing-fields")).data;
export const createPricingField = async (body: { service_id: number; field_key: string; field_label: string; required: boolean; sort_order: number }) => (await adminApi.post("/pricing-fields", { ...body, field_type: "Number" })).data;
export const deletePricingField = async (id: number) => (await adminApi.delete(`/pricing-fields/${id}`)).data;
export const listFleets = async () => (await adminApi.get<Fleet[]>("/fleets")).data;
export const createFleet = async (fleet_name: string) => (await adminApi.post("/fleets", { fleet_name, active: true })).data;
export const deleteFleet = async (id: number) => (await adminApi.delete(`/fleets/${id}`)).data;

// --- Email templates ---
export type EmailTemplate = { eventType: string; subject: string; content: string; updatedAt?: string | null; updated_at?: string | null };
export const listEmailTemplates = async () => (await adminApi.get<EmailTemplate[]>("/email-templates")).data;
export const saveEmailTemplate = async (eventType: string, body: { subject: string; content: string }) => (await adminApi.put<EmailTemplate>(`/email-templates/${encodeURIComponent(eventType)}`, body)).data;
