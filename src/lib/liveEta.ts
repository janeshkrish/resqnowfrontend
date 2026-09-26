/**
 * Live ETA shown on the customer's tracking screen.
 *
 * The backend attaches its latest ETA to technician location events, either as
 * the normalized `eta` object or as the legacy distanceKm / durationMinutes
 * fields. The ETA is held apart from the GPS coordinate: a location event
 * without an ETA never clears it, and only a newer calculation replaces it.
 * The frontend never calls a routing or traffic provider itself.
 */

export type LiveEta = {
  requestId: string;
  etaSeconds: number;
  distanceMeters: number;
  trafficAware: boolean;
  provider: string;
  /** When the backend calculated it (server clock, epoch ms). */
  calculatedAt: number;
  /** When this calculation first reached this device (device clock, epoch ms). */
  receivedAt: number;
  destinationLat: number | null;
  destinationLng: number | null;
};

type Coordinate = { lat: number; lng: number };

/** How long the last ETA stays on screen if no newer calculation arrives. */
export const LIVE_ETA_MAX_AGE_MS = 3 * 60_000;

// An ETA calculated for another destination (e.g. the towing pickup once the
// vehicle is loaded) must not be shown for the new one.
const DESTINATION_MATCH_METERS = 150;

const TERMINAL_STATUSES = new Set([
  "completed",
  "cancelled",
  "canceled",
  "paid",
  "closed",
  "job_closed",
  "rejected",
  "expired",
]);

export function isTerminalRequestStatus(status: unknown) {
  return TERMINAL_STATUSES.has(String(status ?? "").trim().toLowerCase());
}

const finiteNonNegative = (value: unknown) => {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const finiteCoordinate = (value: unknown, limit: number) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Math.abs(parsed) <= limit ? parsed : null;
};

const timestamp = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);

/**
 * Reads the ETA carried by a location event, or null when it has none.
 * Accepts the normalized `eta` object and the legacy route-metric fields.
 */
export function parseLiveEta(data: unknown, requestId: string, receivedAt = Date.now()): LiveEta | null {
  if (!data || typeof data !== "object") return null;
  const event = data as Record<string, unknown>;
  const eta = event.eta && typeof event.eta === "object" ? (event.eta as Record<string, unknown>) : null;

  const etaRequestId = text(eta?.requestId) ?? (eta?.requestId != null ? String(eta.requestId) : null);
  if (etaRequestId && etaRequestId !== String(requestId)) return null;

  let etaSeconds: number | null;
  let distanceMeters: number | null;
  if (eta) {
    etaSeconds = finiteNonNegative(eta.etaSeconds);
    distanceMeters = finiteNonNegative(eta.distanceMeters);
  } else {
    const minutes = finiteNonNegative(event.durationMinutes);
    const kilometres = finiteNonNegative(event.distanceKm);
    etaSeconds = minutes == null ? null : minutes * 60;
    distanceMeters = kilometres == null ? null : kilometres * 1000;
  }
  if (etaSeconds == null || distanceMeters == null) return null;

  const calculatedAt =
    timestamp(eta?.calculatedAt) ??
    timestamp(event.etaCalculatedAt) ??
    timestamp(event.receivedAt) ??
    timestamp(event.recordedAt ?? event.locationUpdatedAt) ??
    receivedAt;

  return {
    requestId: String(requestId),
    etaSeconds,
    distanceMeters,
    trafficAware: eta ? eta.trafficAware === true : event.trafficAware === true || event.traffic_aware === true,
    provider: text(eta?.provider) ?? text(event.etaSource) ?? text(event.provider) ?? "route",
    calculatedAt,
    receivedAt,
    destinationLat: finiteCoordinate(eta?.destinationLat, 90),
    destinationLng: finiteCoordinate(eta?.destinationLng, 180),
  };
}

/** Keeps the current ETA unless the incoming one is a newer calculation. */
export function mergeLiveEta(current: LiveEta | null | undefined, incoming: LiveEta | null): LiveEta | null {
  if (!incoming) return current ?? null;
  if (!current || current.requestId !== incoming.requestId) return incoming;
  // The backend re-sends its cached ETA with each location. Keeping the
  // current object means a repeat never looks fresher than it is.
  if (incoming.calculatedAt <= current.calculatedAt) return current;
  return incoming;
}

export function isLiveEtaExpired(eta: LiveEta, now = Date.now()) {
  return now - eta.receivedAt > LIVE_ETA_MAX_AGE_MS;
}

export function distanceMeters(from: Coordinate, to: Coordinate) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRad(to.lat - from.lat);
  const deltaLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * 6_371_000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** The ETA to show for this request and destination, or null. */
export function usableLiveEta(
  eta: LiveEta | null | undefined,
  { requestId, destination, now = Date.now() }: { requestId: string; destination?: Coordinate | null; now?: number },
): LiveEta | null {
  if (!eta || eta.requestId !== String(requestId) || isLiveEtaExpired(eta, now)) return null;
  if (destination && eta.destinationLat != null && eta.destinationLng != null) {
    const drift = distanceMeters(destination, { lat: eta.destinationLat, lng: eta.destinationLng });
    if (drift > DESTINATION_MATCH_METERS) return null;
  }
  return eta;
}

export function formatEtaDuration(etaSeconds: number) {
  const minutes = Math.max(1, Math.ceil(etaSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

export function etaBasisLabel(eta: Pick<LiveEta, "trafficAware">) {
  return eta.trafficAware ? "Traffic-aware" : "Estimated";
}
