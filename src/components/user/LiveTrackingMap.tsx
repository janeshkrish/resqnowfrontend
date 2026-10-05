import React, { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { LocateFixed, RadioTower } from "lucide-react";

import { fetchRoute, routePolylineFromMetadata } from "@/lib/geo";
import {
  LiveTrackingPlaybackController,
  type TrackingFreshness,
  type TrackingPlaybackFrame,
  type TrackingPlaybackPoint,
} from "@/lib/liveTrackingPlayback";
import { logLiveTrackingDiagnostic } from "@/lib/liveTrackingDiagnostics";
import { MapplsMapSurface } from "@/lib/mapProvider/MapplsMapSurface";
import type {
  MapCameraSpec,
  MapCircleSpec,
  MapMarkerSpec,
  MapPoint,
  MapPolylineSpec,
} from "@/lib/mapProvider/types";
import { cn } from "@/lib/utils";

import { Card, CardContent } from "../ui/card";

type TrackingMapMode = "map" | "balanced" | "sheet";

interface LiveTrackingMapProps {
  techLocation: { lat: number; lng: number } | null;
  technicianSpeed?: number | null;
  technicianHeading?: number | null;
  technicianAccuracy?: number | null;
  technicianRecordedAt?: number | null;
  technicianSequenceId?: number | null;
  trackingFreshness?: TrackingFreshness;
  userLocation: { lat: number; lng: number } | null;
  dropLocation?: { lat: number; lng: number } | null;
  eta?: string;
  className?: string;
  variant?: "card" | "fullscreen";
  status?: string;
  distanceLabel?: string;
  mapMode?: TrackingMapMode;
  onInteract?: () => void;
  routePolyline?: Array<[number, number]> | null;
  routeDestination?: { lat: number; lng: number } | null;
  showRoutePath?: boolean;
  showStatusOverlay?: boolean;
  trackingSessionId?: string | number | null;
  /** What the technician arrives on; picks the picture inside their marker. */
  technicianVehicle?: "bike" | "tow";
  /** The word over the customer's own spot, e.g. "You", or "Pickup" on a tow. */
  userLabel?: string;
  dropLabel?: string;
}

const FALLBACK_CENTER: MapPoint = { lat: 20.5937, lng: 78.9629 };
// The markers carry their own soft pulse, so no discs are drawn under them.
const NO_CIRCLES: MapCircleSpec[] = [];
const ROUTE_REFRESH_MIN_DISTANCE_METERS = 25;
const ROUTE_REFRESH_MIN_INTERVAL_MS = 5_000;

export function isMapplsAdvancedTrackingEnabled(value = import.meta.env.VITE_MAPPLS_ADVANCED_TRACKING) {
  return String(value || "").trim().toLowerCase() === "true";
}

const normalizeStatusLabel = (status: string | undefined) => {
  const raw = String(status || "").trim().toLowerCase();
  if (raw === "en-route" || raw === "on_the_way" || raw === "on-the-way") return "On the way";
  if (raw === "arrived") return "Arrived";
  if (raw === "in-progress" || raw === "in_progress") return "Service started";
  if (raw === "payment_pending" || raw === "awaiting_payment") return "Payment pending";
  if (raw === "completed" || raw === "paid") return "Completed";
  if (raw === "assigned") return "Assigned";
  if (raw === "pending") return "Finding technician";
  if (!raw) return "Live tracking";
  return raw
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const normalizeEtaLabel = (eta: string | undefined) =>
  String(eta || "").replace(/\bmins?\b/i, "min").trim();

const escapeHtml = (value: string) =>
  value.replace(
    /[&<>'"]/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[character] || character,
  );

const buildRouteCurve = (
  from: [number, number],
  to: [number, number],
): [number, number][] => {
  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;
  const latDelta = toLat - fromLat;
  const lngDelta = toLng - fromLng;
  return [
    from,
    [fromLat + latDelta * 0.24 + lngDelta * 0.07, fromLng + lngDelta * 0.24 - latDelta * 0.07],
    [(fromLat + toLat) / 2 + lngDelta * 0.12, (fromLng + toLng) / 2 - latDelta * 0.12],
    [fromLat + latDelta * 0.76 + lngDelta * 0.03, fromLng + lngDelta * 0.76 - latDelta * 0.03],
    to,
  ];
};

// Marker pictures. Each sits in the same box, with the same anchor and offset, as the
// markers it replaces, so nothing about where Mappls puts a marker changes: the map
// point is 18px below the middle of the box.

/** A place on the map: the customer's spot (a dot) or the drop (a square), with one word over it. */
const createPlaceMarkerHtml = (label: string, kind: "customer" | "drop") => `
  <div class="mappls-marker-shell tracking-place-marker${kind === "drop" ? " is-drop" : ""}" data-tracking-place="${kind}">
    ${label ? `<span class="tracking-place-marker__label">${escapeHtml(label)}</span>` : ""}
    ${kind === "customer" ? '<span class="tracking-place-marker__pulse"></span>' : ""}
    <span class="tracking-place-marker__dot"></span>
  </div>
`;

const TECHNICIAN_GLYPH = { bike: "two_wheeler", tow: "auto_towing" } as const;

/** Only a real figure ("5 min", "1 hr 5 min") is worth a chip on the marker. */
const etaChipText = (etaLabel: string) => (/\d/.test(etaLabel) ? etaLabel : "");

/**
 * The technician: their vehicle in a white disc, a pointer on its rim that turns with
 * their direction of travel, and the minutes left above it while there is a figure.
 */
const createTechnicianMarkerHtml = (
  etaLabel: string,
  { vehicle = "bike", hasHeading = false, stale = false }: { vehicle?: "bike" | "tow"; hasHeading?: boolean; stale?: boolean } = {},
) => `
  <div class="mappls-marker-shell tracking-tech-marker${hasHeading ? " has-heading" : ""}${stale ? " is-stale" : ""}" data-tracking-marker="technician">
    ${etaChipText(etaLabel) ? `<span class="tracking-tech-marker__eta">${escapeHtml(etaChipText(etaLabel))}</span>` : ""}
    <span class="tracking-tech-marker__pulse"></span>
    <span class="tracking-tech-marker__vehicle" aria-hidden="true"><i></i></span>
    <span class="tracking-tech-marker__badge"><span class="rq-symbol" aria-hidden="true">${TECHNICIAN_GLYPH[vehicle]}</span></span>
  </div>
`;

function distanceMeters(from: MapPoint, to: MapPoint) {
  const earthRadiusMeters = 6_371_000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) *
      Math.sin(deltaLng / 2) ** 2;
  return 2 * earthRadiusMeters * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function samePoint(left: MapPoint, right: MapPoint) {
  return Math.abs(left.lat - right.lat) < 0.000001 && Math.abs(left.lng - right.lng) < 0.000001;
}

function useInterpolatedPoint(
  target: TrackingPlaybackPoint | null,
  reduceMotion: boolean,
  isConnected: boolean,
) {
  const controllerRef = useRef<LiveTrackingPlaybackController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new LiveTrackingPlaybackController();
    if (target) {
      controllerRef.current.push(target, performance.now());
      logLiveTrackingDiagnostic('[RT-PLAYBACK]', 'authoritative_input', {
        sequenceId: target.sequenceId ?? null,
        lat: target.lat,
        lng: target.lng,
        recordedAtMs: target.recordedAtMs ?? null,
        accepted: true,
        ...controllerRef.current.diagnosticSnapshot(),
      });
    }
  }
  const [frame, setFrame] = useState<TrackingPlaybackFrame>(() =>
    controllerRef.current!.frame(performance.now(), isConnected),
  );

  useEffect(() => {
    if (!target) return;
    if (reduceMotion) {
      setFrame({
        position: { lat: target.lat, lng: target.lng },
        bearing: Number.isFinite(Number(target.heading)) ? Number(target.heading) : null,
        freshness: "LIVE",
        isPredicting: false,
        isRepositioning: false,
      });
      return;
    }
    const accepted = controllerRef.current!.push(target, performance.now());
    logLiveTrackingDiagnostic('[RT-PLAYBACK]', 'authoritative_input', {
      sequenceId: target.sequenceId ?? null,
      lat: target.lat,
      lng: target.lng,
      recordedAtMs: target.recordedAtMs ?? null,
      accepted,
      ...controllerRef.current!.diagnosticSnapshot(),
    });
  }, [reduceMotion, target]);

  useEffect(() => {
    if (reduceMotion) return;
    let frameId = 0;
    const renderFrame = (now: number) => {
      setFrame(controllerRef.current!.frame(now, isConnected));
      frameId = window.requestAnimationFrame(renderFrame);
    };
    frameId = window.requestAnimationFrame(renderFrame);
    return () => window.cancelAnimationFrame(frameId);
  }, [isConnected, reduceMotion]);

  return frame;
}

const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  techLocation,
  technicianSpeed,
  technicianHeading,
  technicianAccuracy,
  technicianRecordedAt,
  technicianSequenceId,
  trackingFreshness,
  userLocation,
  dropLocation,
  eta,
  className,
  variant = "card",
  status,
  distanceLabel,
  mapMode = "balanced",
  onInteract,
  routePolyline,
  routeDestination,
  showRoutePath = true,
  showStatusOverlay = true,
  trackingSessionId,
  technicianVehicle = "bike",
  userLabel = "You",
  dropLabel = "Drop",
}) => {
  const reduceMotion = Boolean(useReducedMotion());
  const playbackTarget = useMemo<TrackingPlaybackPoint | null>(() => {
    if (!techLocation) return null;
    return {
      lat: techLocation.lat,
      lng: techLocation.lng,
      speed: technicianSpeed,
      heading: technicianHeading,
      accuracy: technicianAccuracy,
      recordedAtMs: technicianRecordedAt,
      sequenceId: technicianSequenceId,
    };
  }, [
    techLocation,
    technicianAccuracy,
    technicianHeading,
    technicianRecordedAt,
    technicianSequenceId,
    technicianSpeed,
  ]);
  const playback = useInterpolatedPoint(
    playbackTarget,
    reduceMotion,
    trackingFreshness !== "RECONNECTING",
  );
  const displayedTechLocation = playback.position;

  useEffect(() => {
    if (!displayedTechLocation) return;
    logLiveTrackingDiagnostic('[RT-PLAYBACK]', 'playback_frame', {
      lat: displayedTechLocation.lat,
      lng: displayedTechLocation.lng,
      bearing: playback.bearing ?? null,
      freshness: playback.freshness,
      isPredicting: playback.isPredicting,
      isRepositioning: playback.isRepositioning,
    });
  }, [displayedTechLocation?.lat, displayedTechLocation?.lng, playback.bearing, playback.freshness]);
  const [routePath, setRoutePath] = useState<Array<[number, number]>>([]);
  const [autoFrame, setAutoFrame] = useState(true);
  const [initialCameraRevision, setInitialCameraRevision] = useState(0);
  const [followCameraRevision, setFollowCameraRevision] = useState(0);
  const [followCenter, setFollowCenter] = useState<MapPoint | null>(null);
  const initialCameraPointsRef = useRef<MapPoint[] | null>(null);
  const lastFollowRef = useRef<{ center: MapPoint; updatedAt: number } | null>(null);
  const lastRouteRequestRef = useRef<{
    origin: MapPoint;
    destination: MapPoint;
    requestedAt: number;
  } | null>(null);
  const routeRequestVersionRef = useRef(0);

  useEffect(() => {
    logLiveTrackingDiagnostic('[RT-MAP-CAMERA-VERIFY]', 'camera_state', {
      autoFrame,
      mapMode,
      variant,
      displayedTechLat: displayedTechLocation?.lat ?? null,
      displayedTechLng: displayedTechLocation?.lng ?? null,
    });
  }, [autoFrame, displayedTechLocation?.lat, displayedTechLocation?.lng, mapMode, variant]);

  const activeRouteDestination = useMemo<MapPoint | null>(
    () => routeDestination ? { lat: routeDestination.lat, lng: routeDestination.lng } : null,
    [routeDestination],
  );
  const advancedTrackingDestination = activeRouteDestination ?? dropLocation ?? userLocation ?? null;
  const advancedTracking = useMemo(() => {
    if (!isMapplsAdvancedTrackingEnabled() || !playbackTarget || !advancedTrackingDestination) {
      return undefined;
    }
    return {
      enabled: true,
      ...(trackingSessionId != null ? { sessionId: trackingSessionId } : {}),
      technician: {
        lat: playbackTarget.lat,
        lng: playbackTarget.lng,
        speed: playbackTarget.speed ?? null,
        heading: playbackTarget.heading ?? null,
        recordedAtMs: playbackTarget.recordedAtMs ?? null,
      },
      destination: advancedTrackingDestination,
    };
  }, [advancedTrackingDestination, playbackTarget, trackingSessionId]);
  const routeWaypoints = useMemo<MapPoint[]>(() => {
    if (techLocation && activeRouteDestination) {
      return [techLocation, activeRouteDestination];
    }

    return [techLocation, userLocation, dropLocation].filter(Boolean) as MapPoint[];
  }, [activeRouteDestination, dropLocation, techLocation, userLocation]);

  const routeFallback = useMemo(() => {
    if (!showRoutePath) return [];
    const positions = routeWaypoints.map(
      (point) => [point.lat, point.lng] as [number, number],
    );
    if (positions.length < 2) return [];

    return positions.slice(1).reduce<Array<[number, number]>>(
      (path, current, index) => {
        const segment = buildRouteCurve(positions[index], current);
        return path.length ? [...path, ...segment.slice(1)] : segment;
      },
      [],
    );
  }, [routeWaypoints, showRoutePath]);

  useEffect(() => {
    if (!showRoutePath) {
      setRoutePath([]);
      lastRouteRequestRef.current = null;
      return;
    }

    // A booking polyline is historical once a technician is moving. The active
    // leg must always start at the latest technician coordinate instead.
    const suppliedRoute = activeRouteDestination && techLocation
      ? []
      : routePolylineFromMetadata({ polyline: routePolyline });
    if (suppliedRoute.length > 1) {
      setRoutePath(suppliedRoute);
      return;
    }

    if (routeWaypoints.length < 2) {
      setRoutePath([]);
      return;
    }

    const origin = routeWaypoints[0];
    const destination = routeWaypoints[routeWaypoints.length - 1];
    const now = Date.now();
    const previousRouteRequest = lastRouteRequestRef.current;
    const destinationChanged = previousRouteRequest
      ? !samePoint(previousRouteRequest.destination, destination)
      : true;
    const technicianMovedEnough = previousRouteRequest
      ? distanceMeters(previousRouteRequest.origin, origin) >= ROUTE_REFRESH_MIN_DISTANCE_METERS
      : true;
    const refreshIntervalElapsed = previousRouteRequest
      ? now - previousRouteRequest.requestedAt >= ROUTE_REFRESH_MIN_INTERVAL_MS
      : true;

    if (!destinationChanged && !technicianMovedEnough && !refreshIntervalElapsed) return;

    lastRouteRequestRef.current = { origin, destination, requestedAt: now };
    const requestVersion = routeRequestVersionRef.current + 1;
    routeRequestVersionRef.current = requestVersion;
    setRoutePath(routeFallback);

    let stale = false;
    void fetchRoute(routeWaypoints, "full")
      .then((route) => {
        if (stale || routeRequestVersionRef.current !== requestVersion) return;
        const coordinates = routePolylineFromMetadata(route);
        if (coordinates.length > 1) setRoutePath(coordinates);
      })
      .catch(() => {
        if (!stale && routeRequestVersionRef.current === requestVersion) setRoutePath(routeFallback);
      });
    return () => {
      stale = true;
    };
  }, [
    activeRouteDestination,
    routeFallback,
    routePolyline,
    routeWaypoints,
    showRoutePath,
    techLocation,
  ]);

  const etaLabel = normalizeEtaLabel(eta) || "Live";
  // An old position is shown for what it is: the marker goes grey with an amber ring.
  const markerFreshness = trackingFreshness ?? playback.freshness;
  const technicianIsStale =
    markerFreshness === "DELAYED" || markerFreshness === "RECONNECTING" || markerFreshness === "OFFLINE";
  const technicianHasHeading = playback.bearing != null && Number.isFinite(playback.bearing);
  const markers = useMemo<MapMarkerSpec[]>(() => {
    const next: MapMarkerSpec[] = [];
    if (userLocation) {
      next.push({
        id: "customer",
        position: userLocation,
        html: createPlaceMarkerHtml(userLabel, "customer"),
        anchor: "center",
        zIndex: 640,
        width: 86,
        height: 92,
        offset: [0, -18],
      });
    }
    if (dropLocation) {
      next.push({
        id: "destination",
        position: dropLocation,
        html: createPlaceMarkerHtml(dropLabel, "drop"),
        anchor: "center",
        zIndex: 620,
        width: 86,
        height: 92,
        offset: [0, -18],
      });
    }
    if (displayedTechLocation && !playback.isRepositioning) {
      next.push({
        id: "technician",
        position: displayedTechLocation,
        html: createTechnicianMarkerHtml(etaLabel, {
          vehicle: technicianVehicle,
          hasHeading: technicianHasHeading,
          stale: technicianIsStale,
        }),
        heading: playback.bearing,
        anchor: "center",
        zIndex: 720,
        width: 108,
        height: 96,
        offset: [0, -18],
      });
    }
    return next;
  }, [
    displayedTechLocation,
    dropLabel,
    dropLocation,
    etaLabel,
    playback.bearing,
    playback.isRepositioning,
    technicianHasHeading,
    technicianIsStale,
    technicianVehicle,
    userLabel,
    userLocation,
  ]);

  const visibleRoute = routePath.length > 1 ? routePath : routeFallback;
  const polylines = useMemo<MapPolylineSpec[]>(() => {
    if (!showRoutePath || visibleRoute.length < 2) return [];
    const points = visibleRoute.map(([lat, lng]) => ({ lat, lng }));
    return [
      {
        id: "route-casing",
        points,
        color: "#ffffff",
        width: 7,
        opacity: 0.86,
      },
      {
        id: "route-primary",
        points,
        color: "#ef4444",
        width: 4,
        opacity: 0.92,
      },
    ];
  }, [showRoutePath, visibleRoute]);

  const cameraPoints = useMemo(
    () => activeRouteDestination
      ? [techLocation, activeRouteDestination].filter(Boolean) as MapPoint[]
      : [techLocation, userLocation, dropLocation].filter(Boolean) as MapPoint[],
    [activeRouteDestination, dropLocation, techLocation, userLocation],
  );
  // What the frame is drawn for: whether a technician is on the map, and the place they are
  // heading to. It does not change as the technician moves, so the frame stays still then.
  const place = (point: MapPoint | null | undefined) => (point ? `${point.lat},${point.lng}` : "-");
  const frameSubject = [
    techLocation ? "technician" : "-",
    place(activeRouteDestination),
    place(userLocation),
    place(dropLocation),
  ].join("|");
  const framedSubjectRef = useRef<string | null>(null);
  useEffect(() => {
    if (cameraPoints.length === 0) return;
    if (!initialCameraPointsRef.current) {
      initialCameraPointsRef.current = cameraPoints;
      framedSubjectRef.current = frameSubject;
      setInitialCameraRevision((revision) => revision + 1);
      return;
    }
    if (framedSubjectRef.current === frameSubject) return;
    framedSubjectRef.current = frameSubject;
    // A technician was assigned after the page opened, or a tow turned towards the drop:
    // both ends go on screen again. Not if the customer has moved the map themselves;
    // Recentre does it for them then.
    if (!autoFrame) return;
    initialCameraPointsRef.current = cameraPoints;
    setInitialCameraRevision((revision) => revision + 1);
  }, [autoFrame, cameraPoints, frameSubject]);

  useEffect(() => {
    if (
      !autoFrame ||
      variant !== "fullscreen" ||
      mapMode !== "map" ||
      !displayedTechLocation
    ) {
      return;
    }
    const now = performance.now();
    const previous = lastFollowRef.current;
    if (
      previous &&
      distanceMeters(previous.center, displayedTechLocation) < 12 &&
      now - previous.updatedAt < 750
    ) {
      return;
    }
    const center = { ...displayedTechLocation };
    lastFollowRef.current = { center, updatedAt: now };
    setFollowCenter(center);
    setFollowCameraRevision((revision) => revision + 1);
  }, [
    autoFrame,
    displayedTechLocation,
    displayedTechLocation?.lat,
    displayedTechLocation?.lng,
    mapMode,
    variant,
  ]);

  const topPadding = variant === "fullscreen" ? 180 : 48;
  const bottomPadding =
    variant === "fullscreen"
      ? mapMode === "sheet"
        ? 420
        : mapMode === "balanced"
          ? 300
          : 136
      : 72;
  // The camera the map was last given while it was placing itself.
  const selfPlacedCameraRef = useRef<MapCameraSpec | null>(null);
  const camera = useMemo<MapCameraSpec>(() => {
    // Once the customer has moved the map it is theirs. The map keeps the camera it
    // already has, so it is not pulled back to the overview, until they tap Recentre.
    if (!autoFrame && selfPlacedCameraRef.current) return selfPlacedCameraRef.current;
    const points = initialCameraPointsRef.current ?? cameraPoints;
    const next: MapCameraSpec =
      autoFrame && variant === "fullscreen" && mapMode === "map" && followCenter
        ? {
            mode: "follow",
            center: followCenter,
            zoom: 15,
            bearing: 0,
            pitch: 0,
            revision: followCameraRevision,
          }
        : {
            mode: "fit",
            points: points.length ? points : [FALLBACK_CENTER],
            padding: { top: topPadding, right: 24, bottom: bottomPadding, left: 24 },
            maxZoom: points.length > 1 ? 15 : points.length === 1 ? 14 : 5,
            revision: initialCameraRevision,
          };
    selfPlacedCameraRef.current = next;
    return next;
  }, [
    autoFrame,
    bottomPadding,
    cameraPoints,
    followCameraRevision,
    followCenter,
    initialCameraRevision,
    mapMode,
    topPadding,
    variant,
  ]);

  const handleInteract = () => {
    setAutoFrame(false);
    onInteract?.();
  };

  const recenter = () => {
    initialCameraPointsRef.current = cameraPoints.length ? cameraPoints : [FALLBACK_CENTER];
    setInitialCameraRevision((revision) => revision + 1);
    if (displayedTechLocation) {
      const center = { ...displayedTechLocation };
      lastFollowRef.current = { center, updatedAt: performance.now() };
      setFollowCenter(center);
      setFollowCameraRevision((revision) => revision + 1);
    }
    setAutoFrame(true);
  };

  const map = (
    <MapplsMapSurface
      ariaLabel="Live service tracking map"
      markers={markers}
      polylines={polylines}
      circles={NO_CIRCLES}
      camera={camera}
      cameraDiagnostics={{ autoFrame, mapMode }}
      advancedTracking={advancedTracking}
      className="tracking-live-map h-full w-full"
      onInteract={variant === "fullscreen" ? handleInteract : undefined}
    />
  );

  if (variant === "fullscreen") {
    const statusLabel = normalizeStatusLabel(status);
    const effectiveFreshness = trackingFreshness ?? playback.freshness;
    const freshnessLabels: Record<TrackingFreshness, string> = {
      LIVE: distanceLabel || normalizeEtaLabel(eta) || "Live location",
      UPDATING: "Updating technician location",
      DELAYED: "Location update delayed",
      RECONNECTING: "Reconnecting live tracking",
      OFFLINE: "Technician location is unavailable",
    };
    const supportingLabel = freshnessLabels[effectiveFreshness];
    const freshnessColor = effectiveFreshness === "LIVE"
      ? "text-emerald-600"
      : effectiveFreshness === "DELAYED" || effectiveFreshness === "RECONNECTING"
        ? "text-amber-600"
        : "text-slate-600";
    const freshnessDot = effectiveFreshness === "LIVE"
      ? "bg-emerald-500"
      : effectiveFreshness === "DELAYED" || effectiveFreshness === "RECONNECTING"
        ? "bg-amber-500"
        : "bg-slate-400";
    return (
      <div className={cn("relative h-full w-full overflow-hidden", className)}>
        {map}
        <div
          className="pointer-events-none absolute inset-0 z-[380]"
          style={{
            background:
              "radial-gradient(circle at top center, rgba(255,255,255,0.82), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08) 38%, rgba(238,242,248,0.38) 100%)",
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-4 z-[410]"
          style={{ top: "calc(env(safe-area-inset-top) + 6.75rem)" }}
        >
          {showStatusOverlay ? (
            <div className="pointer-events-auto inline-block rounded-[1.5rem] border border-white/80 bg-white/92 px-4 py-3 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.4)] backdrop-blur-xl">
              <div className={cn("flex items-center gap-2 text-[15px] font-bold", freshnessColor)}>
                <span className={cn("h-2.5 w-2.5 rounded-full", freshnessDot)} />
                {statusLabel}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
                <RadioTower className={cn("h-3.5 w-3.5", freshnessColor)} />
                {supportingLabel}
              </div>
            </div>
          ) : null}
        </div>
        <div className="pointer-events-none absolute bottom-20 right-4 z-[410]">
          <button
            type="button"
            onClick={recenter}
            data-testid="live-tracking-recenter"
            className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/75 bg-white/92 text-slate-700 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.4)] backdrop-blur-xl transition hover:bg-white"
            aria-label="Recenter live tracking map"
          >
            <LocateFixed className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <Card className={cn("overflow-hidden border-0 shadow-lg ring-1 ring-slate-900/5", className)}>
      <CardContent className="relative h-[320px] p-0">{map}</CardContent>
    </Card>
  );
};

export default LiveTrackingMap;
