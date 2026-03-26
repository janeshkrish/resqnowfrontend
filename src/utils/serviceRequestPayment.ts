export type ServiceRequestPaymentMode = "cash" | "upi";

export const SERVICE_REQUEST_PLATFORM_FEE_PERCENT = 0.1;
export const SERVICE_REQUEST_RAZORPAY_FEE = 2;

const COMPLETED_STATUSES = new Set(["paid", "completed"]);

const roundMoney = (value: number) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const toFiniteMoney = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? roundMoney(parsed) : null;
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
  const baseAmount = toFiniteMoney(
    source?.baseAmount ??
      source?.base_amount ??
      source?.amount ??
      source?.service_charge ??
      source?.serviceCharge
  );

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
