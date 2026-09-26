import { apiFetch } from "@/lib/api";

/**
 * Nearby EV charging stations for the Live Radar.
 *
 * Stations come from Mappls through our backend (the Mappls key never reaches
 * the browser). Any field Mappls did not return is absent, so the UI only
 * shows what is actually known about a station.
 */

/** Live charger occupancy. No trusted real-time source yet, so always "unknown". */
export type EVAvailability = {
  status: "unknown" | "available" | "occupied";
  availablePoints?: number;
  totalPoints?: number;
  updatedAt?: string;
};

export interface EVChargingStation {
  id: string;
  name: string;
  /** Null when Mappls gave no coordinates for this station. */
  latitude: number | null;
  longitude: number | null;
  address?: string;
  /** Metres from the customer. */
  distance?: number;
  phone?: string;
  /** Operating hours status; says nothing about whether a charger is free. */
  isOpen?: boolean;
  openingHours?: string[];
  /** Charging network, when known. */
  provider?: string;
  /** Brand key detected from the name (tatapower, statiq, jiobp, …) for its logo. */
  brand?: string;
  chargingTypes?: string[];
  connectorTypes?: string[];
  /** Highest connector power, in kW. */
  chargingPower?: number | string;
  chargingSlots?: number;
  amenities?: string[];
  mapplsPlaceId?: string;
  availability?: EVAvailability;
}

export type EVStationsResponse = {
  source: string;
  radiusMeters: number;
  stations: EVChargingStation[];
  total: number;
  located: number;
};

/** Search radius for the EV layer. Mappls accepts 500 m to 10 km. */
export const EV_SEARCH_RADIUS_METERS = 5_000;

/** A new search runs only after the customer moves this far from the last one. */
export const EV_SEARCH_REFRESH_METERS = 500;

export class EVStationsError extends Error {
  constructor(public readonly code: string, message = "EV charging stations are temporarily unavailable.") {
    super(message);
    this.name = "EVStationsError";
  }
}

type Point = { lat: number; lng: number };

export function distanceBetweenMeters(from: Point, to: Point) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRad(to.lat - from.lat);
  const deltaLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 2 * 6_371_000 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * The point EV searches run from. It stays put until the customer has moved
 * EV_SEARCH_REFRESH_METERS, so small GPS changes never trigger a new search.
 */
export function nextSearchAnchor(current: Point | null, location: Point | null): Point | null {
  if (!location) return current;
  if (current && distanceBetweenMeters(current, location) < EV_SEARCH_REFRESH_METERS) return current;
  return { lat: Number(location.lat.toFixed(4)), lng: Number(location.lng.toFixed(4)) };
}

export async function fetchEvStations(
  anchor: Point,
  radiusMeters = EV_SEARCH_RADIUS_METERS,
  signal?: AbortSignal,
): Promise<EVStationsResponse> {
  const query = new URLSearchParams({
    lat: anchor.lat.toFixed(4),
    lng: anchor.lng.toFixed(4),
    radius: String(radiusMeters),
  });
  const response = await apiFetch(`/api/public/ev-stations?${query}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new EVStationsError(typeof body?.code === "string" ? body.code : `http_${response.status}`);
  }
  const data = await response.json();
  return {
    source: String(data?.source ?? "mappls"),
    radiusMeters: Number(data?.radiusMeters) || radiusMeters,
    stations: Array.isArray(data?.stations) ? data.stations : [],
    total: Number(data?.total) || 0,
    located: Number(data?.located) || 0,
  };
}

export const hasCoordinates = (station: EVChargingStation): station is EVChargingStation & { latitude: number; longitude: number } =>
  typeof station.latitude === "number" && Number.isFinite(station.latitude) &&
  typeof station.longitude === "number" && Number.isFinite(station.longitude);

/**
 * Google Maps turn-by-turn directions to the station. Uses the Mappls
 * coordinates; only a station Mappls could not place falls back to its
 * name and address.
 */
export function googleMapsDirectionsUrl(station: EVChargingStation) {
  const { name, address, latitude, longitude } = station;
  const destination = hasCoordinates(station)
    ? `${latitude},${longitude}`
    : [name, address].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

export function formatStationDistance(meters?: number) {
  if (typeof meters !== "number" || !Number.isFinite(meters)) return null;
  return meters < 1_000 ? `${Math.max(10, Math.round(meters / 10) * 10)} m away` : `${(meters / 1_000).toFixed(1)} km away`;
}

export function formatRadius(meters: number) {
  return meters < 1_000 ? `${meters} m` : `${Number((meters / 1_000).toFixed(1))} km`;
}

export function formatChargingPower(power: EVChargingStation["chargingPower"]) {
  if (power == null || power === "") return null;
  const numeric = Number(power);
  return Number.isFinite(numeric) && numeric > 0 ? `${Number(numeric.toFixed(1))} kW` : String(power);
}

/** Open/closed from operating hours, or null when the hours are not known. */
export function operatingStatus(station: EVChargingStation): "open" | "closed" | null {
  if (station.isOpen === true) return "open";
  if (station.isOpen === false) return "closed";
  return null;
}

/** Whether Mappls told us anything about the chargers themselves. */
export function hasChargerDetails(station: EVChargingStation) {
  return Boolean(
    station.connectorTypes?.length ||
      station.chargingTypes?.length ||
      formatChargingPower(station.chargingPower) ||
      station.chargingSlots,
  );
}
