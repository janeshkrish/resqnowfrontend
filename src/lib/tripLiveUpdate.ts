/**
 * What the Android Live Update says for a request, worked out from the same facts as the
 * tracking card (lib/customerTracking): the stage, the backend's ETA, the technician and the
 * amount due. The notification follows the card, so the two never disagree.
 *
 * Design canvas: "Android notifications", boards 1 to 10.
 */
import { arrivesByText, firstName, type TrackingPhase } from "@/lib/customerTracking";
import { formatEtaDuration, type LiveEta } from "@/lib/liveEta";
import { formatClockTime } from "@/lib/technicianArrival";

export type TripTone = "" | "ok" | "warn" | "hot";
export type TripTracker = "" | "bike" | "truck" | "check" | "build";

/** The fields TripUpdatesPlugin.update() reads on Android. */
export type TripLiveUpdate = {
  requestId: string;
  phase: TrackingPhase;
  title: string;
  text: string;
  /** The status-bar chip on Android 16: "6 min", "Here", "₹110". Empty shows a work timer or nothing. */
  chip: string;
  tone: TripTone;
  /** 0 to 100 across the four steps: found, on the way, at the vehicle, done. */
  progress: number;
  indeterminate: boolean;
  tracker: TripTracker;
  technicianName: string;
  technicianPhone: string;
  service: string;
  amountLabel: string;
  /** Epoch ms the technician should arrive; 0 when not known. */
  arrivalAt: number;
  /** Epoch ms the work started; 0 when not known. */
  startedAt: number;
  /** The short alert with sound for this stage, when it deserves one. */
  alertTitle: string;
  alertText: string;
  deepLinkPath: string;
};

export type TripLiveUpdateInput = {
  requestId: string;
  phase: TrackingPhase;
  isTowing: boolean;
  technicianName?: string | null;
  technicianPhone?: string | null;
  serviceType?: string | null;
  liveEta: LiveEta | null;
  /** "2.4 km away", as on the card. */
  distanceLabel: string | null;
  /** The amount due, e.g. "₹110.00". */
  amountLabel: string | null;
  startedAt?: string | null;
  dropAddress?: string | null;
  /** The first ETA of this leg, so the bar shows how much of the way is done. */
  legStartEtaSeconds?: number | null;
};

const joined = (...parts: Array<string | null | undefined>) => parts.filter(Boolean).join(" · ");

/** "6 min" for the chip; a long trip says "1 hr+" so it still fits. */
export function chipMinutes(etaSeconds: number) {
  const minutes = Math.max(1, Math.ceil(etaSeconds / 60));
  return minutes < 60 ? `${minutes} min` : "1 hr+";
}

/** "₹110" from "₹110.00"; paise stay when there are any. */
export function wholeAmount(label: string | null | undefined) {
  return String(label || "").replace(/\.00$/, "");
}

/** How far along a leg is, from its first ETA to now; never quite done until arrival. */
function legDone(eta: LiveEta | null, startSeconds: number | null | undefined) {
  if (!eta || !startSeconds || startSeconds <= 0) return 0.15;
  return Math.max(0, Math.min(0.92, 1 - eta.etaSeconds / startSeconds));
}

/** Progress is sent in steps of five, so a new ETA every few seconds is not a new notification. */
const step = (value: number) => Math.round(value / 5) * 5;

