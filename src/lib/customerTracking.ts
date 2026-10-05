/**
 * What the customer's live-tracking card says at each stage of a request.
 *
 * Everything here is worked out from the request, the technician and the backend's ETA
 * as they are; nothing is estimated on the phone. Where a figure is not known, the card
 * says so in words instead of showing a made-up number.
 */
import { formatEtaDuration, type LiveEta } from "@/lib/liveEta";
import type { TrackingFreshness } from "@/lib/liveTrackingPlayback";
import { formatClockTime } from "@/lib/technicianArrival";

/** The stage of the journey the card is drawn for. */
export type TrackingPhase =
  | "search"
  | "accepted"
  | "way"
  | "arrived"
  | "working"
  | "loaded"
  | "towing"
  | "dropped"
  | "finished"
  | "pay"
  | "rate"
  | "closed"
  | "cancelled"
  | "other";

export type TrackingStep = { label: string; state: "done" | "now" | "todo" };

export type TrackingHeadline = {
  /** One plain line that says what is happening. */
  say: string;
  /** The figure or words the eye lands on. */
  big: string;
  /** True when `big` is words rather than a figure, so it is set smaller. */
  bigIsText: boolean;
  /** A short note beside the figure, e.g. "Arrives by 9:46 pm". */
  side: string | null;
  sub: string;
};

/** A customer may cancel only until the technician sets off. */
const CANCELLABLE_STATUSES = new Set(["pending", "assigned", "accepted"]);

export function canCustomerCancel(status: string) {
  return CANCELLABLE_STATUSES.has(status);
}

/** Statuses in which the technician has set off but the work is not finished. */
const CANCEL_CLOSED_STATUSES = new Set([
  "en-route",
  "en_route_pickup",
  "arrived",
  "arrived_pickup",
  "in-progress",
  "vehicle_loaded",
  "enroute_drop",
  "arrived_drop",
]);

/** True while the customer may wonder where Cancel went: the job is under way. */
export function isCancelClosed(status: string) {
  return CANCEL_CLOSED_STATUSES.has(status);
}

const RATING_STATUSES = new Set(["completed", "paid", "payment_pending"]);

export function trackingPhase({
  status,
  paymentDue,
  paymentCompleted,
}: {
  status: string;
  paymentDue: boolean;
  paymentCompleted: boolean;
}): TrackingPhase {
  if (status === "cancelled") return "cancelled";
  if (paymentCompleted && RATING_STATUSES.has(status)) return "rate";
  if (paymentDue && !paymentCompleted) return "pay";
  switch (status) {
    case "pending":
      return "search";
    case "assigned":
    case "accepted":
      return "accepted";
    case "en-route":
    case "en_route_pickup":
      return "way";
    case "arrived":
    case "arrived_pickup":
      return "arrived";
    case "in-progress":
      return "working";
    case "vehicle_loaded":
      return "loaded";
    case "enroute_drop":
      return "towing";
    case "arrived_drop":
      return "dropped";
    case "service_completed":
    case "payment_pending":
    case "completed":
      return "finished";
    case "paid":
    case "closed":
      return "closed";
    default:
      return "other";
  }
}

/** The card can shrink to the map strip or open to details while the job is live. */
export function canResizeTrackingSheet(phase: TrackingPhase) {
  return phase !== "rate" && phase !== "closed" && phase !== "cancelled";
}

const STEP_NOW: Record<TrackingPhase, number> = {
  search: 0,
  accepted: 0,
  way: 1,
  arrived: 2,
  working: 2,
  loaded: 2,
  towing: 2,
  dropped: 2,
  finished: 3,
  pay: 3,
  rate: 4,
  closed: 4,
  cancelled: -1,
  other: 0,
};

/** The four-part progress line. Towing waits at the pickup under "To pickup". */
export function trackingSteps(phase: TrackingPhase, isTowing: boolean): TrackingStep[] {
  const found = phase === "search" ? "Finding" : "Found";
  const labels = isTowing ? [found, "To pickup", "Towing", "Done"] : [found, "On the way", "At vehicle", "Done"];
  const now = isTowing && phase === "arrived" ? 1 : STEP_NOW[phase];
  return labels.map((label, index) => ({ label, state: index < now ? "done" : index === now ? "now" : "todo" }));
}

export function firstName(name: string | null | undefined) {
  return String(name || "").trim().split(/\s+/)[0] || "Your technician";
}

