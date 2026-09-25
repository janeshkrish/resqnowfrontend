import { logLiveTrackingDiagnostic } from "@/lib/liveTrackingDiagnostics";

/** The unchanged TrackingLocationV1 body accepted by canonical ingestion. */
export type TrackingLocationV1Payload = {
  version: 1;
  technicianId: string;
  jobId: string;
  lat: number;
  lng: number;
  speed: number | null;
  heading: number | null;
  accuracy: number | null;
  recordedAt: string;
  sequenceId: number;
};

export type TrackingAcknowledgement = { ok?: boolean; code?: string } | undefined;

export type RestDeliveryResult = { ok: boolean; status?: number; code?: string };

export type LocationTransport = {
  isSocketConnected: () => boolean;
  emitSocket: (payload: TrackingLocationV1Payload, acknowledge: (response: TrackingAcknowledgement) => void) => void;
  /** Resolves with the HTTP outcome; rejects only when the request never reached the server. */
  sendRest: (payload: TrackingLocationV1Payload) => Promise<RestDeliveryResult>;
};

// While moving, a fix is sent at most this often.
export const MOVING_SEND_INTERVAL_MS = 2_500;
// While stationary, the newest unsent fix is still delivered at this cadence so
// the customer keeps receiving a heartbeat within the backend's 30 s Redis TTL.
export const STATIONARY_SEND_INTERVAL_MS = 12_000;
// Movement below this distance (or below the fix's own accuracy) is GPS jitter.
export const MIN_SEND_DISTANCE_METERS = 10;
const MAX_ACCURACY_DISTANCE_METERS = 30;
export const SOCKET_ACK_TIMEOUT_MS = 3_500;
// A REST attempt that has not answered by then is treated as a retryable failure,
// so one hung request can never stall every later fix.
export const REST_RESPONSE_TIMEOUT_MS = 10_000;
// After a retryable failure the newest pending fix is retried no sooner than this,
// unless connectivity is reported back first.
export const PENDING_RETRY_INTERVAL_MS = 5_000;
// Canonical ingestion rejects fixes older than 60 s; never replay anything close to that.
export const MAX_PENDING_LOCATION_AGE_MS = 45_000;

// Canonical ingestion rejects these deterministically, so a REST retry of the same
// fix cannot succeed. Unknown codes keep the existing REST recovery behaviour.
const TERMINAL_REJECTION_CODES = new Set([
  "INVALID_LOCATION",
  "STALE_LOCATION",
  "OUT_OF_ORDER",
  "DUPLICATE_LOCATION",
  "IMPLAUSIBLE_MOVEMENT",
  "NO_ACTIVE_JOB",
  "FORBIDDEN",
]);

const EARTH_RADIUS_METERS = 6_371_000;

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

export type SendReason = "first" | "moving" | "stationary_heartbeat";

// waitMs is present on both variants: the app tsconfig runs without
// strictNullChecks, where a `send: false` branch does not narrow.
export type SendDecision =
  | { send: true; reason: SendReason; waitMs: 0 }
  | { send: false; waitMs: number };

/**
 * Adaptive cadence: a fix that has moved beyond the jitter threshold is sent at
 * the moving cadence; anything else waits for the stationary heartbeat.
 */
export function decideLocationSend(
  lastSent: { lat: number; lng: number; sentAt: number } | null,
  candidate: TrackingLocationV1Payload,
  now: number,
): SendDecision {
  if (!lastSent) return { send: true, reason: "first", waitMs: 0 };
  const elapsedMs = now - lastSent.sentAt;
  const accuracy = Number.isFinite(candidate.accuracy) ? Math.max(0, Number(candidate.accuracy)) : 0;
  const thresholdMeters = Math.max(MIN_SEND_DISTANCE_METERS, Math.min(accuracy, MAX_ACCURACY_DISTANCE_METERS));
  const moved = distanceMeters(lastSent, candidate) >= thresholdMeters;

  if (moved && elapsedMs >= MOVING_SEND_INTERVAL_MS) return { send: true, reason: "moving", waitMs: 0 };
  if (elapsedMs >= STATIONARY_SEND_INTERVAL_MS) return { send: true, reason: "stationary_heartbeat", waitMs: 0 };
  return {
    send: false,
    waitMs: (moved ? MOVING_SEND_INTERVAL_MS : STATIONARY_SEND_INTERVAL_MS) - elapsedMs,
  };
}

