import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock3, ShieldCheck, UserRound } from "lucide-react";
import { io, Socket } from "socket.io-client";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  TechnicianLoginAlertRow,
  TechnicianLoginSessionRow,
  getAdminTechnicianLoginActivity,
} from "./api/adminExtendedApi";
import { getAdminToken, getRequiredApiBaseUrl } from "@/lib/api";

const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value: string | null | undefined) => {
  const date = parseDate(value);
  if (!date) return "Never";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
};

const formatRelativeTime = (value: string | null | undefined) => {
  const date = parseDate(value);
  if (!date) return "Never";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round((diffMinutes / 60) * 10) / 10;
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round((diffHours / 24) * 10) / 10;
  return `${diffDays}d ago`;
};

const formatHours = (value: number | null | undefined) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return "0.00 h";
  return `${parsed.toFixed(2)} h`;
};

const toDayKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const toDayLabel = (date: Date) =>
  date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "2-digit",
  });

function buildDailyLoginTrend(sessions: TechnicianLoginSessionRow[], days = 14) {
  const normalizedDays = Math.min(Math.max(Number(days) || 14, 7), 60);
  const now = new Date();
  const dayMap = new Map<string, number>();
  const dayLabelMap = new Map<string, string>();
  const startBoundary = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  startBoundary.setDate(startBoundary.getDate() - (normalizedDays - 1));

  for (let i = 0; i < normalizedDays; i += 1) {
    const day = new Date(startBoundary);
    day.setDate(startBoundary.getDate() + i);
    const key = toDayKey(day);
    dayMap.set(key, 0);
    dayLabelMap.set(key, toDayLabel(day));
  }

  sessions.forEach((session) => {
    const loginDate = parseDate(session.loginAt);
    if (!loginDate) return;

    const candidateEndDate =
      parseDate(session.logoutAt) ||
      parseDate(session.lastSeenAt) ||
      (session.isActive ? now : null) ||
      loginDate;
    if (!candidateEndDate) return;

    const sessionEnd = candidateEndDate.getTime() < loginDate.getTime() ? loginDate : candidateEndDate;
    let cursor = new Date(loginDate);

    while (cursor.getTime() < sessionEnd.getTime()) {
      const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
      const nextDayStart = new Date(dayStart);
      nextDayStart.setDate(dayStart.getDate() + 1);
      const segmentEnd = sessionEnd.getTime() < nextDayStart.getTime() ? sessionEnd : nextDayStart;
      const dayKey = toDayKey(dayStart);

      if (dayMap.has(dayKey)) {
        const seconds = Math.max(0, Math.floor((segmentEnd.getTime() - cursor.getTime()) / 1000));
        dayMap.set(dayKey, Number(dayMap.get(dayKey) || 0) + seconds);
      }

      if (segmentEnd.getTime() <= cursor.getTime()) break;
      cursor = segmentEnd;
    }
  });

  return Array.from(dayMap.entries()).map(([dayKey, seconds]) => ({
    dayKey,
    dayLabel: dayLabelMap.get(dayKey) || dayKey,
    hours: Number((seconds / 3600).toFixed(2)),
  }));
}

const formatSessionReason = (session: TechnicianLoginSessionRow) => {
  if (session.isActive) return "Active session";
  return session.endedReason || "Ended";
};