export function technicianInitials(name: string | null | undefined) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  return (words.slice(0, 2).map((word) => word[0]).join("") || "T").toUpperCase();
}

/** "₹110.00" in rupees; the currency code in front for anything else. */
export function formatTrackingMoney(amount: number, currency = "INR", { whole = false } = {}) {
  const digits = whole && Number.isInteger(amount) ? 0 : 2;
  const figure = amount.toLocaleString("en-IN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return currency.toUpperCase() === "INR" ? `₹${figure}` : `${currency.toUpperCase()} ${figure}`;
}

/** "04:12": how long the work has been going. */
export function formatWorkClock(seconds: number) {
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, "0")}:${String(whole % 60).padStart(2, "0")}`;
}

const clockOf = (value: string | null | undefined) => {
  const at = Date.parse(String(value ?? ""));
  return Number.isFinite(at) ? formatClockTime(at) : null;
};

/** What the minutes are based on. Live traffic is claimed only when the backend used it. */
export function etaBasisText(eta: Pick<LiveEta, "trafficAware">) {
  return eta.trafficAware ? "live traffic" : "road estimate";
}

/** "Arrives by 9:46 pm", from the moment the ETA reached this phone. */
export function arrivesByText(eta: Pick<LiveEta, "receivedAt" | "etaSeconds">) {
  return `Arrives by ${formatClockTime(eta.receivedAt + eta.etaSeconds * 1000)}`;
}

const joined = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(" · ");

export type TrackingHeadlineInput = {
  phase: TrackingPhase;
  isTowing: boolean;
  technicianName?: string | null;
  requestId: string;
  createdAt?: string | null;
  startedAt?: string | null;
  elapsedSeconds: number;
  /** The backend's ETA, already checked for this request and destination. */
  liveEta: LiveEta | null;
  /** "1.6 km away", or "≈ 1.6 km away" when it is only a straight line. */
  distanceLabel: string | null;
  /** The amount due, e.g. "₹110.00". */
  amountLabel: string | null;
  dropAddress?: string | null;
  /** Wording for a status this card has no stage for. */
  fallback: { title: string; subtitle: string };
};

export function trackingHeadline(input: TrackingHeadlineInput): TrackingHeadline {
  const { phase, isTowing, liveEta, distanceLabel, amountLabel } = input;
  const first = firstName(input.technicianName);
  const text = (say: string, big: string, sub: string): TrackingHeadline => ({ say, big, bigIsText: true, side: null, sub });

  switch (phase) {
    case "search":
      return text(joined("Request sent", clockOf(input.createdAt)), "Finding a technician", "We’re checking nearby partners for you.");
    case "accepted":
      return liveEta
        ? {
            say: `${first} accepted your request`,
            big: `${formatEtaDuration(liveEta.etaSeconds)} away`,
            bigIsText: false,
            side: null,
            sub: joined(distanceLabel, "getting ready to leave"),
          }
        : text(`${first} accepted your request`, "Technician assigned", joined(distanceLabel, "getting ready to leave"));
    case "way": {
      const say = isTowing ? `${first} is heading to pickup` : `${first} is on the way`;
      return liveEta
        ? {
            say,
            big: formatEtaDuration(liveEta.etaSeconds),
            bigIsText: false,
            side: arrivesByText(liveEta),
            sub: joined(distanceLabel, etaBasisText(liveEta)),
          }
        : text(say, "On the way", distanceLabel || "Live location is on.");
    }
    case "arrived":
      return text(
        `${first} has arrived`,
        isTowing ? "At the pickup point" : "At your location",
        "Meet your technician at the vehicle.",
      );
    case "working": {
      const started = clockOf(input.startedAt);
      return input.elapsedSeconds > 0
        ? {
            say: "Work in progress",
            big: formatWorkClock(input.elapsedSeconds),
            bigIsText: false,
            side: null,
            sub: started ? `Started at ${started}` : `${first} is working on your vehicle.`,
          }
        : text("Work in progress", "Work has started", `${first} is working on your vehicle.`);
    }
    case "loaded":
      return text(
        "Vehicle loaded",
        "Ready to tow",
        input.dropAddress ? `Going to ${input.dropAddress}` : "Your vehicle is secured on the tow truck.",
      );
    case "towing":
      return liveEta
        ? {
            say: "Towing to the drop point",
            big: formatEtaDuration(liveEta.etaSeconds),
            bigIsText: false,
            side: arrivesByText(liveEta),
            sub: joined(distanceLabel, input.dropAddress) || etaBasisText(liveEta),
          }
        : text("Towing to the drop point", "On the way", joined(distanceLabel, input.dropAddress) || "Live location is on.");
    case "dropped":
      return text("Reached the drop point", "At the drop location", "Final confirmation is next.");
    case "finished":
      return text("Work finished", "Payment is next", "Your bill will show here in a moment.");
    case "pay":
      return amountLabel
        ? { say: "Work finished", big: amountLabel, bigIsText: false, side: "to pay", sub: `Pay online, or give cash to ${first}.` }
        : text("Work finished", "Payment due", `Pay online, or give cash to ${first}.`);
    case "rate":
      return text(
        joined("Payment received", amountLabel),
        `How was ${first}?`,
        "Your rating helps other drivers pick a technician.",
      );
    case "closed":
      return text(`Request #${input.requestId}`, "Request closed", "Thank you for choosing ResQNow.");
    case "cancelled":
      return text(`Request #${input.requestId}`, "Request cancelled", "You can send a new request any time.");
    default:
      return text(`Request #${input.requestId}`, input.fallback.title, input.fallback.subtitle);
  }
}