export function tripLiveUpdate(input: TripLiveUpdateInput): TripLiveUpdate | null {
  const requestId = String(input.requestId || "").trim();
  if (!requestId || input.phase === "other") return null;
  const first = firstName(input.technicianName);
  const eta = input.liveEta;
  const minutes = eta ? formatEtaDuration(eta.etaSeconds) : null;
  const arrivesBy = eta ? arrivesByText(eta) : null;
  const amount = wholeAmount(input.amountLabel);
  const vehicle: TripTracker = input.isTowing ? "truck" : "bike";
  const started = Date.parse(String(input.startedAt ?? ""));

  const base: TripLiveUpdate = {
    requestId,
    phase: input.phase,
    title: "",
    text: "",
    chip: "",
    tone: "",
    progress: 0,
    indeterminate: false,
    tracker: "",
    technicianName: String(input.technicianName || "").trim(),
    technicianPhone: String(input.technicianPhone || "").trim(),
    service: String(input.serviceType || "").trim(),
    amountLabel: amount,
    arrivalAt: eta ? Math.round(eta.receivedAt + eta.etaSeconds * 1000) : 0,
    startedAt: Number.isFinite(started) ? started : 0,
    alertTitle: "",
    alertText: "",
    deepLinkPath: `/service-tracking/${encodeURIComponent(requestId)}`,
  };
  const say = (fields: Partial<TripLiveUpdate>): TripLiveUpdate => ({ ...base, ...fields });

  switch (input.phase) {
    case "search":
      return say({ title: "Finding a technician", text: "We’re checking nearby partners for you.", chip: "Finding", indeterminate: true });
    case "accepted":
      return say({
        title: minutes ? `${first} arrives in ${minutes}` : `${first} accepted your request`,
        text: joined(arrivesBy, input.distanceLabel) || "Getting ready to leave",
        chip: eta ? chipMinutes(eta.etaSeconds) : "Found",
        progress: 25,
        tracker: vehicle,
        alertTitle: `${first} accepted your request`,
        alertText: joined(arrivesBy, input.distanceLabel) || "Getting ready to leave.",
      });
    case "way":
      return say({
        title: minutes ? `${first} arrives in ${minutes}` : input.isTowing ? `${first} is heading to pickup` : `${first} is on the way`,
        text: joined(arrivesBy, input.distanceLabel) || "Live location is on.",
        chip: eta ? chipMinutes(eta.etaSeconds) : "On way",
        progress: step(25 + 25 * legDone(eta, input.legStartEtaSeconds)),
        tracker: vehicle,
      });
    case "arrived":
      return say({
        title: input.isTowing ? `${first} is at the pickup` : `${first} is here`,
        text: "Meet your technician at the vehicle.",
        chip: "Here",
        tone: "ok",
        progress: 50,
        tracker: "check",
        alertTitle: input.isTowing ? `${first} is at the pickup` : `${first} is here`,
        alertText: "Meet your technician at the vehicle.",
      });
    case "working":
      return say({
        title: "Work in progress",
        text: Number.isFinite(started) ? `Started at ${formatClockTime(started)}` : `${first} is working on your vehicle.`,
        // No words: Android shows the running work timer in the chip instead.
        chip: "",
        progress: 60,
        tracker: "build",
      });
    case "loaded":
      return say({
        title: "Vehicle loaded",
        text: input.dropAddress ? `Going to ${input.dropAddress}` : "Your vehicle is secured on the tow truck.",
        chip: "Loaded",
        progress: 55,
        tracker: "truck",
      });
    case "towing":
      return say({
        title: minutes ? `At the drop point in ${minutes}` : "Towing to the drop point",
        text: joined(arrivesBy, input.distanceLabel) || input.dropAddress || "Live location is on.",
        chip: eta ? chipMinutes(eta.etaSeconds) : "Towing",
        progress: step(50 + 25 * legDone(eta, input.legStartEtaSeconds)),
        tracker: "truck",
      });
    case "dropped":
      return say({ title: "Reached the drop point", text: "Final confirmation is next.", chip: "Dropped", progress: 75, tracker: "check" });
    case "finished":
      return say({ title: "Work done", text: "Your bill will show here in a moment.", chip: "Done", progress: 75, tracker: "check" });
    case "pay": {
      const title = amount ? `Work done · ${amount} to pay` : "Work done · payment due";
      const text = `Pay online, or give cash to ${first}.`;
      return say({ title, text, chip: amount || "Pay", tone: "hot", progress: 75, tracker: "check", alertTitle: title, alertText: text });
    }
    case "rate":
      return say({ title: "Paid · thank you", text: `How was ${first}? One tap is enough.`, tone: "ok", progress: 100 });
    case "closed":
      return say({ title: "Request closed", text: "Thank you for choosing ResQNow.", progress: 100 });
    case "cancelled":
      return say({
        title: "Request cancelled",
        text: "You can send a new request any time.",
        alertTitle: "Request cancelled",
        alertText: "You can send a new request any time.",
      });
    default:
      return null;
  }
}

/** Stages after which the trip is over. */
const ENDED: ReadonlySet<TrackingPhase> = new Set<TrackingPhase>(["rate", "closed", "cancelled"]);

/**
 * Whether to send an update. A request already over when the page opened (say, from the
 * activity list) sends nothing: its notification is long gone and should stay gone.
 */
export function shouldSendTripUpdate(update: TripLiveUpdate, sawItLive: boolean) {
  return !ENDED.has(update.phase) || sawItLive;
}
