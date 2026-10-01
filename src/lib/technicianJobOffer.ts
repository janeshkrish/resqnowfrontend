import type { JobRequest } from "@/components/technician/TechnicianJobModal";
import { apiFetch, readJsonSafely } from "@/lib/api";
import { readJobDetails } from "@/lib/technicianJobDetails";

type Row = Record<string, unknown>;

const money = (value: unknown) =>
  value != null && value !== "" && Number.isFinite(Number(value)) ? Number(value) : null;

/**
 * The number in what dispatch sends for the way to the customer: "2.4 km", "~8 mins", or a
 * plain number. Null for "Nearby" or nothing, so the card shows a dash, never a guess.
 */
export function readOfferNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  const match = /\d+(?:\.\d+)?/.exec(String(value ?? ""));
  const found = match ? Number(match[0]) : NaN;
  return Number.isFinite(found) && found > 0 ? found : null;
}

/**
 * The offer card's job, from a socket offer (resqnowbackend dispatchQueueService) or the
 * `request` of GET /api/service-requests/:id/technician-offer.
 */
export function toJobRequest(raw: Row | null | undefined): JobRequest | null {
  const id = String(raw?.requestId ?? raw?.id ?? raw?.jobId ?? "").trim();
  if (!raw || !id || id === "undefined") return null;
  const location = (raw.location || {}) as Row;
  const drop = (raw.dropLocation || {}) as Row;
  const job: JobRequest = {
    id,
    isTowing: Boolean(raw.isTowing),
    customerName: String(raw.customerName || raw.contact_name || "Customer"),
    serviceType: String(raw.serviceType || raw.service_type || "Service"),
    vehicleType: String(raw.vehicleType || raw.vehicle_type || "car"),
    location: {
      lat: Number(location.lat ?? raw.location_lat ?? 0) || 0,
      lng: Number(location.lng ?? raw.location_lng ?? 0) || 0,
      address: String(raw.address || location.address || "Location not available"),
    },
    distance: parseFloat(String(raw.routeDistanceKm ?? raw.distance ?? raw.locationDistance ?? 0)) || 0,
    pickupDistanceKm: readOfferNumber(raw.distance ?? raw.locationDistance),
    etaMinutes: readOfferNumber(raw.eta),
    routeDistanceKm: Number(raw.routeDistanceKm ?? raw.route_distance_km ?? 0) || null,
    estimatedDuration: Number(raw.estimatedDuration ?? raw.estimated_duration ?? 0) || null,
    dropLocation: {
      lat: Number(drop.lat ?? raw.drop_latitude ?? 0) || null,
      lng: Number(drop.lng ?? raw.drop_longitude ?? 0) || null,
      address: String(drop.address || raw.dropAddress || raw.drop_address || "").trim() || null,
    },
    vehicleCategory: String(raw.vehicleCategory || raw.vehicle_category || "").trim() || null,
    details: readJobDetails(raw),
    amount:
      money(raw.technicianEstimatedEarning) ?? money(raw.estimatedEarnings) ?? money(raw.amount) ?? money(raw.priceAmount) ?? 0,
    eta: (raw.eta as JobRequest["eta"]) ?? null,
  };
  return job;
}

/** Whether the offer is still open for this technician, with its full details when it is. */
export async function fetchTechnicianOffer(requestId: string) {
  const res = await apiFetch(`/api/service-requests/${encodeURIComponent(requestId)}/technician-offer`, { technician: true });
  const body = (await readJsonSafely<Row>(res)) || {};
  const available = res.ok && body.available === true;
  return { available, job: available ? toJobRequest({ id: requestId, ...((body.request || {}) as Row) }) : null };
}