/** The same stage, said in the two lines of the small strip shown over the map. */
export function trackingStripHeadline(
  input: TrackingHeadlineInput & { freshness: TrackingFreshness },
): Pick<TrackingHeadline, "big" | "bigIsText" | "side" | "sub"> {
  const { phase, liveEta, distanceLabel } = input;
  const first = firstName(input.technicianName);
  const full = trackingHeadline(input);
  const stale = input.freshness === "DELAYED" || input.freshness === "OFFLINE" || input.freshness === "RECONNECTING";
  const words = (big: string, sub: string) => ({ big, bigIsText: true, side: null, sub });

  switch (phase) {
    case "search":
      return words("Finding a technician", "Checking nearby partners");
    case "accepted":
      return liveEta
        ? { big: full.big, bigIsText: false, side: null, sub: `${first} accepted · getting ready` }
        : words(`${first} accepted`, "Getting ready to leave");
    case "way":
    case "towing": {
      const sub = stale ? "Location delayed · last seen position" : joined(full.say, distanceLabel);
      return liveEta ? { big: full.big, bigIsText: false, side: full.side, sub } : words("On the way", sub);
    }
    case "arrived":
      return words(`${first} has arrived`, "Meet your technician at the vehicle");
    case "working":
      return full.bigIsText
        ? words("Work in progress", full.sub)
        : { big: full.big, bigIsText: false, side: "Work in progress", sub: full.sub };
    case "pay":
      return full.bigIsText ? words("Payment due", "Work finished") : { big: full.big, bigIsText: false, side: "to pay", sub: "Work finished" };
    default:
      return words(full.big, full.say);
  }
}

const FRESHNESS_TEXT: Record<TrackingFreshness, string> = {
  LIVE: "Live",
  UPDATING: "Updating",
  DELAYED: "Delayed",
  RECONNECTING: "Reconnecting",
  OFFLINE: "Offline",
};

export function freshnessText(freshness: TrackingFreshness) {
  return FRESHNESS_TEXT[freshness];
}

/** What to tell the customer when the technician's position has stopped arriving. */
export function staleLocationNotice(freshness: TrackingFreshness, technicianName?: string | null) {
  const first = firstName(technicianName);
  if (freshness === "DELAYED") return `Location is delayed. Showing where ${first} was last seen.`;
  if (freshness === "RECONNECTING") return `Reconnecting. Showing where ${first} was last seen.`;
  if (freshness === "OFFLINE") return `Live location is not coming through. Showing where ${first} was last seen.`;
  return null;
}

/** The picture that stands for the customer's vehicle on the request row. */
export function vehicleArt(vehicleType: string | null | undefined) {
  const type = String(vehicleType || "").toLowerCase();
  if (/bike|scooter|motor|two/.test(type)) return "/images/vehicles/bike.webp";
  if (/truck|commercial|pickup|lcv|van|bus|tempo/.test(type)) return "/images/vehicles/truck.webp";
  if (/\bev\b|electric/.test(type)) return "/images/vehicles/ev.webp";
  return "/images/vehicles/car.webp";
}

export const CANCEL_REASONS = ["Found other help", "Sent by mistake", "Taking too long", "Another reason"] as const;
export const OTHER_CANCEL_REASON = "Another reason";
