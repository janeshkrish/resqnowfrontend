import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export type VehiclePriceMap = Partial<Record<"car" | "bike" | "commercial" | "ev", number>>;
export type ServicePriceMatrix = Record<string, VehiclePriceMap>;

export type SubscriptionPlanConfig = {
  id: string;
  name: string;
  amount: number;
  period: string;
  description: string;
  features: string[];
  notIncluded: string[];
  idealFor: string[];
  footer: string;
  color: string;
  recommended: boolean;
  active: boolean;
  display_order: number;
};

export type PricingConfig = {
  currency: string;
  platform_fee_percent: number;
  payment_fee_percent: number;
  welcome_coupon_code: string;
  welcome_coupon_discount_percent: number;
  welcome_coupon_max_uses_per_user: number;
  welcome_coupon_active: boolean;
  registration_fee: number;
  booking_fee: number;
  pay_now_discount_percent: number;
  default_service_amount: number;
  service_base_prices: ServicePriceMatrix;
  subscription_plans: SubscriptionPlanConfig[];
};

const DEFAULT_PRICING_CONFIG: PricingConfig = {
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
    "ev-charging": { car: 499, bike: 299, commercial: 899, ev: 299 },
    other: { car: 500, bike: 500, commercial: 500, ev: 500 },
  },
  subscription_plans: [
    {
      id: "free",
      name: "PAY-AS-YOU-GO",
      amount: 0,
      period: "per month",
      description: "Use only when you need it",
      features: [
        "Request roadside assistance anytime",
        "Access to nearby verified technicians",
        "Live technician tracking",
        "Transparent price breakup",
      ],
      notIncluded: [
        "Platform convenience fee per service",
        "Priority response",
        "Service history & invoices",
      ],
      idealFor: ["Occasional users", "First-time customers", "Emergency-only usage"],
      footer: "No commitment. Pay only when you are stuck.",
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
      description: "Save money. Get priority. Stay worry-free.",
      features: [
        "Everything in Free, plus:",
        "Zero platform fee on all services",
        "Faster technician assignment",
        "Priority support during breakdowns",
        "Service history & invoices",
        "Exclusive offers & discounts",
      ],
      notIncluded: [],
      idealFor: ["Daily commuters", "Students & office-goers", "Two-wheeler & car owners"],
      footer: "One small fee. Big peace of mind.",
      color: "blue",
      recommended: true,
      active: true,
      display_order: 1,
    },
    {
      id: "premium",
      name: "TOTAL CARE",
      amount: 149,
      period: "per month",
      description: "Maximum coverage. Zero stress.",
      features: [
        "Everything in Smart Care, plus:",
        "Highest priority technician matching",
        "Free or discounted emergency services",
        "Extended service coverage (late night / peak hours)",
        "Dedicated customer support",
        "Family vehicle coverage (up to 2 vehicles)",
      ],
      notIncluded: [],
      idealFor: [],
      footer: "Subject to fair usage policy",
      color: "purple",
      recommended: false,
      active: true,
      display_order: 2,
    },
  ],
};

const toNumber = (value: unknown, fallback: number, allowZero = false) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (allowZero ? parsed < 0 : parsed <= 0) return fallback;
  return parsed;
};

const toBoolean = (value: unknown, fallback: boolean) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
  }
  return fallback;
};

function normalizeConfig(raw: unknown): PricingConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PRICING_CONFIG };
  const data = raw as Partial<PricingConfig>;
  const extra = raw as Record<string, unknown>;

  const service_base_prices =
    data.service_base_prices && typeof data.service_base_prices === "object"
      ? data.service_base_prices
      : DEFAULT_PRICING_CONFIG.service_base_prices;

  const subscription_plans = Array.isArray(data.subscription_plans)
    ? data.subscription_plans
    : DEFAULT_PRICING_CONFIG.subscription_plans;

  return {
    currency: String(data.currency || DEFAULT_PRICING_CONFIG.currency).toUpperCase(),
    platform_fee_percent: toNumber(data.platform_fee_percent, DEFAULT_PRICING_CONFIG.platform_fee_percent, true),
    payment_fee_percent: toNumber(data.payment_fee_percent, DEFAULT_PRICING_CONFIG.payment_fee_percent, true),
    welcome_coupon_code: String(
      extra.welcome_coupon_code || DEFAULT_PRICING_CONFIG.welcome_coupon_code
    )
      .trim()
      .toUpperCase(),
    welcome_coupon_discount_percent: toNumber(
      extra.welcome_coupon_discount_percent,
      DEFAULT_PRICING_CONFIG.welcome_coupon_discount_percent,
      true
    ),
    welcome_coupon_max_uses_per_user: Math.max(
      0,
      Math.floor(
        toNumber(
          extra.welcome_coupon_max_uses_per_user,
          DEFAULT_PRICING_CONFIG.welcome_coupon_max_uses_per_user
        )
      )
    ),
    welcome_coupon_active: toBoolean(
      extra.welcome_coupon_active,
      DEFAULT_PRICING_CONFIG.welcome_coupon_active
    ),
    registration_fee: toNumber(data.registration_fee, DEFAULT_PRICING_CONFIG.registration_fee),
    booking_fee: toNumber(data.booking_fee, DEFAULT_PRICING_CONFIG.booking_fee),
    pay_now_discount_percent: toNumber(
      data.pay_now_discount_percent,
      DEFAULT_PRICING_CONFIG.pay_now_discount_percent,
      true
    ),
    default_service_amount: toNumber(data.default_service_amount, DEFAULT_PRICING_CONFIG.default_service_amount),
    service_base_prices,
    subscription_plans: [...subscription_plans].sort(
      (a, b) => Number(a.display_order || 0) - Number(b.display_order || 0)
    ),
  };
}

export function getPriceLabelFromConfig(
  pricingConfig: PricingConfig | null | undefined,
  serviceId: string | undefined,
  vehicleType: "car" | "bike" | "commercial" | "ev"
) {
  const config = pricingConfig || DEFAULT_PRICING_CONFIG;
  const serviceKey = String(serviceId || "other").toLowerCase();
  const amount =
    Number(config.service_base_prices?.[serviceKey]?.[vehicleType]) ||
    Number(config.service_base_prices?.other?.[vehicleType]) ||
    Number(config.default_service_amount);

  if (!Number.isFinite(amount) || amount <= 0) return "Varies";
  return `${config.currency} ${Math.round(amount)}`;
}

export function usePricingConfig() {
  return useQuery<PricingConfig>({
    queryKey: ["pricing-config"],
    queryFn: async () => {
      const res = await apiFetch("/api/payments/config");
      if (!res.ok) {
        throw new Error("Failed to fetch pricing config");
      }
      return normalizeConfig(await res.json());
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
    initialData: DEFAULT_PRICING_CONFIG,
  });
}
