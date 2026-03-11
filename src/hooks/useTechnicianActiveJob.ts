import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { useSocket } from "@/contexts/SocketContext";
import { normalizeTechnicianStatus } from "@/utils/technicianStatus";

const EMPTY_VALUE_TOKENS = new Set(["not available", "n/a", "na", "null", "undefined", "no phone number"]);

const toOptionalString = (value: any) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  return EMPTY_VALUE_TOKENS.has(normalized.toLowerCase()) ? null : normalized;
};

const toOptionalNumber = (value: any) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toOptionalPhone = (value: any) => {
  const raw = toOptionalString(value);
  if (!raw) return null;
  const compact = raw.replace(/[^\d+]/g, "");
  return compact || null;
};

const buildVehicleDetails = (vehicleType: string | null, vehicleModel: string | null) =>
  [vehicleType, vehicleModel].filter(Boolean).join(" ").trim() || null;

const normalizeJob = (job: any) => {
  if (!job) return null;

  const requestId = toOptionalString(job.requestId ?? job.id);
  const status = normalizeTechnicianStatus(
    toOptionalString(job.jobStatus ?? job.job_status ?? job.status ?? job.current_status) || "accepted"
  );
  const customerName = toOptionalString(
    job.customerName ?? job.customer_name ?? job.contact_name ?? job.user?.name
  );
  const serviceType = toOptionalString(job.serviceType ?? job.service_type ?? job.service?.type);
  const vehicleType = toOptionalString(job.vehicle?.type ?? job.vehicle_type);
  const vehicleModel = toOptionalString(job.vehicle?.model ?? job.vehicle_model);
  const vehicleDetails =
    toOptionalString(job.vehicleDetails ?? job.vehicle_details ?? job.vehicle?.details) ||
    buildVehicleDetails(vehicleType, vehicleModel);
  const phoneNumber = toOptionalPhone(job.phoneNumber ?? job.phone_number ?? job.contact_phone ?? job.user?.phone);
  const address = toOptionalString(job.address ?? job.location?.address ?? job.pickupAddress);
  const pickupLatitude = toOptionalNumber(
    job.pickupLatitude ??
      job.pickup_latitude ??
      job.location?.lat ??
      job.location_lat ??
      job.customer_location_lat
  );
  const pickupLongitude = toOptionalNumber(
    job.pickupLongitude ??
      job.pickup_longitude ??
      job.location?.lng ??
      job.location_lng ??
      job.customer_location_lng
  );
  const destinationLatitude = toOptionalNumber(
    job.destinationLatitude ?? job.destination_latitude ?? job.destination_lat
  );
  const destinationLongitude = toOptionalNumber(
    job.destinationLongitude ?? job.destination_longitude ?? job.destination_lng
  );
  const serviceDescription = toOptionalString(job.service?.description ?? job.description);
  const amount = toOptionalNumber(job.amount ?? job.service_charge ?? job.serviceCharge);

  return {
    ...job,
    id: requestId ?? "",
    requestId: requestId ?? "",
    status,
    jobStatus: status,
    customerName,
    serviceType,
    vehicleDetails,
    phoneNumber,
    pickupLatitude,
    pickupLongitude,
    destinationLatitude,
    destinationLongitude,
    amount: amount ?? job.amount ?? 0,
    address,
    contact_name: customerName ?? toOptionalString(job.contact_name),
    contact_phone: phoneNumber ?? toOptionalPhone(job.contact_phone),
    service_type: serviceType ?? toOptionalString(job.service_type),
    vehicle_type: vehicleType,
    vehicle_model: vehicleModel,
    location_lat: pickupLatitude,
    location_lng: pickupLongitude,
    location: {
      ...(job.location && typeof job.location === "object" ? job.location : {}),
      lat: pickupLatitude,
      lng: pickupLongitude,
      address,
    },
    user: {
      ...(job.user && typeof job.user === "object" ? job.user : {}),
      name: customerName,
      phone: phoneNumber,
    },
    service: {
      ...(job.service && typeof job.service === "object" ? job.service : {}),
      type: serviceType,
      description: serviceDescription,
    },
    vehicle: {
      ...(job.vehicle && typeof job.vehicle === "object" ? job.vehicle : {}),
      type: vehicleType,
      model: vehicleModel,
      details: vehicleDetails,
    },
  };
};

export const useTechnicianActiveJob = (technicianId?: string, autoRefreshMs = 15000) => {
  const [activeJob, setActiveJob] = useState<any | null>(null);
  const [dues, setDues] = useState(0);
  const { socket } = useSocket();

  const refreshActiveJob = useCallback(async () => {
    if (!technicianId) return;
    try {
      const encodedTechId = encodeURIComponent(String(technicianId));
      const candidatePaths = [
        `/api/technician/active-job/${encodedTechId}`,
        "/api/technicians/me/active-job",
      ];

      for (const path of candidatePaths) {
        const res = await apiFetch(path, { technician: true });
        if (!res.ok) continue;
        const data = await res.json();
        const normalized = normalizeJob(data);
        setActiveJob(normalized);
        return normalized;
      }
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
        const previousRequestId = String(prev.requestId || prev.id || "");
        if (previousRequestId !== requestId) return prev;
        const nextStatus = normalizeTechnicianStatus(data?.status);
        return { ...prev, status: nextStatus, jobStatus: nextStatus };
      });
      if (["paid", "completed", "job_completed", "cancelled", "rejected"].includes(String(data?.status || "").toLowerCase())) {
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
