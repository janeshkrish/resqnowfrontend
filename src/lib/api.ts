const normalizeBaseUrl = (value: string | undefined): string => {
  const trimmed = (value ?? "").trim();
  const unquoted = trimmed.replace(/^["']|["']$/g, "");
  return unquoted.replace(/\/+$/, "");
};

const isBrowser = typeof window !== "undefined";
const runtimeOrigin = () => (isBrowser ? window.location.origin : "");

const FRONTEND_ONLY_ENV = String(import.meta.env.VITE_FRONTEND_ONLY ?? "")
  .trim()
  .toLowerCase();

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL);
export const FRONTEND_ONLY_MODE =
  FRONTEND_ONLY_ENV === "true" || FRONTEND_ONLY_ENV === "1";

const DEMO_USER_TOKEN = "demo-user-token";
const DEMO_TECH_TOKEN = "demo-tech-token";
const DEMO_ADMIN_TOKEN = "demo-admin-token";

type AnyRecord = Record<string, any>;

const nowIso = () => new Date().toISOString();
const json = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const parseJsonBody = (raw: string) => {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
};

const readStore = <T,>(key: string, fallback: T): T => {
  if (!isBrowser) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
};

const writeStore = (key: string, value: unknown) => {
  if (!isBrowser) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore localStorage write failures in demo mode.
  }
};

const defaultTechnicians = () => [
  {
    id: "tech-101",
    name: "Rapid Auto Care",
    email: "rapid@resqnow.demo",
    phone: "+91 9876500001",
    verification_status: "verified",
    specialties: ["Towing Assistance", "Battery Jump Start", "Tyre / Puncture Repair"],
    vehicle_types: { car: true, bike: true, commercial: true, ev: true },
    pricing: { towing: 899, puncture: 299, battery: 399 },
    rating: 4.8,
    jobs_completed: 186,
    total_earnings: 148500,
    latitude: 12.9716,
    longitude: 77.5946,
    is_active: true,
  },
  {
    id: "tech-102",
    name: "City Bike Clinic",
    email: "bike@resqnow.demo",
    phone: "+91 9876500002",
    verification_status: "pending",
    specialties: ["Tyre / Puncture Repair", "Fuel Delivery"],
    vehicle_types: { bike: true, ev: true },
    rating: 4.4,
    jobs_completed: 74,
    total_earnings: 54000,
    latitude: 12.9352,
    longitude: 77.6245,
    is_active: false,
  },
];

const defaultRequests = () => [
  {
    id: "req-1001",
    service_type: "flat-tire",
    vehicle_type: "car",
    vehicle_model: "Hyundai i20",
    address: "MG Road, Bengaluru",
    status: "assigned",
    payment_status: "pending",
    amount: 0,
    service_charge: 0,
    location_lat: 12.9716,
    location_lng: 77.5946,
    technician_id: "tech-101",
    has_review: false,
    created_at: nowIso(),
    updated_at: nowIso(),
  },
];

const defaultUsers = () => [
  { id: 1, full_name: "Demo User", email: "demo@resqnow.app", email_confirmed: true, created_at: nowIso() },
];

const MOCK_PRICING_CONFIG = {
  currency: "INR",
  platform_fee_percent: 0.1,
  payment_fee_percent: 0.02,
  welcome_coupon_code: "RESQ10",
  welcome_coupon_discount_percent: 0.1,
  welcome_coupon_max_uses_per_user: 2,
  welcome_coupon_active: true,
  registration_fee: 500,
  booking_fee: 199,
  pay_now_discount_percent: 0,
  default_service_amount: 500,
  service_base_prices: {
    towing: { car: 599, bike: 399, commercial: 2499, ev: 699 },
    "flat-tire": { car: 349, bike: 99, commercial: 999, ev: 299 },
    battery: { car: 399, bike: 199, commercial: 899, ev: 499 },
    mechanical: { car: 499, bike: 499, commercial: 1499, ev: 399 },
    fuel: { car: 299, bike: 99, commercial: 499, ev: 299 },
    lockout: { car: 399, bike: 199, commercial: 699, ev: 399 },
    winching: { car: 599, bike: 399, commercial: 1999, ev: 699 },
    other: { car: 500, bike: 500, commercial: 500, ev: 500 },
  },
  subscription_plans: [
    {
      id: "free",
      name: "PAY-AS-YOU-GO",
      amount: 0,
      period: "per month",
      description: "Use only when needed",
      features: ["Roadside assistance", "Live tracking"],
      notIncluded: ["Priority response"],
      idealFor: ["Occasional users"],
      footer: "No commitment.",
      color: "green",
      recommended: false,
      active: true,
      display_order: 0,
    },
    {
      id: "basic",
      name: "SMART CARE",
      amount: 99,
      period: "per month",
      description: "Priority and savings",
      features: ["Everything in Free", "Priority support"],
      notIncluded: [],
      idealFor: ["Daily commuters"],
      footer: "Best value.",
      color: "blue",
      recommended: true,
      active: true,
      display_order: 1,
    },
  ],
};

const getTechnicians = () => readStore("resqnow_mock_technicians", defaultTechnicians());
const setTechnicians = (value: AnyRecord[]) => writeStore("resqnow_mock_technicians", value);
const getRequests = () => readStore("resqnow_mock_requests", defaultRequests());
const setRequests = (value: AnyRecord[]) => writeStore("resqnow_mock_requests", value);
const getUsers = () => readStore("resqnow_mock_users", defaultUsers());
const setUsers = (value: AnyRecord[]) => writeStore("resqnow_mock_users", value);
const getVehicles = () =>
  readStore("resqnow_mock_vehicles", [
    { id: 1, type: "car", make: "Hyundai", model: "i20", license_plate: "KA01DEMO1", status: "ready" },
  ]);
const setVehicles = (value: AnyRecord[]) => writeStore("resqnow_mock_vehicles", value);
const defaultWallets = () => {
  const technicians = getTechnicians();
  return technicians.map((tech, idx) => {
    const numericId =
      Number(String(tech.id || "").replace(/[^\d]/g, "")) || idx + 1;
    const totalEarned = Number(tech.total_earnings || 0);
    const totalPaidOut = Number(tech.total_paid_out || Math.round(totalEarned * 0.4));
    const withdrawableBalance = Math.max(0, totalEarned - totalPaidOut);
    return {
      walletId: idx + 1,
      technicianId: numericId,
      technicianName: tech.name || `Technician ${numericId}`,
      technicianEmail: tech.email || "",
      upiId: tech.payment_details?.upi_id || tech.upi_id || "",
      currency: "INR",
      withdrawableBalance,
      totalEarned,
      totalPaidOut,
      onHoldBalance: 0,
      lastTransactionAt: tech.updated_at || nowIso(),
      walletUpdatedAt: tech.updated_at || nowIso(),
    };
  });
};
const getWallets = () => readStore("resqnow_mock_wallets", defaultWallets());
const setWallets = (value: AnyRecord[]) => writeStore("resqnow_mock_wallets", value);
const getPayoutHistory = () => readStore("resqnow_mock_payout_history", []);
const setPayoutHistory = (value: AnyRecord[]) => writeStore("resqnow_mock_payout_history", value);
const getRefunds = () => readStore("resqnow_mock_refunds", []);
const setRefunds = (value: AnyRecord[]) => writeStore("resqnow_mock_refunds", value);

