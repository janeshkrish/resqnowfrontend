import { usableLiveEta, type LiveEta } from "@/lib/liveEta";

type Coordinate = { lat: number; lng: number };

/** The backend's ETA for a job, placed on this device's clock. */
export type TrafficArrival = {
  eta: LiveEta;
  /** When the technician is due, in this device's time (epoch ms). */
  arrivalAt: number;
};

/** What the technician's screens show: minutes left, the clock time, and what it is based on. */
export type Arrival = {
  minutes: number;
  arrivalAt: number;
  /** e.g. "4:35 pm", in the phone's own time zone. */
  clockText: string;
  /** True only when the figure includes live traffic; never claimed otherwise. */
  trafficAware: boolean;
};

/**
 * Puts a backend ETA on the device's clock. The ETA was worked out at `calculatedAt` on
 * the server; `serverTime` is the server's clock when it answered. Their difference is
 * how old the ETA already was, whatever this phone's clock says.
 */
export function toTrafficArrival(eta: LiveEta, serverTime: unknown): TrafficArrival {
  const serverNow = Date.parse(String(serverTime ?? ""));
  const ageMs = Number.isFinite(serverNow) ? Math.max(0, serverNow - eta.calculatedAt) : 0;
  return { eta, arrivalAt: eta.receivedAt + eta.etaSeconds * 1000 - ageMs };
}

/** "4:35 pm": the way a clock time is said, in the phone's own time zone. */
export function formatClockTime(epochMs: number) {
  const date = new Date(epochMs);
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours % 12 || 12}:${minutes} ${hours < 12 ? "am" : "pm"}`;
}

/** "9 min", or "1 hr 5 min" for a long way. */
export function formatArrivalMinutes(minutes: number) {
  const whole = Math.max(1, Math.round(minutes));
  if (whole < 60) return `${whole} min`;
  const hours = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}

/**
 * When the technician will get there. The backend's ETA is used while it is current and
 * for this destination (it includes live traffic when the backend has it); otherwise the
 * app's own figure from the road route. Null when neither is known: no time is made up.
 */
export function resolveArrival({
  traffic,
  requestId,
  destination,
  routeMinutes,
  now = Date.now(),
}: {
  traffic: TrafficArrival | null | undefined;
  requestId: string | number | null | undefined;
  destination?: Coordinate | null;
  routeMinutes: number | null | undefined;
  now?: number;
}): Arrival | null {
  const current = traffic && requestId != null
    ? usableLiveEta(traffic.eta, { requestId: String(requestId), destination, now })
    : null;
  if (current && traffic) {
    const minutes = Math.max(1, Math.ceil((traffic.arrivalAt - now) / 60_000));
    // Shown to the minute the technician is told: never a time already past.
    const arrivalAt = Math.max(traffic.arrivalAt, now + 60_000);
    return { minutes, arrivalAt, clockText: formatClockTime(arrivalAt), trafficAware: current.trafficAware };
  }

  if (typeof routeMinutes !== "number" || !Number.isFinite(routeMinutes) || routeMinutes <= 0) return null;
  const minutes = Math.max(1, Math.round(routeMinutes));
  const arrivalAt = now + minutes * 60_000;
  return { minutes, arrivalAt, clockText: formatClockTime(arrivalAt), trafficAware: false };
}
