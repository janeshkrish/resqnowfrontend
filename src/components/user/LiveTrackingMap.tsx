import React, { useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useReducedMotion } from "framer-motion";
import { LocateFixed, RadioTower } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { cn } from "@/lib/utils";

type TrackingMapMode = "map" | "balanced" | "sheet";

interface LiveTrackingMapProps {
  techLocation: { lat: number; lng: number } | null;
  userLocation: { lat: number; lng: number } | null;
  eta?: string;
  className?: string;
  variant?: "card" | "fullscreen";
  status?: string;
  distanceLabel?: string;
  mapMode?: TrackingMapMode;
  onInteract?: () => void;
}

const FALLBACK_CENTER: [number, number] = [20.5937, 78.9629];

const normalizeStatusLabel = (status: string | undefined) => {
  const raw = String(status || "")
    .trim()
    .toLowerCase();

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
  String(eta || "")
    .replace(/\bmins?\b/i, "min")
    .trim();

const buildRouteCurve = (from: [number, number], to: [number, number]): [number, number][] => {
  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;
  const latDelta = toLat - fromLat;
  const lngDelta = toLng - fromLng;

  const firstCurve: [number, number] = [
    fromLat + latDelta * 0.24 + lngDelta * 0.07,
    fromLng + lngDelta * 0.24 - latDelta * 0.07,
  ];
  const middleCurve: [number, number] = [
    (fromLat + toLat) / 2 + lngDelta * 0.12,
    (fromLng + toLng) / 2 - latDelta * 0.12,
  ];
  const secondCurve: [number, number] = [
    fromLat + latDelta * 0.76 + lngDelta * 0.03,
    fromLng + lngDelta * 0.76 - latDelta * 0.03,
  ];

  return [from, firstCurve, middleCurve, secondCurve, to];
};

const createDestinationIcon = () =>
  L.divIcon({
    className: "tracking-destination-marker-wrapper",
    html: `
      <div class="tracking-destination-marker">
        <span class="tracking-destination-marker__ripple tracking-destination-marker__ripple--outer"></span>
        <span class="tracking-destination-marker__ripple tracking-destination-marker__ripple--inner"></span>
        <span class="tracking-destination-marker__pin">
          <span class="tracking-destination-marker__pin-core"></span>
        </span>
      </div>
    `,
    iconSize: [86, 92],
    iconAnchor: [43, 74],
  });

const createTechnicianIcon = (etaLabel: string) =>
  L.divIcon({
    className: "tracking-tech-marker-wrapper",
    html: `
      <div class="tracking-tech-marker">
        <div class="tracking-tech-marker__bubble">
          <span class="tracking-tech-marker__badge"></span>
          <div class="tracking-tech-marker__copy">
            <span>${etaLabel || "Live"}</span>
            <small>Technician</small>
          </div>
        </div>
        <span class="tracking-tech-marker__pulse"></span>
        <span class="tracking-tech-marker__pin"></span>
      </div>
    `,
    iconSize: [108, 96],
    iconAnchor: [54, 78],
  });

const destinationIcon = createDestinationIcon();

function MapViewport({
  techLoc,
  userLoc,
  topPadding,
  bottomPadding,
  reduceMotion,
  recenterKey,
}: {
  techLoc: { lat: number; lng: number } | null;
  userLoc: { lat: number; lng: number } | null;
  topPadding: number;
  bottomPadding: number;
  reduceMotion: boolean;
  recenterKey: number;
}) {
  const map = useMap();

  useEffect(() => {
    const invalidateTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 170);

    if (techLoc && userLoc) {
      map.fitBounds(L.latLngBounds([techLoc.lat, techLoc.lng], [userLoc.lat, userLoc.lng]), {
        paddingTopLeft: [24, topPadding],
        paddingBottomRight: [24, bottomPadding],
        maxZoom: 15,
        animate: !reduceMotion,
      });
    } else if (techLoc) {
      map.setView([techLoc.lat, techLoc.lng], 14.3, { animate: !reduceMotion });
    } else if (userLoc) {
      map.setView([userLoc.lat, userLoc.lng], 14, { animate: !reduceMotion });
    } else {
      map.setView(FALLBACK_CENTER, 5, { animate: !reduceMotion });
    }

    return () => {
      window.clearTimeout(invalidateTimer);
    };
  }, [bottomPadding, map, recenterKey, reduceMotion, techLoc, topPadding, userLoc]);

  return null;
}

function MapInteractionBridge({
  enabled,
  onInteract,
}: {
  enabled: boolean;
  onInteract: () => void;
}) {
  useMapEvents(
    enabled
      ? {
          click: onInteract,
          dragstart: onInteract,
          mousedown: onInteract,
          touchstart: onInteract,
          zoomstart: onInteract,
        }
      : {},
  );

  return null;
}

