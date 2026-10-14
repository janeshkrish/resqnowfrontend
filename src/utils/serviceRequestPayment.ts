export type ServiceRequestPaymentMode = "cash" | "upi";

export const SERVICE_REQUEST_PLATFORM_FEE_PERCENT = 0.1;
export const SERVICE_REQUEST_RAZORPAY_FEE = 2;

const COMPLETED_STATUSES = new Set(["paid", "completed"]);

/** A successful confirmation request may still be waiting for gateway capture. */
export const isServicePaymentFinalized = (confirmation: any): boolean => {
  if (confirmation?.alreadyPaid === true || confirmation?.immediateFinalization === true) return true;
  const request = confirmation?.request ?? confirmation;
  const requestStatus = String(request?.status || "").trim().toLowerCase();
  const paymentStatus = String(request?.payment_status ?? request?.paymentStatus ?? "").trim().toLowerCase();
  return COMPLETED_STATUSES.has(requestStatus) || COMPLETED_STATUSES.has(paymentStatus);
};

const roundMoney = (value: number) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const toFiniteMoney = (value: unknown) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? roundMoney(parsed) : null;
};

const pricingObject = (value: any): Record<string, any> => {
  if (value && typeof value === "object") return value;
  try { return typeof value === "string" ? JSON.parse(value) || {} : {}; }
  catch { return {}; }
};

const BEFORE_ACCEPTANCE = new Set(["pending", "requested", "searching", "assigned", "technician_assigned", "awaiting_technician"]);
const ACCEPTED_STATUSES = new Set(["accepted", "en-route", "en_route", "en-route-pickup", "en_route_pickup", "on_the_way", "arrived", "arrived_pickup", "in-progress", "in_progress", "service_started", "vehicle_loaded", "tow_started", "enroute_drop", "arrived_drop", "service_completed", "job_completed", "completed", "payment_pending", "awaiting_payment", "paid", "closed", "job_closed"]);

/** Assignment alone is not acceptance. Legacy accepted jobs retain their recorded prices. */
export const hasAcceptedCustomerPricing = (source: any): boolean => {
  if (!source || source.pricing_status === "pending" || source.pricing_finalized === false) return false;
  const status = String(source.status || "").trim().toLowerCase();
  if (BEFORE_ACCEPTANCE.has(status)) return false;
  if (source.pricing_status === "confirmed" || source.pricing_finalized === true) return true;
  return ACCEPTED_STATUSES.has(status) || Boolean(source.accepted_time || source.accepted_at);
};

const toBoolean = (value: unknown) => {
  if (typeof value === "boolean") return value;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric > 0;
  const normalized = String(value || "").trim().toLowerCase();
  return ["true", "yes", "y"].includes(normalized);
};

export const normalizeServiceRequestPaymentMode = (
  value: unknown,
  fallback: ServiceRequestPaymentMode | null = null
): ServiceRequestPaymentMode | null => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "cash" || normalized === "cod") return "cash";
  if (["upi", "razorpay", "online", "card", "netbanking"].includes(normalized)) {
    return "upi";
  }
  return fallback;
};

const isPaymentComplete = (source: any) => {
  const paymentStatus = String(source?.payment_status ?? source?.paymentStatus ?? "").trim().toLowerCase();
  const requestStatus = String(source?.status || "").trim().toLowerCase();
  return COMPLETED_STATUSES.has(paymentStatus) || COMPLETED_STATUSES.has(requestStatus);
};

export const resolveServiceRequestPaymentDetails = (
  source: any,
  fallbackPaymentMode: ServiceRequestPaymentMode | null = null
) => {
  if (source?.pricing_status === "pending" || source?.pricing_finalized === false || BEFORE_ACCEPTANCE.has(String(source?.status || "").toLowerCase())) {
    source = {};
  }
  const baseAmount = toFiniteMoney(
    source?.baseAmount ??
      source?.base_amount ??
      source?.amount ??
      source?.service_charge ??
      source?.serviceCharge
  );
  const snapshot = pricingObject(source?.pricing_snapshot ?? source?.pricingSnapshot);
  const breakdown = pricingObject(snapshot.pricing_breakdown ?? source?.pricingBreakdown ?? source?.pricing_breakdown ?? source?.pricing_breakdown_json);
  const taxAmount = Math.max(0, toFiniteMoney(source?.taxAmount ?? source?.tax_amount ?? breakdown.tax_amount) ?? 0);
  const technicianCharge = Math.max(0, toFiniteMoney(source?.technicianCharge ?? snapshot.technician_earning) ?? roundMoney((baseAmount ?? 0) - taxAmount));

  const originalPlatformFee = roundMoney(
    Math.max(0, Number(baseAmount || 0)) * SERVICE_REQUEST_PLATFORM_FEE_PERCENT
  );
  const explicitPlatformFee = toFiniteMoney(source?.platformFee ?? source?.platform_fee);
  const paymentMode = normalizeServiceRequestPaymentMode(
    source?.paymentMode ??
      source?.payment_mode ??
      source?.paymentMethod ??
      source?.payment_method,
    fallbackPaymentMode
  );
  const explicitRazorpayFee = toFiniteMoney(
    source?.razorpayFee ??
      source?.razorpay_fee ??
      source?.paymentFee ??
      source?.payment_fee
  );
  const platformFee = explicitPlatformFee ?? originalPlatformFee;
  const razorpayFee =
    explicitRazorpayFee ?? (paymentMode === "upi" ? SERVICE_REQUEST_RAZORPAY_FEE : 0);
  const explicitFinalAmount = toFiniteMoney(
    source?.finalAmount ??
      source?.final_amount ??
      source?.totalAmount ??
      source?.total_amount
  );
  const finalAmount =
    explicitFinalAmount ??
    (baseAmount != null ? roundMoney(baseAmount + platformFee + razorpayFee) : null);
  const explicitDiscountAmount = toFiniteMoney(source?.discountAmount ?? source?.discount_amount);
  const discountAmount =
    explicitDiscountAmount ?? Math.max(0, roundMoney(originalPlatformFee - platformFee));
  const isSettled = toBoolean(source?.isSettled ?? source?.is_settled);
  const explicitDueAmount = toFiniteMoney(source?.dueAmount ?? source?.due_amount);
  const dueAmount =
    explicitDueAmount ??
    (paymentMode === "cash" && isPaymentComplete(source) && !isSettled ? platformFee : 0);

  return {
    hasPricing: baseAmount != null || finalAmount != null,
    paymentMode,
    baseAmount: baseAmount ?? 0,
    technicianCharge,
    taxAmount,
    platformFeePercent: SERVICE_REQUEST_PLATFORM_FEE_PERCENT,
    originalPlatformFee,
    discountAmount,
    platformFee,
    paymentFeePercent: 0,
    paymentFee: razorpayFee,
    razorpayFee,
    totalAmount: finalAmount ?? roundMoney((baseAmount || 0) + platformFee + razorpayFee),
    finalAmount,
    dueAmount,
    isSettled,
  };
};
