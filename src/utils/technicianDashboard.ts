import { normalizeTechnicianStatus } from "@/utils/technicianStatus";

export type DashboardOrderRecord = {
  id?: string | number | null;
  service_type?: string | null;
  vehicle_type?: string | null;
  vehicle_model?: string | null;
  address?: string | null;
  status?: string | null;
  payment_status?: string | null;
  amount?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  accepted_time?: string | null;
  sla_deadline?: string | null;
  eta_minutes?: number | null;
};

export type DashboardWithdrawalRecord = {
  id?: number | string | null;
  amount?: number | null;
  status?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  rejectionReason?: string | null;
};

export type DashboardWalletSummary = {
  total_earnings?: number | null;
  withdrawable_balance?: number | null;
  total_paid_out?: number | null;
  on_hold_balance?: number | null;
  pending_withdrawals?: number | null;
  recent_withdrawals?: DashboardWithdrawalRecord[] | null;
};

export type OrderOverviewCounts = {
  newOrders: number;
  assigned: number;
  acknowledged: number;
  inProgress: number;
  completed: number;
};

export type OrderPerformanceSummary = {
  totalOrders: number;
  onTimeOrders: number;
  lateOrders: number;
  lastOrder: {
    id: string;
    serviceType: string;
    lateByMinutes: number | null;
    statusLabel: string;
  } | null;
};

export type EarningsBreakdown = {
  pending: number;
  paid: number;
  disputed: number;
  withdrawable: number;
};

export type RewardItem = {
  id: string;
  title: string;
  subtitle: string;
  pointsRequired: number;
  progress: number;
  redeemable: boolean;
};

const LATE_FALLBACK_THRESHOLD_MINUTES = 90;

export const formatCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

export const formatPlainCurrency = (value: number | null | undefined) =>
  new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const toDate = (value: unknown) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

const toMinutes = (from: Date | null, to: Date | null) => {
  if (!from || !to) return null;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60000));
};

const formatServiceType = (value: unknown) =>
  String(value || "Roadside Assistance")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export function countEnabledVehicleTypes(vehicleTypes: unknown): number {
  if (!vehicleTypes || typeof vehicleTypes !== "object") return 0;
  return Object.values(vehicleTypes as Record<string, unknown>).filter(Boolean).length;
}

export function buildOrderOverviewCounts(orders: DashboardOrderRecord[]): OrderOverviewCounts {
  return orders.reduce<OrderOverviewCounts>(
    (summary, order) => {
      const status = normalizeTechnicianStatus(order?.status);
      if (status === "pending") summary.newOrders += 1;
      else if (status === "assigned") summary.assigned += 1;
      else if (["accepted", "arrived"].includes(status)) summary.acknowledged += 1;
      else if (["en-route", "in-progress", "payment_pending"].includes(status)) summary.inProgress += 1;
      else if (["paid", "completed"].includes(status)) summary.completed += 1;
      return summary;
    },
    {
      newOrders: 0,
      assigned: 0,
      acknowledged: 0,
      inProgress: 0,
      completed: 0,
    }
  );
}

function isOrderLate(order: DashboardOrderRecord) {
  const deadline = toDate(order?.sla_deadline);
  const completion =
    toDate(order?.completed_at) ||
    toDate(order?.updated_at) ||
    toDate(order?.started_at) ||
    toDate(order?.created_at);

  if (deadline && completion) {
    return completion.getTime() > deadline.getTime();
  }

  const started =
    toDate(order?.accepted_time) ||
    toDate(order?.started_at) ||
    toDate(order?.created_at);
  const fallbackMinutes = toMinutes(started, completion);
  return Number(fallbackMinutes || 0) > LATE_FALLBACK_THRESHOLD_MINUTES;
}

