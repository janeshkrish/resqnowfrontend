import { Component, type ErrorInfo, type ReactNode, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminExtendedApiRequest } from "./api/adminExtendedApi";
import { AdminExtendedShell } from "./components/AdminExtendedShell";

type DashboardMetrics = {
  activeRequestsCount: number;
  availableTechniciansCount: number;
  completedToday: number;
  avgResponseTime: number;
  todayRevenue: number;
  pendingPayments: number;
};

type DashboardMetricsPayload = Partial<DashboardMetrics> & {
  metrics?: Partial<DashboardMetrics> | null;
  data?: {
    metrics?: Partial<DashboardMetrics> | null;
  } | null;
  dashboardMetrics?: Partial<DashboardMetrics> | null;
};

const metricLabels: Record<keyof DashboardMetrics, string> = {
  activeRequestsCount: "Active Requests",
  availableTechniciansCount: "Available Technicians",
  completedToday: "Completed Today",
  avgResponseTime: "Avg Response (min)",
  todayRevenue: "Today Revenue",
  pendingPayments: "Pending Payments",
};

const metricKeys = Object.keys(metricLabels) as Array<keyof DashboardMetrics>;

const defaultMetrics: DashboardMetrics = {
  activeRequestsCount: 0,
  availableTechniciansCount: 0,
  completedToday: 0,
  avgResponseTime: 0,
  todayRevenue: 0,
  pendingPayments: 0,
};

const toSafeNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

// Normalize API shape so rendering never depends on unstable backend payloads.
const normalizeDashboardMetrics = (rawData: unknown): DashboardMetrics => {
  const payload = (rawData ?? null) as DashboardMetricsPayload | null;

  // Optional chaining keeps this safe when any wrapper level is missing.
  const metricSource =
    payload?.metrics ??
    payload?.data?.metrics ??
    payload?.dashboardMetrics ??
    payload ??
    {};

  return {
    activeRequestsCount: toSafeNumber(metricSource.activeRequestsCount),
    availableTechniciansCount: toSafeNumber(metricSource.availableTechniciansCount),
    completedToday: toSafeNumber(metricSource.completedToday),
    avgResponseTime: toSafeNumber(metricSource.avgResponseTime),
    todayRevenue: toSafeNumber(metricSource.todayRevenue),
    pendingPayments: toSafeNumber(metricSource.pendingPayments),
  };
};

type DashboardMetricCardProps = {
  label?: string;
  value?: number;
};

function DashboardMetricCard({ label, value }: DashboardMetricCardProps) {
  // Guard props so the card always renders valid JSX even with malformed input.
  const safeLabel = typeof label === "string" && label.trim() ? label : "Unknown Metric";
  const safeValue = Number.isFinite(value ?? Number.NaN) ? Number(value) : 0;

  return (
    <article style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
      <h3 style={{ marginTop: 0 }}>{safeLabel}</h3>
      <p style={{ fontSize: 24, margin: 0 }}>{safeValue.toLocaleString()}</p>
    </article>
  );
}

type DashboardErrorBoundaryState = {
  hasError: boolean;
};

class DashboardErrorBoundary extends Component<{ children: ReactNode }, DashboardErrorBoundaryState> {
  public state: DashboardErrorBoundaryState = { hasError: false };

  public static getDerivedStateFromError(): DashboardErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Admin extended dashboard render failure:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <p role="alert" style={{ color: "#b00020" }}>
          Dashboard widgets failed to render. Please refresh and try again.
        </p>
      );
    }

    return this.props.children;
  }
}

export default function AdminExtendedDashboardPage() {
  const metricsQuery = useQuery({
    queryKey: ["adminExtended", "dashboard"],
    queryFn: () => adminExtendedApiRequest<unknown>("/dashboard"),
  });

  const metrics = useMemo(
    () => (metricsQuery.data == null ? defaultMetrics : normalizeDashboardMetrics(metricsQuery.data)),
    [metricsQuery.data]
  );

  const metricItems = useMemo(
    () =>
      metricKeys.map((key) => ({
        key,
        label: metricLabels[key],
        value: metrics[key],
      })),
    [metrics]
  );

  const errorMessage =
    metricsQuery.error instanceof Error
      ? metricsQuery.error.message
      : "Failed to load dashboard metrics.";

  return (
    <AdminExtendedShell title="Admin Extended Dashboard" subtitle="Read-only pilot metrics">
      {metricsQuery.isPending ? <p>Loading dashboard metrics...</p> : null}
      {metricsQuery.isError ? (
        <div role="alert" style={{ color: "#b00020" }}>
          <p style={{ marginBottom: 8 }}>{errorMessage}</p>
          <button type="button" onClick={() => void metricsQuery.refetch()}>
            Retry
          </button>
        </div>
      ) : null}

      {!metricsQuery.isPending && !metricsQuery.isError ? (
        <DashboardErrorBoundary>
          {metricsQuery.data == null ? (
            // Explicit empty state for null/undefined API responses.
            <p>No dashboard data is available right now.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 10,
              }}
            >
              {metricItems.map((item) => (
                <DashboardMetricCard key={item.key} label={item.label} value={item.value} />
              ))}
            </div>
          )}
        </DashboardErrorBoundary>
      ) : null}
    </AdminExtendedShell>
  );
}

