import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api";
import { nearbyAvailable, type NearbyPoint } from "@/lib/findingTechnician";

type Options = {
  /** Only while a technician is still being found. */
  enabled: boolean;
  /** Where the customer is. */
  location: { lat: number; lng: number } | null;
  serviceType?: string | null;
  vehicleType?: string | null;
};

/**
 * Technicians near the customer who are available for this job, for the search map. Asked of the same public list
 * the Map tab uses, for this service and kind of vehicle, and asked again every half minute while the search runs.
 * Nothing is returned once the search is over, or if the list cannot be loaded.
 */
export function useNearbySearchTechnicians({ enabled, location, serviceType, vehicleType }: Options): NearbyPoint[] | undefined {
  const lat = location?.lat;
  const lng = location?.lng;
  const searching = enabled && lat != null && lng != null;
  const query = useQuery({
    queryKey: ["finding", "nearby", lat, lng, serviceType ?? "", vehicleType ?? ""],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
      if (serviceType) params.set("service_type", String(serviceType));
      if (vehicleType) params.set("vehicle_type", String(vehicleType));
      const res = await apiFetch(`/api/technicians/nearby?${params.toString()}`, { signal });
      if (!res.ok) throw new Error(`Nearby technicians failed (${res.status})`);
      return nearbyAvailable(await res.json());
    },
    enabled: searching,
    refetchInterval: 30_000,
    staleTime: 20_000,
    retry: false,
  });
  return searching ? query.data : undefined;
}
