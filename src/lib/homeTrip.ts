/**
 * The active request card on home: what it says, and where the technician is drawn on
 * the slim line that runs to the customer's vehicle.
 *
 * Nothing is estimated on the phone. The words and the position come from the request's
 * stage and, while the technician travels, from the minutes and distance the backend sent.
 */
import type { ActiveStage } from "@/lib/activeRequest";
import { arrivesByText, firstName, formatWorkClock, type TrackingPhase } from "@/lib/customerTracking";
import { distanceMeters, formatEtaDuration, type LiveEta } from "@/lib/liveEta";
import { formatClockTime } from "@/lib/technicianArrival";

type Point = { lat: number; lng: number };

const PHASE_BY_STAGE: Record<ActiveStage, TrackingPhase> = {
  pending: "search",
  assigned: "accepted",
  on_the_way: "way",
  arrived: "arrived",
  in_progress: "working",
};

/** The home card's stage, as the phase the trip line and the wording are drawn for. */
export function phaseForStage(stage: ActiveStage): TrackingPhase {
  return PHASE_BY_STAGE[stage];
}

/** A trip of this many minutes or more is drawn from the far end of the line. */
export const TRIP_SCALE_MINUTES = 20;
const TRIP_NEAR_START = 0.06;
const TRIP_NEAR_VEHICLE = 0.92;
/** Where a travelling technician is drawn when the backend has sent no minutes yet. */
export const TRIP_UNKNOWN = 0.3;

/**
 * How far along the line the technician is drawn, from 0 (the start) to 1 (at the
 * vehicle). At the start once assigned, at the vehicle from arrival on, and while
 * travelling by the minutes left: 20 minutes or more away is the far end, and the last
 * minute is just short of the vehicle.
 */
export function tripProgress(phase: TrackingPhase, liveEta: Pick<LiveEta, "etaSeconds"> | null) {
  if (phase === "search" || phase === "accepted") return 0;
  if (phase !== "way") return 1;
  if (!liveEta) return TRIP_UNKNOWN;
  const minutes = Math.max(0, Math.min(TRIP_SCALE_MINUTES, liveEta.etaSeconds / 60));
  return TRIP_NEAR_VEHICLE - (TRIP_NEAR_VEHICLE - TRIP_NEAR_START) * (minutes / TRIP_SCALE_MINUTES);
}

/**
 * "1.6 km" from the backend's road route. Without one, the straight line between the two
 * points, marked as approximate; null when even that is not known.
 */
export function approachDistance(
  liveEta: Pick<LiveEta, "distanceMeters"> | null,
  technician: Point | null,
  destination: Point | null,
) {
  if (liveEta) return `${(liveEta.distanceMeters / 1000).toFixed(1)} km`;
  if (!technician || !destination) return null;
  return `≈ ${(distanceMeters(technician, destination) / 1000).toFixed(1)} km`;
}

export type HomeHeadline = {
  /** One short line that says what is happening. */
  say: string;
  /** The figure or words the eye lands on. */
  big: string;
  /** True when `big` is words rather than a figure, so it is set smaller. */
  bigIsText: boolean;
  /** A short note beside the figure, e.g. "Arrives by 9:46 pm". */
  side: string | null;
};

const clockOf = (value: string | null | undefined) => {
  const at = Date.parse(String(value ?? ""));
  return Number.isFinite(at) ? formatClockTime(at) : null;
};

const joined = (...parts: Array<string | null | undefined | false>) => parts.filter(Boolean).join(" · ");

/** The card's two lines of words for a stage. */
export function homeTrackingHeadline({
  phase,
  technicianName,
  createdAt,
  startedAt,
  elapsedSeconds,
  liveEta,
  distance,
}: {
  phase: TrackingPhase;
  technicianName?: string | null;
  createdAt?: string | null;
  startedAt?: string | null;
  elapsedSeconds: number;
  /** The backend's ETA, already checked for this request and destination. */
  liveEta: LiveEta | null;
  /** From `approachDistance`: "1.6 km", "≈ 1.6 km" or null. */
  distance: string | null;
}): HomeHeadline {
  const first = firstName(technicianName);
  const words = (say: string, big: string): HomeHeadline => ({ say, big, bigIsText: true, side: null });

  switch (phase) {
    case "search":
      return words(joined("Request sent", clockOf(createdAt)), "Finding a technician");
    case "accepted": {
      const say = joined(`${first} accepted`, distance && `${distance} away`);
      return liveEta
        ? { say, big: `${formatEtaDuration(liveEta.etaSeconds)} away`, bigIsText: false, side: null }
        : words(say, "Getting ready to leave");
    }
    case "way":
      if (liveEta) {
        return {
          say: joined(`${first} is on the way`, distance),
          big: formatEtaDuration(liveEta.etaSeconds),
          bigIsText: false,
          side: arrivesByText(liveEta),
        };
      }
      // No minutes from the backend: the distance is shown if it is known, and no time is made up.
      return distance ? words(`${first} is on the way`, `${distance} away`) : words(`${first} is coming to you`, "On the way");
    case "arrived":
      return words(`${first} has arrived`, "At your location");
    case "working": {
      const since = clockOf(startedAt);
      return elapsedSeconds > 0
        ? { say: "Work in progress", big: formatWorkClock(elapsedSeconds), bigIsText: false, side: since ? `since ${since}` : null }
        : words("Work in progress", "Work has started");
    }
    default:
      return words("Your request", "In progress");
  }
}
