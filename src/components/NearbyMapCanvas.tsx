import { useCallback, useEffect, useMemo, useRef } from "react";
import { MapplsMapSurface } from "@/lib/mapProvider/MapplsMapSurface";
import type { MapCameraSpec, MapCircleSpec, MapMarkerSpec, MapPoint } from "@/lib/mapProvider/types";

type Position = [number, number];

/** A static point of interest on the radar (technician, charger or fuel pump). */
export type RadarPin = {
  id: string;
  lat: number;
  lng: number;
  html: string;
  width: number;
  height: number;
  anchor?: "center" | "bottom";
  zIndex?: number;
  onClick?: () => void;
};

type Props = {
  center: Position;
  userPosition: Position | null;
  pins: RadarPin[];
  /** Points the camera keeps in view along with the customer. */
  focus: Position[];
  topPadding: number;
  bottomPadding: number;
  rightPadding: number;
  /** A tap on the map itself, not on a pin. */
  onMapTap?: () => void;
  onUnavailable?: () => void;
  ariaLabel?: string;
  fallbackDescription?: string;
};

const point = ([lat, lng]: Position): MapPoint => ({ lat, lng });
const userHtml = '<div class="rqr-me" aria-hidden="true"></div>';
// Mappls reports a pin tap to the map as well; a map tap this soon after a pin tap is the same tap.
const PIN_TAP_WINDOW_MS = 350;

export function NearbyMapCanvas({
  center, userPosition, pins, focus, topPadding, bottomPadding, rightPadding,
  onMapTap, onUnavailable, ariaLabel = "Live radar map", fallbackDescription = "You can still browse everything nearby below.",
}: Props) {
  const lastPinTap = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(tapTimer.current), []);

  const markers = useMemo<MapMarkerSpec[]>(() => [
    ...(userPosition ? [{ id: "user", position: point(userPosition), html: userHtml, width: 22, height: 22, zIndex: 600 }] : []),
    ...pins.map((pin) => ({
      id: pin.id,
      position: { lat: pin.lat, lng: pin.lng },
      html: pin.html,
      width: pin.width,
      height: pin.height,
      anchor: pin.anchor ?? "center",
      zIndex: pin.zIndex ?? 150,
      onClick: () => {
        lastPinTap.current = Date.now();
        pin.onClick?.();
      },
    })),
  ], [userPosition, pins]);

  const circles = useMemo<MapCircleSpec[]>(() => userPosition ? [
    { id: "user-outer", center: point(userPosition), radiusMeters: 260, fillColor: "#283048", fillOpacity: 0.05 },
    { id: "user-inner", center: point(userPosition), radiusMeters: 120, fillColor: "#283048", fillOpacity: 0.09 },
  ] : [], [userPosition]);

  const handleMapClick = useCallback(() => {
    if (!onMapTap) return;
    clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      if (Date.now() - lastPinTap.current > PIN_TAP_WINDOW_MS) onMapTap();
    }, 120);
  }, [onMapTap]);

  const points = [userPosition, ...focus].filter((value): value is Position => value !== null).map(point);
  const cameraKey = JSON.stringify([points, center, topPadding, bottomPadding, rightPadding]);
  const lastCamera = useRef({ key: "", revision: 0 });
  if (lastCamera.current.key !== cameraKey) {
    lastCamera.current = { key: cameraKey, revision: lastCamera.current.revision + 1 };
  }
  const camera: MapCameraSpec = {
    mode: "fit",
    points: points.length ? points : [point(center)],
    padding: { top: topPadding, right: rightPadding, bottom: bottomPadding, left: 24 },
    maxZoom: points.length > 1 ? 15 : 14,
    revision: lastCamera.current.revision,
  };
  return (
    <MapplsMapSurface
      ariaLabel={ariaLabel}
      className="radar-map h-full w-full"
      markers={markers}
      circles={circles}
      polylines={[]}
      camera={camera}
      onMapClick={handleMapClick}
      onUnavailable={onUnavailable}
      fallbackDescription={fallbackDescription}
    />
  );
}