const formatAlertType = (alert: TechnicianLoginAlertRow) =>
  String(alert.alertType || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || "Alert";

export default function AdminExtendedTechnicianActivityPage() {
  const queryClient = useQueryClient();
  const params = useParams<{ technicianId: string }>();
  const technicianId = Number(params.technicianId);
  const validTechnicianId = Number.isInteger(technicianId) && technicianId > 0;

  const activityQuery = useQuery({
    queryKey: ["admin", "technician-login-activity", technicianId],
    enabled: validTechnicianId,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchInterval: validTechnicianId ? 20000 : false,
    refetchIntervalInBackground: true,
    queryFn: () =>
      getAdminTechnicianLoginActivity(technicianId, {
        sessionLimit: 500,
        alertLimit: 80,
      }),
  });

  useEffect(() => {
    if (!validTechnicianId) return;

    const refresh = () => {
      void queryClient.invalidateQueries({
        queryKey: ["admin", "technician-login-activity", technicianId],
      });
    };

    const onActivityUpdate = (payload: { technicianId?: number | string } | null | undefined) => {
      if (Number(payload?.technicianId) !== technicianId) return;
      refresh();
    };

    const onInactivityAlert = (payload: { technicianId?: number | string } | null | undefined) => {
      if (Number(payload?.technicianId) !== technicianId) return;
      refresh();
    };

    const socketBaseUrl = getRequiredApiBaseUrl();
    const socket: Socket = io(socketBaseUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token: getAdminToken() || undefined },
    });

    socket.on("admin:technician_activity_update", onActivityUpdate);
    socket.on("admin:technician_inactivity_alert", onInactivityAlert);

    return () => {
      socket.off("admin:technician_activity_update", onActivityUpdate);
      socket.off("admin:technician_inactivity_alert", onInactivityAlert);
      socket.disconnect();
    };
  }, [validTechnicianId, technicianId, queryClient]);

  const technician = activityQuery.data?.technician;
  const sessions = activityQuery.data?.sessions || [];
  const alerts = activityQuery.data?.alerts || [];
  const generatedAt = activityQuery.data?.generatedAt || null;

  const sessionStats = useMemo(() => {
    const activeCount = sessions.filter((session) => session.isActive).length;
    const avgHours =
      sessions.length > 0
        ? sessions.reduce((sum, session) => sum + Number(session.durationHours || 0), 0) / sessions.length
        : 0;
    return {
      activeCount,
      avgHours: Number(avgHours.toFixed(2)),
    };
  }, [sessions]);

  const dailyTrend = useMemo(() => buildDailyLoginTrend(sessions, 14), [sessions]);
  const trendMaxHours = useMemo(
    () => Math.max(0, ...dailyTrend.map((entry) => Number(entry.hours || 0))),
    [dailyTrend]
  );
  const trendAverageHours = useMemo(() => {
    if (dailyTrend.length === 0) return 0;
    const total = dailyTrend.reduce((sum, entry) => sum + Number(entry.hours || 0), 0);
    return Number((total / dailyTrend.length).toFixed(2));
  }, [dailyTrend]);

  if (!validTechnicianId) {
    return (
      <section className="space-y-4">
        <Link
          to="/admin/extended/technicians"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Technicians
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Invalid technician id.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <Link
          to="/admin/extended/technicians"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Technicians
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Technician Login Activity</h1>
          <p className="text-sm text-slate-500">
            Clear session timeline and reminders for technician #{technicianId}. Times are shown in {LOCAL_TIME_ZONE}.
          </p>
          <p className="text-xs text-slate-500">
            Live mode: auto-refresh every 20 seconds and instant refresh on activity events.
          </p>
          <p className="text-xs text-slate-500">
            Last DB sync: {formatDateTime(generatedAt)} {activityQuery.isFetching ? "(refreshing...)" : ""}
          </p>
        </div>
      </header>

      {activityQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {(activityQuery.error as Error).message}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Technician</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{technician?.name || "Loading..."}</p>
          <p className="text-sm text-slate-500">{technician?.email || "-"}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
              {technician?.approvalStatus || "pending"}
            </span>
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                technician?.availabilityStatus === "Online"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {technician?.availabilityStatus || "Offline"}
            </span>
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                technician?.loginStatus === "Logged In"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {technician?.loginStatus || "Logged Out"}
            </span>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last Seen</p>
          <p className="mt-2 text-lg font-semibold text-slate-900">{formatRelativeTime(technician?.lastSeenAt)}</p>
          <p className="text-sm text-slate-500">{formatDateTime(technician?.lastSeenAt)}</p>
          {!technician?.lastSeenAt && sessions.length === 0 ? (
            <p className="mt-2 text-xs text-amber-700">
              No login/heartbeat records found in DB yet for this technician.
            </p>
          ) : null}
          <div className="mt-3 space-y-1 text-xs text-slate-600">
            <p>Last login: {formatDateTime(technician?.lastLoginAt)}</p>
            <p>Last logout: {formatDateTime(technician?.lastLogoutAt)}</p>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Logged Hours</p>
          <div className="mt-2 space-y-1 text-sm text-slate-700">
            <p>
              <span className="font-medium">Current:</span> {formatHours(technician?.currentSessionHours)}
            </p>
            <p>
              <span className="font-medium">24h:</span> {formatHours(technician?.loggedInHours24h)}
            </p>
            <p>
              <span className="font-medium">7d:</span> {formatHours(technician?.loggedInHours7d)}
            </p>
            <p>
              <span className="font-medium">Total:</span> {formatHours(technician?.loggedInHoursTotal)}
            </p>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tracking Snapshot</p>
          <div className="mt-2 space-y-2 text-sm text-slate-700">
            <p className="flex items-center gap-1.5">
              <Clock3 className="h-4 w-4 text-slate-500" />
              Sessions loaded: <strong>{sessions.length}</strong>
            </p>
            <p className="flex items-center gap-1.5">
              <UserRound className="h-4 w-4 text-slate-500" />
              Active sessions: <strong>{sessionStats.activeCount}</strong>
            </p>
            <p className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-slate-500" />
              Avg session: <strong>{formatHours(sessionStats.avgHours)}</strong>
            </p>
            <p>Last reminder: {formatDateTime(technician?.inactivityAlertSentAt)}</p>
          </div>
        </article>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Daily Login Trend (Last 14 Days)</h2>
            <p className="text-sm text-slate-500">Quick visual of total logged-in hours per day.</p>
          </div>
          <div className="grid gap-1 text-xs text-slate-600 sm:text-right">
            <p>
              <span className="font-medium">Average/day:</span> {formatHours(trendAverageHours)}
            </p>
            <p>
              <span className="font-medium">Peak day:</span> {formatHours(trendMaxHours)}
            </p>
          </div>
        </div>

        {activityQuery.isLoading ? (
          <div className="h-[210px] animate-pulse rounded-xl bg-slate-100" />
        ) : dailyTrend.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            Not enough session records to render the trend yet.
          </div>
        ) : (
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyTrend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="loginHoursGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dayLabel" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={42} />
                <Tooltip
                  formatter={(value: number | string) => `${Number(value || 0).toFixed(2)} h`}
                  labelFormatter={(label) => `Day: ${label}`}
                />
                <Area
                  type="monotone"
                  dataKey="hours"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  fill="url(#loginHoursGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Session Timeline</h2>
        <p className="text-sm text-slate-500">Most recent login sessions with start, end, source, and duration.</p>

        {activityQuery.isLoading ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`session-skeleton-${index}`} className="h-20 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : sessions.length === 0 ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            No session history found yet for this technician.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {sessions.map((session) => (
              <article
                key={session.sessionId}
                className={`rounded-xl border p-3 ${
                  session.isActive ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">
                    Session #{session.sessionId} | {formatDateTime(session.loginAt)}
                  </p>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                      session.isActive
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-slate-50 text-slate-700"
                    }`}
                  >
                    {session.isActive ? "Active" : "Closed"}
                  </span>
                </div>
                <div className="mt-2 grid gap-2 text-xs text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                  <p>
                    <span className="font-medium">Logout:</span> {formatDateTime(session.logoutAt)}
                  </p>
                  <p>
                    <span className="font-medium">Duration:</span> {formatHours(session.durationHours)}
                  </p>
                  <p>
                    <span className="font-medium">Source:</span> {session.source || "unknown"}
                  </p>
                  <p>
                    <span className="font-medium">End reason:</span> {formatSessionReason(session)}
                  </p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Reminder & Alert History</h2>
        <p className="text-sm text-slate-500">Login reminders sent to this technician.</p>

        {activityQuery.isLoading ? (
          <div className="mt-3 space-y-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`alert-skeleton-${index}`} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
            No reminders or alerts sent yet.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {alerts.map((alert) => (
              <article key={alert.alertId} className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{formatAlertType(alert)}</p>
                  <span className="text-xs text-slate-500">
                    {formatRelativeTime(alert.sentAt)} | {formatDateTime(alert.sentAt)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-700">{alert.message || "No message body."}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
