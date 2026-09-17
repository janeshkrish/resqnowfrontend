export type TrackingFreshness =
  | "LIVE"
  | "UPDATING"
  | "DELAYED"
  | "RECONNECTING"
  | "OFFLINE";

export type TrackingPlaybackPoint = {
  lat: number;
  lng: number;
  speed?: number | null;
  heading?: number | null;
  accuracy?: number | null;
  recordedAtMs?: number | null;
  sequenceId?: number | null;
};

export type TrackingPlaybackFrame = {
  position: { lat: number; lng: number } | null;
  bearing: number | null;
  freshness: TrackingFreshness;
  isPredicting: boolean;
  isRepositioning: boolean;
};

type QueuedPoint = {
  point: Required<Pick<TrackingPlaybackPoint, "lat" | "lng">> & TrackingPlaybackPoint;
  availableAt: number;
  durationMs: number;
};

type Segment = {
  from: { lat: number; lng: number };
  to: Required<Pick<TrackingPlaybackPoint, "lat" | "lng">> & TrackingPlaybackPoint;
  startedAt: number;
  durationMs: number;
  fromBearing: number | null;
  toBearing: number | null;
};

const EARTH_RADIUS_METERS = 6_371_000;
export const PLAYBACK_BUFFER_MS = 250;
export const MAX_PENDING_POINTS = 2;
export const MIN_SEGMENT_DURATION_MS = 400;
export const MAX_SEGMENT_DURATION_MS = 1_000;
export const PREDICTION_START_MS = 1_400;
export const MAX_PREDICTION_MS = 5_000;
export const MAX_PREDICTION_DISTANCE_METERS = 50;
export const MAX_PREDICTION_ACCURACY_METERS = 50;
export const JUMP_REBASE_MS = 300;

const LIVE_THRESHOLD_MS = 3_000;
const UPDATING_THRESHOLD_MS = 8_000;
const DELAYED_THRESHOLD_MS = 20_000;
const STATIONARY_SPEED_METERS_PER_SECOND = 0.75;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

const finiteNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

function normalizePoint(point: TrackingPlaybackPoint): QueuedPoint["point"] | null {
  const lat = finiteNumber(point.lat);
  const lng = finiteNumber(point.lng);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { ...point, lat, lng };
}

function validHeading(value: unknown): number | null {
  const heading = finiteNumber(value);
  return heading != null && heading >= 0 && heading < 360 ? heading : null;
}

function validSpeed(value: unknown): number | null {
  const speed = finiteNumber(value);
  return speed != null && speed >= 0 && speed <= 60 ? speed : null;
}

function validAccuracy(value: unknown): number | null {
  const accuracy = finiteNumber(value);
  return accuracy != null && accuracy >= 0 && accuracy <= 500 ? accuracy : null;
}

