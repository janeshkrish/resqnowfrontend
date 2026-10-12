// The words and pictures for the moment between sending a request and a technician accepting it.
import { serviceArt, serviceOf, type ServiceId } from "@/lib/services";

export type FindingCopy = {
  /** The card's heading while searching: "Finding a tow truck nearby". */
  title: string;
  /** Who is being asked, for "Contacting … near you". */
  who: string;
  /** The Material symbol on a nearby technician's marker. */
  glyph: string;
};

const BY_SERVICE: Record<ServiceId, FindingCopy> = {
  towing: { title: "Finding a tow truck nearby", who: "tow operators", glyph: "auto_towing" },
  "flat-tire": { title: "Finding a technician nearby", who: "tyre technicians", glyph: "two_wheeler" },
  battery: { title: "Finding a technician nearby", who: "battery technicians", glyph: "two_wheeler" },
  mechanical: { title: "Finding a mechanic nearby", who: "mechanics", glyph: "two_wheeler" },
  fuel: { title: "Finding fuel nearby", who: "fuel partners", glyph: "two_wheeler" },
  lockout: { title: "Finding a locksmith nearby", who: "locksmiths", glyph: "two_wheeler" },
  winching: { title: "Finding a recovery truck", who: "recovery crews", glyph: "auto_towing" },
  "ev-charging": { title: "Finding a charging van nearby", who: "charging vans", glyph: "ev_station" },
};

// SOS and anything else that is not one of the listed services.
const ANY_SERVICE: FindingCopy = { title: "Finding a technician nearby", who: "technicians", glyph: "two_wheeler" };

/** The search wording for a request's `service_type`, however it was saved. */
export function findingCopy(serviceType: string | null | undefined): FindingCopy {
  const service = serviceOf(serviceType);
  return service ? BY_SERVICE[service.id] : ANY_SERVICE;
}

/** The two lines that take turns under the heading while the search runs. */
export const findingLines = (copy: FindingCopy): [string, string] => [
  `Contacting ${copy.who} near you`,
  "Waiting for one of them to accept",
];

/** Under "Request sent": "Finding a tow truck near you". */
export const sentNextLine = (copy: FindingCopy) => `${copy.title.replace(/ nearby$/, "")} near you`;

/** The service's own picture for the pins in the request-sent scene; null when the service has none. */
export const findingArt = (serviceType: string | null | undefined) => serviceArt(serviceType);

export type NearbyPoint = { id: string; lat: number; lng: number };

/** How many nearby technicians the search map shows at most, nearest first. */
export const NEARBY_MARKER_LIMIT = 8;

/**
 * Technicians near the customer who are marked available, nearest first, from /api/technicians/nearby
 * (already asked for this service and kind of vehicle). Only where they are is kept.
 */
export function nearbyAvailable(input: unknown, limit = NEARBY_MARKER_LIMIT): NearbyPoint[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index) => {
      const raw = (item ?? {}) as Record<string, unknown>;
      const lat = Number(raw.latitude ?? raw.lat);
      const lng = Number(raw.longitude ?? raw.lng);
      const distance = Number(raw.distance);
      return {
        id: String(raw.id ?? `nearby-${index}`),
        lat,
        lng,
        available: raw.is_available === true,
        distance: Number.isFinite(distance) ? distance : Number.POSITIVE_INFINITY,
      };
    })
    .filter((tech) => tech.available && Number.isFinite(tech.lat) && Number.isFinite(tech.lng) && tech.lat !== 0 && tech.lng !== 0)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ id, lat, lng }) => ({ id, lat, lng }));
}

const SENT_SEEN_PREFIX = "resqnow_request_sent_seen_";

/** The request-sent moment plays once per request, not again on a reload or on coming back to the page. */
export function hasSeenRequestSent(requestId: string): boolean {
  try {
    return sessionStorage.getItem(SENT_SEEN_PREFIX + requestId) === "1";
  } catch {
    return false;
  }
}

export function markRequestSentSeen(requestId: string) {
  try {
    sessionStorage.setItem(SENT_SEEN_PREFIX + requestId, "1");
  } catch {
    // Storage can be unavailable; the moment may then play again after a reload.
  }
}