type SenderOptions = {
  jobId: string;
  transport: LocationTransport;
  now?: () => number;
};

export type TechnicianLocationSender = {
  /** Offer a new raw GPS fix. The newest fix always replaces an older unsent one. */
  handleFix: (payload: TrackingLocationV1Payload) => void;
  /** Connectivity returned: deliver the newest pending fix now. */
  flush: (reason: string) => void;
  /** The request stopped accepting locations: drop anything unsent without disposing. */
  clearPending: (reason: string) => void;
  /** Tracking stopped for this job: drop pending state and timers. */
  dispose: () => void;
  hasPending: () => boolean;
};

export function createTechnicianLocationSender({
  jobId,
  transport,
  now = () => Date.now(),
}: SenderOptions): TechnicianLocationSender {
  let disposed = false;
  // The last fix the backend answered (accepted or deterministically rejected).
  // Cadence and distance are measured from it, so a rejected fix cannot turn
  // into a once-per-fix retry loop.
  let lastReference: { lat: number; lng: number; sentAt: number } | null = null;
  let candidate: TrackingLocationV1Payload | null = null;
  // Fixes are only ever sent in increasing sequence order.
  let highestSequenceId = 0;
  let coalescedFixes = 0;
  let inFlight: TrackingLocationV1Payload | null = null;
  let pendingAfterFailure = false;
  let retryBlockedUntil = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let deliveryTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer != null) clearTimeout(timer);
    timer = null;
  };

  const clearDeliveryTimer = () => {
    if (deliveryTimer != null) clearTimeout(deliveryTimer);
    deliveryTimer = null;
  };

  const schedule = (delayMs: number) => {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      evaluate();
    }, Math.max(0, delayMs));
  };

  const log = (event: string, details: Record<string, unknown>) => {
    logLiveTrackingDiagnostic("[RT-TECH-SOCKET]", event, { requestId: jobId, ...details });
  };

  const settle = (
    payload: TrackingLocationV1Payload,
    sentAt: number,
    outcome: "delivered" | "rejected" | "retryable",
    code: string | null,
  ) => {
    if (disposed || inFlight !== payload) return;
    inFlight = null;
    clearDeliveryTimer();
    if (outcome === "delivered" || outcome === "rejected") {
      lastReference = { lat: payload.lat, lng: payload.lng, sentAt };
      pendingAfterFailure = false;
      retryBlockedUntil = 0;
      if (candidate === payload) candidate = null;
      if (outcome === "rejected") log("location_rejected", { sequenceId: payload.sequenceId, code });
    } else {
      pendingAfterFailure = true;
      retryBlockedUntil = now() + PENDING_RETRY_INTERVAL_MS;
      log("pending_retained", {
        sequenceId: candidate?.sequenceId ?? null,
        code,
        socketConnected: transport.isSocketConnected(),
      });
    }
    evaluate();
  };

  const sendRest = (payload: TrackingLocationV1Payload, sentAt: number) => {
    log("rest_recovery_sent", {
      sequenceId: payload.sequenceId,
      lat: payload.lat,
      lng: payload.lng,
      socketConnected: transport.isSocketConnected(),
    });
    clearDeliveryTimer();
    deliveryTimer = setTimeout(
      () => settle(payload, sentAt, "retryable", "REST_TIMEOUT"),
      REST_RESPONSE_TIMEOUT_MS,
    );
    transport.sendRest(payload).then(
      (result) => {
        log("rest_recovery_result", {
          sequenceId: payload.sequenceId,
          ok: result.ok,
          status: result.status ?? null,
          code: result.code ?? null,
          latencyMs: now() - sentAt,
        });
        if (result.ok) return settle(payload, sentAt, "delivered", null);
        const retryable = !result.status || result.status >= 500 || result.status === 429;
        const terminal = !retryable || TERMINAL_REJECTION_CODES.has(String(result.code));
        settle(payload, sentAt, terminal ? "rejected" : "retryable", result.code ?? null);
      },
      () => settle(payload, sentAt, "retryable", "NETWORK_ERROR"),
    );
  };

  const attempt = (payload: TrackingLocationV1Payload, reason: SendReason | "recovery") => {
    clearTimer();
    inFlight = payload;
    const sentAt = now();
    const socketConnected = transport.isSocketConnected();
    log("location_emitted", {
      sequenceId: payload.sequenceId,
      lat: payload.lat,
      lng: payload.lng,
      reason,
      transport: socketConnected ? "socket" : "rest_recovery",
      sentAt: new Date(sentAt).toISOString(),
      recordedAt: payload.recordedAt,
      fixAgeMs: sentAt - Date.parse(payload.recordedAt),
      coalescedFixes,
    });
    coalescedFixes = 0;

    if (!socketConnected) {
      sendRest(payload, sentAt);
      return;
    }

    let restStarted = false;
    const fallBackToRest = () => {
      if (restStarted || disposed || inFlight !== payload) return;
      restStarted = true;
      sendRest(payload, sentAt);
    };
    clearDeliveryTimer();
    deliveryTimer = setTimeout(fallBackToRest, SOCKET_ACK_TIMEOUT_MS);
    transport.emitSocket(payload, (acknowledgement) => {
      if (disposed || inFlight !== payload) return;
      if (!restStarted) clearDeliveryTimer();
      log("location_acknowledged", {
        sequenceId: payload.sequenceId,
        ok: Boolean(acknowledgement?.ok),
        code: acknowledgement?.code ?? null,
        latencyMs: now() - sentAt,
      });
      if (restStarted) return;
      if (acknowledgement?.ok) return settle(payload, sentAt, "delivered", null);
      if (TERMINAL_REJECTION_CODES.has(String(acknowledgement?.code))) {
        return settle(payload, sentAt, "rejected", acknowledgement?.code ?? null);
      }
      fallBackToRest();
    });
  };

  function evaluate() {
    if (disposed || inFlight || !candidate) return;
    const currentTime = now();
    const candidateAgeMs = currentTime - Date.parse(candidate.recordedAt);
    if (!(candidateAgeMs <= MAX_PENDING_LOCATION_AGE_MS)) {
      log("pending_dropped_stale", { sequenceId: candidate.sequenceId, ageMs: candidateAgeMs });
      candidate = null;
      pendingAfterFailure = false;
      clearTimer();
      return;
    }
    if (pendingAfterFailure && currentTime < retryBlockedUntil) {
      schedule(retryBlockedUntil - currentTime);
      return;
    }
    if (pendingAfterFailure) {
      attempt(candidate, "recovery");
      return;
    }
    const decision = decideLocationSend(lastReference, candidate, currentTime);
    if (decision.send) {
      attempt(candidate, decision.reason);
    } else {
      schedule(decision.waitMs);
    }
  }

  return {
    handleFix(payload) {
      if (disposed || String(payload.jobId) !== String(jobId)) return;
      if (!(payload.sequenceId > highestSequenceId)) return;
      highestSequenceId = payload.sequenceId;
      if (candidate) coalescedFixes += 1;
      candidate = payload;
      evaluate();
    },

    flush(reason) {
      if (disposed || !candidate || !pendingAfterFailure) return;
      log("pending_flushed", {
        reason,
        sequenceId: candidate.sequenceId,
        pendingAgeMs: now() - Date.parse(candidate.recordedAt),
      });
      retryBlockedUntil = 0;
      evaluate();
    },

    clearPending(reason) {
      if (disposed) return;
      clearTimer();
      if (candidate) log("pending_cleared", { reason, sequenceId: candidate.sequenceId });
      candidate = null;
      pendingAfterFailure = false;
      retryBlockedUntil = 0;
      coalescedFixes = 0;
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      clearTimer();
      clearDeliveryTimer();
      if (candidate) log("pending_cleared", { reason: "tracking_stopped", sequenceId: candidate.sequenceId });
      candidate = null;
      inFlight = null;
    },

    hasPending() {
      return Boolean(candidate) || Boolean(inFlight);
    },
  };
}
