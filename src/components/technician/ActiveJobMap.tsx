import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  LocateFixed,
  Navigation,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { fetchRoute, routePolylineFromMetadata } from "@/lib/geo";
import { MapplsMapSurface } from "@/lib/mapProvider/MapplsMapSurface";
import type {
  MapCameraSpec,
  MapMarkerSpec,
  MapPoint,
  MapPolylineSpec,
} from "@/lib/mapProvider/types";
import {
  getNavigationProgress,
  type ManeuverKind,
} from "@/lib/navigation/routeNavigation";

interface ActiveJobMapProps {
  technicianLocation?: { lat: number; lng: number };
  customerLocation?: { lat: number; lng: number };
  destinationLocation?: { lat: number; lng: number };
  routePolyline?: Array<[number, number]> | null;
  navigationMode?: boolean;
  navigationDestination?: { lat: number; lng: number };
  heading?: number | null;
  onExitNavigation?: () => void;
}

const routeRequestDistanceMeters = 35;
const minimumRouteRequestIntervalMs = 4_000;

function distanceMeters(a: MapPoint, b: MapPoint) {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLat = toRadians(b.lat - a.lat);
  const deltaLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const value =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(value));
}

function coordinateRevision(points: MapPoint[]) {
  return points.reduce(
    (revision, point) =>
      revision + Math.round(point.lat * 10_000) * 31 + Math.round(point.lng * 10_000),
    points.length,
  );
}

function pinMarker(label: string, color: string) {
  return `<div class="mappls-marker-shell" aria-label="${label}">
    <svg width="38" height="44" viewBox="0 0 38 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M19 42C19 42 35 29.4 35 17C35 8.16 27.84 1 19 1S3 8.16 3 17C3 29.4 19 42 19 42Z" fill="${color}" stroke="white" stroke-width="3"/>
      <circle cx="19" cy="17" r="5" fill="white"/>
    </svg>
  </div>`;
}

function technicianMarker(heading: number) {
  return `<div class="mappls-marker-shell active-job-navigation-marker" style="--marker-heading:${heading}deg" aria-label="Technician live location">
    <span class="active-job-navigation-marker__pulse"></span>
    <span class="active-job-navigation-marker__arrow">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M12 3L20 20L12 16.5L4 20L12 3Z" fill="white"/>
      </svg>
    </span>
  </div>`;
}

function formatDistance(meters: number) {
  if (meters < 1_000) return `${Math.max(10, Math.round(meters / 10) * 10)} m`;
  return `${(meters / 1_000).toFixed(meters < 10_000 ? 1 : 0)} km`;
}

function ManeuverIcon({ kind }: { kind: ManeuverKind }) {
  if (kind.includes("left")) return <CornerUpLeft aria-hidden="true" />;
  if (kind.includes("right")) return <CornerUpRight aria-hidden="true" />;
  if (kind === "arrive") return <Navigation aria-hidden="true" />;
  return <ArrowUp aria-hidden="true" />;
}

