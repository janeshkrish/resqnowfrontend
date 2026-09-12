import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { initializeMapplsSdk } from "./mapplsSdk";
import type {
  MapCameraSpec,
  MapCircleSpec,
  MapMarkerSpec,
  MapplsLayer,
  MapplsMap,
  MapplsMarker,
  MapplsRuntime,
  MapPolylineSpec,
} from "./types";

type MapplsMapSurfaceProps = {
  ariaLabel: string;
  markers: MapMarkerSpec[];
  polylines: MapPolylineSpec[];
  circles: MapCircleSpec[];
  camera?: MapCameraSpec;
  className?: string;
  onInteract?: () => void;
  loadSdk?: () => Promise<MapplsRuntime>;
};

const interactionEvents = [
  "click",
  "mousedown",
  "touchstart",
  "dragstart",
  "zoomstart",
] as const;

function removeOverlay(
  runtime: MapplsRuntime,
  map: MapplsMap,
  layer: MapplsLayer,
) {
  try {
    runtime.removeLayer({ map, layer });
  } catch {
    layer.remove?.();
  }
}

export function MapplsMapSurface({
  ariaLabel,
  markers,
  polylines,
  circles,
  camera,
  className,
  onInteract,
  loadSdk = initializeMapplsSdk,
}: MapplsMapSurfaceProps) {
  const reactId = useId();
  const mapId = useMemo(
    () => `mappls-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [reactId],
  );
  const containerRef = useRef<HTMLDivElement | null>(null);
  const runtimeRef = useRef<MapplsRuntime | null>(null);
  const mapRef = useRef<MapplsMap | null>(null);
  const markerLayersRef = useRef(new Map<string, MapplsMarker>());
  const markerContentRef = useRef(new Map<string, string | HTMLElement>());
  const polylineLayersRef = useRef(new Map<string, MapplsLayer>());
  const circleLayersRef = useRef(new Map<string, MapplsLayer>());
  const lastCameraRef = useRef<{ mode: MapCameraSpec["mode"]; revision: number } | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const retry = useCallback(() => {
    setError(null);
    setLoaded(false);
    setLoadRevision((revision) => revision + 1);
  }, []);

  useEffect(() => {
    let disposed = false;
    let map: MapplsMap | null = null;
    let runtime: MapplsRuntime | null = null;
    let resizeObserver: ResizeObserver | null = null;
    const markerLayers = markerLayersRef.current;
    const markerContent = markerContentRef.current;
    const polylineLayers = polylineLayersRef.current;
    const circleLayers = circleLayersRef.current;

    setLoaded(false);
    loadSdk()
      .then((loadedRuntime) => {
        if (disposed) return;
        runtime = loadedRuntime;
        runtimeRef.current = loadedRuntime;
        lastCameraRef.current = null;
        return loadedRuntime.Map({
          id: mapId,
          properties: {
            center: [20.5937, 78.9629],
            zoom: 4,
            zoomControl: false,
            location: false,
          },
        });
      })
      .then((createdMap) => {
        if (disposed) {
          createdMap.remove();
          return;
        }
        map = createdMap;
        mapRef.current = createdMap;

        const handleLoad = () => {
          if (!disposed) setLoaded(true);
        };
        createdMap.on("load", handleLoad);

        if (containerRef.current && typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => createdMap.resize());
          resizeObserver.observe(containerRef.current);
        }
      })
      .catch((cause: unknown) => {
        if (!disposed) {
          setError(cause instanceof Error ? cause : new Error(String(cause)));
        }
      });

    return () => {
      disposed = true;
      resizeObserver?.disconnect();
      markerLayers.forEach((layer) => {
        if (runtime && map) removeOverlay(runtime, map, layer);
      });
      polylineLayers.forEach((layer) => {
        if (runtime && map) removeOverlay(runtime, map, layer);
      });
      circleLayers.forEach((layer) => {
        if (runtime && map) removeOverlay(runtime, map, layer);
      });
      markerLayers.clear();
      markerContent.clear();
      polylineLayers.clear();
      circleLayers.clear();
      map?.remove();
      if (mapRef.current === map) mapRef.current = null;
      if (runtimeRef.current === runtime) runtimeRef.current = null;
      lastCameraRef.current = null;
    };
  }, [loadRevision, loadSdk, mapId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !onInteract) return;
    interactionEvents.forEach((event) => map.on(event, onInteract));
    return () => {
      interactionEvents.forEach((event) => map.off(event, onInteract));
    };
  }, [loaded, onInteract]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    const map = mapRef.current;
    if (!runtime || !map || !loaded) return;

    markerLayersRef.current.forEach((layer, id) => {
      if (markers.some((marker) => marker.id === id)) return;
      removeOverlay(runtime, map, layer);
      markerLayersRef.current.delete(id);
      markerContentRef.current.delete(id);
    });

    markers.forEach((marker) => {
      const existing = markerLayersRef.current.get(marker.id);
      const sameContent = markerContentRef.current.get(marker.id) === marker.html;
      if (existing && sameContent) {
        existing.setPosition?.(marker.position);
        return;
      }
      if (existing) removeOverlay(runtime, map, existing);
      markerLayersRef.current.set(
        marker.id,
        runtime.Marker({
          map,
          position: marker.position,
          html: marker.html,
          anchor: marker.anchor ?? "center",
          zIndex: marker.zIndex,
          width: marker.width,
          height: marker.height,
          offset: marker.offset,
        }),
      );
      markerContentRef.current.set(marker.id, marker.html);
    });
  }, [loaded, markers]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    const map = mapRef.current;
    if (!runtime || !map || !loaded) return;
    polylineLayersRef.current.forEach((layer) => removeOverlay(runtime, map, layer));
    polylineLayersRef.current.clear();
    polylines.forEach((polyline) => {
      if (polyline.points.length < 2) return;
      polylineLayersRef.current.set(
        polyline.id,
        runtime.Polyline({
          map,
          path: polyline.points,
          paths: polyline.points,
          strokeColor: polyline.color,
          strokeOpacity: polyline.opacity,
          strokeWeight: polyline.width,
          fitbounds: false,
        }),
      );
    });
  }, [loaded, polylines]);

  useEffect(() => {
    const runtime = runtimeRef.current;
    const map = mapRef.current;
    if (!runtime || !map || !loaded) return;
    circleLayersRef.current.forEach((layer) => removeOverlay(runtime, map, layer));
    circleLayersRef.current.clear();
    circles.forEach((circle) => {
      circleLayersRef.current.set(
        circle.id,
        runtime.Circle({
          map,
          center: circle.center,
          radius: circle.radiusMeters,
          fillColor: circle.fillColor,
          fillOpacity: circle.fillOpacity,
          strokeOpacity: 0,
        }),
      );
    });
  }, [circles, loaded]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loaded || !camera) return;
    const lastCamera = lastCameraRef.current;
    if (
      lastCamera?.mode === camera.mode &&
      lastCamera.revision === camera.revision
    ) {
      return;
    }
    lastCameraRef.current = { mode: camera.mode, revision: camera.revision };
    if (camera.mode === "fit") {
      if (camera.points.length === 0) return;
      if (camera.points.length === 1) {
        map.jumpTo({
          center: [camera.points[0].lng, camera.points[0].lat],
          zoom: camera.maxZoom,
        });
      } else {
        const lngs = camera.points.map((point) => point.lng);
        const lats = camera.points.map((point) => point.lat);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: camera.padding, maxZoom: camera.maxZoom },
        );
      }
      return;
    }
    map.jumpTo({
      center: [camera.center.lng, camera.center.lat],
      zoom: camera.zoom,
      bearing: camera.bearing ?? 0,
      pitch: camera.pitch ?? 0,
    });
  }, [camera, camera?.mode, camera?.revision, loaded]);

  if (error) {
    return (
      <div
        role="status"
        className={cn(
          "flex h-full min-h-[240px] flex-col items-center justify-center bg-slate-100 p-6 text-center",
          className,
        )}
      >
        <p className="font-bold text-slate-900">Map is temporarily unavailable</p>
        <p className="mt-1 text-sm text-slate-500">
          Live job details will continue updating.
        </p>
        <Button className="mt-4" type="button" variant="outline" onClick={retry}>
          Retry map
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id={mapId}
      role="application"
      aria-label={ariaLabel}
      className={cn("relative h-full min-h-[240px] w-full bg-slate-100", className)}
    >
      {!loaded && (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-slate-100 text-sm font-semibold text-slate-500">
          Loading live map…
        </div>
      )}
    </div>
  );
}
