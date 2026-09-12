import { useMemo, useRef } from "react";
import { MapplsMapSurface } from "@/lib/mapProvider/MapplsMapSurface";
import type { MapCameraSpec, MapCircleSpec, MapMarkerSpec, MapPoint, MapPolylineSpec } from "@/lib/mapProvider/types";

type Position = [number, number];
type TechnicianPosition = { id: string; latitude: number; longitude: number };
type Props<T extends TechnicianPosition> = {
  center: Position;
  userPosition: Position | null;
  activeTechPosition: Position | null;
  technicians: T[];
  selectedTechId?: string;
  routePath: Position[];
  bottomPadding: number;
  rightPadding: number;
  onSelect: (technician: T) => void;
  onInteract?: () => void;
};
const point = ([lat, lng]: Position): MapPoint => ({ lat, lng });
const userHtml = '<div style="width:20px;height:20px;background:#4285f4;border:3px solid white;border-radius:50%;box-shadow:0 0 8px #0005"></div>';
const technicianHtml = (selected: boolean) => `<svg width="28" height="40" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 5px #0004)">
  <path d="M12 0C5.37 0 0 5.37 0 12C0 21 12 36 12 36S24 21 24 12C24 5.37 18.63 0 12 0Z" fill="${selected ? "#ea4335" : "#1a73e8"}"/>
  <circle cx="12" cy="12" r="5" fill="white"/></svg>`;

export function NearbyMapCanvas<T extends TechnicianPosition>({
  center, userPosition, activeTechPosition, technicians, selectedTechId,
  routePath, bottomPadding, rightPadding, onSelect, onInteract,
}: Props<T>) {
  const markers = useMemo<MapMarkerSpec[]>(() => [
    ...(userPosition ? [{ id: "user", position: point(userPosition), html: userHtml, width: 20, height: 20, zIndex: 600 }] : []),
    ...technicians.map((tech) => ({
      id: `tech-${tech.id}`,
      position: { lat: tech.latitude, lng: tech.longitude },
      html: technicianHtml(tech.id === selectedTechId),
      width: 28, height: 40, offset: [0, -20] as Position,
      zIndex: tech.id === selectedTechId ? 400 : 150,
      onClick: () => onSelect(tech),
    })),
  ], [userPosition, technicians, selectedTechId, onSelect]);
  const circles = useMemo<MapCircleSpec[]>(() => [
    ...(userPosition ? [
      { id: "user-outer", center: point(userPosition), radiusMeters: 240, fillColor: "#fb7185", fillOpacity: 0.08 },
      { id: "user-inner", center: point(userPosition), radiusMeters: 140, fillColor: "#fb7185", fillOpacity: 0.14 },
    ] : []),
    ...(activeTechPosition ? [{ id: "technician-radius", center: point(activeTechPosition), radiusMeters: 180, fillColor: "#34d399", fillOpacity: 0.11 }] : []),
  ], [userPosition, activeTechPosition]);
  const polylines = useMemo<MapPolylineSpec[]>(() => routePath.length < 2 ? [] : [
    { id: "route-casing", points: routePath.map(point), color: "#ffffff", width: 8, opacity: 0.72 },
    { id: "route", points: routePath.map(point), color: "#ff4d5a", width: 4, opacity: 0.92 },
  ], [routePath]);
  const points = [userPosition, activeTechPosition].filter((value): value is Position => value !== null).map(point);
  const cameraKey = JSON.stringify([points, center, bottomPadding, rightPadding]);
  const lastCamera = useRef({ key: "", revision: 0 });
  if (lastCamera.current.key !== cameraKey) {
    lastCamera.current = { key: cameraKey, revision: lastCamera.current.revision + 1 };
  }
  const camera: MapCameraSpec = {
    mode: "fit",
    points: points.length ? points : [point(center)],
    padding: { top: 140, right: rightPadding, bottom: bottomPadding, left: 24 },
    maxZoom: points.length > 1 ? 14 : 13,
    revision: lastCamera.current.revision,
  };
  return <MapplsMapSurface ariaLabel="Nearby technicians map" className="radar-map h-full w-full"
    markers={markers} circles={circles} polylines={polylines} camera={camera} onInteract={onInteract}
    onUnavailable={onInteract} fallbackDescription="You can still browse nearby technicians below." />;
}
