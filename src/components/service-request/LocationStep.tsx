import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { LocationSelection, ServiceRequestFormData } from "./types";
import { MapPin, Loader2, Navigation } from "lucide-react";
import React, { useCallback, useState, useEffect, useMemo, useRef } from "react";
import MapplsPlaceInput from "./MapplsPlaceInput";
import TowingEstimateCard from "./TowingEstimateCard";
import { fetchRoute, reverseGeocode, routePolylineFromMetadata } from "@/lib/geo";
import { reverseGeocodeWithGoogle } from "@/lib/googlePlaces";
import { MapplsMapSurface } from "@/lib/mapProvider/MapplsMapSurface";
import type { MapCameraSpec, MapMarkerSpec, MapPolylineSpec, MapPoint } from "@/lib/mapProvider/types";

interface LocationStepProps {
  formData: ServiceRequestFormData;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  currentLocation: string;
  isGettingLocation: boolean;
  onGetCurrentLocation: () => void;
  onLocationSelect?: (lat: number, lng: number, address?: string, placeId?: string | null) => void;
  requiresDropLocation?: boolean;
  onDropLocationSelect?: (lat: number, lng: number, address?: string, placeId?: string | null) => void;
  onGetCurrentDropLocation?: () => void;
  towingEstimate?: any;
  isEstimatingTowing?: boolean;
  towingEstimateError?: string | null;
  towingEstimateWarning?: string | null;
}

const normalizeAddressValue = (value: unknown): string => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return String(record.formatted_address || record.address || record.description || "").trim();
  }
  return String(value).trim();
};

const normalizePlaceSelection = (place: LocationSelection): LocationSelection => {
  const address = normalizeAddressValue(place.formatted_address || place.address);
  return {
    ...place,
    address,
    formatted_address: address,
    placeId: place.placeId || null,
  };
};

const PICKUP_MARKER_HTML = '<div style="width:32px;height:32px;border:3px solid white;border-radius:9999px;background:#059669;color:white;display:grid;place-items:center;font:800 11px/1 sans-serif;box-shadow:0 4px 12px rgba(15,23,42,.3)">P</div>';
const DROP_MARKER_HTML = '<div style="width:32px;height:32px;border:3px solid white;border-radius:9999px;background:#e11d48;color:white;display:grid;place-items:center;font:800 11px/1 sans-serif;box-shadow:0 4px 12px rgba(15,23,42,.3)">D</div>';

const isUsableSearchCoordinate = (lat: number, lng: number) =>
  Number.isFinite(lat)
  && Number.isFinite(lng)
  && lat >= -90
  && lat <= 90
  && lng >= -180
  && lng <= 180
  && !(lat === 0 && lng === 0);

