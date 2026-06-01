export type GoogleResolvedLocation = {
  address: string;
  formatted_address: string;
  lat: number;
  lng: number;
  placeId?: string | null;
};

type GoogleGeocodeResult = {
  formatted_address?: string;
  place_id?: string;
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
};

type GoogleGeocodeResponse = {
  status?: string;
  error_message?: string;
  results?: GoogleGeocodeResult[];
};

const GOOGLE_GEOCODE_ENDPOINT = "https://maps.googleapis.com/maps/api/geocode/json";
const COIMBATORE_BOUNDS = "10.70,76.70|11.30,77.30";

export const getGoogleMapsApiKey = () =>
  String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();

const readFirstResult = (
  data: GoogleGeocodeResponse,
  fallbackLat?: number,
  fallbackLng?: number
): GoogleResolvedLocation => {
  const result = data.results?.[0];
  const address = String(result?.formatted_address || "").trim();
  const lat = Number(result?.geometry?.location?.lat ?? fallbackLat);
  const lng = Number(result?.geometry?.location?.lng ?? fallbackLng);

  if (!address || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error("Unable to fetch locations");
  }

  return {
    address,
    formatted_address: address,
    lat,
    lng,
    placeId: result?.place_id || null,
  };
};

const fetchGoogleGeocode = async (params: URLSearchParams) => {
  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    throw new Error("Unable to fetch locations");
  }

  params.set("key", apiKey);
  params.set("region", "in");

  const response = await fetch(`${GOOGLE_GEOCODE_ENDPOINT}?${params.toString()}`);
  const data = (await response.json().catch(() => ({}))) as GoogleGeocodeResponse;

  if (!response.ok || data.status !== "OK") {
    throw new Error(data.error_message || "Unable to fetch locations");
  }

  return data;
};

export async function reverseGeocodeWithGoogle(
  lat: number,
  lng: number
): Promise<GoogleResolvedLocation> {
  const params = new URLSearchParams({
    latlng: `${lat},${lng}`,
  });
  const data = await fetchGoogleGeocode(params);
  return readFirstResult(data, lat, lng);
}

export async function geocodeAddressWithGoogle(address: string): Promise<GoogleResolvedLocation | null> {
  const trimmed = String(address || "").trim();
  if (trimmed.length < 2) return null;

  const params = new URLSearchParams({
    address: trimmed,
    components: "country:IN",
    bounds: COIMBATORE_BOUNDS,
  });

  const data = await fetchGoogleGeocode(params);
  return readFirstResult(data);
}
