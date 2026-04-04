import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Users, Wrench, TrendingUp, Activity, Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";

type MonthlyPoint = {
  name: string;
  technicians: number;
  requests: number;
};

type ServiceDistributionPoint = {
  name: string;
  value: number;
  color: string;
};

type AnalyticsState = {
  totalTechnicians: number;
  totalServiceRequests: number;
  totalRevenue: number;
  activeUsers: number;
  monthlyData: MonthlyPoint[];
  serviceDistribution: ServiceDistributionPoint[];
};

const SERVICE_COLORS = ["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6", "#14b8a6", "#f97316"];

const initialAnalyticsState: AnalyticsState = {
  totalTechnicians: 0,
  totalServiceRequests: 0,
  totalRevenue: 0,
  activeUsers: 0,
  monthlyData: [],
  serviceDistribution: [],
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

const toSafeNumber = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatServiceName = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "Other";
  return raw
    .split(/[_-]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
};

const normalizeMonthlyData = (rawMonthly: unknown): MonthlyPoint[] => {
  if (!Array.isArray(rawMonthly)) return [];

  return rawMonthly.map((item, index) => {
    const row = asRecord(item);
    const fallbackName = `Month ${index + 1}`;
    const name = String(row?.name ?? row?.month ?? fallbackName).trim() || fallbackName;

    return {
      name,
      technicians: toSafeNumber(row?.technicians ?? row?.technicianCount),
      requests: toSafeNumber(row?.requests ?? row?.requestCount),
    };
  });
};

const normalizeServiceDistribution = (payload: Record<string, unknown>): ServiceDistributionPoint[] => {
  const directDistribution = Array.isArray(payload?.serviceDistribution)
    ? payload.serviceDistribution
    : [];

  if (directDistribution.length > 0) {
    return directDistribution.map((item, index) => {
      const row = asRecord(item);
      return {
        name: formatServiceName(row?.name),
        value: toSafeNumber(row?.value),
        color:
          typeof row?.color === "string" && row.color.trim().length > 0
            ? row.color
            : SERVICE_COLORS[index % SERVICE_COLORS.length],
      };
    });
  }

  const issueBreakdown = Array.isArray(payload?.issueCategoryBreakdown)
    ? payload.issueCategoryBreakdown
    : [];

  return issueBreakdown.map((item, index) => {
    const row = asRecord(item);
    return {
      name: formatServiceName(row?.issueCategory),
      value: toSafeNumber(row?.requestCount),
      color: SERVICE_COLORS[index % SERVICE_COLORS.length],
    };
  });
};

const normalizeAnalyticsPayload = (payload: unknown): AnalyticsState => {
  const safe = asRecord(payload);

  return {
    totalTechnicians: toSafeNumber(safe?.totalTechnicians),
    totalServiceRequests: toSafeNumber(safe?.totalServiceRequests),
    totalRevenue: toSafeNumber(safe?.totalRevenue),
    // Backend can return either activeUsers or totalUsers depending on environment.
    activeUsers: toSafeNumber(safe?.activeUsers ?? safe?.totalUsers),
    monthlyData: normalizeMonthlyData(safe?.monthlyData),
    serviceDistribution: normalizeServiceDistribution(safe),
  };
};

const AdminAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AnalyticsState>(initialAnalyticsState);

  const fetchAnalytics = useCallback(async (showLoadingState: boolean) => {
    if (showLoadingState) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      setError(null);
      const res = await apiFetch("/api/admin/analytics", { method: "GET", admin: true });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(String((body as { error?: string })?.error || "Failed to fetch analytics data."));
      }

      const fetchedData = await res.json();
      setData(normalizeAnalyticsPayload(fetchedData));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch analytics data.";
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchAnalytics(true);

    // Auto-refresh keeps UI current without manual reload.
    const intervalId = window.setInterval(() => {
      void fetchAnalytics(false);
    }, 15000);

    const onWindowFocus = () => {
      void fetchAnalytics(false);
    };

    // Optional hook for pages that dispatch status-change events.
    const onAdminStatusChange = () => {
      void fetchAnalytics(false);
    };

    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("admin-status-changed", onAdminStatusChange as EventListener);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("admin-status-changed", onAdminStatusChange as EventListener);
    };
  }, [fetchAnalytics]);

  const safeMonthlyData = useMemo(() => data?.monthlyData ?? [], [data?.monthlyData]);
  const safeServiceDistribution = useMemo(
    () => data?.serviceDistribution ?? [],
    [data?.serviceDistribution]
  );

  const totalTechnicians = data?.totalTechnicians ?? 0;
  const totalServiceRequests = data?.totalServiceRequests ?? 0;
  const totalRevenue = data?.totalRevenue ?? 0;
  const activeUsers = data?.activeUsers ?? 0;

  const showCharts = !loading && !error;
  const emptyGrowthData = safeMonthlyData.length === 0;
  const emptyServiceDistribution = safeServiceDistribution.length === 0;

  const renderChartPlaceholder = () => (
    <div className="h-[300px] flex items-center justify-center text-sm text-muted-foreground">
      No analytics data available.
    </div>
  );

  const renderLoadingChartSkeleton = () => (
    <div className="space-y-3">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-[260px] w-full" />
    </div>
  );

  const renderStatValue = (value: number) => {
    if (loading) {
      return <Skeleton className="h-8 w-20" />;
    }
    return <div className="text-2xl font-bold">{value.toLocaleString("en-IN")}</div>;
  };

  const renderRevenueValue = () => {
    if (loading) {
      return <Skeleton className="h-8 w-32" />;
    }
    return <div className="text-2xl font-bold">INR {totalRevenue.toLocaleString("en-IN")}</div>;
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          {(loading || refreshing) ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : null}
        </div>
        <p className="text-muted-foreground">
          Platform performance and insights
          {refreshing ? " • Refreshing live data" : ""}
        </p>
      </div>

      {error ? (
        <Card>
          <CardHeader>
            <CardTitle>Unable to Load Analytics</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <button
              type="button"
              onClick={() => void fetchAnalytics(true)}
              className="text-sm text-primary hover:underline"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      ) : null}

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Technicians</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>{renderStatValue(totalTechnicians)}</CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Service Requests</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>{renderStatValue(totalServiceRequests)}</CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>{renderRevenueValue()}</CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>{renderStatValue(activeUsers)}</CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Growth Overview</CardTitle>
            <CardDescription>Technicians and service requests over time</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              renderLoadingChartSkeleton()
            ) : showCharts && !emptyGrowthData ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={safeMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="technicians" stroke="#ef4444" strokeWidth={2} name="Technicians" />
                  <Line type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={2} name="Requests" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              renderChartPlaceholder()
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service Distribution</CardTitle>
            <CardDescription>Breakdown of services by type</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              renderLoadingChartSkeleton()
            ) : showCharts && !emptyServiceDistribution ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={safeServiceDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {safeServiceDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry?.color ?? SERVICE_COLORS[index % SERVICE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              renderChartPlaceholder()
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Monthly Service Requests</CardTitle>
            <CardDescription>Number of service requests per month</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              renderLoadingChartSkeleton()
            ) : showCharts && !emptyGrowthData ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={safeMonthlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="requests" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              renderChartPlaceholder()
            )}
          </CardContent>
        </Card>
      </div>

      {refreshing && !loading ? (
        <p className="text-xs text-muted-foreground">Refreshing analytics...</p>
      ) : null}
    </div>
  );
};

export default AdminAnalytics;