const ActiveJobMap: React.FC<ActiveJobMapProps> = ({
  technicianLocation,
  customerLocation,
  destinationLocation,
  routePolyline,
  navigationMode = false,
  navigationDestination,
  heading,
  onExitNavigation,
}) => {
  const suppliedRoute = useMemo(
    () => routePolylineFromMetadata({ polyline: routePolyline }),
    [routePolyline],
  );
  const [routePath, setRoutePath] = useState<Array<[number, number]>>(suppliedRoute);
  const [routeDurationMinutes, setRouteDurationMinutes] = useState<number>();
  const [following, setFollowing] = useState(true);
  const [cameraRevision, setCameraRevision] = useState(0);
  const lastRouteOriginRef = useRef<MapPoint | null>(null);
  const lastRouteRequestAtRef = useRef(0);

  const routePoints = useMemo(() => {
    if (navigationMode) {
      return [technicianLocation, navigationDestination].filter(Boolean) as MapPoint[];
    }
    return [technicianLocation, customerLocation, destinationLocation].filter(
      Boolean,
    ) as MapPoint[];
  }, [
    customerLocation,
    destinationLocation,
    navigationDestination,
    navigationMode,
    technicianLocation,
  ]);

  const progress = useMemo(() => {
    if (!navigationMode || !technicianLocation) return null;
    return getNavigationProgress({
      current: technicianLocation,
      destination: navigationDestination,
      route: routePath,
      routeDurationMinutes,
    });
  }, [
    navigationDestination,
    navigationMode,
    routeDurationMinutes,
    routePath,
    technicianLocation,
  ]);

  useEffect(() => {
    if (suppliedRoute.length > 1) setRoutePath(suppliedRoute);
  }, [suppliedRoute]);

  useEffect(() => {
    if (routePoints.length < 2) {
      setRoutePath([]);
      return;
    }

    const origin = routePoints[0];
    const previousOrigin = lastRouteOriginRef.current;
    const moved = previousOrigin
      ? distanceMeters(previousOrigin, origin)
      : Number.POSITIVE_INFINITY;
    const now = Date.now();
    const needsNavigationRoute =
      navigationMode && (progress?.offRoute || moved >= routeRequestDistanceMeters);
    const needsOverviewRoute = !navigationMode && suppliedRoute.length < 2;
    if (!needsNavigationRoute && !needsOverviewRoute) return;
    if (
      lastRouteRequestAtRef.current &&
      now - lastRouteRequestAtRef.current < minimumRouteRequestIntervalMs
    ) {
      return;
    }

    let stale = false;
    lastRouteOriginRef.current = origin;
    lastRouteRequestAtRef.current = now;
    void fetchRoute(routePoints, "full")
      .then((route) => {
        if (stale) return;
        const coordinates = routePolylineFromMetadata(route);
        if (coordinates.length > 1) setRoutePath(coordinates);
        const duration = Number(
          route.durationMinutes ?? route.estimatedDuration ?? route.estimated_duration,
        );
        if (Number.isFinite(duration) && duration > 0) {
          setRouteDurationMinutes(duration);
        }
      })
      .catch((error: unknown) => {
        if (!stale) console.error("Route Fetch Error:", error);
      });

    return () => {
      stale = true;
    };
  }, [navigationMode, progress?.offRoute, routePoints, suppliedRoute.length]);

  useEffect(() => {
    setFollowing(true);
    setCameraRevision((revision) => revision + 1);
  }, [navigationMode]);

  useEffect(() => {
    if (navigationMode && following && technicianLocation) {
      setCameraRevision((revision) => revision + 1);
    }
  }, [following, navigationMode, technicianLocation]);

  const markerHeading = heading ?? progress?.maneuver.bearing ?? 0;
  const markers = useMemo<MapMarkerSpec[]>(() => {
    const next: MapMarkerSpec[] = [];
    if (technicianLocation) {
      next.push({
        id: "technician",
        position: technicianLocation,
        html: technicianMarker(markerHeading),
        anchor: "center",
        zIndex: 30,
        heading: markerHeading,
      });
    }
    if (customerLocation) {
      next.push({
        id: "pickup",
        position: customerLocation,
        html: pinMarker("Pickup", "#ef4444"),
        anchor: "bottom",
        zIndex: 20,
      });
    }
    if (destinationLocation) {
      next.push({
        id: "destination",
        position: destinationLocation,
        html: pinMarker("Destination", "#0f172a"),
        anchor: "bottom",
        zIndex: 20,
      });
    } else if (navigationMode && navigationDestination) {
      next.push({
        id: "navigation-destination",
        position: navigationDestination,
        html: pinMarker("Destination", "#0f172a"),
        anchor: "bottom",
        zIndex: 20,
      });
    }
    return next;
  }, [
    customerLocation,
    destinationLocation,
    markerHeading,
    navigationDestination,
    navigationMode,
    technicianLocation,
  ]);

  const visibleRoute = navigationMode && progress
    ? progress.remainingPolyline
    : routePath;
  const polylines = useMemo<MapPolylineSpec[]>(() => {
    if (visibleRoute.length < 2) return [];
    const points = visibleRoute.map(([lat, lng]) => ({ lat, lng }));
    return [
      {
        id: "route-casing",
        points,
        color: "#ffffff",
        width: navigationMode ? 9 : 7,
        opacity: 0.92,
      },
      {
        id: "route-primary",
        points,
        color: navigationMode ? "#e11d48" : "#2563eb",
        width: navigationMode ? 6 : 4,
        opacity: 0.96,
      },
    ];
  }, [navigationMode, visibleRoute]);

  const camera = useMemo<MapCameraSpec>(() => {
    if (navigationMode && technicianLocation) {
      return {
        mode: "follow",
        center: technicianLocation,
        zoom: 17,
        bearing: markerHeading,
        pitch: 45,
        revision: cameraRevision,
      };
    }
    const points = routePoints.length ? routePoints : [{ lat: 12.9716, lng: 77.5946 }];
    return {
      mode: "fit",
      points,
      padding: { top: 56, right: 44, bottom: 56, left: 44 },
      maxZoom: 15,
      revision: coordinateRevision(points),
    };
  }, [cameraRevision, markerHeading, navigationMode, routePoints, technicianLocation]);

  const recenter = () => {
    setFollowing(true);
    setCameraRevision((revision) => revision + 1);
  };

  return (
    <div
      className="relative z-0 h-full min-h-[240px] w-full overflow-hidden rounded-xl bg-slate-100"
      {...(navigationMode
        ? { role: "region", "aria-label": "Turn-by-turn navigation" }
        : {})}
    >
      <MapplsMapSurface
        ariaLabel={navigationMode ? "Active route navigation map" : "Active job map"}
        markers={markers}
        polylines={polylines}
        circles={[]}
        camera={camera}
        className="h-full w-full"
        onInteract={navigationMode ? () => setFollowing(false) : undefined}
      />

      {navigationMode && progress && (
        <>
          <div
            aria-live="polite"
            className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-center gap-4 rounded-2xl border border-white/70 bg-white/95 p-4 text-slate-950 shadow-xl backdrop-blur"
          >
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-rose-600 text-white [&>svg]:h-7 [&>svg]:w-7">
              <ManeuverIcon kind={progress.maneuver.kind} />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-rose-600">
                In {formatDistance(progress.distanceToManeuverMeters)}
              </p>
              <p className="truncate text-lg font-black">{progress.instruction}</p>
              {progress.offRoute && (
                <p className="text-xs font-bold text-amber-600">Updating route…</p>
              )}
            </div>
          </div>

          <div className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-white/70 bg-white/95 p-4 shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-2xl font-black text-slate-950">
                  {progress.remainingEtaMinutes} min
                </p>
                <p className="text-sm font-bold text-slate-500">
                  {formatDistance(progress.remainingDistanceMeters)} remaining
                </p>
              </div>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Recenter navigation map"
                className="h-11 w-11 rounded-full"
                onClick={recenter}
              >
                <LocateFixed className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="h-11 rounded-xl px-5 font-extrabold"
                onClick={onExitNavigation}
              >
                Exit navigation
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default React.memo(ActiveJobMap);
