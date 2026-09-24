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
import { logLiveTrackingDiagnostic } from "@/lib/liveTrackingDiagnostics";
import { MapProviderError } from "./types";
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
  onMapClick?: (position: MapMarkerSpec["position"]) => void;
  onUnavailable?: () => void;
  fallbackDescription?: string;
  loadSdk?: () => Promise<MapplsRuntime>;
  cameraDiagnostics?: {
    autoFrame: boolean;
    mapMode: string;
  };
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

function readMapPoint(value: unknown): MapMarkerSpec["position"] | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const target = record.target && typeof record.target === "object"
    ? record.target as Record<string, unknown>
    : undefined;
  const candidate = (
    record.lngLat
    || record.latLng
    || record._lngLat
    || target?._lngLat
    || target?.lngLat
    || record.position
    || record
  ) as Record<string, unknown>;
  const lat = Number(candidate?.lat ?? candidate?.latitude);
  const lng = Number(candidate?.lng ?? candidate?.lon ?? candidate?.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function updateMarkerHeading(
  marker: MapplsMarker,
  heading: number | null | undefined,
  markerId: string,
  container: HTMLElement | null,
) {
  if (heading == null || !Number.isFinite(heading)) return;
  const element = marker.getElement?.() || Array
    .from(container?.querySelectorAll<HTMLElement>("[data-tracking-marker]") || [])
    .find((candidate) => candidate.dataset.trackingMarker === markerId);
  element?.style.setProperty("--tracking-heading", `${heading}deg`);
}

function readMarkerPosition(marker: MapplsMarker): MapMarkerSpec["position"] | null {
  try {
    return readMapPoint(marker.getPosition?.());
  } catch {
    return null;
  }
}

function inspectTechnicianMarkerDom(
  marker: MapplsMarker,
  markerId: string,
  mapContainer: HTMLElement | null,
) {
  const selector = `[data-tracking-marker="${markerId}"]`;
  const matchingElements = typeof document === "undefined"
    ? []
    : Array.from(document.querySelectorAll<HTMLElement>(selector));
  let sdkElement: HTMLElement | null = null;
  try {
    sdkElement = marker.getElement?.() ?? null;
  } catch {
    sdkElement = null;
  }
  const element = sdkElement?.matches(selector)
    ? sdkElement
    : sdkElement?.querySelector<HTMLElement>(selector)
      ?? mapContainer?.querySelector<HTMLElement>(selector)
      ?? matchingElements[0]
      ?? sdkElement;
  const outerElement = sdkElement ?? element;
  const computed = element && typeof window !== "undefined"
    ? window.getComputedStyle(element)
    : null;
  const outerComputed = outerElement && typeof window !== "undefined"
    ? window.getComputedStyle(outerElement)
    : null;
  const vehicle = element?.querySelector<HTMLElement>(".tracking-tech-marker__vehicle") ?? null;
  const vehicleComputed = vehicle && typeof window !== "undefined"
    ? window.getComputedStyle(vehicle)
    : null;
  const rect = element?.getBoundingClientRect();
  const mapRect = mapContainer?.getBoundingClientRect();

  return {
    markerId,
    elementFound: Boolean(element),
    elementTag: element?.tagName ?? null,
    className: element?.className || null,
    connected: element?.isConnected ?? false,
    elementCountForTechnician: matchingElements.length,
    outerPositionStyle: outerComputed?.position ?? null,
    computedTransform: computed?.transform ?? null,
    computedLeft: computed?.left ?? null,
    computedTop: computed?.top ?? null,
    cssHeadingTransform: computed?.getPropertyValue("--tracking-heading").trim() || null,
    outerComputedTransform: outerComputed?.transform ?? null,
    vehicleComputedTransform: vehicleComputed?.transform ?? null,
    rectLeft: rect?.left ?? null,
    rectTop: rect?.top ?? null,
    rectWidth: rect?.width ?? null,
    rectHeight: rect?.height ?? null,
    mapRectLeft: mapRect?.left ?? null,
    mapRectTop: mapRect?.top ?? null,
    mapRectWidth: mapRect?.width ?? null,
    mapRectHeight: mapRect?.height ?? null,
  };
}

export function MapplsMapSurface({
  ariaLabel,
  markers,
  polylines,
  circles,
  camera,
  className,
  onInteract,
  onMapClick,
  onUnavailable,
  fallbackDescription = "Live job details will continue updating.",
  loadSdk = initializeMapplsSdk,
  cameraDiagnostics,
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
  const markerClickRef = useRef(new Map<string, (() => void) | undefined>());
  markerClickRef.current = new Map(markers.map((marker) => [marker.id, marker.onClick]));
  const markerDragEndRef = useRef(new Map<string, ((position: MapMarkerSpec["position"]) => void) | undefined>());
  markerDragEndRef.current = new Map(markers.map((marker) => [marker.id, marker.onDragEnd]));
  const polylineLayersRef = useRef(new Map<string, MapplsLayer>());
  const circleLayersRef = useRef(new Map<string, MapplsLayer>());
  const lastCameraRef = useRef<{ mode: MapCameraSpec["mode"]; revision: number } | null>(null);
  const [loadRevision, setLoadRevision] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (error) onUnavailable?.();
  }, [error, onUnavailable]);

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
    let readyTimer: ReturnType<typeof setTimeout> | undefined;
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
        const createdMap = loadedRuntime.Map({
          id: mapId,
          properties: {
            center: [20.5937, 78.9629],
            zoom: 4,
            zoomControl: false,
            location: false,
          },
        });
        if (!createdMap || typeof createdMap.on !== "function") {
          throw new MapProviderError("map_failed", "Mappls did not return a map. Verify the Web SDK key and authorization.");
        }
        map = createdMap;
        mapRef.current = createdMap;

        const handleLoad = () => {
          clearTimeout(readyTimer);
          if (!disposed) setLoaded(true);
        };
        readyTimer = setTimeout(() => {
          if (!disposed) {
            setError(new MapProviderError("map_failed", "Mappls map rendering timed out."));
          }
        }, 20_000);
        createdMap.on("load", handleLoad);
        if (createdMap.loaded?.()) handleLoad();

        if (containerRef.current && typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => createdMap.resize());
          resizeObserver.observe(containerRef.current);
        }
      })
      .catch((cause: unknown) => {
        if (!disposed) {
          // Do not log provider URLs or raw SDK errors: they may contain the key.
          console.error("[Mappls]", {
            code: cause instanceof MapProviderError ? cause.code : "map_failed",
            origin: window.location.origin,
          });
          setError(cause instanceof Error ? cause : new Error(String(cause)));
        }
      });

    return () => {
      disposed = true;
      clearTimeout(readyTimer);
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
    const map = mapRef.current;
    if (!map || !loaded || !onMapClick) return;
    const handleClick = (event?: unknown) => {
      const position = readMapPoint(event);
      if (position) onMapClick(position);
    };
    map.on("click", handleClick);
    return () => map.off("click", handleClick);
  }, [loaded, onMapClick]);

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
        if (marker.id === 'technician') {
          logLiveTrackingDiagnostic('[RT-MAPPLS-MARKER]', 'set_position', {
            markerId: marker.id,
            lat: marker.position.lat,
            lng: marker.position.lng,
            source: 'playback',
            renderedAt: new Date().toISOString(),
          });
          const hasSetPosition = typeof existing.setPosition === 'function';
          const hasGetPosition = typeof existing.getPosition === 'function';
          const actualPosition = hasGetPosition ? readMarkerPosition(existing) : null;
          logLiveTrackingDiagnostic('[RT-MAPPLS-MARKER-VERIFY]', 'sdk_position_verified', {
            markerId: marker.id,
            requestedLat: marker.position.lat,
            requestedLng: marker.position.lng,
            actualLat: actualPosition?.lat ?? null,
            actualLng: actualPosition?.lng ?? null,
            hasSetPosition,
            hasGetPosition,
            setPositionType: typeof existing.setPosition,
            getPositionType: typeof existing.getPosition,
          });
          logLiveTrackingDiagnostic('[RT-MAPPLS-DOM-VERIFY]', 'technician_marker_element', {
            ...inspectTechnicianMarkerDom(existing, marker.id, containerRef.current),
          });
          window.requestAnimationFrame(() => {
            const positionAfterPaint = readMarkerPosition(existing);
            const dom = inspectTechnicianMarkerDom(existing, marker.id, containerRef.current);
            logLiveTrackingDiagnostic('[RT-MAPPLS-DOM-POSITION]', 'technician_marker_screen_position', {
              markerId: marker.id,
              requestedLat: marker.position.lat,
              requestedLng: marker.position.lng,
              actualLat: positionAfterPaint?.lat ?? null,
              actualLng: positionAfterPaint?.lng ?? null,
              rectLeft: dom.rectLeft,
              rectTop: dom.rectTop,
              rectWidth: dom.rectWidth,
              rectHeight: dom.rectHeight,
              computedTransform: dom.computedTransform,
              mapRectLeft: dom.mapRectLeft,
              mapRectTop: dom.mapRectTop,
              mapRectWidth: dom.mapRectWidth,
              mapRectHeight: dom.mapRectHeight,
            });
          });
        }
        updateMarkerHeading(existing, marker.heading, marker.id, containerRef.current);
        return;
      }
      if (existing) removeOverlay(runtime, map, existing);
      const layer = runtime.Marker({
          map,
          position: marker.position,
          html: marker.html,
          anchor: marker.anchor ?? "center",
          zIndex: marker.zIndex,
          width: marker.width,
          height: marker.height,
          offset: marker.offset,
          draggable: marker.draggable ?? false,
        });
      layer.addListener?.("click", () => markerClickRef.current.get(marker.id)?.());
      layer.addListener?.("dragend", (event?: unknown) => {
        const position = readMapPoint(layer.getPosition?.()) || readMapPoint(event);
        if (position) markerDragEndRef.current.get(marker.id)?.(position);
      });
      markerLayersRef.current.set(marker.id, layer);
      markerContentRef.current.set(marker.id, marker.html);
      if (marker.id === 'technician') {
        logLiveTrackingDiagnostic('[RT-MAPPLS-MARKER]', 'marker_created', {
          markerId: marker.id,
          lat: marker.position.lat,
          lng: marker.position.lng,
          source: 'playback',
          renderedAt: new Date().toISOString(),
        });
      }
      updateMarkerHeading(layer, marker.heading, marker.id, containerRef.current);
      window.requestAnimationFrame(() => {
        updateMarkerHeading(layer, marker.heading, marker.id, containerRef.current);
      });
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
        logLiveTrackingDiagnostic('[RT-MAP-CAMERA-CALL]', 'camera_call', {
          method: 'jumpTo',
          reason: 'fit_single_point',
          centerLat: camera.points[0].lat,
          centerLng: camera.points[0].lng,
          zoom: camera.maxZoom,
          duration: null,
          autoFrame: cameraDiagnostics?.autoFrame ?? null,
          mapMode: cameraDiagnostics?.mapMode ?? null,
        });
        map.jumpTo({
          center: [camera.points[0].lng, camera.points[0].lat],
          zoom: camera.maxZoom,
        });
      } else {
        const lngs = camera.points.map((point) => point.lng);
        const lats = camera.points.map((point) => point.lat);
        logLiveTrackingDiagnostic('[RT-MAP-CAMERA-CALL]', 'camera_call', {
          method: 'fitBounds',
          reason: 'fit_points',
          centerLat: (Math.min(...lats) + Math.max(...lats)) / 2,
          centerLng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
          zoom: camera.maxZoom,
          duration: null,
          autoFrame: cameraDiagnostics?.autoFrame ?? null,
          mapMode: cameraDiagnostics?.mapMode ?? null,
        });
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
    const followCamera = {
      center: [camera.center.lng, camera.center.lat],
      zoom: camera.zoom,
      bearing: camera.bearing ?? 0,
      pitch: camera.pitch ?? 0,
      duration: 550,
    };
    if (typeof map.easeTo === "function") {
      logLiveTrackingDiagnostic('[RT-MAP-CAMERA-CALL]', 'camera_call', {
        method: 'easeTo',
        reason: 'follow',
        centerLat: camera.center.lat,
        centerLng: camera.center.lng,
        zoom: camera.zoom,
        duration: followCamera.duration,
        autoFrame: cameraDiagnostics?.autoFrame ?? null,
        mapMode: cameraDiagnostics?.mapMode ?? null,
      });
      map.easeTo(followCamera);
    } else {
      logLiveTrackingDiagnostic('[RT-MAP-CAMERA-CALL]', 'camera_call', {
        method: 'jumpTo',
        reason: 'follow_fallback',
        centerLat: camera.center.lat,
        centerLng: camera.center.lng,
        zoom: camera.zoom,
        duration: 0,
        autoFrame: cameraDiagnostics?.autoFrame ?? null,
        mapMode: cameraDiagnostics?.mapMode ?? null,
      });
      map.jumpTo(followCamera);
    }
  }, [camera, camera?.mode, camera?.revision, cameraDiagnostics, loaded]);

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
          {fallbackDescription}
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
