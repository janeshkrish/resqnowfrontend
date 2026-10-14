import { useCallback, useEffect, useState } from "react";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { TechPage } from "@/components/technician/app/TechUi";
import { useSocket } from "@/contexts/SocketContext";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { apiFetch } from "@/lib/api";
import { serviceArt } from "@/lib/services";
import { techDayLabel, techRupees, techServiceName, techTime, useTechText } from "@/lib/technicianLanguage";
import type { TechTextKey } from "@/lib/technicianText";
import { buildOrderOverviewCounts, type DashboardOrderRecord } from "@/utils/technicianDashboard";
import { cn } from "@/lib/utils";

type JobHistoryItem = {
    id: string;
    service_type?: string | null;
    vehicle_type?: string | null;
    vehicle_model?: string | null;
    address?: string | null;
    status?: string | null;
    created_at?: string | null;
    amount?: number | null;
    technicianEstimatedEarning?: number | null;
    technician_estimated_earning?: number | null;
};

type Filter = "all" | "completed" | "cancelled";

const isDone = (job: JobHistoryItem) => ["completed", "paid"].includes(String(job.status || "").toLowerCase());
const isCancelled = (job: JobHistoryItem) => String(job.status || "").toLowerCase() === "cancelled";

// How a job's state reads at the end of its row. Any other state shows as the server names it.
const STATE_LOOK: Record<string, { label: TechTextKey; icon: string; tone: string }> = {
    completed: { label: "jobs.state.done", icon: "check_circle", tone: "is-ok" },
    paid: { label: "jobs.state.done", icon: "check_circle", tone: "is-ok" },
    cancelled: { label: "jobs.state.cancelled", icon: "cancel", tone: "is-void" },
    rejected: { label: "jobs.state.rejected", icon: "block", tone: "is-off" },
    "in-progress": { label: "jobs.state.working", icon: "build", tone: "is-wait" },
};