const LocationStep = ({
  formData,
  onInputChange,
  currentLocation,
  isGettingLocation,
  onGetCurrentLocation,
  onLocationSelect,
  requiresDropLocation = false,
  onDropLocationSelect,
  onGetCurrentDropLocation,
  towingEstimate,
  isEstimatingTowing,
  towingEstimateError,
  towingEstimateWarning
}: LocationStepProps) => {

  const [markerPosition, setMarkerPosition] = useState<{ lat: number, lng: number } | null>(
    formData.locationCoordinates
      ? { lat: formData.locationCoordinates.lat, lng: formData.locationCoordinates.lng }
      : formData.locationLat && formData.locationLng
        ? { lat: Number(formData.locationLat), lng: Number(formData.locationLng) }
        : { lat: 12.9716, lng: 77.5946 }
  );
  const searchLocationBias = useMemo<MapPoint | null>(() => {
    const coordinates = formData.locationCoordinates;
    if (coordinates && isUsableSearchCoordinate(coordinates.lat, coordinates.lng)) {
      return { lat: coordinates.lat, lng: coordinates.lng };
    }
    if (
      formData.locationLat !== undefined
      && formData.locationLat !== null
      && formData.locationLng !== undefined
      && formData.locationLng !== null
    ) {
      const lat = Number(formData.locationLat);
      const lng = Number(formData.locationLng);
      if (isUsableSearchCoordinate(lat, lng)) return { lat, lng };
    }
    return null;
  }, [formData.locationCoordinates, formData.locationLat, formData.locationLng]);
  const dropPosition = useMemo(() => formData.dropLocationCoordinates
    ? { lat: formData.dropLocationCoordinates.lat, lng: formData.dropLocationCoordinates.lng }
    : formData.dropLat && formData.dropLng
      ? { lat: Number(formData.dropLat), lng: Number(formData.dropLng) }
      : null, [
        formData.dropLat,
        formData.dropLng,
        formData.dropLocationCoordinates,
      ]);
  const [routePath, setRoutePath] = useState<Array<[number, number]>>([]);
  const [activePin, setActivePin] = useState<"pickup" | "drop">(
    requiresDropLocation ? "drop" : "pickup"
  );

  // Update map center if we have coordinates from props
  useEffect(() => {
    if (formData.locationCoordinates) {
      setMarkerPosition(formData.locationCoordinates);
    }
  }, [formData.locationCoordinates]);

  useEffect(() => {
    if (formData.locationLat && formData.locationLng) {
      setMarkerPosition({ lat: Number(formData.locationLat), lng: Number(formData.locationLng) });
    }
  }, [formData.locationLat, formData.locationLng]);

  useEffect(() => {
    setActivePin(requiresDropLocation ? "drop" : "pickup");
  }, [requiresDropLocation]);

  const emitTextChange = (name: string, value: string) => {
    const inputEvent = {
      target: {
        name,
        value
      }
    } as React.ChangeEvent<HTMLInputElement>;
    onInputChange(inputEvent);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    emitTextChange(e.target.name, e.target.value);
  };

  const handlePickupPlaceSelect = (place: LocationSelection) => {
    const normalizedPlace = normalizePlaceSelection(place);
    emitTextChange("location", normalizedPlace.address);
    setMarkerPosition({ lat: normalizedPlace.lat, lng: normalizedPlace.lng });
    onLocationSelect?.(normalizedPlace.lat, normalizedPlace.lng, normalizedPlace.address, normalizedPlace.placeId);
    if (requiresDropLocation) setActivePin("drop");
  };

  const handleDropPlaceSelect = (place: LocationSelection) => {
    const normalizedPlace = normalizePlaceSelection(place);
    emitTextChange("dropLocation", normalizedPlace.address);
    setActivePin("drop");
    onDropLocationSelect?.(normalizedPlace.lat, normalizedPlace.lng, normalizedPlace.address, normalizedPlace.placeId);
  };

  const handleMarkerDragEnd = useCallback(async (lat: number, lng: number, type: "pickup" | "drop" = "pickup") => {
    // 1. Update coordinates
    if (type === "pickup") {
      setActivePin("pickup");
      setMarkerPosition({ lat, lng });
      onLocationSelect?.(lat, lng);
    } else {
      setActivePin("drop");
      onDropLocationSelect?.(lat, lng);
    }

    try {
      const result = requiresDropLocation ? await reverseGeocodeWithGoogle(lat, lng) : await reverseGeocode(lat, lng);
      if (result.address) {
        const address = result.address;
        const placeId = "placeId" in result ? result.placeId : null;
        const inputEvent = {
          target: {
            name: type === "pickup" ? "location" : "dropLocation",
            value: address
          }
        } as React.ChangeEvent<HTMLInputElement>;
        onInputChange(inputEvent);
        if (type === "pickup") onLocationSelect?.(lat, lng, address, placeId);
        if (type === "drop") onDropLocationSelect?.(lat, lng, address, placeId);
      }
    } catch (error) {
      console.error("Reverse geocoding failed", error);
    }
  }, [onDropLocationSelect, onInputChange, onLocationSelect, requiresDropLocation]);

  useEffect(() => {
    if (!requiresDropLocation || !markerPosition || !dropPosition) {
      setRoutePath([]);
      return;
    }

    const quote = towingEstimate?.quote || towingEstimate;
    const metadataRoute = routePolylineFromMetadata(
      quote?.route_metadata || quote?.routeMetadata || towingEstimate?.routeMetadata
    );
    if (metadataRoute.length > 1) {
      setRoutePath(metadataRoute);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const route = await fetchRoute([markerPosition, dropPosition], "full");
        if (!cancelled) {
          setRoutePath(routePolylineFromMetadata(route));
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Route calculation failed", error);
          setRoutePath([]);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [dropPosition, markerPosition, requiresDropLocation, towingEstimate]);

  const routePoints = useMemo<MapPoint[]>(
    () => routePath.map(([lat, lng]) => ({ lat, lng })),
    [routePath],
  );

  const markers = useMemo<MapMarkerSpec[]>(() => {
    const nextMarkers: MapMarkerSpec[] = [];
    if (markerPosition) {
      nextMarkers.push({
        id: "pickup",
        position: markerPosition,
        html: PICKUP_MARKER_HTML,
        anchor: "center",
        draggable: true,
        onDragEnd: ({ lat, lng }) => void handleMarkerDragEnd(lat, lng, "pickup"),
      });
    }
    if (requiresDropLocation && dropPosition) {
      nextMarkers.push({
        id: "drop",
        position: dropPosition,
        html: DROP_MARKER_HTML,
        anchor: "center",
        draggable: true,
        onDragEnd: ({ lat, lng }) => void handleMarkerDragEnd(lat, lng, "drop"),
      });
    }
    return nextMarkers;
  }, [
    dropPosition,
    handleMarkerDragEnd,
    markerPosition,
    requiresDropLocation,
  ]);

  const polylines = useMemo<MapPolylineSpec[]>(
    () => requiresDropLocation && routePoints.length > 1
      ? [{
          id: "towing-route",
          points: routePoints,
          color: "#0f172a",
          width: 4,
          opacity: 0.8,
        }]
      : [],
    [requiresDropLocation, routePoints],
  );

  const cameraPoints = useMemo<MapPoint[]>(() => {
    if (requiresDropLocation && routePoints.length > 1) return routePoints;
    return [markerPosition, requiresDropLocation ? dropPosition : null].filter(
      (point): point is MapPoint => Boolean(point),
    );
  }, [dropPosition, markerPosition, requiresDropLocation, routePoints]);

  const cameraKey = cameraPoints
    .map(({ lat, lng }) => `${lat.toFixed(6)},${lng.toFixed(6)}`)
    .join("|");
  const cameraRevisionRef = useRef({ key: "", revision: 0 });
  if (cameraRevisionRef.current.key !== cameraKey) {
    cameraRevisionRef.current = {
      key: cameraKey,
      revision: cameraRevisionRef.current.revision + 1,
    };
  }
  const cameraRevision = cameraRevisionRef.current.revision;
  const camera = useMemo<MapCameraSpec>(() => ({
    mode: "fit",
    points: cameraPoints,
    padding: { top: 48, right: 48, bottom: 48, left: 48 },
    maxZoom: 16,
    revision: cameraRevision,
  }), [cameraPoints, cameraRevision]);

  const handleMapClick = useCallback(({ lat, lng }: MapPoint) => {
    void handleMarkerDragEnd(lat, lng, requiresDropLocation ? activePin : "pickup");
  }, [activePin, handleMarkerDragEnd, requiresDropLocation]);

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="mb-4 px-1">
        <h3 className="text-2xl font-black tracking-tight text-foreground mb-2">
          {requiresDropLocation ? "Towing Route" : "Service Location"}
        </h3>
        <p className="text-sm font-medium text-muted-foreground/80">
          {requiresDropLocation ? "Choose pickup and drop points for a verified towing fare." : "Pinpoint your exact location for fastest arrival."}
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-5">
        {/* Modern Map Container */}
        <div className="flex-[1.2] bg-card dark:bg-slate-900 rounded-[1.5rem] overflow-hidden border border-border shadow-sm relative shadow-sm">
          <div className="h-[250px] md:h-[400px] w-full relative z-0">
            <MapplsMapSurface
              ariaLabel="Service request location map"
              className="h-full min-h-0 w-full"
              markers={markers}
              polylines={polylines}
              circles={[]}
              camera={camera}
              onMapClick={handleMapClick}
              fallbackDescription="You can still use Auto Detect or search for your address."
            />

            {/* Premium Floating Badge */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] text-[10px] font-bold tracking-widest uppercase text-white z-[400] pointer-events-none flex items-center gap-2 border border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {requiresDropLocation ? "Drag pins to refine route" : "Drag to refine location"}
            </div>
            {requiresDropLocation && (
              <div className="absolute bottom-3 left-1/2 z-[400] flex -translate-x-1/2 rounded-full border border-white/70 bg-white/95 p-1 shadow-lg backdrop-blur">
                <button
                  type="button"
                  onClick={() => setActivePin("pickup")}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                    activePin === "pickup" ? "bg-emerald-600 text-white" : "text-slate-600"
                  }`}
                >
                  Pickup
                </button>
                <button
                  type="button"
                  onClick={() => setActivePin("drop")}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-bold transition ${
                    activePin === "drop" ? "bg-rose-600 text-white" : "text-slate-600"
                  }`}
                >
                  Drop
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Address & Details Unified Container */}
        <div className="flex-1 space-y-5">
          <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] border border-border shadow-sm overflow-hidden flex flex-col">

            {/* Action Bar */}
            <div className="p-4 border-b border-border bg-muted/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <MapPin className="h-4 w-4 text-slate-400" />
                <Label className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground/80">
                  {requiresDropLocation ? "Route Details" : "Address Details"}
                </Label>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 rounded-full border-red-200 bg-red-50 text-red-700 hover:bg-red-100 transition-colors shadow-none text-xs font-bold px-3"
                onClick={onGetCurrentLocation}
                disabled={isGettingLocation}
              >
                {isGettingLocation ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                {isGettingLocation ? "Locating" : "Auto Detect"}
              </Button>
            </div>

            {/* GPS Reference (if available) */}
            {currentLocation && (
              <div className="px-4 py-3 bg-red-50/50 border-b border-red-100/50">
                <div className="flex gap-2 items-start">
                  <div className="mt-0.5 text-red-600">🎯</div>
                  <p className="text-[11px] font-semibold text-red-900 leading-tight pr-2">
                    {currentLocation}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3 p-4 border-b border-border">
              <div className="space-y-2">
                <Label htmlFor="location" className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Pickup Location</Label>
                <MapplsPlaceInput
                  id="location"
                  name="location"
                  value={normalizeAddressValue(formData.location)}
                  placeholder="Search pickup address..."
                  locationBias={searchLocationBias}
                  onTextChange={emitTextChange}
                  onPlaceSelect={handlePickupPlaceSelect}
                />
              </div>
              {requiresDropLocation && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="dropLocation" className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Drop Location</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setActivePin("drop")}
                      className="h-7 gap-1 rounded-full px-2 text-[11px] font-bold text-slate-500"
                    >
                      <Navigation className="h-3 w-3" />
                      Map pin
                    </Button>
                  </div>
                  <MapplsPlaceInput
                    id="dropLocation"
                    name="dropLocation"
                    value={normalizeAddressValue(formData.dropLocation)}
                    placeholder="Search garage, home, or service center..."
                    iconTone="drop"
                    locationBias={searchLocationBias}
                    onTextChange={emitTextChange}
                    onPlaceSelect={handleDropPlaceSelect}
                  />
                </div>
              )}
              <p className="text-[11px] text-slate-400 font-medium mt-1">
                Include landmarks (e.g., "Opposite to City Mall")
              </p>
            </div>

            {/* Additional Details */}
            <div className="p-4 bg-muted/30">
              <div className="flex items-center gap-2.5 mb-2">
                <Label htmlFor="details" className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Extra Note (Optional)</Label>
              </div>
              <Input
                id="details"
                name="details"
                placeholder="Gate code, parking spot..."
                value={formData.details}
                onChange={handleTextareaChange}
                className="h-10 text-sm border-0 focus-visible:ring-0 px-0 rounded-none bg-transparent placeholder:text-slate-300 font-semibold text-muted-foreground shadow-none"
              />
            </div>

          </div>
          {requiresDropLocation && (
            <TowingEstimateCard
              estimate={towingEstimate}
              loading={isEstimatingTowing}
              error={towingEstimateError}
              warning={towingEstimateWarning}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationStep;
