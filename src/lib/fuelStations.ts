import { apiFetch } from "@/lib/api";

/**
 * Nearby fuel pumps and CNG stations for the Live Radar, from Mappls through
 * our backend. Prices are city-wide and come from /api/public/fuel-prices.
 */
export interface FuelStation {
  id: string;
  name: string;
  /** Brand key when the name shows it (indianoil, bpcl, hpcl, nayara, shell, jiobp). */
  brand?: string;
  latitude: number | null;
  longitude: number | null;
  address?: string;
  /** Metres from the customer. */
  distance?: number;
  phone?: string;
  isOpen?: boolean;
  openingHours?: string[];
  /** What Mappls lists the place as: a petrol pump, a CNG station, or both. */
  stationTypes?: Array<"petrol" | "cng">;
  mapplsPlaceId?: string;
  /** "osm" when the pin was placed from OpenStreetMap (approximate). */
  positionSource?: "osm";
}

export type FuelStationsResponse = {
  source: string;
  radiusMeters: number;
  stations: FuelStation[];
  total: number;
  located: number;
  positionsPending?: boolean;
  positionsAttribution?: string;
};

export const FUEL_SEARCH_RADIUS_METERS = 5_000;

export class FuelStationsError extends Error {
  constructor(public readonly code: string, message = "Fuel stations are temporarily unavailable.") {
    super(message);
    this.name = "FuelStationsError";
  }
}

export async function fetchFuelStations(
  anchor: { lat: number; lng: number },
  radiusMeters = FUEL_SEARCH_RADIUS_METERS,
  signal?: AbortSignal,
): Promise<FuelStationsResponse> {
  const query = new URLSearchParams({
    lat: anchor.lat.toFixed(4),
    lng: anchor.lng.toFixed(4),
    radius: String(radiusMeters),
  });
  const response = await apiFetch(`/api/public/fuel-stations?${query}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new FuelStationsError(typeof body?.code === "string" ? body.code : `http_${response.status}`);
  }
  const data = await response.json();
  return {
    source: String(data?.source ?? "mappls"),
    radiusMeters: Number(data?.radiusMeters) || radiusMeters,
    stations: Array.isArray(data?.stations) ? data.stations : [],
    total: Number(data?.total) || 0,
    located: Number(data?.located) || 0,
    positionsPending: data?.positionsPending === true,
    positionsAttribution: typeof data?.positionsAttribution === "string" ? data.positionsAttribution : undefined,
  };
}
