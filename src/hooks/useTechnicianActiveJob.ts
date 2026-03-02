import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useSocket } from "@/contexts/SocketContext";
import { normalizeTechnicianStatus } from "@/utils/technicianStatus";

const normalizeJob = (job: any) => {
  if (!job) return null;
  return {
    ...job,
    id: String(job.id ?? job.requestId ?? ""),
    status: normalizeTechnicianStatus(job.status),
  };
};

export const useTechnicianActiveJob = (technicianId?: string, autoRefreshMs = 15000) => {
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [dues, setDues] = useState(0);
  const { socket } = useSocket();

  const refreshActiveJob = useCallback(async () => {
    if (!technicianId) return;
    try {
      const res = await apiFetch("/api/technicians/me/active-job", { technician: true });
      if (!res.ok) return;
      const data = await res.json();
      const normalized = normalizeJob(data);
      setActiveJob(normalized);
      return normalized;
    } catch {
      // ignore transient failures
    }
  }, [technicianId]);

  const refreshDues = useCallback(async () => {
    if (!technicianId) return;
    try {
      const res = await apiFetch("/api/technicians/me/dues", { technician: true });
      if (!res.ok) return;
      const data = await res.json();
      setDues(Number(data?.total || 0));
    } catch {
      // ignore transient failures
    }
  }, [technicianId]);

  useEffect(() => {
    if (!technicianId) return;
    refreshActiveJob();
    refreshDues();
    const id = setInterval(() => {
      refreshActiveJob();
      refreshDues();
    }, autoRefreshMs);
    return () => clearInterval(id);
  }, [technicianId, autoRefreshMs, refreshActiveJob, refreshDues]);

  useEffect(() => {
    if (!socket || !technicianId) return;

    const handleAssigned = (payload: any) => {
      const incoming = normalizeJob(payload?.request || payload);
      if (!incoming?.id) return;
      setActiveJob(incoming);
    };

    const handleStatusUpdate = (data: any) => {
      const requestId = String(data?.requestId || data?.id || "");
      if (!requestId) return;
      setActiveJob((prev: any) => {
        if (!prev) return prev;
        if (String(prev.id) !== requestId) return prev;
        return { ...prev, status: normalizeTechnicianStatus(data?.status) };
      });
      if (["paid", "completed", "cancelled"].includes(String(data?.status || "").toLowerCase())) {
        refreshActiveJob();
        refreshDues();
      }
    };

    const handleFinancialsUpdate = (data: any) => {
      if (!data) return;
      const pending = Number(data?.pending_dues);
      if (Number.isFinite(pending) && pending >= 0) {
        setDues(pending);
      } else {
        refreshDues();
      }
    };

    socket.on("job:assigned", handleAssigned);
    socket.on("job_assigned", handleAssigned);
    socket.on("job:status_update", handleStatusUpdate);
    socket.on("technician:financials_update", handleFinancialsUpdate);

    return () => {
      socket.off("job:assigned", handleAssigned);
      socket.off("job_assigned", handleAssigned);
      socket.off("job:status_update", handleStatusUpdate);
      socket.off("technician:financials_update", handleFinancialsUpdate);
    };
  }, [socket, technicianId, refreshActiveJob, refreshDues]);

  return useMemo(
    () => ({
      activeJob,
      setActiveJob,
      dues,
      setDues,
      refreshActiveJob,
      refreshDues,
    }),
    [activeJob, dues, refreshActiveJob, refreshDues]
  );
};