const ensureUserProfile = (patch: AnyRecord = {}) => {
  const base = getUserProfile() || {
    id: "demo-user-1",
    name: "Demo User",
    email: "demo@resqnow.app",
    subscription: "free",
    isVerified: true,
  };
  const next = { ...base, ...patch };
  setUserProfile(next);
  return next;
};

const withTechnician = (request: AnyRecord) => {
  if (!request) return request;
  const technician = getTechnicians().find((item) => String(item.id) === String(request.technician_id));
  if (!technician) return request;
  return {
    ...request,
    technician: {
      id: technician.id,
      name: technician.name,
      phone: technician.phone,
      rating: technician.rating,
      location_lat: technician.latitude,
      location_lng: technician.longitude,
      completedJobs: technician.jobs_completed,
    },
  };
};

const requestById = (id: string) =>
  getRequests().find((item) => String(item.id) === String(id)) || null;

const mockPaymentById = (paymentId: number) => {
  const requests = getRequests();
  const idx = Number(paymentId) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= requests.length) return null;
  const request = requests[idx];
  return {
    paymentId,
    request,
    totalAmount: Number(request?.amount || request?.service_charge || 0),
    paymentMethod: String(request?.payment_method || "razorpay"),
    paymentStatus: String(request?.payment_status || "completed"),
  };
};

const upsertRequest = (request: AnyRecord) => {
  const requests = getRequests();
  const idx = requests.findIndex((item) => String(item.id) === String(request.id));
  if (idx >= 0) requests[idx] = { ...requests[idx], ...request, updated_at: nowIso() };
  else requests.unshift({ ...request, updated_at: nowIso() });
  setRequests(requests);
};

const roundMoney = (value: number) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const normalizeCouponCode = (value: unknown) => String(value || "").trim().toUpperCase();
const isRequestPaid = (request: AnyRecord) =>
  ["paid", "completed"].includes(String(request?.status || "").toLowerCase()) ||
  String(request?.payment_status || "").toLowerCase() === "completed";

const buildMockPaymentQuote = (
  request: AnyRecord,
  couponCode: unknown,
  { preserveExistingApplied = false }: { preserveExistingApplied?: boolean } = {}
) => {
  const pricingConfig = MOCK_PRICING_CONFIG;
  const baseAmount = roundMoney(
    Number(request?.amount || request?.service_charge || pricingConfig.default_service_amount)
  );
  const originalPlatformFee = roundMoney(baseAmount * Number(pricingConfig.platform_fee_percent || 0.1));

  const configuredCode = normalizeCouponCode(pricingConfig.welcome_coupon_code);
  const enteredCode = normalizeCouponCode(couponCode);
  const requestId = String(request?.id || "");

  const completedServicesCount = getRequests().filter(
    (item) => String(item?.id || "") !== requestId && isRequestPaid(item)
  ).length;

  const reservedCouponCount = getRequests().filter((item) => {
    if (String(item?.id || "") === requestId) return false;
    if (String(item?.status || "").toLowerCase() === "cancelled") return false;
    if (String(item?.payment_status || "").toLowerCase() === "completed") return false;
    return normalizeCouponCode(item?.applied_coupon_code) === configuredCode;
  }).length;

  const maxUses = Number(pricingConfig.welcome_coupon_max_uses_per_user || 2);
  const remainingEligibleUses = Math.max(0, maxUses - completedServicesCount - reservedCouponCount);
  const hasExistingReservation =
    normalizeCouponCode(request?.applied_coupon_code) === configuredCode &&
    Number(request?.applied_discount_percent || 0) > 0 &&
    String(request?.status || "").toLowerCase() !== "cancelled";

  let isApplied = false;
  let reason: string | null = null;

  if (!enteredCode) {
    if (preserveExistingApplied && hasExistingReservation && pricingConfig.welcome_coupon_active) {
      isApplied = true;
    }
  } else if (!pricingConfig.welcome_coupon_active) {
    reason = "This coupon is currently inactive.";
  } else if (enteredCode !== configuredCode) {
    reason = "Invalid coupon code.";
  } else if (!hasExistingReservation && remainingEligibleUses <= 0) {
    reason = `Coupon is valid only for your first ${maxUses} paid services.`;
  } else {
    isApplied = true;
  }

  const discountPercent = Number(pricingConfig.welcome_coupon_discount_percent || 0.1);
  const discountAmount = isApplied ? roundMoney(originalPlatformFee * discountPercent) : 0;
  const platformFee = roundMoney(Math.max(0, originalPlatformFee - discountAmount));
  const totalAmount = roundMoney(baseAmount + platformFee);

  return {
    breakdown: {
      currency: pricingConfig.currency,
      base_amount: baseAmount,
      platform_fee_percent: Number(pricingConfig.platform_fee_percent || 0.1),
      original_platform_fee: originalPlatformFee,
      discount_amount: discountAmount,
      platform_fee: platformFee,
      total_amount: totalAmount,
    },
    coupon: {
      active: Boolean(pricingConfig.welcome_coupon_active),
      configured_code: configuredCode,
      entered_code: enteredCode,
      applied_coupon_code: isApplied ? configuredCode : null,
      is_applied: isApplied,
      reason,
      discount_percent: discountPercent,
      max_uses_per_user: maxUses,
      completed_services_count: completedServicesCount,
      reserved_coupon_count: reservedCouponCount,
      remaining_eligible_uses: remainingEligibleUses,
    },
  };
};

