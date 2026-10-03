import type { GeoPoint } from "@/lib/geo";

import { isValidNavigationPoint, type NavigationVehicleMode } from "./technicianNavigation";

// Google Maps has no tow-truck mode; a tow drives the roads a car does.
const GOOGLE_TRAVEL_MODES: Record<NavigationVehicleMode, string> = {
  "two-wheeler": "two-wheeler",
  car: "driving",
  "commercial-tow": "driving",
};

/**
 * A Google Maps link that starts turn-by-turn navigation to the destination from
 * wherever the phone is: voice, traffic and re-routing come from Google Maps itself.
 * It needs no API key. On a phone it opens the Google Maps app; elsewhere, the website.
 * Null when there is nowhere valid to navigate to.
 */
export function googleMapsNavigationUrl(
  destination: GeoPoint | null | undefined,
  vehicleMode: NavigationVehicleMode = "car",
): string | null {
  if (!destination || !isValidNavigationPoint(destination)) return null;
  const params = new URLSearchParams({
    api: "1",
    destination: `${Number(destination.lat.toFixed(6))},${Number(destination.lng.toFixed(6))}`,
    travelmode: GOOGLE_TRAVEL_MODES[vehicleMode] ?? "driving",
    // With no origin given, Google Maps starts from the phone's own position.
    dir_action: "navigate",
  });
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
