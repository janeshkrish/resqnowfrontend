import React, { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { LocateFixed, RadioTower } from "lucide-react";

import { fetchRoute, routePolylineFromMetadata } from "@/lib/geo";
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
  showRoutePath?: boolean;
}

const FALLBACK_CENTER: MapPoint = { lat: 20.5937, lng: 78.9629 };

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

const destinationMarkerHtml = `
  <div class="mappls-marker-shell tracking-destination-marker">
    <span class="tracking-destination-marker__ripple tracking-destination-marker__ripple--outer"></span>
    <span class="tracking-destination-marker__ripple tracking-destination-marker__ripple--inner"></span>
    <span class="tracking-destination-marker__pin">
      <span class="tracking-destination-marker__pin-core"></span>
    </span>
  </div>
`;

const createTechnicianMarkerHtml = (etaLabel: string) => `
  <div class="mappls-marker-shell tracking-tech-marker">
    <div class="tracking-tech-marker__bubble">
      <span class="tracking-tech-marker__badge"></span>
      <div class="tracking-tech-marker__copy">
        <span>${escapeHtml(etaLabel || "Live")}</span>
        <small>Technician</small>
      </div>
    </div>
    <span class="tracking-tech-marker__pulse"></span>
    <span class="tracking-tech-marker__pin"></span>
  </div>
`;

function coordinateRevision(points: MapPoint[]) {
  return points.reduce(
    (revision, point) =>
      revision + Math.round(point.lat * 10_000) * 31 + Math.round(point.lng * 10_000),
    points.length,
  );
}

function useInterpolatedPoint(target: MapPoint | null, reduceMotion: boolean) {
  const [displayed, setDisplayed] = useState<MapPoint | null>(target);
  const displayedRef = useRef<MapPoint | null>(target);

  useEffect(() => {
    if (!target || !displayedRef.current || reduceMotion) {
      displayedRef.current = target;
      setDisplayed(target);
      return;
    }

    const from = displayedRef.current;
    const startedAt = performance.now();
    let frameId = 0;
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / 900);
      const eased = 1 - (1 - progress) ** 3;
      const next = {
        lat: from.lat + (target.lat - from.lat) * eased,
        lng: from.lng + (target.lng - from.lng) * eased,
      };
      displayedRef.current = next;
      setDisplayed(next);
      if (progress < 1) frameId = window.requestAnimationFrame(animate);
    };
    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [reduceMotion, target]);

  return displayed;
}

