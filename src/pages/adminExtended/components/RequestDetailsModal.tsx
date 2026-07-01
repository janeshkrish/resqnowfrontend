import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MapContainer, Marker, Polyline, TileLayer } from "react-leaflet";
import { AlertTriangle, FileText, MapPin, ShieldAlert, UserRoundSearch } from "lucide-react";
import { toast } from "sonner";
import Modal from "./Modal";
import TechnicianAssignmentModal from "./TechnicianAssignmentModal";
import { getAdminRequestDetails } from "@/services/adminDetailsService";
import { routePolylineFromMetadata } from "@/lib/geo";
import {
  closeAdminRequest,
  escalateAdminRequest,
  markAdminRequestHighPriority,
  overrideAdminRequestPricing,
} from "../api/adminExtendedApi";

type ActionType = "escalate" | "priority" | "pricing" | "close" | null;

const label = (value: string | null | undefined) =>
  String(value || "-")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const money = (value: number | null | undefined, currency = "INR") =>
  `${currency} ${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const dateTime = (value: string | null | undefined) => (value ? new Date(value).toLocaleString() : "-");

const DetailRows = ({ data }: { data: Record<string, any> }) => (
  <div className="grid gap-2 text-sm sm:grid-cols-2">
    {Object.entries(data).map(([key, value]) => (
      <div key={key} className="rounded-lg bg-slate-50 p-2.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label(key)}</p>
        <p className="mt-1 break-words font-medium text-slate-800">
          {value == null || value === "" ? "-" : typeof value === "object" ? JSON.stringify(value) : String(value)}
        </p>
      </div>
    ))}
  </div>
);

export default function RequestDetailsModal({
  requestId,
  open,
  onClose,
}: {
  requestId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [assignmentOpen, setAssignmentOpen] = useState(false);
  const [action, setAction] = useState<ActionType>(null);
  const [reason, setReason] = useState("");
  const [radiusKm, setRadiusKm] = useState("35");
  const [amount, setAmount] = useState("");
  const [closeStatus, setCloseStatus] = useState("cancelled");

  const detailsQuery = useQuery({
    queryKey: ["admin", "request-details", requestId],
    queryFn: () => getAdminRequestDetails(requestId!),
    enabled: open && Boolean(requestId),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin", "requests"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "request-details", requestId] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "analytics"] }),
      queryClient.invalidateQueries({ queryKey: ["admin", "technicians"] }),
    ]);
    setAction(null);
    setReason("");
  };

  const actionMutation = useMutation({
    mutationFn: async () => {
      if (!requestId || !action) return;
      if (action === "escalate") {
        return escalateAdminRequest({ requestId, radiusKm: Number(radiusKm) || 35, reason: reason || undefined });
      }
      if (action === "priority") return markAdminRequestHighPriority({ requestId, note: reason || undefined });
      if (action === "pricing") {
        const baseAmount = Number(amount);
        if (!Number.isFinite(baseAmount) || baseAmount <= 0) throw new Error("Enter a valid fare amount.");
        return overrideAdminRequestPricing({ requestId, baseAmount, finalPrice: baseAmount, reason: reason || undefined });
      }
      return closeAdminRequest({ requestId, status: closeStatus, reason: reason || undefined });
    },
    onSuccess: async () => {
      toast.success("Request updated.");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const details = detailsQuery.data;
  const routePath = useMemo(
    () => routePolylineFromMetadata(details?.location.routeMetadata || null),
    [details?.location.routeMetadata]
  );
  const pickup =
    details?.location.pickup.lat != null && details.location.pickup.lng != null
      ? ([details.location.pickup.lat, details.location.pickup.lng] as [number, number])
      : routePath[0] || null;
  const destination =
    details?.location.destination.lat != null && details.location.destination.lng != null
      ? ([details.location.destination.lat, details.location.destination.lng] as [number, number])
      : routePath[routePath.length - 1] || null;
  const center = pickup || destination || ([11.0168, 76.9558] as [number, number]);

  const openAction = (nextAction: ActionType) => {
    setAction(nextAction);
    setReason("");
    setAmount(String(details?.fare.customerFare || ""));
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Request Details"
        description={requestId ? `Request #${requestId}` : ""}
        size="full"
      >
        {detailsQuery.isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : detailsQuery.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {(detailsQuery.error as Error).message}
          </div>
        ) : details ? (
          <div className="space-y-5">
            <section className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 font-semibold text-slate-900">Admin Actions</h4>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setAssignmentOpen(true)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
                  <UserRoundSearch className="mr-1 inline h-4 w-4" /> Manual Assign
                </button>
                <button onClick={() => openAction("escalate")} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">Escalate</button>
                <button onClick={() => openAction("priority")} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">High Priority</button>
                <button onClick={() => openAction("pricing")} className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">Override Fare</button>
                <button onClick={() => openAction("close")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">Close Request</button>
              </div>

              {action ? (
                <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-3">
                  {action === "escalate" ? (
                    <input value={radiusKm} onChange={(event) => setRadiusKm(event.target.value)} placeholder="Radius km" className="h-10 rounded-lg border px-3 text-sm" />
                  ) : null}
                  {action === "pricing" ? (
                    <input value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Revised fare" className="h-10 rounded-lg border px-3 text-sm" />
                  ) : null}
                  {action === "close" ? (
                    <select value={closeStatus} onChange={(event) => setCloseStatus(event.target.value)} className="h-10 rounded-lg border px-3 text-sm">
                      <option value="cancelled">Cancelled</option>
                      <option value="completed">Completed</option>
                    </select>
                  ) : null}
                  <textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Admin reason or note" className="min-h-10 rounded-lg border px-3 py-2 text-sm md:col-span-2" />
                  <div className="flex gap-2">
                    <button onClick={() => actionMutation.mutate()} disabled={actionMutation.isPending} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                      Confirm
                    </button>
                    <button onClick={() => setAction(null)} className="rounded-lg border px-4 py-2 text-sm font-semibold">Cancel</button>
                  </div>
                </div>
              ) : null}
            </section>

            <div className="grid gap-5 xl:grid-cols-2">
              <section className="rounded-xl border border-slate-200 p-4">
                <h4 className="mb-3 font-semibold text-slate-900">Request Information</h4>
                <DetailRows data={{
                  requestId: details.request.id,
                  createdTime: dateTime(details.request.createdTime),
                  status: label(details.request.status),
                  priority: details.request.priority,
                  serviceType: label(details.request.serviceType),
                  paymentStatus: label(details.request.paymentStatus),
                  cancellationReason: details.request.cancellationReason,
                }} />
              </section>

              <section className="rounded-xl border border-slate-200 p-4">
                <h4 className="mb-3 font-semibold text-slate-900">Customer & Vehicle</h4>
                <DetailRows data={{ ...details.customer, ...details.vehicle }} />
              </section>
            </div>

            <section className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 font-semibold text-slate-900">Pickup & Destination</h4>
              <div className="mb-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-emerald-50 p-3 text-sm"><MapPin className="mb-1 h-4 w-4 text-emerald-700" /><strong>Pickup:</strong> {details.location.pickupAddress || "-"}</div>
                <div className="rounded-lg bg-rose-50 p-3 text-sm"><MapPin className="mb-1 h-4 w-4 text-rose-700" /><strong>Destination:</strong> {details.location.destinationAddress || "-"}</div>
              </div>
              {(pickup || destination) ? (
                <div className="h-72 overflow-hidden rounded-xl border">
                  <MapContainer center={center} zoom={12} style={{ height: "100%", width: "100%" }}>
                    <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {pickup ? <Marker position={pickup} /> : null}
                    {destination ? <Marker position={destination} /> : null}
                    {routePath.length > 1 ? <Polyline positions={routePath} color="#2563eb" weight={4} /> : null}
                  </MapContainer>
                </div>
              ) : <p className="text-sm text-slate-500">Coordinates are not available.</p>}
              <p className="mt-3 text-sm text-slate-600">Distance: {details.location.distanceKm == null ? "-" : `${details.location.distanceKm} km`} | Estimated duration: {details.location.estimatedDurationMinutes == null ? "-" : `${details.location.estimatedDurationMinutes} min`}</p>
            </section>

            <section className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 font-semibold text-slate-900">Fare Breakdown</h4>
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  ["Customer Fare", money(details.fare.customerFare, details.fare.currency)],
                  ["Technician Earnings", money(details.fare.technicianEarnings, details.fare.currency)],
                  ["Platform Margin", money(details.fare.platformMargin, details.fare.currency)],
                  ["Surge Multiplier", `${details.fare.surgeMultiplier}x`],
                  ["Tax", money(details.fare.tax, details.fare.currency)],
                  ["Total", money(details.fare.total, details.fare.currency)],
                ].map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{key}</p><p className="mt-1 font-bold">{value}</p></div>)}
              </div>
            </section>

            <section className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 font-semibold text-slate-900">Assigned Technician</h4>
              {details.technician ? (
                <div className="space-y-3">
                  <DetailRows data={{
                    technicianId: details.technician.technicianId,
                    name: details.technician.businessInfo.shopName,
                    proprietor: details.technician.businessInfo.proprietorName,
                    phone: details.technician.businessInfo.contactNumber,
                    rating: details.technician.statistics.rating,
                    currentStatus: details.technician.availability.isAvailable ? "Available" : "Busy",
                    location: details.technician.businessInfo.location,
                    approvalStatus: details.technician.verification.approvalStatus,
                    servicesOffered: details.technician.services.join(", "),
                    fleetDetails: details.technician.fleet.selectedTypes.join(", "),
                  }} />
                </div>
              ) : <p className="text-sm text-slate-500">No technician assigned.</p>}
            </section>

            <section className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 font-semibold text-slate-900">Timeline / Audit Trail</h4>
              {details.timeline.length ? (
                <div className="space-y-3">
                  {details.timeline.map((event) => (
                    <div key={`${event.id}-${event.createdAt}`} className="flex gap-3">
                      <div className="mt-1 h-3 w-3 shrink-0 rounded-full bg-red-600" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-800">{event.title}</p>
                        <p className="text-xs text-slate-500">{dateTime(event.createdAt)}{event.actorId ? ` | ${event.actorId}` : ""}</p>
                        {event.description ? <p className="mt-1 text-sm text-slate-600">{event.description}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">No timeline events available.</p>}
            </section>

            <section className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 font-semibold text-slate-900">Attachments</h4>
              {details.attachments.length ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {details.attachments.map((attachment) => {
                    const isImage = String(attachment.mimeType || attachment.url).match(/image|\.png|\.jpe?g|\.webp/i);
                    return <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-xl border">
                      {isImage ? <img src={attachment.url} alt={attachment.fileName || "Attachment"} className="h-32 w-full object-cover" /> : <div className="flex h-32 items-center justify-center bg-slate-50"><FileText className="h-8 w-8 text-slate-400" /></div>}
                      <p className="truncate px-3 py-2 text-xs font-semibold">{attachment.fileName || label(attachment.type)}</p>
                    </a>;
                  })}
                </div>
              ) : <p className="text-sm text-slate-500">No attachments uploaded.</p>}
            </section>

            {details.request.priority === "High" ? <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"><ShieldAlert className="h-4 w-4" /> High-priority request</div> : null}
            {details.request.cancellationReason ? <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700"><AlertTriangle className="h-4 w-4" /> {details.request.cancellationReason}</div> : null}
          </div>
        ) : null}
      </Modal>

      <TechnicianAssignmentModal
        open={assignmentOpen}
        requestId={requestId}
        onClose={() => setAssignmentOpen(false)}
        onAssigned={() => void refresh()}
      />
    </>
  );
}
