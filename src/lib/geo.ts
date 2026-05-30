import { apiFetch, readJsonSafely } from "@/lib/api";

export type GeoPoint = {
  lat: number;
  lng: number;
};

export type LocationSearchResult = GeoPoint & {
  id?: string;
  label: string;
  name?: string;
  address: string;
  provider?: string;
  category?: string | null;
};

type RouteResponse = {
  distanceKm?: number;
  distance_km?: number;
  durationMinutes?: number;
  estimatedDuration?: number;
  estimated_duration?: number;
  geometry?: { type?: string; coordinates?: [number, number][] };
  polyline?: Array<[number, number]>;
  error?: string;
};

const toFinitePoint = (lat: unknown, lng: unknown): GeoPoint | null => {
  const parsedLat = Number(lat);
  const parsedLng = Number(lng);
  if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) return null;
  return { lat: parsedLat, lng: parsedLng };
};

const normalizePolyline = (value: unknown): Array<[number, number]> => {
  if (!Array.isArray(value)) return [];
  return value
    .map((point) => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const parsed = toFinitePoint(point[0], point[1]);
      return parsed ? ([parsed.lat, parsed.lng] as [number, number]) : null;
    })
    .filter((point): point is [number, number] => Boolean(point));
};

export function routePolylineFromMetadata(value: unknown): Array<[number, number]> {
  if (!value || typeof value !== "object") return [];
  const metadata = value as { polyline?: unknown; geometry?: { coordinates?: unknown } };
  const polyline = normalizePolyline(metadata.polyline);
  if (polyline.length > 0) return polyline;

  if (Array.isArray(metadata.geometry?.coordinates)) {
    return metadata.geometry.coordinates
      .map((point) => {
        if (!Array.isArray(point) || point.length < 2) return null;
        const parsed = toFinitePoint(point[1], point[0]);
        return parsed ? ([parsed.lat, parsed.lng] as [number, number]) : null;
      })
      .filter((point): point is [number, number] => Boolean(point));
  }

  return [];
}

export async function searchLocations(query: string, limit = 6): Promise<LocationSearchResult[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) return [];

  const response = await apiFetch(
    `/api/public/location-search?q=${encodeURIComponent(normalizedQuery)}&limit=${encodeURIComponent(String(limit))}`
  );
  const data = await readJsonSafely<{ results?: Array<Partial<LocationSearchResult>>; error?: string }>(response);
  if (!response.ok) {
    throw new Error(data?.error || "Location search failed.");
  }

  return (data?.results || [])
    .map((item) => {
      const point = toFinitePoint(item.lat, item.lng);
      const address = String(item.address || item.label || item.name || "").trim();
      if (!point || !address) return null;
      return {
        ...point,
        id: item.id ? String(item.id) : `${point.lat},${point.lng}`,
        label: String(item.label || address),
        name: item.name ? String(item.name) : String(item.label || address).split(",")[0],
        address,
        provider: item.provider ? String(item.provider) : undefined,
        category: item.category || null,
      };
    })
    .filter((item): item is LocationSearchResult => Boolean(item));
}

export async function reverseGeocode(lat: number, lng: number): Promise<LocationSearchResult> {
  const response = await apiFetch(
    `/api/public/reverse-geocode?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`
  );
  const data = await readJsonSafely<any>(response);
  if (!response.ok) {
    throw new Error(data?.error || "Reverse geocoding failed.");
  }

  const normalized = data?.normalized || data;
  const point = toFinitePoint(normalized?.lat ?? data?.lat ?? lat, normalized?.lng ?? data?.lon ?? data?.lng ?? lng) || { lat, lng };
  const address = String(normalized?.address || normalized?.label || data?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`).trim();
  return {
    ...point,
    id: normalized?.id || `${point.lat},${point.lng}`,
    label: normalized?.label || address,
    name: normalized?.name || address.split(",")[0],
    address,
    provider: normalized?.provider || data?.provider,
  };
}

export async function fetchRoute(points: GeoPoint[], overview: "full" | "simplified" = "full"): Promise<RouteResponse> {
  const validPoints = points
    .map((point) => toFinitePoint(point.lat, point.lng))
    .filter((point): point is GeoPoint => Boolean(point));
  if (validPoints.length < 2) {
    throw new Error("At least two valid route points are required.");
  }

  const encodedPoints = validPoints.map((point) => `${point.lat},${point.lng}`).join(";");
  const response = await apiFetch(
    `/api/public/route?points=${encodeURIComponent(encodedPoints)}&overview=${encodeURIComponent(overview)}`
  );
  const data = await readJsonSafely<RouteResponse>(response);
  if (!response.ok) {
    throw new Error(data?.error || "Route calculation failed.");
  }
  return data || {};
}
