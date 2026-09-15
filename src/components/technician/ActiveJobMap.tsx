import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  LocateFixed,
  Navigation,
  RefreshCw,
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
import {
  isValidNavigationPoint,
  navigationVehicleLabels,
  type NavigationVehicleMode,
} from "@/lib/navigation/technicianNavigation";

export type ActiveJobRouteStatus =
  | "idle"
  | "locating"
  | "loading"
  | "ready"
  | "rerouting"
  | "error";

export type ActiveJobRouteState = {
  status: ActiveJobRouteStatus;
  distanceKm: number | null;
  durationMinutes: number | null;
  message?: string;
};

interface ActiveJobMapProps {
  technicianLocation?: { lat: number; lng: number };
  customerLocation?: { lat: number; lng: number };
  destinationLocation?: { lat: number; lng: number };
  navigationMode?: boolean;
  navigationDestination?: { lat: number; lng: number };
  heading?: number | null;
  speedKmh?: number | null;
  vehicleMode?: NavigationVehicleMode;
  onRouteStateChange?: (state: ActiveJobRouteState) => void;
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
  navigationMode = false,
  navigationDestination,
  heading,
  speedKmh,
  vehicleMode = "car",
  onRouteStateChange,
  onExitNavigation,
}) => {
  const [routePath, setRoutePath] = useState<Array<[number, number]>>([]);
  const [routeDurationMinutes, setRouteDurationMinutes] = useState<number | null>(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [routeStatus, setRouteStatus] = useState<ActiveJobRouteStatus>("idle");
  const [routeMessage, setRouteMessage] = useState<string>();
  const [retryRevision, setRetryRevision] = useState(0);
  const [following, setFollowing] = useState(true);
  const [cameraRevision, setCameraRevision] = useState(0);
  const lastRouteOriginRef = useRef<MapPoint | null>(null);
  const lastRouteRequestAtRef = useRef(0);
  const routeContextRef = useRef("");
  const requestSequenceRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const validTechnicianLocation = isValidNavigationPoint(technicianLocation)
    ? technicianLocation
    : undefined;
  const validNavigationDestination = isValidNavigationPoint(navigationDestination)
    ? navigationDestination
    : undefined;

  const progress = useMemo(() => {
    if (!navigationMode || !validTechnicianLocation || routePath.length < 3) return null;
    return getNavigationProgress({
      current: validTechnicianLocation,
      destination: validNavigationDestination,
      route: routePath,
      routeDistanceKm: routeDistanceKm ?? undefined,
      routeDurationMinutes: routeDurationMinutes ?? undefined,
    });
  }, [
    navigationMode,
    routeDurationMinutes,
    routeDistanceKm,
    routePath,
    validNavigationDestination,
    validTechnicianLocation,
  ]);

  useEffect(() => {
    onRouteStateChange?.({
      status: routeStatus,
      distanceKm: routeDistanceKm,
      durationMinutes: routeDurationMinutes,
      ...(routeMessage ? { message: routeMessage } : {}),
    });
  }, [onRouteStateChange, routeDistanceKm, routeDurationMinutes, routeMessage, routeStatus]);

  useEffect(() => {
    if (!validTechnicianLocation) {
      requestSequenceRef.current += 1;
      setRoutePath([]);
      setRouteDistanceKm(null);
      setRouteDurationMinutes(null);
      setRouteMessage("Acquiring accurate location…");
      setRouteStatus("locating");
      return;
    }
    if (!validNavigationDestination) {
      requestSequenceRef.current += 1;
      setRoutePath([]);
      setRouteDistanceKm(null);
      setRouteDurationMinutes(null);
      setRouteMessage("Destination coordinates are unavailable.");
      setRouteStatus("error");
      return;
    }

    const contextKey = `${validNavigationDestination.lat.toFixed(6)}:${validNavigationDestination.lng.toFixed(6)}:${vehicleMode}:${retryRevision}`;
    const contextChanged = routeContextRef.current !== contextKey;
    if (contextChanged) {
      routeContextRef.current = contextKey;
      lastRouteOriginRef.current = null;
      lastRouteRequestAtRef.current = 0;
      setRoutePath([]);
      setRouteDistanceKm(null);
      setRouteDurationMinutes(null);
    }

    const previousOrigin = lastRouteOriginRef.current;
    const moved = previousOrigin
      ? distanceMeters(previousOrigin, validTechnicianLocation)
      : Number.POSITIVE_INFINITY;
    const needsInitialRoute = contextChanged || routePath.length < 3;
    const needsNavigationRoute =
      navigationMode && (Boolean(progress?.offRoute) || moved >= routeRequestDistanceMeters);
    if (!needsInitialRoute && !needsNavigationRoute) return;

    const now = Date.now();
    if (
      !contextChanged &&
      lastRouteRequestAtRef.current &&
      now - lastRouteRequestAtRef.current < minimumRouteRequestIntervalMs
    ) {
      return;
    }

    const requestSequence = ++requestSequenceRef.current;
    lastRouteOriginRef.current = validTechnicianLocation;
    lastRouteRequestAtRef.current = now;
    setRouteMessage(undefined);
    setRouteStatus(!contextChanged && routePath.length >= 3 ? "rerouting" : "loading");

    void fetchRoute(
      [validTechnicianLocation, validNavigationDestination],
      "full",
      vehicleMode,
    )
      .then((route) => {
        if (!mountedRef.current || requestSequence !== requestSequenceRef.current) return;
        const coordinates = routePolylineFromMetadata(route);
        const distance = Number(route.distanceKm ?? route.distance_km);
        const duration = Number(
          route.durationMinutes ?? route.estimatedDuration ?? route.estimated_duration,
        );
        if (
          coordinates.length < 3 ||
          !Number.isFinite(distance) ||
          distance <= 0 ||
          !Number.isFinite(duration) ||
          duration <= 0
        ) {
          throw new Error("The route provider did not return usable road geometry.");
        }
        setRoutePath(coordinates);
        setRouteDistanceKm(distance);
        setRouteDurationMinutes(duration);
        setRouteStatus("ready");
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || requestSequence !== requestSequenceRef.current) return;
        console.error("Route Fetch Error:", error);
        setRoutePath([]);
        setRouteDistanceKm(null);
        setRouteDurationMinutes(null);
        setRouteMessage(error instanceof Error ? error.message : "Route calculation failed.");
        setRouteStatus("error");
      });
  }, [
    navigationMode,
    progress?.offRoute,
    retryRevision,
    routePath.length,
    validNavigationDestination,
    validTechnicianLocation,
    vehicleMode,
  ]);

  useEffect(() => {
    setFollowing(true);
    setCameraRevision((revision) => revision + 1);
  }, [navigationMode]);

  useEffect(() => {
    if (navigationMode && following && validTechnicianLocation) {
      setCameraRevision((revision) => revision + 1);
    }
  }, [following, navigationMode, validTechnicianLocation]);

  const markerHeading = heading ?? progress?.maneuver.bearing ?? 0;
  const markers = useMemo<MapMarkerSpec[]>(() => {
    const next: MapMarkerSpec[] = [];
    if (validTechnicianLocation) {
      next.push({
        id: "technician",
        position: validTechnicianLocation,
        html: technicianMarker(markerHeading),
        anchor: "center",
        zIndex: 30,
        heading: markerHeading,
      });
    }
    if (isValidNavigationPoint(customerLocation)) {
      next.push({
        id: "pickup",
        position: customerLocation,
        html: pinMarker("Pickup", "#ef4444"),
        anchor: "bottom",
        zIndex: 20,
      });
    }
    if (isValidNavigationPoint(destinationLocation)) {
      next.push({
        id: "destination",
        position: destinationLocation,
        html: pinMarker("Destination", "#0f172a"),
        anchor: "bottom",
        zIndex: 20,
      });
    } else if (validNavigationDestination && !customerLocation) {
      next.push({
        id: "navigation-destination",
        position: validNavigationDestination,
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
    validNavigationDestination,
    validTechnicianLocation,
  ]);

  const visibleRoute = navigationMode && progress ? progress.remainingPolyline : routePath;
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

  const camera = useMemo<MapCameraSpec | undefined>(() => {
    if (navigationMode && validTechnicianLocation) {
      return {
        mode: "follow",
        center: validTechnicianLocation,
        zoom: 17,
        bearing: markerHeading,
        pitch: 45,
        revision: cameraRevision,
      };
    }
    const points = [
      validTechnicianLocation,
      isValidNavigationPoint(customerLocation) ? customerLocation : undefined,
      isValidNavigationPoint(destinationLocation) ? destinationLocation : undefined,
    ].filter(Boolean) as MapPoint[];
    if (points.length === 0) return undefined;
    return {
      mode: "fit",
      points,
      padding: { top: 56, right: 44, bottom: 56, left: 44 },
      maxZoom: 15,
      revision: coordinateRevision(points),
    };
  }, [
    cameraRevision,
    customerLocation,
    destinationLocation,
    markerHeading,
    navigationMode,
    validTechnicianLocation,
  ]);

  const recenter = () => {
    setFollowing(true);
    setCameraRevision((revision) => revision + 1);
  };

  const retryRoute = () => setRetryRevision((revision) => revision + 1);
  const showRouteInterruption = ["locating", "loading", "error"].includes(routeStatus);

  return (
    <div
      className={`relative z-0 h-full min-h-[240px] w-full overflow-hidden bg-slate-100 ${navigationMode ? 'rounded-none' : 'rounded-xl'}`}
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

      {showRouteInterruption && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-slate-950/35 p-5 backdrop-blur-[2px]">
          <div role="status" aria-live="polite" className="max-w-xs rounded-2xl bg-white/95 p-5 text-center shadow-2xl">
            {routeStatus === "error" ? (
              <>
                <p className="font-black text-slate-950">Road route unavailable</p>
                <p className="mt-1 text-sm text-slate-500">{routeMessage}</p>
                <Button type="button" variant="outline" className="mt-4 rounded-xl" onClick={retryRoute}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Retry route
                </Button>
                {navigationMode && (
                  <Button type="button" variant="ghost" className="mt-2 rounded-xl" onClick={onExitNavigation}>
                    Exit navigation
                  </Button>
                )}
              </>
            ) : (
              <>
                <RefreshCw className="mx-auto h-6 w-6 animate-spin text-rose-600" />
                <p className="mt-3 font-black text-slate-950">
                  {routeStatus === "locating" ? "Acquiring accurate location…" : "Calculating road route…"}
                </p>
                {navigationMode && (
                  <Button type="button" variant="ghost" className="mt-3 rounded-xl" onClick={onExitNavigation}>
                    Exit navigation
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}

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
                ResQNow · In {formatDistance(progress.distanceToManeuverMeters)}
              </p>
              <p className="truncate text-lg font-black">{progress.instruction}</p>
              {routeStatus === "rerouting" && (
                <p className="text-xs font-bold text-amber-600">Updating route…</p>
              )}
            </div>
          </div>

          <div className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-white/70 bg-white/95 p-3 shadow-2xl backdrop-blur">
            <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-3 text-center">
              <div>
                <p className="text-lg font-black text-slate-950">{progress.remainingEtaMinutes} min</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">ETA</p>
              </div>
              <div>
                <p className="text-lg font-black text-slate-950">{formatDistance(progress.remainingDistanceMeters)}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Remaining</p>
              </div>
              <div>
                <p className="text-lg font-black text-slate-950">
                  {Number.isFinite(speedKmh) ? `${Math.max(0, Math.round(Number(speedKmh)))} km/h` : "-- km/h"}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Speed</p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-extrabold text-slate-600">
                {navigationVehicleLabels[vehicleMode]}
              </p>
              <Button
                type="button"
                size="icon"
                variant="outline"
                aria-label="Recenter navigation map"
                className="h-10 w-10 rounded-full"
                onClick={recenter}
              >
                <LocateFixed className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="destructive"
                className="h-10 rounded-xl px-4 font-extrabold"
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