const TechnicianHistoryPage = () => {
    const { technician, token } = useTechnicianAuth();
    const { socket } = useSocket();
    const { lang, t } = useTechText();
    const [jobHistory, setJobHistory] = useState<JobHistoryItem[]>([]);
    // The technician's open requests, for the counts at the top (the same list Home reads).
    const [requests, setRequests] = useState<DashboardOrderRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const [filter, setFilter] = useState<Filter>("all");

    const fetchHistory = useCallback(async () => {
        if (!technician || !token) return;
        try {
            const [res, requestsRes] = await Promise.all([
                apiFetch(`/api/technicians/jobs/history`, { technician: true }),
                apiFetch("/api/technicians/requests", { technician: true }).catch(() => null),
            ]);
            if (res.ok) {
                const historyData = await res.json();
                if (Array.isArray(historyData)) {
                    setJobHistory(historyData.map((job: JobHistoryItem) => ({ ...job, amount: job.technicianEstimatedEarning ?? job.technician_estimated_earning ?? job.amount })));
                }
            } else {
                console.error("Failed to fetch history:", res.status);
            }
            if (requestsRes?.ok) {
                const requestData = await requestsRes.json();
                if (Array.isArray(requestData)) setRequests(requestData);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoading(false);
        }
    }, [technician, token]);

    useEffect(() => {
        if (technician && token) {
            fetchHistory();
        }
    }, [technician, token, fetchHistory]);

    useEffect(() => {
        if (!technician || !token) return;
        const id = setInterval(fetchHistory, 20000);
        return () => clearInterval(id);
    }, [technician, token, fetchHistory]);

    useEffect(() => {
        if (!socket || !technician?.id) return;
        const refresh = () => fetchHistory();
        const handleStatusUpdate = (payload: any) => {
            const status = String(payload?.status || "").toLowerCase();
            if (!status || ["paid", "completed", "cancelled", "payment_pending"].includes(status)) {
                refresh();
            }
        };
        socket.on("job:list_update", refresh);
        socket.on("job:status_update", handleStatusUpdate);
        socket.on("dashboard:stats_update", refresh);
        return () => {
            socket.off("job:list_update", refresh);
            socket.off("job:status_update", handleStatusUpdate);
            socket.off("dashboard:stats_update", refresh);
        };
    }, [socket, technician?.id, fetchHistory]);

    const filteredJobs = jobHistory.filter((job) => {
        if (filter === "all") return true;
        if (filter === "completed") return isDone(job);
        if (filter === "cancelled") return isCancelled(job);
        return true;
    });

    const now = buildOrderOverviewCounts(requests);
    const filters: Array<{ key: Filter; label: TechTextKey; count: number }> = [
        { key: "all", label: "jobs.filterAll", count: jobHistory.length },
        { key: "completed", label: "jobs.filterDone", count: jobHistory.filter(isDone).length },
        { key: "cancelled", label: "jobs.filterCancelled", count: jobHistory.filter(isCancelled).length },
    ];

    // The list arrives newest first; jobs on the same day share a heading.
    const days: Array<{ label: string; jobs: JobHistoryItem[] }> = [];
    filteredJobs.forEach((job) => {
        const label = techDayLabel(lang, job.created_at);
        const last = days[days.length - 1];
        if (last && last.label === label) last.jobs.push(job);
        else days.push({ label, jobs: [job] });
    });

    return (
        <TechPage tab="jobs" testId="technician-jobs">
            <h1 className="tp-h1 tp-pj">{t("jobs.title")}</h1>

            <p className="tp-day" style={{ marginTop: 12 }}>{t("jobs.now")}</p>
            <div className="tp-now" data-testid="jobs-now">
                <div className={cn(now.newOrders > 0 && "is-hot")}><b>{now.newOrders}</b>{t("jobs.new")}</div>
                <div><b>{now.assigned}</b>{t("jobs.assigned")}</div>
                <div><b>{now.acknowledged}</b>{t("jobs.accepted")}</div>
                <div><b>{now.inProgress}</b>{t("jobs.working")}</div>
            </div>

            <p className="tp-day">{t("jobs.all")}</p>
            <div className="tp-seg" role="radiogroup" aria-label={t("jobs.show")}>
                {filters.map((item) => (
                    <button
                        key={item.key}
                        type="button"
                        role="radio"
                        aria-checked={filter === item.key}
                        className={cn("tp-press", filter === item.key && "is-on")}
                        onClick={() => setFilter(item.key)}
                    >
                        <b>{item.count}</b>
                        {t(item.label)}
                    </button>
                ))}
            </div>

            {loading ? (
                <p className="tp-empty" role="status">{t("common.loading")}</p>
            ) : filteredJobs.length === 0 ? (
                <div className="tp-list" style={{ marginTop: 14 }}><p className="tp-empty">{t("jobs.none")}</p></div>
            ) : (
                days.map((day, index) => (
                    <section key={`${day.label}-${index}`}>
                        {day.label ? <p className="tp-day">{day.label}</p> : null}
                        <div className="tp-list" style={day.label ? undefined : { marginTop: 14 }}>
                            {day.jobs.map((job) => {
                                const status = String(job.status || "").toLowerCase();
                                const look = STATE_LOOK[status];
                                const art = serviceArt(job.service_type);
                                const kind = String(job.vehicle_type || "");
                                const vehicle = [kind ? kind[0].toUpperCase() + kind.slice(1) : "", job.vehicle_model].filter(Boolean).join(" · ");
                                return (
                                    <div key={job.id} className="tp-row is-tall" data-testid="job-row" data-status={status}>
                                        <span className="tp-thumb" aria-hidden="true">
                                            {art ? <img src={art} alt="" draggable={false} /> : <MaterialSymbol name="build" />}
                                        </span>
                                        <span className="tp-text">
                                            <b>{techServiceName(lang, job.service_type)}</b>
                                            <span>{[vehicle, techTime(lang, job.created_at)].filter(Boolean).join(" · ")}</span>
                                            {job.address ? <span>{job.address}</span> : null}
                                        </span>
                                        <span className="tp-end is-in">
                                            {job.amount ? <b>{techRupees(job.amount)}</b> : null}
                                            <span className={cn("tp-state", look?.tone ?? "is-wait")}>
                                                {look ? <MaterialSymbol name={look.icon} /> : null}
                                                {look ? t(look.label) : job.status}
                                            </span>
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                ))
            )}
        </TechPage>
    );
};

export default TechnicianHistoryPage;
