import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

/** A model's photo from its Wikipedia article, with the credit its licence requires. */
export type VehiclePhoto = {
  url: string;
  width: number | null;
  height: number | null;
  article: string;
  credit: { author: string; license: string; source: string };
};

/** The plain studio picture shown when a model has no photo. */
export const studioImage = (type?: string | null) =>
  type === "bike" ? "/images/vehicles/bike.webp" : "/images/vehicles/car.webp";

export async function fetchVehiclePhoto(make: string, model: string, signal?: AbortSignal): Promise<VehiclePhoto | null> {
  const query = new URLSearchParams({ make, model });
  const response = await apiFetch(`/api/public/vehicle-photo?${query}`, { signal });
  if (!response.ok) return null;
  const data = await response.json().catch(() => null);
  const photo = data?.photo;
  return photo && typeof photo.url === "string" && /^https:\/\//.test(photo.url) ? (photo as VehiclePhoto) : null;
}

/** One lookup per model for the whole session; models share it across screens. */
export function useVehiclePhoto(make?: string | null, model?: string | null) {
  const cleanMake = String(make || "").trim();
  const cleanModel = String(model || "").trim();
  return useQuery({
    queryKey: ["vehicle-photo", cleanMake.toLowerCase(), cleanModel.toLowerCase()],
    queryFn: ({ signal }) => fetchVehiclePhoto(cleanMake, cleanModel, signal),
    enabled: Boolean(cleanMake && cleanModel),
    staleTime: 24 * 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 0,
  });
}
