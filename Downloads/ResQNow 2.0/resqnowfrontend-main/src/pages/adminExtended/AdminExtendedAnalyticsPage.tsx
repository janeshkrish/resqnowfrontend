import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import LoadingSpinner from "./components/LoadingSpinner";
import { getAnalytics } from "./api/adminExtendedApi";

const COLORS = ["#0ea5e9", "#14b8a6", "#f97316", "#8b5cf6", "#ef4444", "#22c55e", "#f59e0b"];

export default function AdminExtendedAnalyticsPage() {
  const analyticsQuery = useQuery({
    queryKey: ["admin", "analytics"],
    queryFn: getAnalytics,
  });

  const chartData = analyticsQuery.data;

  const requestsPerDayData = useMemo(() => {
    if (chartData?.requestsPerDay && chartData.requestsPerDay.length > 0) {
      return chartData.requestsPerDay;
    }
    return (chartData?.requestsOverTime || []).map((item) => ({
      day: item.date,
      requestCount: item.count,
    }));
  }, [chartData?.requestsPerDay, chartData?.requestsOverTime]);

  const peakHoursData = chartData?.peakHours || [];

  const issueCategoryBreakdownData = useMemo(() => {
    if (chartData?.issueCategoryBreakdown && chartData.issueCategoryBreakdown.length > 0) {
      return chartData.issueCategoryBreakdown;
    }
    return (chartData?.serviceDistribution || []).map((item) => ({
      issueCategory: item.name,
      requestCount: item.value,
    }));
  }, [chartData?.issueCategoryBreakdown, chartData?.serviceDistribution]);

  const utilizationData = useMemo(
    () =>
      (chartData?.technicianUtilization || [])
        .slice(0, 10)
        .map((item) => ({
          name: item.technicianName,
          utilization: item.utilizationRate,
          activeRequests: item.activeRequests,
        })),
    [chartData?.technicianUtilization]
  );

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Analytics</h1>
        <p className="text-sm text-slate-500">Operational trends and capacity charts for admin decisioning.</p>
      </header>

      {analyticsQuery.isLoading ? <LoadingSpinner label="Loading analytics charts..." fullHeight /> : null}
      {analyticsQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(analyticsQuery.error as Error).message}
        </div>
      ) : null}

      {!analyticsQuery.isLoading && chartData ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Requests Per Day</h2>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={requestsPerDayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="requestCount" stroke="#0ea5e9" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Peak Hours</h2>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakHoursData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="hourOfDay" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="requestCount" radius={[6, 6, 0, 0]} fill="#14b8a6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Issue Category Breakdown</h2>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={issueCategoryBreakdownData}
                    dataKey="requestCount"
                    nameKey="issueCategory"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={3}
                    label
                  >
                    {issueCategoryBreakdownData.map((_, index) => (
                      <Cell key={`issue-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Technician Utilization</h2>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilizationData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={120} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="utilization" name="Utilization %" fill="#f97316" radius={[0, 6, 6, 0]} />
                  <Bar dataKey="activeRequests" name="Active Requests" fill="#6366f1" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
