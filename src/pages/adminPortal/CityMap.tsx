import { useMemo, useRef } from "react";
import { MapplsMapSurface } from "@/lib/mapProvider/MapplsMapSurface";
import type { MapCameraSpec, MapMarkerSpec } from "@/lib/mapProvider/types";

export type CityPin = { id: string; lat: number; lng: number; tone: "" | "warn" | "hot" | "ok" | "soft"; icon: string; tag?: string | null; tagWarn?: boolean; label: string; onClick?: () => void };
export type CityDot = { id: string; lat: number; lng: number; label: string };

const COIMBATORE = { lat: 11.0168, lng: 76.9558 };
const escape = (text: string) => text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);

/** One map for the whole city: every live job and every free technician. It re-frames only when the set of jobs changes. */
export function CityMap({ pins, dots, onUnavailable }: { pins: CityPin[]; dots: CityDot[]; onUnavailable?: () => void }) {
  const markers = useMemo<MapMarkerSpec[]>(() => [
    ...dots.map((dot) => ({ id: dot.id, position: { lat: dot.lat, lng: dot.lng }, html: `<span class="cm-dot" title="${escape(dot.label)}"></span>`, width: 12, height: 12, zIndex: 100 })),
    ...pins.map((pin) => ({
      id: pin.id,
      position: { lat: pin.lat, lng: pin.lng },
      html: `<span class="cm-pin${pin.tone ? ` is-${pin.tone}` : ""}" role="button" aria-label="${escape(pin.label)}"><span class="rq-symbol" aria-hidden="true">${pin.icon}</span>${pin.tag ? `<span class="cm-tag${pin.tagWarn ? " is-warn" : ""}">${escape(pin.tag)}</span>` : ""}</span>`,
      width: 30, height: 30, zIndex: pin.tone === "warn" ? 400 : 300,
      onClick: pin.onClick,
    })),
  ], [pins, dots]);

  const key = [...pins.map((pin) => pin.id)].sort().join(",");
  const camera = useRef<{ key: string; revision: number; points: { lat: number; lng: number }[] }>({ key: "", revision: 0, points: [COIMBATORE] });
  if (camera.current.key !== key) {
    const points = [...pins, ...dots].map((item) => ({ lat: item.lat, lng: item.lng }));
    camera.current = { key, revision: camera.current.revision + 1, points: points.length ? points : [COIMBATORE] };
  }
  const spec: MapCameraSpec = { mode: "fit", points: camera.current.points, padding: { top: 48, right: 32, bottom: 64, left: 32 }, maxZoom: 14, revision: camera.current.revision };
  return (
    <MapplsMapSurface
      ariaLabel="Live jobs and free technicians across the city"
      className="h-full w-full"
      markers={markers}
      polylines={[]}
      circles={[]}
      camera={spec}
      onUnavailable={onUnavailable}
      fallbackDescription="The map could not load. Every live job is listed under Live requests."
    />
  );
}
