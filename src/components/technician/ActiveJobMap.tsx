import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  CornerUpLeft,
  CornerUpRight,
  ExternalLink,
  LocateFixed,
  Navigation,
  RefreshCw,
  TriangleAlert,
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
import { formatArrivalMinutes } from "@/lib/technicianArrival";
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
  /**
   * Set while `technicianLocation` is the last known position rather than a live fix.
   * The route already on screen stays, and this note says why nothing is moving.
   */
  positionNote?: string | null;
  /** The job's own details and actions, shown above the figures while navigating. */
  navigationPanel?: React.ReactNode;
  /** Google Maps to the same destination, offered when our own road route cannot be had. */
  externalNavigationUrl?: string | null;
  /**
   * When the technician is due, from the page: the backend's ETA when there is one. Without
   * it the navigation screen shows the minutes left along its own route, as before.
   */
  arrival?: { minutes: number; clockText: string; trafficAware: boolean } | null;
  onRouteStateChange?: (state: ActiveJobRouteState) => void;
  onExitNavigation?: () => void;
}

// While navigating, a new route is asked for only when the technician has left the one
// on screen: off it by more than its tolerance, or riding back along it the wrong way.
// Two position updates in a row must say so, so one noisy reading cannot trigger it.
const offCourseConfirmFixes = 2;
// Remaining distance grown by this much over the best so far means going the wrong way.
const wrongWayMeters = 150;
// A new route from (nearly) the same spot as the last one would be the same route.
const minimumRerouteMoveMeters = 35;
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
  positionNote = null,
  navigationPanel,
  externalNavigationUrl = null,
  arrival = null,
  onRouteStateChange,
  onExitNavigation,
}) => {
  const [routePath, setRoutePath] = useState<Array<[number, number]>>([]);
  const [routeDurationMinutes, setRouteDurationMinutes] = useState<number | null>(null);
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | null>(null);
  const [routeStatus, setRouteStatus] = useState<ActiveJobRouteStatus>("idle");
  const [routeMessage, setRouteMessage] = useState<string>();
  const [retryRevision, setRetryRevision] = useState(0);
  // A route update failed while a route was already on screen: that route is kept.
  const [routeUpdateFailed, setRouteUpdateFailed] = useState(false);
  const [following, setFollowing] = useState(true);
  const [cameraRevision, setCameraRevision] = useState(0);
  const lastRouteOriginRef = useRef<MapPoint | null>(null);
  const lastRouteRequestAtRef = useRef(0);
  const routeContextRef = useRef("");
  const requestSequenceRef = useRef(0);
  const mountedRef = useRef(true);
  const instructionRef = useRef<HTMLDivElement | null>(null);
  const footerRef = useRef<HTMLDivElement | null>(null);
  // How far the map is extended upwards so that its centre, where the follow view keeps
  // the technician, sits midway between the instruction and the bottom panel.
  const [mapLift, setMapLift] = useState(0);
  // Off-course tracking for the route on screen, one count per position update.
  const offCourseFixesRef = useRef(0);
  const closestRemainingMetersRef = useRef(Number.POSITIVE_INFINITY);
  const countedLocationRef = useRef<MapPoint | null>(null);

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
  const hasPositionNote = Boolean(positionNote);

  // Where the technician is along the route on screen, navigating or not.
  const routeProgress = useMemo(() => {
    if (!validTechnicianLocation || routePath.length < 3) return null;
    return getNavigationProgress({
      current: validTechnicianLocation,
      destination: validNavigationDestination,
      route: routePath,
      routeDistanceKm: routeDistanceKm ?? undefined,
      routeDurationMinutes: routeDurationMinutes ?? undefined,
    });
  }, [
    routeDurationMinutes,
    routeDistanceKm,
    routePath,
    validNavigationDestination,
    validTechnicianLocation,
  ]);
  const progress = navigationMode ? routeProgress : null;

  // The page shows what is left of the route from where the technician is now, so the
  // figures count down without asking the route service again.
  const remainingDistanceKm = routeProgress
    ? Math.round(routeProgress.remainingDistanceMeters / 10) / 100
    : routeDistanceKm;
  const remainingDurationMinutes = routeProgress
    ? routeProgress.remainingEtaMinutes
    : routeDurationMinutes;

  useEffect(() => {
    onRouteStateChange?.({
      status: routeStatus,
      distanceKm: remainingDistanceKm,
      durationMinutes: remainingDurationMinutes,
      ...(routeMessage ? { message: routeMessage } : {}),
    });
  }, [onRouteStateChange, remainingDistanceKm, remainingDurationMinutes, routeMessage, routeStatus]);

  // A new route starts a fresh count.
  useEffect(() => {
    offCourseFixesRef.current = 0;
    closestRemainingMetersRef.current = Number.POSITIVE_INFINITY;
  }, [routePath]);

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
      setRouteUpdateFailed(false);
    }

    const needsInitialRoute = contextChanged || routePath.length < 3;
    // The position is the last known one: a new route from it would say nothing new.
    if (hasPositionNote && !needsInitialRoute) return;

    if (progress && countedLocationRef.current !== validTechnicianLocation) {
      countedLocationRef.current = validTechnicianLocation;
      // Only a reading on the route says how far along it the technician is.
      if (!progress.offRoute) {
        closestRemainingMetersRef.current = Math.min(
          closestRemainingMetersRef.current,
          progress.remainingDistanceMeters,
        );
      }
      const wrongWay =
        !progress.offRoute &&
        progress.remainingDistanceMeters - closestRemainingMetersRef.current > wrongWayMeters;
      offCourseFixesRef.current = progress.offRoute || wrongWay ? offCourseFixesRef.current + 1 : 0;
    }
    const previousOrigin = lastRouteOriginRef.current;
    const moved = previousOrigin
      ? distanceMeters(previousOrigin, validTechnicianLocation)
      : Number.POSITIVE_INFINITY;
    const needsNavigationRoute =
      navigationMode &&
      offCourseFixesRef.current >= offCourseConfirmFixes &&
      moved >= minimumRerouteMoveMeters;
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
    const hasRouteToKeep = !contextChanged && routePath.length >= 3;
    offCourseFixesRef.current = 0;
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
        setRouteUpdateFailed(false);
        setRouteStatus("ready");
      })
      .catch((error: unknown) => {
        if (!mountedRef.current || requestSequence !== requestSequenceRef.current) return;
        console.error("Route Fetch Error:", error);
        if (hasRouteToKeep) {
          // A dead zone must not blank the screen: the route already shown is still
          // the way there. The next update is tried again as the technician moves on.
          setRouteUpdateFailed(true);
          setRouteStatus("ready");
          return;
        }
        setRoutePath([]);
        setRouteDistanceKm(null);
        setRouteDurationMinutes(null);
        setRouteMessage(error instanceof Error ? error.message : "Route calculation failed.");
        setRouteStatus("error");
      });
  }, [
    hasPositionNote,
    navigationMode,
    progress,
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

  const hasGuidance = navigationMode && Boolean(progress);
  useEffect(() => {
    if (!hasGuidance) {
      setMapLift(0);
      return;
    }
    const measure = () => {
      const footerHeight = footerRef.current?.offsetHeight ?? 0;
      const instructionHeight = instructionRef.current?.offsetHeight ?? 0;
      setMapLift(Math.max(0, Math.round(footerHeight - instructionHeight)));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    // The panel grows and shrinks with the job's details and the arrival prompt.
    const observer = new ResizeObserver(measure);
    if (footerRef.current) observer.observe(footerRef.current);
    if (instructionRef.current) observer.observe(instructionRef.current);
    return () => observer.disconnect();
  }, [hasGuidance]);

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
      <div className="absolute inset-x-0 bottom-0" style={{ top: -mapLift }}>
        <MapplsMapSurface
          ariaLabel={navigationMode ? "Active route navigation map" : "Active job map"}
          markers={markers}
          polylines={polylines}
          circles={[]}
          camera={camera}
          className="h-full w-full"
          onInteract={navigationMode ? () => setFollowing(false) : undefined}
        />
      </div>

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
                {externalNavigationUrl && (
                  <Button asChild className="mt-2 rounded-xl">
                    <a href={externalNavigationUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open in Google Maps
                    </a>
                  </Button>
                )}
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
            ref={instructionRef}
            data-testid="navigation-instruction"
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
              {positionNote || routeUpdateFailed ? (
                <p role="status" className="mt-1 flex items-start gap-1.5 rounded-xl bg-amber-100 px-2.5 py-1.5 text-xs font-extrabold leading-4 text-amber-900">
                  <TriangleAlert aria-hidden="true" className="mt-px h-4 w-4 shrink-0" />
                  <span>{positionNote || "Weak network · showing the last route"}</span>
                </p>
              ) : routeStatus === "rerouting" ? (
                <p className="text-xs font-bold text-amber-600">Updating route…</p>
              ) : null}
            </div>
          </div>

          <div
            ref={footerRef}
            data-testid="navigation-footer"
            className="absolute inset-x-3 bottom-3 z-20 rounded-2xl border border-white/70 bg-white/95 p-3 shadow-2xl backdrop-blur"
          >
            {navigationPanel}
            <div className="grid grid-cols-3 gap-2 border-b border-slate-100 pb-3 text-center">
              <div data-testid="navigation-eta">
                <p className="text-lg font-black text-slate-950">
                  {arrival ? formatArrivalMinutes(arrival.minutes) : `${progress.remainingEtaMinutes} min`}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                  {arrival ? `Arrive ${arrival.clockText}` : "ETA"}
                </p>
                {arrival?.trafficAware && (
                  <p className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-700">Live traffic</p>
                )}
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
