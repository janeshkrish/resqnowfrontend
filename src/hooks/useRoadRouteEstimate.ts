import { useEffect, useRef, useState } from "react";

import { fetchRoute, type GeoPoint } from "@/lib/geo";
import { isValidNavigationPoint, type NavigationVehicleMode } from "@/lib/navigation/technicianNavigation";

export type RoadRouteEstimate = { distanceKm: number | null; durationMinutes: number | null };

const NO_ESTIMATE: RoadRouteEstimate = { distanceKm: null, durationMinutes: null };
// A moving technician asks again only after covering some ground, and not too often.
const REFRESH_AFTER_METERS = 150;
const REFRESH_AFTER_MS = 15_000;

function metersBetween(a: GeoPoint, b: GeoPoint) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/**
 * The road distance and drive time from where the technician is to where the job takes them,
 * from the same route service the active job page uses. Null until a route is known: a card
 * shows a dash rather than a straight line or an assumed speed.
 */
export function useRoadRouteEstimate(
  origin: GeoPoint | null | undefined,
  destination: GeoPoint | null | undefined,
  vehicleMode: NavigationVehicleMode,
): RoadRouteEstimate {
  const [estimate, setEstimate] = useState<RoadRouteEstimate>(NO_ESTIMATE);
  const tripRef = useRef("");
  const askedRef = useRef<{ from: GeoPoint; at: number; failed: boolean } | null>(null);
  const sequenceRef = useRef(0);
  const mountedRef = useRef(true);

  const from = isValidNavigationPoint(origin) ? origin : null;
  const to = isValidNavigationPoint(destination) ? destination : null;
  const fromLat = from?.lat ?? null;
  const fromLng = from?.lng ?? null;
  const toLat = to?.lat ?? null;
  const toLng = to?.lng ?? null;

  useEffect(() => {
    if (fromLat === null || fromLng === null || toLat === null || toLng === null) {
      sequenceRef.current += 1;
      tripRef.current = "";
      askedRef.current = null;
      setEstimate(NO_ESTIMATE);
      return;
    }

    const start = { lat: fromLat, lng: fromLng };
    const trip = `${toLat.toFixed(6)}:${toLng.toFixed(6)}:${vehicleMode}`;
    if (tripRef.current !== trip) {
      // A different destination or vehicle: the last figures no longer apply.
      tripRef.current = trip;
      askedRef.current = null;
      setEstimate(NO_ESTIMATE);
    }

    const asked = askedRef.current;
    // A failed lookup is tried again from the same spot; a good one waits for the technician to move.
    const tooSoon = asked ? Date.now() - asked.at < REFRESH_AFTER_MS : false;
    const sameSpot = asked ? !asked.failed && metersBetween(asked.from, start) < REFRESH_AFTER_METERS : false;
    if (tooSoon || sameSpot) return;

    const sequence = ++sequenceRef.current;
    const request = { from: start, at: Date.now(), failed: false };
    askedRef.current = request;
    void fetchRoute([start, { lat: toLat, lng: toLng }], "simplified", vehicleMode)
      .then((route) => {
        if (!mountedRef.current || sequence !== sequenceRef.current) return;
        const distanceKm = Number(route.distanceKm ?? route.distance_km);
        const durationMinutes = Number(route.durationMinutes ?? route.estimatedDuration ?? route.estimated_duration);
        setEstimate(
          Number.isFinite(distanceKm) && distanceKm > 0 && Number.isFinite(durationMinutes) && durationMinutes > 0
            ? { distanceKm, durationMinutes }
            : NO_ESTIMATE,
        );
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || sequence !== sequenceRef.current) return;
        console.error("Route estimate failed:", error);
        request.failed = true;
        setEstimate(NO_ESTIMATE);
      });
  }, [fromLat, fromLng, toLat, toLng, vehicleMode]);

  // Ignore a late answer once the card is gone.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return estimate;
}
