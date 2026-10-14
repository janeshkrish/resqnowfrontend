import { serviceArt, serviceName } from "@/lib/services";
import type { MonitorPhase, MonitorRequest } from "../api/adminMonitorApi";

export const money = (value: number | null | undefined) =>
  value == null || !Number.isFinite(Number(value)) ? "—" : `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const clock = (value: string | number | null | undefined) => {
  if (value == null || value === "") return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
};

export const dayAndTime = (value: string | null | undefined, now = Date.now()) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const today = new Date(now);
  const sameDay = date.toDateString() === today.toDateString();
  return `${sameDay ? "Today" : date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${clock(value)}`;
};

/** "8 s ago", "4 min ago", "2 h ago". */
export function ago(value: string | number | null | undefined, now = Date.now()) {
  if (value == null || value === "") return null;
  const t = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(t)) return null;
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  return `${Math.floor(s / 3600)} h ago`;
}

/** "14:20" running since a time. */
export function runningFor(value: string | null | undefined, now = Date.now()) {
  if (!value) return null;
  const t = Date.parse(value);
  if (!Number.isFinite(t)) return null;
  const s = Math.max(0, Math.floor((now - t) / 1000));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m}:${String(s % 60).padStart(2, "0")}`;
}

export const minutesLabel = (seconds: number | null | undefined) =>
  seconds == null ? null : `${Math.max(1, Math.ceil(seconds / 60))} min`;

export const initials = (name: string | null | undefined) =>
  String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "?";

export const service = (type: string | null | undefined) => serviceName(type);
export const servicePicture = (type: string | null | undefined) => serviceArt(type);

export const PHASE_LABEL: Record<MonitorPhase, string> = {
  finding: "Finding",
  offered: "Offered",
  accepted: "Accepted",
  on_the_way: "On the way",
  arrived: "Arrived",
  working: "Working",
  towing: "Towing to drop",
  payment_due: "Payment due",
  done: "Done",
  cancelled: "Cancelled",
};

const PHASE_ICON: Record<MonitorPhase, string> = {
  finding: "radar",
  offered: "radar",
  accepted: "check",
  on_the_way: "two_wheeler",
  arrived: "check",
  working: "build",
  towing: "auto_towing",
  payment_due: "payments",
  done: "check_circle",
  cancelled: "block",
};

const PHASE_TONE: Record<MonitorPhase, string> = {
  finding: "is-hot",
  offered: "is-hot",
  accepted: "is-go",
  on_the_way: "is-go",
  arrived: "is-ok",
  working: "",
  towing: "is-go",
  payment_due: "is-hot",
  done: "is-ok",
  cancelled: "",
};

export type Attention = { code: string; label: string; tone: "warn" | "bad" } | null;

/** The one thing an admin should look at for this job, if any: alerts, silent GPS, a broken promise. */
export function attentionOf(request: MonitorRequest, now = Date.now()): Attention {
  const top = request.alerts[0];
  if (top) return { code: top.code, label: ALERT_SHORT[top.code] || top.text, tone: top.level === "high" || top.level === "critical" ? "bad" : "warn" };
  if (request.live?.lastSeenAt && request.live.gpsStale) {
    return { code: "gps_stale", label: `GPS quiet ${ago(request.live.lastSeenAt, now)?.replace(" ago", "")}`, tone: "bad" };
  }
  if (request.promisedAt && !request.arrivedAt && (request.phase === "accepted" || request.phase === "on_the_way") && Date.parse(request.promisedAt) < now) {
    return { code: "late", label: `Late by ${Math.max(1, Math.round((now - Date.parse(request.promisedAt)) / 60_000))} min`, tone: "warn" };
  }
  return null;
}

export const ALERT_SHORT: Record<string, string> = {
  arrival_delay: "ETA past deadline",
  sla_risk: "Close to deadline",
  start_delay: "Not moving",
  gps_inactive: "GPS off",
  movement_stationary: "Stopped on the way",
  movement_away: "Moving away",
  progress_delay: "Work running long",
  scheduled_start_miss: "Missed start",
};