const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({
  techLocation,
  userLocation,
  eta,
  className,
  variant = "card",
  status,
  distanceLabel,
  mapMode = "balanced",
  onInteract,
}) => {
  const reduceMotion = useReducedMotion();
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [recenterKey, setRecenterKey] = useState(0);

  const techPosition = useMemo<[number, number] | null>(
    () => (techLocation ? [techLocation.lat, techLocation.lng] : null),
    [techLocation],
  );
  const userPosition = useMemo<[number, number] | null>(
    () => (userLocation ? [userLocation.lat, userLocation.lng] : null),
    [userLocation],
  );

  const routeFallback = useMemo(
    () => (techPosition && userPosition ? buildRouteCurve(techPosition, userPosition) : []),
    [techPosition, userPosition],
  );

  const techIcon = useMemo(() => createTechnicianIcon(normalizeEtaLabel(eta) || "Live"), [eta]);

  useEffect(() => {
    if (!techLocation || !userLocation) {
      setRoutePath([]);
      return;
    }

    const fallbackPath = buildRouteCurve(
      [techLocation.lat, techLocation.lng],
      [userLocation.lat, userLocation.lng],
    );
    setRoutePath(fallbackPath);

    const controller = new AbortController();

    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${techLocation.lng},${techLocation.lat};${userLocation.lng},${userLocation.lat}?overview=full&geometries=geojson`;
        const response = await fetch(url, { signal: controller.signal });
        const data = await response.json();
        const coordinates = Array.isArray(data?.routes?.[0]?.geometry?.coordinates)
          ? data.routes[0].geometry.coordinates.map((entry: number[]) => [entry[1], entry[0]] as [number, number])
          : [];

        if (coordinates.length > 1) {
          setRoutePath(coordinates);
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setRoutePath(fallbackPath);
        }
      }
    };

    void fetchRoute();

    return () => {
      controller.abort();
    };
  }, [techLocation, userLocation]);

  const mapCenter: [number, number] = userPosition || techPosition || FALLBACK_CENTER;
  const statusLabel = normalizeStatusLabel(status);
  const supportingLabel = distanceLabel || normalizeEtaLabel(eta) || "Live location";
  const topPadding = variant === "fullscreen" ? 180 : 48;
  const bottomPadding =
    variant === "fullscreen"
      ? mapMode === "sheet"
        ? 420
        : mapMode === "balanced"
          ? 300
          : 136
      : 72;

  const renderMap = () => (
    <MapContainer
      center={mapCenter}
      zoom={14}
      className="tracking-live-map h-full w-full"
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom
      dragging
      touchZoom
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

      <MapInteractionBridge enabled={variant === "fullscreen" && Boolean(onInteract)} onInteract={onInteract || (() => undefined)} />

      <MapViewport
        techLoc={techLocation}
        userLoc={userLocation}
        topPadding={topPadding}
        bottomPadding={bottomPadding}
        reduceMotion={Boolean(reduceMotion)}
        recenterKey={recenterKey}
      />

      {userPosition && (
        <>
          <Circle
            center={userPosition}
            radius={230}
            pathOptions={{ color: "transparent", fillColor: "#60a5fa", fillOpacity: 0.08 }}
          />
          <Circle
            center={userPosition}
            radius={120}
            pathOptions={{ color: "transparent", fillColor: "#3b82f6", fillOpacity: 0.12 }}
          />
          <Marker position={userPosition} icon={destinationIcon} zIndexOffset={640} />
        </>
      )}

      {techPosition && (
        <>
          <Circle
            center={techPosition}
            radius={170}
            pathOptions={{ color: "transparent", fillColor: "#ef4444", fillOpacity: 0.08 }}
          />
          <Marker position={techPosition} icon={techIcon} zIndexOffset={720} />
        </>
      )}

      {(routePath.length > 1 ? routePath : routeFallback).length > 1 && (
        <>
          <Polyline
            positions={routePath.length > 1 ? routePath : routeFallback}
            pathOptions={{
              color: "rgba(255,255,255,0.86)",
              weight: 7,
              opacity: 0.7,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
          <Polyline
            positions={routePath.length > 1 ? routePath : routeFallback}
            pathOptions={{
              color: "#ef4444",
              weight: 4,
              opacity: 0.92,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </>
      )}
    </MapContainer>
  );

  if (variant === "fullscreen") {
    return (
      <div className={cn("relative h-full w-full overflow-hidden", className)}>
        {renderMap()}

        <div
          className="pointer-events-none absolute inset-0 z-[380]"
          style={{
            background:
              "radial-gradient(circle at top center, rgba(255,255,255,0.82), transparent 26%), linear-gradient(180deg, rgba(255,255,255,0.18), rgba(255,255,255,0.08) 38%, rgba(238,242,248,0.38) 100%)",
          }}
        />

        <div className="pointer-events-none absolute inset-x-4 z-[410]" style={{ top: "calc(env(safe-area-inset-top) + 6.75rem)" }}>
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
              onClick={() => setRecenterKey((current) => current + 1)}
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
      <CardContent className="relative h-[320px] p-0">
        {renderMap()}
      </CardContent>
    </Card>
  );
};

export default LiveTrackingMap;
