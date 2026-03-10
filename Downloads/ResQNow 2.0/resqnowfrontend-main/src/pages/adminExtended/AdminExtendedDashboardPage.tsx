import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BadgeDollarSign,
  CircleCheckBig,
  Clock3,
  CreditCard,
  UsersRound,
} from "lucide-react";
import MetricCard from "./components/MetricCard";
import LoadingSpinner from "./components/LoadingSpinner";
import { getDashboardMetrics } from "./api/adminExtendedApi";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

function DashboardSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={`metric-skeleton-${index}`}
          className="h-36 animate-pulse rounded-2xl border border-slate-200 bg-white"
        />
      ))}
    </div>
  );
}

export default function AdminExtendedDashboardPage() {
  const dashboardQuery = useQuery({
    queryKey: ["admin", "dashboard"],
    queryFn: getDashboardMetrics,
  });

  const metrics = dashboardQuery.data;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Operations Dashboard</h1>
        <p className="text-sm text-slate-500">
          Live admin metrics from request, technician, and payment services.
        </p>
      </header>

      {dashboardQuery.isLoading ? <DashboardSkeleton /> : null}

      {dashboardQuery.isError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{(dashboardQuery.error as Error).message}</p>
          <button
            type="button"
            onClick={() => void dashboardQuery.refetch()}
            className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white"
          >
            Retry
          </button>
        </div>
      ) : null}

      {!dashboardQuery.isLoading && metrics ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            title="Active Requests"
            value={metrics.activeRequests.toLocaleString()}
            icon={<Activity className="h-4 w-4" />}
            accent="blue"
          />
          <MetricCard
            title="Available Technicians"
            value={metrics.availableTechnicians.toLocaleString()}
            icon={<UsersRound className="h-4 w-4" />}
            accent="teal"
          />
          <MetricCard
            title="Completed Today"
            value={metrics.completedToday.toLocaleString()}
            icon={<CircleCheckBig className="h-4 w-4" />}
            accent="emerald"
          />
          <MetricCard
            title="Average Response Time"
            value={`${metrics.avgResponseTime.toFixed(1)} min`}
            icon={<Clock3 className="h-4 w-4" />}
            accent="amber"
          />
          <MetricCard
            title="Today's Revenue"
            value={formatCurrency(metrics.todayRevenue)}
            icon={<BadgeDollarSign className="h-4 w-4" />}
            accent="rose"
          />
          <MetricCard
            title="Pending Payments"
            value={metrics.pendingPayments.toLocaleString()}
            icon={<CreditCard className="h-4 w-4" />}
            accent="slate"
          />
        </div>
      ) : null}

      {!dashboardQuery.isLoading && !dashboardQuery.isError && !metrics ? (
        <LoadingSpinner label="No dashboard data found." />
      ) : null}
    </section>
  );
}