const mockApi = (url: URL, method: string, body: AnyRecord): Response => {
  const path = url.pathname;
  const q = url.searchParams;

  if (path === "/api/auth/google/url" && method === "GET") {
    return json({ url: `${runtimeOrigin()}/auth/success?token=${encodeURIComponent(DEMO_USER_TOKEN)}` });
  }
  if (path === "/api/auth/verify" && method === "GET") return json({ token: DEMO_USER_TOKEN, user: ensureUserProfile() });
  if (path === "/api/auth/me" && method === "GET") return getUserToken() ? json(ensureUserProfile()) : json({ error: "Unauthorized" }, 401);
  if (path === "/api/auth/logout" && method === "POST") return json({ success: true });

  if (path === "/api/users/login" && method === "POST") return json({ token: DEMO_USER_TOKEN, user: ensureUserProfile({ email: body.email || "demo@resqnow.app" }) });
  if (path === "/api/users/send-otp" && method === "POST") return json({ message: "OTP sent successfully (demo mode)." });
  if (path === "/api/users/verify-otp" && method === "POST") return json({ token: DEMO_USER_TOKEN, user: ensureUserProfile({ email: body.email, name: body.name || "Demo User" }) });
  if (path === "/api/users/confirm-email" && method === "GET") return json({ message: "Email confirmed successfully (demo mode)." });
  if (path === "/api/users/me/settings" && method === "GET") return json(readStore("resqnow_mock_user_settings", { appearance: { theme: "system", force_dark_mode: false }, notifications: { service_updates_email: true, marketing_email: true, push_alerts: false }, navigation: { mobile_bottom_nav_enabled: true, auto_hide_bottom_nav: true }, privacy: { email_visibility: "verified_only" } }));
  if (path === "/api/users/me/settings" && (method === "PATCH" || method === "PUT")) {
    const current = readStore("resqnow_mock_user_settings", { appearance: { theme: "system", force_dark_mode: false }, notifications: { service_updates_email: true, marketing_email: true, push_alerts: false }, navigation: { mobile_bottom_nav_enabled: true, auto_hide_bottom_nav: true }, privacy: { email_visibility: "verified_only" } });
    const next = { ...current, ...body, appearance: { ...(current.appearance || {}), ...(body.appearance || {}) }, notifications: { ...(current.notifications || {}), ...(body.notifications || {}) }, navigation: { ...(current.navigation || {}), ...(body.navigation || {}) }, privacy: { ...(current.privacy || {}), ...(body.privacy || {}) } };
    writeStore("resqnow_mock_user_settings", next);
    return json({ settings: next });
  }
  if (path === "/api/users/reviews" && method === "POST") return json({ success: true });

  if (path === "/api/admin/login" && method === "POST") return json({ token: DEMO_ADMIN_TOKEN, admin: { id: "demo-admin-1", email: "admin@resqnow.app", name: "Demo Admin", role: "super_admin" } });
  if (path === "/api/admin/users" && method === "GET") return json(getUsers());
  if (path === "/api/admin/users" && method === "POST") {
    const users = getUsers();
    users.push({ id: users.length + 1, full_name: body.name || "New User", email: body.email || `user${users.length + 1}@resqnow.app`, email_confirmed: true, created_at: nowIso() });
    setUsers(users);
    return json({ message: "User created successfully (demo mode)." });
  }
  if (path === "/api/admin/analytics" && method === "GET") return json({ totalTechnicians: getTechnicians().length, totalUsers: getUsers().length, totalServiceRequests: getRequests().length, totalRevenue: getRequests().reduce((sum, item) => sum + Number(item.amount || 0), 0), monthlyData: [{ name: "Jan", technicians: 1, requests: 3 }, { name: "Feb", technicians: 2, requests: 5 }], serviceDistribution: [{ name: "Towing", value: 35, color: "#ef4444" }, { name: "Battery", value: 25, color: "#3b82f6" }, { name: "Flat Tire", value: 40, color: "#22c55e" }] });
  if (path === "/api/admin/notifications/count" && method === "GET") return json({ count: 1, pendingApplications: getTechnicians().filter((item) => item.verification_status === "pending").length });
  if (path === "/api/admin/notifications" && method === "GET") return json([{ id: 1, title: "New technician application", message: "City Bike Clinic submitted documents.", type: "technician_application", is_read: 0, created_at: nowIso() }].slice(Number(q.get("offset") || 0), Number(q.get("offset") || 0) + Number(q.get("limit") || 5)));
  if (/^\/api\/admin\/notifications\/\d+\/read$/.test(path) && method === "POST") return json({ success: true });
  if (path === "/api/admin/finance/wallets" && method === "GET") {
    const page = Math.max(Number(q.get("page") || 1), 1);
    const limit = Math.min(Math.max(Number(q.get("limit") || 20), 1), 100);
    const search = String(q.get("search") || "").trim().toLowerCase();
    const onlyPositive = ["1", "true", "yes"].includes(String(q.get("onlyPositiveBalance") || "").toLowerCase());
    let rows = getWallets();
    if (search) {
      rows = rows.filter((row) => {
        return (
          String(row.technicianId).includes(search) ||
          String(row.technicianName || "").toLowerCase().includes(search) ||
          String(row.technicianEmail || "").toLowerCase().includes(search) ||
          String(row.upiId || "").toLowerCase().includes(search)
        );
      });
    }
    if (onlyPositive) {
      rows = rows.filter((row) => Number(row.withdrawableBalance || 0) > 0);
    }
    const total = rows.length;
    const offset = (page - 1) * limit;
    const pageRows = rows.slice(offset, offset + limit);
    return json({
      data: pageRows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  }
  if (path === "/api/admin/finance/payouts" && method === "GET") {
    const page = Math.max(Number(q.get("page") || 1), 1);
    const limit = Math.min(Math.max(Number(q.get("limit") || 20), 1), 100);
    const search = String(q.get("search") || "").trim().toLowerCase();
    let rows = getPayoutHistory();
    if (search) {
      rows = rows.filter((row) => {
        return (
          String(row.payoutReference || "").toLowerCase().includes(search) ||
          String(row.externalReference || "").toLowerCase().includes(search) ||
          String(row.technicianName || "").toLowerCase().includes(search) ||
          String(row.technicianId || "").includes(search)
        );
      });
    }
    rows = rows.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.processedAt || 0).getTime();
      const timeB = new Date(b.createdAt || b.processedAt || 0).getTime();
      const safeA = Number.isFinite(timeA) ? timeA : 0;
      const safeB = Number.isFinite(timeB) ? timeB : 0;
      return safeB - safeA;
    });
    const total = rows.length;
    const offset = (page - 1) * limit;
    const pageRows = rows.slice(offset, offset + limit);
    return json({
      data: pageRows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  }
  if (path === "/api/admin/finance/payouts" && method === "POST") {
    const technicianId = Number(body.technicianId || 0);
    if (!Number.isFinite(technicianId) || technicianId <= 0) {
      return json({ error: "Invalid technician id." }, 400);
    }
    const wallets = getWallets();
    const walletIndex = wallets.findIndex((row) => Number(row.technicianId) === technicianId);
    if (walletIndex === -1) {
      return json({ error: "Technician not found." }, 404);
    }
    const wallet = wallets[walletIndex];
    const requestedAmount = body.amount == null || body.amount === "" ? null : Number(body.amount);
    const payoutAmount = requestedAmount == null ? Number(wallet.withdrawableBalance || 0) : Number(requestedAmount);
    if (!Number.isFinite(payoutAmount) || payoutAmount <= 0) {
      return json({ error: "No withdrawable balance available for payout." }, 409);
    }
    if (payoutAmount > Number(wallet.withdrawableBalance || 0)) {
      return json({ error: "Requested payout exceeds withdrawable balance." }, 409);
    }
    const idempotencyKey = String(body.idempotencyKey || "").trim();
    const payoutHistory = getPayoutHistory();
    if (idempotencyKey) {
      const existing = payoutHistory.find((row) => String(row.idempotencyKey || "") === idempotencyKey);
      if (existing) {
        return json({
          success: true,
          payoutId: existing.id,
          technicianId,
          amount: existing.amount,
          alreadyProcessed: true,
          idempotencyReused: true,
          wallet: {
            total_earned: wallet.totalEarned,
            withdrawable_balance: wallet.withdrawableBalance,
            total_paid_out: wallet.totalPaidOut,
            on_hold_balance: wallet.onHoldBalance,
            currency: wallet.currency,
          },
        });
      }
    }
    const now = nowIso();
    const payoutId = Date.now();
    const payoutReference = `PAYOUT-${payoutId}`;
    const nextWallet = {
      ...wallet,
      withdrawableBalance: Math.max(0, Number(wallet.withdrawableBalance || 0) - payoutAmount),
      totalPaidOut: Number(wallet.totalPaidOut || 0) + payoutAmount,
      lastTransactionAt: now,
      walletUpdatedAt: now,
    };
    wallets[walletIndex] = nextWallet;
    setWallets(wallets);

    const payoutRow = {
      id: payoutId,
      payoutReference,
      idempotencyKey: idempotencyKey || null,
      technicianId,
      technicianName: wallet.technicianName,
      upiId: wallet.upiId || null,
      amount: payoutAmount,
      currency: wallet.currency || "INR",
      status: "paid",
      payoutMethod: body.payoutMethod || "manual_upi",
      externalReference: body.externalReference || null,
      destinationReference: wallet.upiId || null,
      notes: body.notes || null,
      processedBy: "demo-admin",
      processedAt: now,
      createdAt: now,
    };
    setPayoutHistory([payoutRow, ...payoutHistory]);

    return json({
      success: true,
      payoutId,
      technicianId,
      amount: payoutAmount,
      alreadyProcessed: false,
      idempotencyReused: false,
      wallet: {
        total_earned: nextWallet.totalEarned,
        withdrawable_balance: nextWallet.withdrawableBalance,
        total_paid_out: nextWallet.totalPaidOut,
        on_hold_balance: nextWallet.onHoldBalance,
        currency: nextWallet.currency,
      },
    });
  }
  const refundHistoryMatch = path.match(/^\/api\/admin\/finance\/refunds\/(\d+)$/);
  if (refundHistoryMatch && method === "GET") {
    const paymentId = Number(refundHistoryMatch[1]);
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      return json({ error: "Invalid transaction id." }, 400);
    }
    const payment = mockPaymentById(paymentId);
    if (!payment) {
      return json({ error: "Transaction not found." }, 404);
    }
    const refunds = getRefunds().filter((row) => Number(row.payment_id) === paymentId);
    const refundedAmount = roundMoney(refunds.reduce((sum, row) => sum + Number(row.amount || 0), 0));
    const totalAmount = roundMoney(payment.totalAmount || 0);
    const remainingRefundable = roundMoney(Math.max(0, totalAmount - refundedAmount));
    const refundStatus =
      refundedAmount <= 0
        ? "none"
        : refundedAmount >= totalAmount
          ? "fully_refunded"
          : "partially_refunded";
    return json({
      paymentId,
      totalAmount,
      refundedAmount,
      remainingRefundable,
      refundStatus,
      paymentStatus: payment.paymentStatus,
      paymentMethod: payment.paymentMethod,
      paymentToTechnicianStatus: "pending",
      refunds: refunds.map((row) => ({
        id: Number(row.id),
        refundReference: row.refund_reference,
        idempotencyKey: row.idempotency_key || null,
        paymentId,
        serviceRequestId: row.service_request_id,
        technicianId: row.technician_id || null,
        walletTransactionId: row.wallet_transaction_id || null,
        amount: roundMoney(row.amount || 0),
        technicianAdjustmentAmount: roundMoney(row.technician_adjustment_amount || 0),
        status: row.status || "processed",
        reason: row.reason || null,
        externalReference: row.external_reference || null,
        requestedBy: row.requested_by || null,
        processedAt: row.processed_at || null,
        createdAt: row.created_at || null,
        metadata: row.metadata || null,
      })),
    });
  }
  const refundMatch = path.match(/^\/api\/admin\/finance\/refund\/(\d+)$/);
  if (refundMatch && method === "POST") {
    const paymentId = Number(refundMatch[1]);
    if (!Number.isFinite(paymentId) || paymentId <= 0) {
      return json({ error: "Invalid transaction id." }, 400);
    }
    const payment = mockPaymentById(paymentId);
    if (!payment) {
      return json({ error: "Transaction not found." }, 404);
    }
    const refunds = getRefunds();
    const idempotencyKey = String(body.idempotencyKey || "").trim();
    if (idempotencyKey) {
      const existing = refunds.find((row) => String(row.idempotency_key || "") === idempotencyKey);
      if (existing) {
        return json({
          success: true,
          alreadyProcessed: true,
          refundId: Number(existing.id),
          paymentId,
          refundedAmount: roundMoney(existing.amount || 0),
          totalRefundedAmount: null,
          refundStatus: existing.status || "processed",
          technicianAdjustmentAmount: roundMoney(existing.technician_adjustment_amount || 0),
          gatewayRefundId: existing.external_reference || null,
        });
      }
    }

    const amountInput = body.refundAmount == null || body.refundAmount === "" ? null : Number(body.refundAmount);
    if (amountInput != null && (!Number.isFinite(amountInput) || amountInput <= 0)) {
      return json({ error: "Invalid refund amount." }, 400);
    }

    const existingRefunds = refunds.filter((row) => Number(row.payment_id) === paymentId);
    const alreadyRefunded = roundMoney(existingRefunds.reduce((sum, row) => sum + Number(row.amount || 0), 0));
    const totalAmount = roundMoney(payment.totalAmount || 0);
    const remaining = roundMoney(Math.max(0, totalAmount - alreadyRefunded));
    const targetRefundAmount = amountInput == null ? remaining : roundMoney(amountInput);
    if (targetRefundAmount <= 0) {
      return json({ error: "Refund amount must be greater than zero." }, 409);
    }
    if (targetRefundAmount > remaining) {
      return json({ error: "Refund amount exceeds the remaining refundable amount." }, 409);
    }

    const now = nowIso();
    const refundId = Date.now();
    const refundReference = `REFUND-${refundId}`;
    const gatewayRefundId = `rf_${refundId}`;
    const record = {
      id: refundId,
      refund_reference: refundReference,
      idempotency_key: idempotencyKey || null,
      payment_id: paymentId,
      service_request_id: payment.request?.id || null,
      technician_id: payment.request?.technician_id || null,
      wallet_transaction_id: null,
      amount: targetRefundAmount,
      technician_adjustment_amount: 0,
      status: "processed",
      reason: String(body.reason || "").trim() || null,
      external_reference: gatewayRefundId,
      requested_by: "demo-admin",
      processed_at: now,
      created_at: now,
      metadata: { gateway: "razorpay" },
    };
    refunds.unshift(record);
    setRefunds(refunds);

    const nextRefundedAmount = roundMoney(alreadyRefunded + targetRefundAmount);
    const refundStatus = nextRefundedAmount >= totalAmount ? "fully_refunded" : "partially_refunded";
    if (payment.request) {
      upsertRequest({
        ...payment.request,
        payment_status: refundStatus === "fully_refunded" ? "refunded" : "partially_refunded",
      });
    }

    return json({
      success: true,
      refundId,
      paymentId,
      refundedAmount: targetRefundAmount,
      totalRefundedAmount: nextRefundedAmount,
      refundStatus,
      technicianAdjustmentAmount: 0,
      gatewayRefundId,
      alreadyProcessed: false,
    });
  }
  if (path === "/api/admin/finance/payout-queue/export" && method === "GET") {
    const wallets = getWallets().filter((row) => Number(row.withdrawableBalance || 0) > 0);
    const headers = [
      "technician_id",
      "technician_name",
      "technician_email",
      "upi_id",
      "currency",
      "withdrawable_balance",
      "total_earned",
      "total_paid_out",
      "last_transaction_at",
    ];
    const lines = [headers.join(",")];
    wallets.forEach((row) => {
      lines.push([
        row.technicianId,
        row.technicianName,
        row.technicianEmail,
        row.upiId || "",
        row.currency || "INR",
        row.withdrawableBalance,
        row.totalEarned,
        row.totalPaidOut,
        row.lastTransactionAt || "",
      ].join(","));
    });
    return new Response(`${lines.join("\n")}\n`, {
      status: 200,
      headers: { "Content-Type": "text/csv; charset=utf-8" },
    });
  }
  const adminTechnicianActivityMatch = path.match(/^\/api\/admin\/technician\/([^/]+)\/login-activity$/);
  if (adminTechnicianActivityMatch && method === "GET") {
    const requestedId = String(adminTechnicianActivityMatch[1] || "").trim();
    const technicians = getTechnicians();
    const technician =
      technicians.find((item) => String(item.id) === requestedId) ||
      technicians.find((item) => String(item.id).replace(/^tech-/i, "") === requestedId) ||
      technicians[0] ||
      null;
    if (!technician) {
      return json({ error: "Technician not found." }, 404);
    }
    const now = nowIso();
    const lastLoginAt = technician.last_login_at || null;
    const lastLogoutAt = technician.last_logout_at || null;
    const lastSeenAt = technician.last_seen_at || lastLogoutAt || lastLoginAt || null;
    const isLoggedIn = Boolean(technician.is_logged_in);

    return json({
      technician: {
        technicianId: Number(String(technician.id || "").replace(/[^\d]/g, "")) || 1,
        name: technician.name || "Technician",
        email: technician.email || "",
        approvalStatus: technician.verification_status === "verified" ? "approved" : "pending",
        availabilityStatus: technician.is_active ? "Online" : "Offline",
        loginStatus: isLoggedIn ? "Logged In" : "Logged Out",
        visibility: true,
        lastLoginAt,
        lastLogoutAt,
        lastSeenAt,
        inactivityAlertSentAt: technician.login_reminder_sent_at || null,
        currentSessionStartedAt: isLoggedIn ? lastLoginAt : null,
        currentSessionHours: 0,
        loggedInHours24h: 0,
        loggedInHours7d: 0,
        loggedInHoursTotal: 0,
      },
      sessions: lastLoginAt
        ? [
            {
              sessionId: 1,
              loginAt: lastLoginAt,
              lastSeenAt: lastSeenAt || now,
              logoutAt: lastLogoutAt,
              isActive: !lastLogoutAt && isLoggedIn,
              endedReason: lastLogoutAt ? "logout" : null,
              source: "demo",
              durationSeconds: 0,
              durationHours: 0,
              metadata: null,
              createdAt: lastLoginAt,
              updatedAt: lastSeenAt || now,
            },
          ]
        : [],
      alerts: technician.login_reminder_sent_at
        ? [
            {
              alertId: 1,
              alertType: "login_inactivity_reminder",
              status: "sent",
              message: "Demo mode reminder record.",
              sentAt: technician.login_reminder_sent_at,
              createdAt: technician.login_reminder_sent_at,
              metadata: null,
            },
          ]
        : [],
    });
  }

  if (path === "/api/technicians/list" && method === "GET") {
    const status = String(q.get("status") || "").toLowerCase();
    const normalized = status === "approved" ? "verified" : status;
    const technicians = getTechnicians();
    return json(normalized ? technicians.filter((item) => item.verification_status === normalized) : technicians);
  }
  if (path === "/api/technicians" && method === "GET") {
    const requestedCategories = String(q.get("category") || "")
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    const requestedRegion = String(q.get("region") || "").trim().toLowerCase();
    const requestedStatus = String(q.get("status") || "").trim().toLowerCase();

    const mapSpecialtyToCategory = (specialty: string) => {
      const normalized = String(specialty || "").trim().toLowerCase();
      if (normalized.includes("tow")) return "towing";
      if (normalized.includes("battery")) return "battery_jumpstart";
      if (normalized.includes("fuel")) return "fuel_delivery";
      if (normalized.includes("lock")) return "lockout_assistance";
      if (normalized.includes("tyre") || normalized.includes("tire") || normalized.includes("puncture")) {
        return "tire_change";
      }
      return "";
    };

    const technicians = getTechnicians()
      .map((item) => {
        const categories = Array.isArray(item.specialties)
          ? item.specialties.map((specialty) => mapSpecialtyToCategory(specialty)).filter(Boolean)
          : [];
        const activeJobs = getRequests().filter(
          (request) =>
            String(request.technician_id || "") === String(item.id || "") &&
            ["assigned", "accepted", "en-route", "arrived", "in-progress", "awaiting_payment", "payment_pending"].includes(
              String(request.status || "").toLowerCase()
            )
        ).length;
        const statusLabel = !item.is_active ? "offline" : activeJobs > 0 ? "busy" : "online";

        return {
          id: Number(String(item.id || "").replace(/[^\d]/g, "")) || 0,
          name: item.name,
          category: categories[0] || "",
          categories,
          region: "Bengaluru",
          status: statusLabel,
        };
      })
      .filter((item) => item.id > 0)
      .filter((item) => (requestedCategories.length ? requestedCategories.some((category) => item.categories.includes(category)) : true))
      .filter((item) => (requestedRegion ? item.region.toLowerCase() === requestedRegion : true))
      .filter((item) => (requestedStatus ? item.status === requestedStatus : true));

    return json(technicians);
  }
  if (path === "/api/technicians/nearby" && method === "GET") {
    const lat = Number(q.get("lat") || 12.9716);
    const lng = Number(q.get("lng") || 77.5946);
    const data = getTechnicians()
      .filter((item) => item.verification_status === "verified")
      .map((item) => {
        const dx = Number(item.latitude || 12.9716) - lat;
        const dy = Number(item.longitude || 77.5946) - lng;
        const distance = Math.sqrt(dx * dx + dy * dy) * 111;
        return { ...item, distance: Number(distance.toFixed(2)), service_type: item.specialties?.[0] || "General", aiRecommended: Number(item.rating || 0) >= 4.7, price: Number(item.pricing?.towing || item.pricing?.puncture || 499), currency: "INR" };
      });
    return json(data);
  }
  if (path === "/api/technicians/login" && method === "POST") {
    const technicians = getTechnicians();
    const found =
      technicians.find((item) => String(item.email || "").toLowerCase() === String(body.email || "").toLowerCase()) ||
      technicians[0];
    if (!found) return json({ error: "Not found" }, 404);
    const updated = technicians.map((item) =>
      String(item.id) === String(found.id)
        ? {
            ...item,
            is_logged_in: true,
            last_login_at: nowIso(),
            last_seen_at: nowIso(),
            login_reminder_sent_at: null,
          }
        : item
    );
    setTechnicians(updated);
    const technician = updated.find((item) => String(item.id) === String(found.id)) || found;
    return json({ token: DEMO_TECH_TOKEN, technician });
  }
  if (path === "/api/technicians/register" && method === "POST") return json({ token: DEMO_TECH_TOKEN, id: `tech-${Date.now()}`, name: body.name || "New Technician", email: body.email || "new@resqnow.app" });
  if (path === "/api/technicians/logout" && method === "POST") {
    const technicians = getTechnicians();
    if (technicians.length > 0) {
      technicians[0] = {
        ...technicians[0],
        is_logged_in: false,
        last_logout_at: nowIso(),
        last_seen_at: nowIso(),
      };
      setTechnicians(technicians);
    }
    return json({ success: true });
  }
  if (path === "/api/technicians/activity/heartbeat" && method === "POST") {
    const technicians = getTechnicians();
    if (technicians.length > 0) {
      technicians[0] = {
        ...technicians[0],
        is_logged_in: true,
        last_seen_at: nowIso(),
        last_login_at: technicians[0].last_login_at || nowIso(),
        login_reminder_sent_at: null,
      };
      setTechnicians(technicians);
    }
    return json({ success: true, seenAt: nowIso() });
  }
  if (path === "/api/technicians/me" && method === "GET") return json(getTechnicians()[0] || null);
  if (path === "/api/technicians/me/status" && method === "GET") return json({ is_active: true, success: true });
  if (path === "/api/technicians/me/status" && method === "PATCH") return json({ is_active: Boolean(body.active), success: true });
  if (path === "/api/technicians/me/settings" && method === "GET") return json(readStore("resqnow_mock_tech_settings", { appearance: { theme: "system" }, notifications: { email_notifications: true, push_notifications: true }, navigation: { mobile_bottom_nav_enabled: true, auto_hide_bottom_nav: true } }));
  if (path === "/api/technicians/me/settings" && (method === "PATCH" || method === "PUT")) {
    const current = readStore("resqnow_mock_tech_settings", { appearance: { theme: "system" }, notifications: { email_notifications: true, push_notifications: true }, navigation: { mobile_bottom_nav_enabled: true, auto_hide_bottom_nav: true } });
    const next = { ...current, ...body, appearance: { ...(current.appearance || {}), ...(body.appearance || {}) }, notifications: { ...(current.notifications || {}), ...(body.notifications || {}) }, navigation: { ...(current.navigation || {}), ...(body.navigation || {}) } };
    writeStore("resqnow_mock_tech_settings", next);
    return json({ settings: next, ...next });
  }
  if (path === "/api/technicians/dashboard-stats" && method === "GET") return json({ completedJobs: getRequests().filter((item) => ["completed", "paid"].includes(String(item.status).toLowerCase())).length, totalEarnings: getRequests().reduce((sum, item) => sum + Number(item.amount || 0), 0), todayEarnings: 0 });
  if (path === "/api/technicians/requests" && method === "GET") return json(getRequests().map(withTechnician));
  if (path === "/api/technicians/jobs/history" && method === "GET") return json(getRequests().filter((item) => ["completed", "paid", "cancelled"].includes(String(item.status).toLowerCase())).map(withTechnician));
  if (path === "/api/technicians/earnings-history" && method === "GET") return json([{ date: "Mon", amount: 1200 }, { date: "Tue", amount: 1800 }, { date: "Wed", amount: 900 }, { date: "Thu", amount: 2200 }, { date: "Fri", amount: 1500 }]);
  if (path === "/api/technicians/me/reviews" && method === "GET") return json([{ id: 1, rating: 5, comment: "Quick and professional service." }]);
  if (path === "/api/technicians/me/notifications" && method === "GET") return json([]);
  if (path === "/api/technicians/me/financials" && method === "GET") return json({ total_earnings: getRequests().reduce((sum, item) => sum + Number(item.amount || 0), 0), pending_dues: 0 });
  if (path === "/api/technicians/me/dues" && method === "GET") return json({ total: 0 });
  if (path === "/api/technicians/me/active-job" && method === "GET") return json(withTechnician(getRequests().find((item) => ["assigned", "accepted", "en-route", "arrived", "in-progress", "awaiting_payment", "payment_pending"].includes(String(item.status).toLowerCase())) || null));
  if (/^\/api\/technician\/active-job\/[^/]+$/.test(path) && method === "GET") return json(withTechnician(getRequests().find((item) => ["assigned", "accepted", "en-route", "arrived", "in-progress", "awaiting_payment", "payment_pending"].includes(String(item.status).toLowerCase())) || null));
  if (path === "/api/technicians/me/profile" && method === "PATCH") return json({ success: true });
  if (path === "/api/technicians/me/payout-transactions" && method === "GET") return json([]);
  if (path === "/api/technicians/me/location" && method === "PATCH") return json({ success: true });
  if (path === "/api/technicians/me/pay-dues/order" && method === "POST") return json({ id: `order_dues_${Date.now()}`, amount: 0, currency: "INR", key_id: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_demo" });
  if ((path === "/api/technicians/me/pay-dues/verify" || path === "/api/technicians/me/verify-dues") && method === "POST") return json({ success: true, financials: { pending_dues: 0, total_earnings: 0 } });
  if (path === "/api/technicians/me/pay-dues" && method === "POST") return json({ id: `order_dues_${Date.now()}`, amount: 0, currency: "INR", key_id: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_demo" });

  if (path === "/api/service-requests" && method === "GET") return json(getRequests().map(withTechnician));
  if (path === "/api/service-requests" && method === "POST") {
    const id = `req-${Date.now()}`;
    const request = { id, service_type: body.service_type || "other", vehicle_type: body.vehicle_type || "car", vehicle_model: body.vehicle_model || "Vehicle", address: body.address || "Demo address", status: "pending", payment_status: "pending", amount: Number(body.amount || 500), service_charge: Number(body.amount || 500), location_lat: Number(body.location_lat || 12.9716), location_lng: Number(body.location_lng || 77.5946), technician_id: body.technician_id || null, has_review: false, created_at: nowIso(), updated_at: nowIso() };
    upsertRequest(request);
    return json(request);
  }
  const requestIdMatch = path.match(/^\/api\/service-requests\/([^/]+)$/);
  if (requestIdMatch && method === "GET") return requestById(requestIdMatch[1]) ? json(withTechnician(requestById(requestIdMatch[1]))) : json({ error: "Not found" }, 404);
  const requestAcceptMatch = path.match(/^\/api\/service-requests\/([^/]+)\/accept$/);
  if (requestAcceptMatch && method === "POST") {
    const req = requestById(requestAcceptMatch[1]);
    if (!req) return json({ error: "Not found" }, 404);
    const next = { ...req, status: "accepted", technician_id: req.technician_id || getTechnicians()[0]?.id || null };
    upsertRequest(next);
    return json({ success: true, request: withTechnician(next) });
  }
  if (path === "/api/jobs/accept" && method === "POST") {
    const jobId = String(body.jobId || body.requestId || body.id || "");
    const req = requestById(jobId);
    if (!req) return json({ error: "Not found" }, 404);
    const next = { ...req, status: "accepted", technician_id: req.technician_id || getTechnicians()[0]?.id || null };
    upsertRequest(next);
    return json({ success: true, request: withTechnician(next) });
  }
  const requestStatusMatch = path.match(/^\/api\/service-requests\/([^/]+)\/(technician-status|status)$/);
  if (requestStatusMatch && method === "PATCH") {
    const req = requestById(requestStatusMatch[1]);
    if (!req) return json({ error: "Not found" }, 404);
    const status = String(body.status || req.status);
    const next = { ...req, status, payment_status: status === "paid" || status === "completed" ? "completed" : req.payment_status };
    upsertRequest(next);
    return json({ success: true, request: withTechnician(next) });
  }
  const requestCancelMatch = path.match(/^\/api\/service-requests\/([^/]+)\/cancel$/);
  if (requestCancelMatch && method === "PATCH") {
    const req = requestById(requestCancelMatch[1]);
    if (!req) return json({ error: "Not found" }, 404);
    const next = {
      ...req,
      status: "cancelled",
      cancellation_reason: String(body.reason || "").trim() || null,
      cancelled_at: nowIso(),
    };
    upsertRequest(next);
    return json({ success: true, request: withTechnician(next) });
  }
  const requestInvoiceMatch = path.match(/^\/api\/service-requests\/([^/]+)\/invoice$/);
  if (requestInvoiceMatch && method === "GET") {
    const req = requestById(requestInvoiceMatch[1]);
    return json({ id: `invoice_${requestInvoiceMatch[1]}`, request_id: requestInvoiceMatch[1], amount: Number(req?.amount || 0), service_charge: Number(req?.service_charge || req?.amount || 0), tax: 0, total: Number(req?.amount || 0), created_at: nowIso() });
  }

  if (path === "/api/vehicles" && method === "GET") return json(getVehicles());
  if (path === "/api/vehicles" && method === "POST") {
    const vehicles = getVehicles();
    vehicles.push({ id: vehicles.length + 1, type: body.type || "car", make: body.make || "Demo", model: body.model || "Model", license_plate: body.license_plate || "", status: "ready" });
    setVehicles(vehicles);
    return json(vehicles[vehicles.length - 1]);
  }
  const vehicleDeleteMatch = path.match(/^\/api\/vehicles\/(\d+)$/);
  if (vehicleDeleteMatch && method === "DELETE") {
    setVehicles(getVehicles().filter((item) => Number(item.id) !== Number(vehicleDeleteMatch[1])));
    return json({ success: true });
  }

  if (path === "/api/payments/config" && method === "GET") return json(MOCK_PRICING_CONFIG);
  if (path === "/api/payments/quote" && method === "POST") {
    const request = requestById(String(body.requestId || ""));
    if (!request) return json({ error: "Request not found" }, 404);
    if (isRequestPaid(request)) return json({ error: "Request already paid" }, 409);
    const quote = buildMockPaymentQuote(request, body.couponCode, {
      preserveExistingApplied: body.preserveExistingApplied !== false,
    });
    return json({ success: true, request_id: request.id, ...quote });
  }
  if (path === "/api/payments/create-service-order" && method === "POST") {
    return json(
      {
        error: "Deprecated endpoint. Use /api/payments/create-order with requestId.",
        deprecated: true,
        replacement: "/api/payments/create-order",
      },
      410
    );
  }
  if (path === "/api/payments/create-order" && method === "POST") {
    const request = requestById(String(body.requestId || ""));
    if (!request) return json({ error: "Request not found" }, 404);
    if (isRequestPaid(request)) return json({ error: "Request already paid" }, 409);

    const quote = buildMockPaymentQuote(request, body.couponCode, { preserveExistingApplied: false });
    if (String(body.couponCode || "").trim() && !quote.coupon.is_applied) {
      return json({ error: quote.coupon.reason || "Coupon could not be applied.", coupon: quote.coupon }, 400);
    }

    upsertRequest({
      ...request,
      applied_coupon_code: quote.coupon.applied_coupon_code,
      applied_discount_percent: quote.coupon.is_applied ? quote.coupon.discount_percent : 0,
      applied_discount_amount: quote.breakdown.discount_amount,
      payment_method: "razorpay",
      payment_status: "pending",
    });

    const orderId = `order_${Date.now()}`;
    return json({
      id: orderId,
      order_id: orderId,
      amount: Math.round(Number(quote.breakdown.total_amount || 0) * 100),
      currency: quote.breakdown.currency || "INR",
      key_id: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_demo",
      success: true,
      base_amount: quote.breakdown.base_amount,
      original_platform_fee: quote.breakdown.original_platform_fee,
      discount_amount: quote.breakdown.discount_amount,
      platform_fee: quote.breakdown.platform_fee,
      payment_fee_percent: quote.breakdown.payment_fee_percent,
      payment_fee: quote.breakdown.payment_fee,
      platform_fee_percent: quote.breakdown.platform_fee_percent,
      total_amount: quote.breakdown.total_amount,
      coupon: quote.coupon,
    });
  }
  if (path === "/api/payments/create-subscription-order" && method === "POST") return json({ id: `order_${Date.now()}`, order_id: `order_${Date.now()}`, amount: 9900, currency: "INR", key_id: import.meta.env.VITE_RAZORPAY_KEY_ID || "rzp_test_demo", success: true, total_amount: 99 });
  if (path === "/api/payments/verify-subscription-payment" && method === "POST") return json({ success: true });
  if (path === "/api/payments/confirm" && method === "POST") {
    const req = requestById(String(body.requestId || ""));
    if (req) upsertRequest({ ...req, status: "paid", payment_status: "completed" });
    return json({ success: true, request: req ? withTechnician({ ...req, status: "paid", payment_status: "completed" }) : undefined });
  }
  if (path === "/api/payments/cash" && method === "POST") {
    const request = requestById(String(body.requestId || ""));
    if (!request) return json({ error: "Request not found" }, 404);
    if (isRequestPaid(request)) return json({ success: true, alreadyPaid: true });

    const quote = buildMockPaymentQuote(request, body.couponCode, { preserveExistingApplied: false });
    if (String(body.couponCode || "").trim() && !quote.coupon.is_applied) {
      return json({ error: quote.coupon.reason || "Coupon could not be applied.", coupon: quote.coupon }, 400);
    }

    upsertRequest({
      ...request,
      status: "paid",
      payment_status: "completed",
      payment_method: "cash",
      applied_coupon_code: quote.coupon.applied_coupon_code,
      applied_discount_percent: quote.coupon.is_applied ? quote.coupon.discount_percent : 0,
      applied_discount_amount: quote.breakdown.discount_amount,
    });
    return json({ success: true });
  }
  if (path === "/api/payments/diagnostics/overview" && method === "GET") return json({ records: getRequests().map((item, idx) => ({ payment_id: idx + 1, service_request_id: item.id, payment_method: "online", payment_row_status: "captured", payment_total_amount: Number(item.amount || 0), platform_fee: 0, technician_amount: Number(item.amount || 0), is_settled: 1, payment_created_at: item.updated_at || item.created_at, request_status: item.status, request_payment_status: item.payment_status, customer_name: "Demo User", customer_email: "demo@resqnow.app", technician_name: withTechnician(item).technician?.name || "Rapid Auto Care", checks: { request_paid_consistent: true, payment_method_consistent: true } })), stats: { total_payments: getRequests().length, completed_payments: getRequests().length, cash_payments: 0, online_payments: getRequests().length } });
  if (/^\/api\/payments\/diagnostics\/request\/.+$/.test(path) && method === "GET") return json({ request: { id: path.split("/").pop(), status: "paid", payment_status: "completed" }, payments: [{ id: "pay_demo", amount: 699 }], invoices: [{ id: "inv_demo", total: 699 }], checks: { request_paid_consistent: true, payment_method_consistent: true } });

  if (path === "/api/upload" && method === "POST") return json({ url: "/placeholder.svg" });
  if (path === "/api/public/stats" && method === "GET") return json({ users: getUsers().length, technicians: getTechnicians().filter((item) => item.verification_status === "verified").length, completedServices: getRequests().filter((item) => ["completed", "paid"].includes(String(item.status).toLowerCase())).length });
  if (path === "/api/public/android-app/status" && method === "GET") {
    return json({
      available: false,
      apkPath: null,
      fileName: null,
      fileSize: null,
      modifiedAt: null,
      downloadUrl: "/api/public/android-app/download",
      source: null,
      releaseDir: null,
      error: "Android app package is not available in frontend-only demo mode.",
    });
  }
  if (path === "/api/public/android-app/download" && (method === "GET" || method === "HEAD")) {
    return json({ error: "Android app package is not available in frontend-only demo mode." }, 404);
  }
  if (path === "/api/public/contact" && method === "POST") return json({ success: true, message: "Message received (demo mode)." });
  if (path === "/api/public/reverse-geocode" && method === "GET") return json({ display_name: `Demo Location (${Number(q.get("lat") || 12.9716).toFixed(4)}, ${Number(q.get("lng") || 77.5946).toFixed(4)}), Bengaluru, Karnataka`, address: { suburb: "Indiranagar", city: "Bengaluru", district: "Bengaluru Urban", state: "Karnataka", postcode: "560038" } });
  if (path === "/api/chatbot/message" && method === "POST") return json({ text: "Demo mode: backend chatbot is disconnected, but UI remains fully usable." });

  return json({ success: true });
};

let fetchPatched = false;
const installMockFetch = () => {
  if (!FRONTEND_ONLY_MODE || !isBrowser || fetchPatched) return;
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url, runtimeOrigin());
    if (!url.pathname.startsWith("/api/")) return nativeFetch(input, init);
    const method = (init?.method || (input instanceof Request ? input.method : "GET") || "GET").toUpperCase();
    const body = await parseBody(input, init);
    return mockApi(url, method, body);
  };
  fetchPatched = true;
};

const parseBody = async (input: RequestInfo | URL, init?: RequestInit): Promise<AnyRecord> => {
  if (typeof init?.body === "string") return parseJsonBody(init.body);
  if (init?.body instanceof FormData) return {};
  if (init?.body && typeof init.body === "object") return init.body as AnyRecord;
  if (input instanceof Request && input.method !== "GET" && input.method !== "HEAD") {
    try {
      const raw = await input.clone().text();
      return parseJsonBody(raw);
    } catch {
      return {};
    }
  }
  return {};
};

installMockFetch();

export function getRequiredApiBaseUrl(): string {
  if (API_BASE_URL) return API_BASE_URL;
  if (FRONTEND_ONLY_MODE) return runtimeOrigin();
  throw new Error(
    "Missing VITE_API_URL. Set it in Netlify env (example: https://your-render-service.onrender.com)."
  );
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = getRequiredApiBaseUrl();
  if (!API_BASE_URL && FRONTEND_ONLY_MODE) return normalizedPath;
  return `${base}${normalizedPath}`;
}

export function getTechnicianToken(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem("resqnow_technician_token");
}

export function getAdminToken(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem("resqnow_admin_token");
}

export async function apiFetch(
  path: string,
  options: RequestInit & { admin?: boolean; technician?: boolean } = {}
): Promise<Response> {
  const { admin, technician, headers = {}, ...rest } = options;
  const h = new Headers(headers);
  const method = String(rest.method || "GET").trim().toUpperCase();
  const hasRequestBody = rest.body != null && method !== "GET" && method !== "HEAD";

  if (hasRequestBody && !(rest.body instanceof FormData) && !h.has("Content-Type")) {
    h.set("Content-Type", "application/json");
  }

  if (admin) {
    const token = getAdminToken();
    if (token) h.set("Authorization", `Bearer ${token}`);
  } else if (technician) {
    const token = getTechnicianToken();
    if (token) h.set("Authorization", `Bearer ${token}`);
  } else {
    const token = getUserToken();
    if (token) h.set("Authorization", `Bearer ${token}`);
  }

  try {
    return await fetch(apiUrl(path), { ...rest, headers: h });
  } catch (networkError) {
    console.error("[apiFetch] network failure for", path, networkError);
    throw networkError;
  }
}

export async function readJsonSafely<T = AnyRecord>(response: Response): Promise<T | null> {
  if (!response) return null;

  try {
    const raw = await response.text();
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setTechnicianToken(token: string | null) {
  if (!isBrowser) return;
  if (token) localStorage.setItem("resqnow_technician_token", token);
  else localStorage.removeItem("resqnow_technician_token");
}

export function setAdminToken(token: string | null) {
  if (!isBrowser) return;
  if (token) localStorage.setItem("resqnow_admin_token", token);
  else localStorage.removeItem("resqnow_admin_token");
}

export function getUserToken(): string | null {
  if (!isBrowser) return null;
  return localStorage.getItem("resqnow_user_token");
}

export function setUserToken(token: string | null) {
  if (!isBrowser) return;
  if (token) localStorage.setItem("resqnow_user_token", token);
  else localStorage.removeItem("resqnow_user_token");
}

export function getUserProfile(): { id: string; name: string; email: string } | null {
  if (!isBrowser) return null;
  try {
    const raw = localStorage.getItem("resqnow_user_profile");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.id !== "undefined" && parsed.name && parsed.email ? parsed : null;
  } catch {
    return null;
  }
}

export function setUserProfile(profile: { id: string; name: string; email: string } | null) {
  if (!isBrowser) return;
  if (profile) localStorage.setItem("resqnow_user_profile", JSON.stringify(profile));
  else localStorage.removeItem("resqnow_user_profile");
}
