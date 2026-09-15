import type { GeoPoint } from "@/lib/geo";

export type NavigationVehicleMode = "two-wheeler" | "car" | "commercial-tow";

export type TechnicianLocationFix = GeoPoint & {
  accuracy: number | null;
  timestamp: number;
  speedKmh?: number | null;
  heading?: number | null;
};

export type RawLocationSample = TechnicianLocationFix & {
  speedMetersPerSecond?: number | null;
};

export const MAX_NAVIGATION_LOCATION_AGE_MS = 30_000;
export const MAX_NAVIGATION_ACCURACY_METERS = 100;

const EARTH_RADIUS_METERS = 6_371_000;
const MAX_PLAUSIBLE_SPEED_KMH = 180;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;

export function isValidNavigationPoint(point: GeoPoint | null | undefined) {
  if (!point) return false;
  if (!Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false;
  if (Math.abs(point.lat) > 90 || Math.abs(point.lng) > 180) return false;
  return !(point.lat === 0 && point.lng === 0);
}

export function isUsableLocationFix(
  fix: TechnicianLocationFix | null | undefined,
  now = Date.now(),
) {
  if (!fix || !isValidNavigationPoint(fix)) return false;
  if (!Number.isFinite(fix.timestamp) || now - fix.timestamp > MAX_NAVIGATION_LOCATION_AGE_MS) {
    return false;
  }
  return (
    Number.isFinite(fix.accuracy) &&
    Number(fix.accuracy) >= 0 &&
    Number(fix.accuracy) <= MAX_NAVIGATION_ACCURACY_METERS
  );
}

export function normalizeNavigationVehicleMode(value: unknown): NavigationVehicleMode {
  const normalized = String(value || "").trim().toLowerCase();
  if (/bike|motorcycle|scooter|two.?wheel/.test(normalized)) return "two-wheeler";
  if (/tow|truck|flatbed|commercial|heavy/.test(normalized)) return "commercial-tow";
  return "car";
}

export function defaultNavigationVehicleMode(value: unknown): NavigationVehicleMode {
  const joined = Array.isArray(value)
    ? value.join(" ")
    : value && typeof value === "object"
      ? Object.entries(value as Record<string, unknown>)
          .filter(([, enabled]) => Boolean(enabled))
          .map(([key]) => key)
          .join(" ")
      : String(value || "");
  return normalizeNavigationVehicleMode(joined);
}

function distanceMeters(a: GeoPoint, b: GeoPoint) {
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const haversine =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

function bearingDegrees(a: GeoPoint, b: GeoPoint) {
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const y = Math.sin(deltaLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function finiteMotionValue(value: unknown) {
  if (value == null || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

export function resolveNavigationMotion(
  previous: TechnicianLocationFix | null,
  sample: RawLocationSample,
) {
  const nativeSpeed = finiteMotionValue(sample.speedMetersPerSecond);
  let measuredSpeedKmh = nativeSpeed == null ? null : nativeSpeed * 3.6;

  if (measuredSpeedKmh == null && previous && sample.timestamp > previous.timestamp) {
    const elapsedHours = (sample.timestamp - previous.timestamp) / 3_600_000;
    measuredSpeedKmh = distanceMeters(previous, sample) / 1_000 / elapsedHours;
  }

  if (measuredSpeedKmh != null && measuredSpeedKmh > MAX_PLAUSIBLE_SPEED_KMH) {
    measuredSpeedKmh = previous?.speedKmh ?? null;
  }

  const previousSpeed = finiteMotionValue(previous?.speedKmh);
  const speedKmh = measuredSpeedKmh == null
    ? previousSpeed
    : previousSpeed == null
      ? measuredSpeedKmh
      : previousSpeed * 0.5 + measuredSpeedKmh * 0.5;

  const nativeHeading = finiteMotionValue(sample.heading);
  const derivedHeading = previous && distanceMeters(previous, sample) >= 3
    ? bearingDegrees(previous, sample)
    : previous?.heading ?? null;

  return {
    speedKmh: speedKmh == null ? null : Math.round(speedKmh),
    heading: nativeHeading == null ? derivedHeading : nativeHeading % 360,
  };
}

export function isPlausibleLocationSample(
  previous: TechnicianLocationFix | null,
  sample: TechnicianLocationFix,
) {
  if (!previous) return true;
  const elapsedMs = sample.timestamp - previous.timestamp;
  if (elapsedMs <= 0) return false;
  if (elapsedMs > MAX_NAVIGATION_LOCATION_AGE_MS) return true;

  const accuracyAllowance =
    Math.max(0, Number(previous.accuracy) || 0) +
    Math.max(0, Number(sample.accuracy) || 0);
  const maximumTravelMeters = Math.max(
    150,
    (elapsedMs / 1_000) * (MAX_PLAUSIBLE_SPEED_KMH / 3.6) + accuracyAllowance,
  );
  return distanceMeters(previous, sample) <= maximumTravelMeters;
}

export function smoothNavigationPoint(
  previous: TechnicianLocationFix | null,
  sample: GeoPoint,
) {
  if (!previous) return sample;
  const distance = distanceMeters(previous, sample);
  if (distance < 2 || distance > 500) return sample;
  const sampleWeight = 0.72;
  return {
    lat: previous.lat * (1 - sampleWeight) + sample.lat * sampleWeight,
    lng: previous.lng * (1 - sampleWeight) + sample.lng * sampleWeight,
  };
}

export const navigationVehicleLabels: Record<NavigationVehicleMode, string> = {
  "two-wheeler": "Two-wheeler",
  car: "Car",
  "commercial-tow": "Commercial / tow",
};
