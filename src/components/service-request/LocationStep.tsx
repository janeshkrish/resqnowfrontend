import { LocationSelection, ServiceRequestFormData } from "./types";
import React, { useCallback, useState, useEffect, useMemo, useRef } from "react";
import MaterialSymbol from "@/components/home/MaterialSymbol";
import { cn } from "@/lib/utils";
import MapplsPlaceInput from "./MapplsPlaceInput";
import TowingEstimateCard from "./TowingEstimateCard";
import { fetchRoute, reverseGeocode, routePolylineFromMetadata } from "@/lib/geo";
import { reverseGeocodeWithGoogle } from "@/lib/googlePlaces";
import { MapplsMapSurface } from "@/lib/mapProvider/MapplsMapSurface";
import type { MapCameraSpec, MapMarkerSpec, MapPolylineSpec, MapPoint } from "@/lib/mapProvider/types";

interface LocationStepProps {
  formData: ServiceRequestFormData;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  /** Kept for callers; the address field shows the detected location itself. */
  currentLocation?: string;
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
  /** SOS: the pin turns red. */
  emergency?: boolean;
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

// Pick up is a navy dot, the drop a red square, as in the rest of the request form.
const PICKUP_MARKER_HTML = '<div style="width:22px;height:22px;box-sizing:border-box;border:4px solid white;border-radius:9999px;background:#283048;box-shadow:0 3px 10px rgba(40,48,72,.45)"></div>';
const SOS_MARKER_HTML = '<div style="width:22px;height:22px;box-sizing:border-box;border:4px solid white;border-radius:9999px;background:#B01F2A;box-shadow:0 3px 10px rgba(176,31,42,.5)"></div>';
const DROP_MARKER_HTML = '<div style="width:22px;height:22px;box-sizing:border-box;border:4px solid white;border-radius:6px;background:#B01F2A;box-shadow:0 3px 10px rgba(176,31,42,.45)"></div>';

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
  isGettingLocation,
  onGetCurrentLocation,
  onLocationSelect,
  requiresDropLocation = false,
  onDropLocationSelect,
  onGetCurrentDropLocation,
  towingEstimate,
  isEstimatingTowing,
  towingEstimateError,
  towingEstimateWarning,
  emergency = false
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
        html: emergency ? SOS_MARKER_HTML : PICKUP_MARKER_HTML,
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
    emergency,
    handleMarkerDragEnd,
    markerPosition,
    requiresDropLocation,
  ]);

  const polylines = useMemo<MapPolylineSpec[]>(
    () => requiresDropLocation && routePoints.length > 1
      ? [{
          id: "towing-route",
          points: routePoints,
          color: "#283048",
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
    <div className="rqf-location">
      <div className={cn("rqf-map", requiresDropLocation && "tow")}>
        <MapplsMapSurface
          ariaLabel="Service request location map"
          className="h-full min-h-0 w-full"
          markers={markers}
          polylines={polylines}
          circles={[]}
          camera={camera}
          onMapClick={handleMapClick}
          fallbackDescription="You can still use your current location or search for the address."
        />
        <span className="rqf-map-hint" aria-hidden="true">
          <MaterialSymbol name="pan_tool" />
          {requiresDropLocation ? `Tap the map to move the ${activePin === "pickup" ? "pick up" : "drop"} pin` : "Drag the pin to the exact spot"}
        </span>
        {requiresDropLocation ? (
          <div className="rqf-pin-toggle" role="radiogroup" aria-label="Which pin the map moves">
            <button type="button" role="radio" aria-checked={activePin === "pickup"} className={cn(activePin === "pickup" && "is-on")} onClick={() => setActivePin("pickup")}>Pick up</button>
            <button type="button" role="radio" aria-checked={activePin === "drop"} className={cn(activePin === "drop" && "is-on")} onClick={() => setActivePin("drop")}>Drop</button>
          </div>
        ) : null}
        <button
          type="button"
          className="rqf-locate rq-press"
          aria-label={isGettingLocation ? "Finding your location" : "Use my current location"}
          onClick={onGetCurrentLocation}
          disabled={isGettingLocation}
        >
          <MaterialSymbol name={isGettingLocation ? "progress_activity" : "my_location"} className={isGettingLocation ? "rqf-spin" : undefined} />
        </button>
      </div>

      <div className="rqf-sec">
        {requiresDropLocation ? (
          <div className="rqf-route">
            <div className="rqf-route-row">
              <span className="rqf-dot" aria-hidden="true" />
              <div className="rqf-route-field">
                <label htmlFor="location" className="rqf-loc-lbl">Pick up from</label>
                <MapplsPlaceInput
                  id="location"
                  name="location"
                  value={normalizeAddressValue(formData.location)}
                  placeholder={isGettingLocation ? "Finding you…" : "Search where the vehicle is"}
                  locationBias={searchLocationBias}
                  onTextChange={emitTextChange}
                  onPlaceSelect={handlePickupPlaceSelect}
                />
              </div>
            </div>
            <span className="rqf-route-line" aria-hidden="true" />
            <div className="rqf-route-row">
              <span className="rqf-square" aria-hidden="true" />
              <div className="rqf-route-field">
                <label htmlFor="dropLocation" className="rqf-loc-lbl">Take it to</label>
                <MapplsPlaceInput
                  id="dropLocation"
                  name="dropLocation"
                  value={normalizeAddressValue(formData.dropLocation)}
                  placeholder="Search a garage, service centre or home"
                  iconTone="drop"
                  locationBias={searchLocationBias}
                  onTextChange={emitTextChange}
                  onPlaceSelect={handleDropPlaceSelect}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="rqf-loc">
            <span className={cn("rqf-dot", emergency && "sos")} aria-hidden="true" />
            <div className="rqf-route-field">
              <label htmlFor="location" className="rqf-loc-lbl">Help comes to</label>
              <MapplsPlaceInput
                id="location"
                name="location"
                value={normalizeAddressValue(formData.location)}
                placeholder={isGettingLocation ? "Finding you…" : "Search your area or street"}
                locationBias={searchLocationBias}
                onTextChange={emitTextChange}
                onPlaceSelect={handlePickupPlaceSelect}
              />
            </div>
          </div>
        )}
      </div>

      {requiresDropLocation ? (
        <div className="rqf-sec">
          <TowingEstimateCard
            estimate={towingEstimate}
            loading={isEstimatingTowing}
            error={towingEstimateError}
            warning={towingEstimateWarning}
          />
        </div>
      ) : null}

      <div className="rqf-sec">
        <p className="rqf-lbl"><label htmlFor="landmark">Landmark or exact spot</label><small>Optional</small></p>
        <input
          id="landmark"
          name="landmark"
          className="rqf-input"
          type="text"
          value={String(formData.landmark || "")}
          onChange={(event) => emitTextChange("landmark", event.target.value.slice(0, 120))}
          placeholder="e.g. near the bus stop, basement B2"
          autoComplete="off"
        />
      </div>
    </div>
  );
};

export default LocationStep;