const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  techLocation,
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
  showRoutePath = true,
}) => {
  const reduceMotion = Boolean(useReducedMotion());
  const displayedTechLocation = useInterpolatedPoint(techLocation, reduceMotion);
  const [routePath, setRoutePath] = useState<Array<[number, number]>>([]);
  const [recenterKey, setRecenterKey] = useState(0);
  const [autoFrame, setAutoFrame] = useState(true);
  const lockedCameraRevisionRef = useRef<number | null>(null);

  const techPosition = useMemo<[number, number] | null>(
    () => displayedTechLocation
      ? [displayedTechLocation.lat, displayedTechLocation.lng]
      : null,
    [displayedTechLocation],
  );
  const userPosition = useMemo<[number, number] | null>(
    () => userLocation ? [userLocation.lat, userLocation.lng] : null,
    [userLocation],
  );
  const dropPosition = useMemo<[number, number] | null>(
    () => dropLocation ? [dropLocation.lat, dropLocation.lng] : null,
    [dropLocation],
  );

  const routeFallback = useMemo(() => {
    if (!showRoutePath) return [];
    if (techPosition && userPosition && dropPosition) {
      return [
        ...buildRouteCurve(techPosition, userPosition),
        ...buildRouteCurve(userPosition, dropPosition).slice(1),
      ];
    }
    if (techPosition && userPosition) return buildRouteCurve(techPosition, userPosition);
    if (userPosition && dropPosition) return buildRouteCurve(userPosition, dropPosition);
    return [];
  }, [dropPosition, showRoutePath, techPosition, userPosition]);

  useEffect(() => {
    if (!showRoutePath) {
      setRoutePath([]);
      return;
    }

    const suppliedRoute = routePolylineFromMetadata({ polyline: routePolyline });
    if (suppliedRoute.length > 1) {
      setRoutePath(suppliedRoute);
      return;
    }

    const waypoints = [techLocation, userLocation, dropLocation].filter(Boolean) as MapPoint[];
    if (waypoints.length < 2) {
      setRoutePath([]);
      return;
    }

    const waypointPositions = waypoints.map(
      (point) => [point.lat, point.lng] as [number, number],
    );
    const fallbackPath = waypointPositions.slice(1).reduce<Array<[number, number]>>(
      (path, current, index) => {
        const segment = buildRouteCurve(waypointPositions[index], current);
        return path.length ? [...path, ...segment.slice(1)] : segment;
      },
      [],
    );
    setRoutePath(fallbackPath);

    let stale = false;
    void fetchRoute(waypoints, "full")
      .then((route) => {
        if (stale) return;
        const coordinates = routePolylineFromMetadata(route);
        if (coordinates.length > 1) setRoutePath(coordinates);
      })
      .catch(() => {
        if (!stale) setRoutePath(fallbackPath);
      });
    return () => {
      stale = true;
    };
  }, [dropLocation, routePolyline, showRoutePath, techLocation, userLocation]);

  const etaLabel = normalizeEtaLabel(eta) || "Live";
  const markers = useMemo<MapMarkerSpec[]>(() => {
    const next: MapMarkerSpec[] = [];
    if (userLocation) {
      next.push({
        id: "customer",
        position: userLocation,
        html: destinationMarkerHtml,
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
        html: destinationMarkerHtml,
        anchor: "center",
        zIndex: 620,
        width: 86,
        height: 92,
        offset: [0, -18],
      });
    }
    if (displayedTechLocation) {
      next.push({
        id: "technician",
        position: displayedTechLocation,
        html: createTechnicianMarkerHtml(etaLabel),
        anchor: "center",
        zIndex: 720,
        width: 108,
        height: 96,
        offset: [0, -18],
      });
    }
    return next;
  }, [displayedTechLocation, dropLocation, etaLabel, userLocation]);

  const circles = useMemo<MapCircleSpec[]>(() => {
    const next: MapCircleSpec[] = [];
    if (userLocation) {
      next.push(
        {
          id: "customer-radius-outer",
          center: userLocation,
          radiusMeters: 230,
          fillColor: "#60a5fa",
          fillOpacity: 0.08,
        },
        {
          id: "customer-radius-inner",
          center: userLocation,
          radiusMeters: 120,
          fillColor: "#3b82f6",
          fillOpacity: 0.12,
        },
      );
    }
    if (displayedTechLocation) {
      next.push({
        id: "technician-radius",
        center: displayedTechLocation,
        radiusMeters: 170,
        fillColor: "#ef4444",
        fillOpacity: 0.08,
      });
    }
    return next;
  }, [displayedTechLocation, userLocation]);

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
    () => [techLocation, userLocation, dropLocation].filter(Boolean) as MapPoint[],
    [dropLocation, techLocation, userLocation],
  );
  const baseCameraRevision =
    coordinateRevision(cameraPoints) +
    recenterKey * 10_000_000 +
    (mapMode === "sheet" ? 2 : mapMode === "balanced" ? 1 : 0);
  const cameraRevision = autoFrame
    ? baseCameraRevision
    : (lockedCameraRevisionRef.current ?? baseCameraRevision);
  const topPadding = variant === "fullscreen" ? 180 : 48;
  const bottomPadding =
    variant === "fullscreen"
      ? mapMode === "sheet"
        ? 420
        : mapMode === "balanced"
          ? 300
          : 136
      : 72;
  const camera = useMemo<MapCameraSpec>(
    () => ({
      mode: "fit",
      points: cameraPoints.length ? cameraPoints : [FALLBACK_CENTER],
      padding: { top: topPadding, right: 24, bottom: bottomPadding, left: 24 },
      maxZoom: cameraPoints.length > 1 ? 15 : cameraPoints.length === 1 ? 14 : 5,
      revision: cameraRevision,
    }),
    [bottomPadding, cameraPoints, cameraRevision, topPadding],
  );

  const handleInteract = () => {
    lockedCameraRevisionRef.current = cameraRevision;
    setAutoFrame(false);
    onInteract?.();
  };

  const recenter = () => {
    lockedCameraRevisionRef.current = null;
    setAutoFrame(true);
    setRecenterKey((current) => current + 1);
  };

  const map = (
    <MapplsMapSurface
      ariaLabel="Live service tracking map"
      markers={markers}
      polylines={polylines}
      circles={circles}
      camera={camera}
      className="tracking-live-map h-full w-full"
      onInteract={variant === "fullscreen" && onInteract ? handleInteract : undefined}
    />
  );

  if (variant === "fullscreen") {
    const statusLabel = normalizeStatusLabel(status);
    const supportingLabel = distanceLabel || normalizeEtaLabel(eta) || "Live location";
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
          <div className="flex items-start justify-between gap-3">
            <div className="pointer-events-auto rounded-[1.5rem] border border-white/80 bg-white/92 px-4 py-3 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.4)] backdrop-blur-xl">
              <div className="flex items-center gap-2 text-[15px] font-bold text-emerald-600">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                {statusLabel}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
                <RadioTower className="h-3.5 w-3.5 text-emerald-500" />
                {supportingLabel}
              </div>
            </div>
            <button
              type="button"
              onClick={recenter}
              className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/75 bg-white/92 text-slate-700 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.4)] backdrop-blur-xl transition hover:bg-white"
              aria-label="Recenter live tracking map"
            >
              <LocateFixed className="h-5 w-5" />
            </button>
          </div>
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