function getOrderLateByMinutes(order: DashboardOrderRecord) {
  const deadline = toDate(order?.sla_deadline);
  const completion =
    toDate(order?.completed_at) ||
    toDate(order?.updated_at) ||
    toDate(order?.started_at) ||
    toDate(order?.created_at);

  if (deadline && completion) {
    return Math.max(0, Math.round((completion.getTime() - deadline.getTime()) / 60000));
  }

  const started =
    toDate(order?.accepted_time) ||
    toDate(order?.started_at) ||
    toDate(order?.created_at);
  const fallbackMinutes = toMinutes(started, completion);
  if (fallbackMinutes == null) return null;
  return Math.max(0, fallbackMinutes - LATE_FALLBACK_THRESHOLD_MINUTES);
}

export function buildOrderPerformanceSummary(
  orders: DashboardOrderRecord[]
): OrderPerformanceSummary {
  const measurableOrders = orders.filter((order) => {
    const status = normalizeTechnicianStatus(order?.status);
    return !["cancelled", "rejected"].includes(status);
  });

  const lateOrders = measurableOrders.filter(isOrderLate).length;
  const totalOrders = measurableOrders.length;
  const onTimeOrders = Math.max(0, totalOrders - lateOrders);

  const lastOrder = [...orders]
    .sort((left, right) => {
      const leftValue =
        toDate(left?.completed_at)?.getTime() ||
        toDate(left?.updated_at)?.getTime() ||
        toDate(left?.created_at)?.getTime() ||
        0;
      const rightValue =
        toDate(right?.completed_at)?.getTime() ||
        toDate(right?.updated_at)?.getTime() ||
        toDate(right?.created_at)?.getTime() ||
        0;
      return rightValue - leftValue;
    })
    .find(Boolean);

  return {
    totalOrders,
    onTimeOrders,
    lateOrders,
    lastOrder: lastOrder
      ? {
          id: String(lastOrder.id || "—"),
          serviceType: formatServiceType(lastOrder.service_type),
          lateByMinutes: isOrderLate(lastOrder) ? getOrderLateByMinutes(lastOrder) : null,
          statusLabel: formatServiceType(normalizeTechnicianStatus(lastOrder.status)),
        }
      : null,
  };
}

export function buildEarningsBreakdown(wallet: DashboardWalletSummary | null | undefined): EarningsBreakdown {
  const recentWithdrawals = Array.isArray(wallet?.recent_withdrawals) ? wallet?.recent_withdrawals : [];
  const disputed = recentWithdrawals.reduce((total, withdrawal) => {
    const status = String(withdrawal?.status || "").trim().toLowerCase();
    if (["rejected", "failed", "disputed"].includes(status)) {
      return total + Number(withdrawal?.amount || 0);
    }
    return total;
  }, 0);

  return {
    pending: Number(wallet?.pending_withdrawals ?? wallet?.on_hold_balance ?? 0),
    paid: Number(wallet?.total_paid_out || 0),
    disputed,
    withdrawable: Number(wallet?.withdrawable_balance || 0),
  };
}

export function calculateRewardPoints({
  totalEarnings,
  completedJobs,
}: {
  totalEarnings: number;
  completedJobs: number;
}) {
  return Math.max(0, Math.floor(Number(totalEarnings || 0) / 1000) + Number(completedJobs || 0) * 5);
}

export function buildRewardItems(pointsBalance: number): RewardItem[] {
  const items = [
    {
      id: "fuel-credit",
      title: "Fuel Credit",
      subtitle: "Redeem a roadside refill voucher.",
      pointsRequired: 120,
    },
    {
      id: "tool-kit",
      title: "Compact Tool Kit",
      subtitle: "Essentials for daily field jobs.",
      pointsRequired: 260,
    },
    {
      id: "service-jacket",
      title: "ResQNow Service Jacket",
      subtitle: "Branded gear for your team.",
      pointsRequired: 420,
    },
  ];

  return items.map((item) => ({
    ...item,
    progress: Math.min(100, Math.round((pointsBalance / item.pointsRequired) * 100)),
    redeemable: pointsBalance >= item.pointsRequired,
  }));
}

export function getGreetingName(name: string | null | undefined) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "Technician";
  return trimmed.split(/\s+/)[0];
}
