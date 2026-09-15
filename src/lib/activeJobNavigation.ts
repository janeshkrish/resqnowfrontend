import type { GeoPoint } from "@/lib/geo";
import { isValidNavigationPoint } from "@/lib/navigation/technicianNavigation";
import { normalizeTechnicianStatus } from "@/utils/technicianStatus";

const dropNavigationStatuses = new Set([
  "vehicle_loaded",
  "enroute_drop",
  "arrived_drop",
  "service_completed",
  "payment_pending",
  "closed",
]);

type ActiveJobNavigationSource = {
  pickupLatitude?: unknown;
  pickupLongitude?: unknown;
  destinationLatitude?: unknown;
  destinationLongitude?: unknown;
  location_lat?: unknown;
  location_lng?: unknown;
  drop_latitude?: unknown;
  drop_longitude?: unknown;
  location?: { lat?: unknown; lng?: unknown } | null;
  dropLocation?: { lat?: unknown; lng?: unknown } | null;
};

function finiteCoordinate(value: unknown) {
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

export function resolveActiveJobNavigationTarget(
  job: ActiveJobNavigationSource | null | undefined,
  status: unknown,
): GeoPoint | null {
  if (!job) return null;
  const pickupLat = finiteCoordinate(
    job.pickupLatitude ?? job.location?.lat ?? job.location_lat,
  );
  const pickupLng = finiteCoordinate(
    job.pickupLongitude ?? job.location?.lng ?? job.location_lng,
  );
  const dropLat = finiteCoordinate(
    job.destinationLatitude ?? job.dropLocation?.lat ?? job.drop_latitude,
  );
  const dropLng = finiteCoordinate(
    job.destinationLongitude ?? job.dropLocation?.lng ?? job.drop_longitude,
  );
  const useDrop = dropNavigationStatuses.has(normalizeTechnicianStatus(status));
  const lat = useDrop ? dropLat ?? pickupLat : pickupLat;
  const lng = useDrop ? dropLng ?? pickupLng : pickupLng;
  const target = lat == null || lng == null ? null : { lat, lng };
  return isValidNavigationPoint(target) ? target : null;
}

export async function startJourneyAndNavigate(
  updateStatus: (status: string) => Promise<boolean>,
  setNavigationActive: (active: boolean) => void,
) {
  const updated = await updateStatus("en-route");
  if (updated) setNavigationActive(true);
  return updated;
}
