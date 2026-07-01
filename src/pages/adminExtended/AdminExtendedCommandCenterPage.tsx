import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { AlertTriangle, BellRing, PhoneCall, RefreshCcw, Route, Siren } from "lucide-react";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getAdminToken, getRequiredApiBaseUrl } from "@/lib/api";
import { Slider } from "@/components/ui/slider";
import {
  callCommandCenterTechnician,
  CommandCenterJob,
  CommandCenterMonitorRunResponse,
  escalateCommandCenterJob,
  getCommandCenterExceptions,
  getCommandCenterTrack,
  reassignCommandCenterJob,
  remindCommandCenterTechnician,
  runCommandCenterMonitorCycle,
} from "./api/adminExtendedApi";

const riskClass: Record<string, string> = {
  red: "border-red-300 bg-red-50 text-red-700",
  yellow: "border-amber-300 bg-amber-50 text-amber-700",
  green: "border-emerald-300 bg-emerald-50 text-emerald-700",
};

function toTimeLabel(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function toMinutesLabel(value: number | null) {
  if (value == null || !Number.isFinite(value)) return "-";
  return `${Math.round(value)} min`;
}

function timeRemainingLabel(ms: number | null) {
  if (ms == null || !Number.isFinite(ms)) return "-";
  const min = Math.round(ms / 60000);
  if (min <= 0) return "SLA breached";
  return `${min} min remaining`;
}

function createDotIcon(color: string) {
  return L.divIcon({
    className: "command-center-dot",
    html: `<span style="display:inline-block;width:14px;height:14px;border-radius:9999px;background:${color};border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.2);"></span>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
}

const technicianIcon = createDotIcon("#dc2626");
const customerIcon = createDotIcon("#2563eb");

function MapViewportSync({ points }: { points: [number, number][] }) {
  const map = useMap();
  const lastSignatureRef = useRef("");

  useEffect(() => {
    if (!points.length) return;

    const signature = points.map((point) => `${point[0].toFixed(5)},${point[1].toFixed(5)}`).join("|");
    if (!signature || signature === lastSignatureRef.current) return;
    lastSignatureRef.current = signature;

    if (points.length === 1) {
      map.setView(points[0], Math.max(map.getZoom(), 13), { animate: false });
      return;
    }

    // Keep map viewport synced with latest technician/customer path updates.
    map.fitBounds(L.latLngBounds(points), { padding: [20, 20], maxZoom: 15, animate: false });
  }, [map, points]);

  return null;
}

function CommandCenterTrackMap({ job, trackLimit }: { job: CommandCenterJob; trackLimit: number }) {
  const hasTechnician = job.technician.currentLat != null && job.technician.currentLng != null;
  const hasCustomer = job.customerLocation.lat != null && job.customerLocation.lng != null;
  const queryEnabled = hasTechnician || hasCustomer;

  const trackQuery = useQuery({
    queryKey: ["admin", "command-center", "track", job.requestId, trackLimit],
    queryFn: () => getCommandCenterTrack(job.requestId, trackLimit),
    enabled: queryEnabled,
    staleTime: 20_000,
    refetchInterval: 20_000,
    refetchIntervalInBackground: true,
  });

  const technicianPoint = hasTechnician
    ? [Number(job.technician.currentLat), Number(job.technician.currentLng)] as [number, number]
    : null;
  const customerPoint = hasCustomer
    ? [Number(job.customerLocation.lat), Number(job.customerLocation.lng)] as [number, number]
    : null;

  const fallbackCenter: [number, number] = technicianPoint || customerPoint || [20.5937, 78.9629];
  const trackPath = (trackQuery.data?.points || [])
    .filter((point) => point.lat != null && point.lng != null)
    .map((point) => [Number(point.lat), Number(point.lng)] as [number, number]);
  const viewportPoints = (trackPath.length >= 2
    ? trackPath
    : [technicianPoint, customerPoint].filter(Boolean)) as [number, number][];

  if (!queryEnabled) {
    return <div className="h-44 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">No GPS location available.</div>;
  }

  return (
    <div className="h-44 overflow-hidden rounded-xl border border-slate-200">
      <MapContainer center={fallbackCenter} zoom={12} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewportSync points={viewportPoints} />
        {customerPoint ? (
          <Marker position={customerPoint} icon={customerIcon} />
        ) : null}
        {technicianPoint ? (
          <Marker position={technicianPoint} icon={technicianIcon} />
        ) : null}
        {trackPath.length >= 2 ? (
          <Polyline positions={trackPath} color="#0f766e" weight={3} />
        ) : technicianPoint && customerPoint ? (
          <Polyline positions={[technicianPoint, customerPoint]} color="#0f766e" weight={2} />
        ) : null}
      </MapContainer>
    </div>
  );
}

function JobCardActions({
  job,
  onReload,
  reassignRadiusKm,
}: {
  job: CommandCenterJob;
  onReload: () => void;
  reassignRadiusKm: number;
}) {
  const callMutation = useMutation({
    mutationFn: callCommandCenterTechnician,
    onSuccess: (data) => {
      if (data?.dialLink) {
        window.location.href = String(data.dialLink);
      } else {
        toast.info("Technician phone number is unavailable.");
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remindMutation = useMutation({
    mutationFn: remindCommandCenterTechnician,
    onSuccess: () => {
      toast.success(`Reminder sent to technician for Job #${job.requestId}.`);
      onReload();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reassignMutation = useMutation({
    mutationFn: reassignCommandCenterJob,
    onSuccess: (data) => {
      toast.success(data?.message || "Reassignment offers sent.");
      onReload();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const escalateMutation = useMutation({
    mutationFn: escalateCommandCenterJob,
    onSuccess: () => {
      toast.success(`Escalation triggered for Job #${job.requestId}.`);
      onReload();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => callMutation.mutate({ requestId: job.requestId })}
        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <PhoneCall className="h-3.5 w-3.5" />
        Call Technician
      </button>
      <button
        type="button"
        onClick={() => remindMutation.mutate({ requestId: job.requestId })}
        className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
      >
        <BellRing className="h-3.5 w-3.5" />
        Send Reminder
      </button>
      <button
        type="button"
        onClick={() => reassignMutation.mutate({ requestId: job.requestId, radiusKm: reassignRadiusKm })}
        className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
      >
        <Route className="h-3.5 w-3.5" />
        Reassign Job ({reassignRadiusKm} km)
      </button>
      <button
        type="button"
        onClick={() => escalateMutation.mutate({ requestId: job.requestId, radiusKm: reassignRadiusKm })}
        className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
      >
        <Siren className="h-3.5 w-3.5" />
        Escalate Job
      </button>
    </div>
  );
}

export default function AdminExtendedCommandCenterPage() {
  const queryClient = useQueryClient();
  const [banner, setBanner] = useState<string | null>(null);
  const [reassignRadiusKm, setReassignRadiusKm] = useState(35);
  const [trackPointLimit, setTrackPointLimit] = useState(80);
  const lastBannerAtRef = useRef<number>(0);

  const exceptionsQuery = useQuery({
    queryKey: ["admin", "command-center", "exceptions"],
    queryFn: getCommandCenterExceptions,
    refetchInterval: 45_000,
  });

  const manualRunMutation = useMutation({
    mutationFn: runCommandCenterMonitorCycle,
    onSuccess: (data: CommandCenterMonitorRunResponse) => {
      const jobsScanned = Number(data?.jobsScanned || 0);
      const alertsDetected = Number(data?.alertsDetected || 0);
      toast.success(`Monitoring cycle completed. Scanned ${jobsScanned} jobs and detected ${alertsDetected} alerts.`);
      void queryClient.invalidateQueries({ queryKey: ["admin", "command-center", "exceptions"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    const socketBaseUrl = getRequiredApiBaseUrl();
    const socket: Socket = io(socketBaseUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token: getAdminToken() || undefined },
    });

    const onAlert = (payload: { message?: string; requestId?: number }) => {
      const now = Date.now();
      if (now - lastBannerAtRef.current < 1500) return;
      const label = payload?.message || `Potential Delay Detected - Job #${payload?.requestId || "?"}`;
      setBanner(label);
      lastBannerAtRef.current = now;
      toast.warning(label);
      void queryClient.invalidateQueries({ queryKey: ["admin", "command-center", "exceptions"] });
    };

    const onRefresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "command-center", "exceptions"] });
    };

    socket.on("admin:command_center_alert", onAlert);
    socket.on("admin:command_center_alert_resolved", onRefresh);
    socket.on("admin:command_center_cycle", onRefresh);

    return () => {
      socket.off("admin:command_center_alert", onAlert);
      socket.off("admin:command_center_alert_resolved", onRefresh);
      socket.off("admin:command_center_cycle", onRefresh);
      socket.disconnect();
    };
  }, [queryClient]);

  const jobs = exceptionsQuery.data?.data || [];
  const summary = useMemo(() => {
    const red = jobs.filter((job) => job.riskLevel === "red").length;
    const yellow = jobs.filter((job) => job.riskLevel === "yellow").length;
    return { red, yellow, total: jobs.length };
  }, [jobs]);

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 md:text-3xl">Operations Command Center</h1>
          <p className="text-sm text-slate-500">Automated monitoring of active jobs. Only exception cases are shown.</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full border border-red-300 bg-red-50 px-2 py-0.5 font-semibold text-red-700">Red Delay: {summary.red}</span>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">Yellow Risk: {summary.yellow}</span>
            <span className="rounded-full border border-slate-300 bg-slate-50 px-2 py-0.5 font-semibold text-slate-700">Flagged Jobs: {summary.total}</span>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-700">
                <span className="font-semibold">Reassign Radius</span>
                <span className="font-bold">{reassignRadiusKm} km</span>
              </div>
              <Slider
                min={5}
                max={80}
                step={5}
                value={[reassignRadiusKm]}
                onValueChange={(value) => setReassignRadiusKm(Math.max(5, Number(value?.[0] || 35)))}
                aria-label="Reassign radius slider"
              />
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between text-xs text-slate-700">
                <span className="font-semibold">Track History Points</span>
                <span className="font-bold">{trackPointLimit}</span>
              </div>
              <Slider
                min={20}
                max={200}
                step={10}
                value={[trackPointLimit]}
                onValueChange={(value) => setTrackPointLimit(Math.max(20, Number(value?.[0] || 80)))}
                aria-label="Track history slider"
              />
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => manualRunMutation.mutate()}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <RefreshCcw className={`h-4 w-4 ${manualRunMutation.isPending ? "animate-spin" : ""}`} />
          Run Monitor Now
        </button>
      </header>

      {banner ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          <AlertTriangle className="h-4 w-4" />
          {banner}
        </div>
      ) : null}

      {exceptionsQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {(exceptionsQuery.error as Error).message}
        </div>
      ) : null}

      {exceptionsQuery.isLoading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading flagged jobs...</div>
      ) : null}

      {!exceptionsQuery.isLoading && jobs.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          No exceptions right now. All monitored jobs are currently within expected thresholds.
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {jobs.map((job) => (
          <article key={job.requestId} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Job #{job.requestId}</h2>
                <p className="text-xs text-slate-500">{job.serviceType || "Service Job"}</p>
              </div>
              <span
                className={`rounded-full border px-2 py-1 text-xs font-bold uppercase ${
                  riskClass[String(job.riskLevel || "yellow")] || "border-slate-300 bg-slate-50 text-slate-700"
                }`}
              >
                {job.riskLevel}
              </span>
            </div>

            <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
              <p><span className="font-semibold">Customer:</span> {job.customerLocation.address || "-"}</p>
              <p><span className="font-semibold">Technician:</span> {job.technician.name || "-"}</p>
              <p><span className="font-semibold">ETA:</span> {toMinutesLabel(job.etaMinutes)}</p>
              <p><span className="font-semibold">SLA:</span> {toTimeLabel(job.slaDeadline)}</p>
              <p><span className="font-semibold">ETA Arrival:</span> {toTimeLabel(job.etaArrival)}</p>
              <p><span className="font-semibold">SLA Window:</span> {timeRemainingLabel(job.timeRemainingMs)}</p>
              <p>
                <span className="font-semibold">Tech GPS:</span>{" "}
                {job.technician.currentLat != null && job.technician.currentLng != null
                  ? `${job.technician.currentLat.toFixed(5)}, ${job.technician.currentLng.toFixed(5)}`
                  : "-"}
              </p>
              <p><span className="font-semibold">Contact:</span> {job.technician.phone || "-"}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Delay Reasons</p>
              <div className="flex flex-wrap gap-2">
                {job.reasons.map((reason) => (
                  <span
                    key={`${job.requestId}-${reason.code}`}
                    className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
                      riskClass[String(reason.riskLevel || "yellow")] || "border-slate-300 bg-slate-100 text-slate-700"
                    }`}
                  >
                    {reason.text}
                  </span>
                ))}
              </div>
            </div>

            <CommandCenterTrackMap job={job} trackLimit={trackPointLimit} />
            <JobCardActions
              job={job}
              reassignRadiusKm={reassignRadiusKm}
              onReload={() => {
                void queryClient.invalidateQueries({ queryKey: ["admin", "command-center", "exceptions"] });
              }}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