export function distanceBetween(
  left: { lat: number; lng: number },
  right: { lat: number; lng: number },
) {
  const latitudeDelta = toRadians(right.lat - left.lat);
  const longitudeDelta = toRadians(right.lng - left.lng);
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(left.lat)) * Math.cos(toRadians(right.lat)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingBetween(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
) {
  const latitudeFrom = toRadians(from.lat);
  const latitudeTo = toRadians(to.lat);
  const longitudeDelta = toRadians(to.lng - from.lng);
  const y = Math.sin(longitudeDelta) * Math.cos(latitudeTo);
  const x =
    Math.cos(latitudeFrom) * Math.sin(latitudeTo) -
    Math.sin(latitudeFrom) * Math.cos(latitudeTo) * Math.cos(longitudeDelta);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

export function interpolateBearing(from: number, to: number, progress: number) {
  const normalizedProgress = Math.min(1, Math.max(0, progress));
  const shortestDelta = ((to - from + 540) % 360) - 180;
  return (from + shortestDelta * normalizedProgress + 360) % 360;
}

function interpolatePoint(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  progress: number,
) {
  const normalizedProgress = Math.min(1, Math.max(0, progress));
  return {
    lat: from.lat + (to.lat - from.lat) * normalizedProgress,
    lng: from.lng + (to.lng - from.lng) * normalizedProgress,
  };
}

function newerThan(
  next: QueuedPoint["point"],
  previous: QueuedPoint["point"],
) {
  const nextSequence = finiteNumber(next.sequenceId);
  const previousSequence = finiteNumber(previous.sequenceId);
  if (nextSequence != null && previousSequence != null) return nextSequence > previousSequence;

  const nextTimestamp = finiteNumber(next.recordedAtMs);
  const previousTimestamp = finiteNumber(previous.recordedAtMs);
  if (nextTimestamp != null && previousTimestamp != null) return nextTimestamp > previousTimestamp;

  return next.lat !== previous.lat || next.lng !== previous.lng;
}

function sourceIntervalMs(
  previous: QueuedPoint["point"],
  next: QueuedPoint["point"],
  receivedIntervalMs: number,
) {
  const previousRecordedAt = finiteNumber(previous.recordedAtMs);
  const nextRecordedAt = finiteNumber(next.recordedAtMs);
  const recordedInterval = previousRecordedAt != null && nextRecordedAt != null
    ? nextRecordedAt - previousRecordedAt
    : null;
  const interval = recordedInterval != null && recordedInterval > 0 && recordedInterval <= 10_000
    ? recordedInterval
    : receivedIntervalMs;
  return Math.min(MAX_SEGMENT_DURATION_MS, Math.max(MIN_SEGMENT_DURATION_MS, interval));
}

function isSuspiciousJump(
  previous: QueuedPoint["point"],
  next: QueuedPoint["point"],
  intervalMs: number,
) {
  const distanceMeters = distanceBetween(previous, next);
  const elapsedSeconds = Math.max(0.25, intervalMs / 1_000);
  const speed = Math.max(validSpeed(previous.speed) ?? 0, validSpeed(next.speed) ?? 0, 30);
  const accuracyAllowance = (validAccuracy(previous.accuracy) ?? 0) + (validAccuracy(next.accuracy) ?? 0);
  const plausibleDistance = Math.max(350, speed * elapsedSeconds * 4 + accuracyAllowance * 3);
  return distanceMeters > plausibleDistance;
}

function predictionFor(
  point: QueuedPoint["point"],
  elapsedMs: number,
) {
  const speed = validSpeed(point.speed);
  const heading = validHeading(point.heading);
  const accuracy = validAccuracy(point.accuracy);
  if (
    speed == null || speed < STATIONARY_SPEED_METERS_PER_SECOND || heading == null ||
    accuracy == null || accuracy > MAX_PREDICTION_ACCURACY_METERS
  ) {
    return null;
  }

  const distanceMeters = Math.min(
    MAX_PREDICTION_DISTANCE_METERS,
    speed * (elapsedMs / 1_000),
  );
  if (distanceMeters <= 0) return null;

  const angularDistance = distanceMeters / EARTH_RADIUS_METERS;
  const bearing = toRadians(heading);
  const latitude = toRadians(point.lat);
  const longitude = toRadians(point.lng);
  const predictedLatitude = Math.asin(
    Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing),
  );
  const predictedLongitude = longitude + Math.atan2(
    Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
    Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(predictedLatitude),
  );
  return { lat: toDegrees(predictedLatitude), lng: toDegrees(predictedLongitude) };
}

function initialBearing(point: QueuedPoint["point"]) {
  const speed = validSpeed(point.speed);
  return speed != null && speed >= STATIONARY_SPEED_METERS_PER_SECOND
    ? validHeading(point.heading)
    : null;
}

export function deriveTrackingFreshness(
  lastAuthoritativeAt: number | null,
  now: number,
  isConnected: boolean,
): TrackingFreshness {
  if (!isConnected) return "RECONNECTING";
  if (lastAuthoritativeAt == null) return "UPDATING";
  const ageMs = Math.max(0, now - lastAuthoritativeAt);
  if (ageMs <= LIVE_THRESHOLD_MS) return "LIVE";
  if (ageMs <= UPDATING_THRESHOLD_MS) return "UPDATING";
  if (ageMs <= DELAYED_THRESHOLD_MS) return "DELAYED";
  return "OFFLINE";
}

export class LiveTrackingPlaybackController {
  private displayed: { lat: number; lng: number } | null = null;
  private lastAccepted: QueuedPoint["point"] | null = null;
  private lastAuthoritativeAt: number | null = null;
  private lastBearing: number | null = null;
  private activeSegment: Segment | null = null;
  private queue: QueuedPoint[] = [];
  private rebase: { point: QueuedPoint["point"]; until: number } | null = null;

  push(rawPoint: TrackingPlaybackPoint, receivedAt: number) {
    const point = normalizePoint(rawPoint);
    if (!point || !Number.isFinite(receivedAt)) return false;
    const previous = this.lastAccepted;
    if (previous && !newerThan(point, previous)) return false;

    const previousReceivedAt = this.lastAuthoritativeAt;
    this.lastAccepted = point;
    this.lastAuthoritativeAt = receivedAt;
    if (!this.displayed) {
      this.displayed = { lat: point.lat, lng: point.lng };
      this.lastBearing = initialBearing(point);
      return true;
    }

    const receivedIntervalMs = previousReceivedAt == null
      ? MIN_SEGMENT_DURATION_MS
      : Math.max(1, receivedAt - previousReceivedAt);
    if (previous && isSuspiciousJump(previous, point, receivedIntervalMs)) {
      this.queue = [];
      this.activeSegment = null;
      this.rebase = { point, until: receivedAt + JUMP_REBASE_MS };
      return true;
    }

    const durationMs = previous
      ? sourceIntervalMs(previous, point, receivedIntervalMs)
      : MIN_SEGMENT_DURATION_MS;
    this.queue.push({ point, availableAt: receivedAt + PLAYBACK_BUFFER_MS, durationMs });
    if (this.queue.length > MAX_PENDING_POINTS) {
      this.queue = [this.queue[this.queue.length - 1]];
    }
    return true;
  }

  frame(now: number, isConnected = true): TrackingPlaybackFrame {
    if (this.rebase) {
      if (now < this.rebase.until) {
        return this.snapshot(now, isConnected, false, true);
      }
      this.displayed = { lat: this.rebase.point.lat, lng: this.rebase.point.lng };
      this.lastBearing = initialBearing(this.rebase.point) ?? this.lastBearing;
      this.rebase = null;
    }

    if (this.activeSegment) {
      const progress = (now - this.activeSegment.startedAt) / this.activeSegment.durationMs;
      this.displayed = interpolatePoint(this.activeSegment.from, this.activeSegment.to, progress);
      if (this.activeSegment.fromBearing != null && this.activeSegment.toBearing != null) {
        this.lastBearing = interpolateBearing(this.activeSegment.fromBearing, this.activeSegment.toBearing, progress);
      }
      if (progress >= 1) {
        this.displayed = { lat: this.activeSegment.to.lat, lng: this.activeSegment.to.lng };
        this.lastBearing = this.activeSegment.toBearing ?? this.lastBearing;
        this.activeSegment = null;
      } else {
        return this.snapshot(now, isConnected, false, false);
      }
    }

    const next = this.queue[0];
    if (next && next.availableAt <= now && this.displayed) {
      this.queue.shift();
      const movementMeters = distanceBetween(this.displayed, next.point);
      const pointBearing = validSpeed(next.point.speed) != null &&
        validSpeed(next.point.speed)! >= STATIONARY_SPEED_METERS_PER_SECOND
        ? validHeading(next.point.heading)
        : movementMeters >= 2
          ? bearingBetween(this.displayed, next.point)
          : this.lastBearing;
      this.activeSegment = {
        from: this.displayed,
        to: next.point,
        startedAt: now,
        durationMs: next.durationMs,
        fromBearing: this.lastBearing ?? pointBearing,
        toBearing: pointBearing,
      };
      return this.snapshot(now, isConnected, false, false);
    }

    const elapsedSinceAuthoritative = this.lastAuthoritativeAt == null
      ? 0
      : now - this.lastAuthoritativeAt;
    if (
      isConnected &&
      this.lastAccepted &&
      this.queue.length === 0 &&
      elapsedSinceAuthoritative > PREDICTION_START_MS &&
      elapsedSinceAuthoritative <= PREDICTION_START_MS + MAX_PREDICTION_MS
    ) {
      const predicted = predictionFor(this.lastAccepted, elapsedSinceAuthoritative - PREDICTION_START_MS);
      if (predicted) {
        this.displayed = predicted;
        this.lastBearing = validHeading(this.lastAccepted.heading) ?? this.lastBearing;
        return this.snapshot(now, isConnected, true, false);
      }
    }

    return this.snapshot(now, isConnected, false, false);
  }

  private snapshot(
    now: number,
    isConnected: boolean,
    isPredicting: boolean,
    isRepositioning: boolean,
  ): TrackingPlaybackFrame {
    return {
      position: this.displayed,
      bearing: this.lastBearing,
      freshness: deriveTrackingFreshness(this.lastAuthoritativeAt, now, isConnected),
      isPredicting,
      isRepositioning,
    };
  }
}