export function chipOf(request: MonitorRequest, now = Date.now()) {
  const attention = attentionOf(request, now);
  if (attention) {
    return { label: attention.label, icon: attention.code === "gps_stale" || attention.code === "gps_inactive" ? "location_off" : "warning", cls: `am-chip ${attention.tone === "bad" ? "is-bad" : "is-warn"}` };
  }
  return { label: PHASE_LABEL[request.phase], icon: PHASE_ICON[request.phase], cls: `am-chip ${PHASE_TONE[request.phase]}`.trim() };
}

/** The line beside the chip: minutes away, the search, the work timer, the wait for payment. */
export function liveLine(request: MonitorRequest, now = Date.now()) {
  const live = request.live;
  switch (request.phase) {
    case "finding":
    case "offered": {
      const searching = runningFor(request.createdAt, now);
      const offers = request.search.sent;
      return {
        main: `Searching ${searching ?? ""}`.trim(),
        sub: offers ? `offered to ${offers}${request.search.declined ? ` · ${request.search.declined} declined` : ""}` : "no offers yet",
      };
    }
    case "accepted":
    case "on_the_way":
    case "towing": {
      const minutes = live?.etaSeconds != null ? minutesLabel(live.etaSeconds) : null;
      const arrival = live?.etaSeconds != null ? clock(now + live.etaSeconds * 1000) : null;
      const distance = live?.distanceKm != null ? `${live.distanceKm} km${live.distanceSource === "straight" ? " away" : ""}` : null;
      const main = minutes ? `${minutes} · arrives ${arrival}` : distance || (request.phase === "accepted" ? "Getting ready" : "On the way");
      return { main, sub: live?.lastSeenAt ? `seen ${ago(live.lastSeenAt, now)}` : "no GPS yet" };
    }
    case "arrived":
      return { main: `At the vehicle ${runningFor(request.arrivedAt, now) ?? ""}`.trim(), sub: request.promisedAt && request.arrivedAt ? (Date.parse(request.arrivedAt) <= Date.parse(request.promisedAt) ? "on time" : "arrived late") : "" };
    case "working":
      return { main: `${runningFor(request.workStartedAt || request.arrivedAt, now) ?? "Working"} on the job`, sub: live?.lastSeenAt ? `seen ${ago(live.lastSeenAt, now)}` : "" };
    case "payment_due":
      return { main: `Waiting ${runningFor(request.completedAt, now) ?? ""}`.trim(), sub: request.paymentMethod ? `${request.paymentMethod} chosen` : "" };
    default:
      return { main: PHASE_LABEL[request.phase], sub: "" };
  }
}

export const stepClasses = (request: Pick<MonitorRequest, "steps">, late: boolean) =>
  [0, 1, 2, 3].map((i) => (i < request.steps.done ? "is-done" : i === request.steps.now ? (late ? "is-late" : "is-now") : ""));

export const TABS = [
  { key: "all", label: "All live" },
  { key: "attention", label: "Needs attention" },
  { key: "finding", label: "Finding" },
  { key: "moving", label: "On the way" },
  { key: "working", label: "Working" },
  { key: "payment", label: "Payment due" },
] as const;
export type TabKey = (typeof TABS)[number]["key"];

export function inTab(request: MonitorRequest, tab: TabKey, now = Date.now()) {
  switch (tab) {
    case "attention": return Boolean(attentionOf(request, now));
    case "finding": return request.phase === "finding" || request.phase === "offered";
    case "moving": return request.phase === "accepted" || request.phase === "on_the_way" || request.phase === "towing";
    case "working": return request.phase === "arrived" || request.phase === "working";
    case "payment": return request.phase === "payment_due";
    default: return true;
  }
}
