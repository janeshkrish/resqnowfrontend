import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { ServiceRequestFormData } from "./types";
import { MapPin, Loader2, Navigation } from "lucide-react";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import OpenStreetMapPlaceInput from "./OpenStreetMapPlaceInput";
import TowingEstimateCard from "./TowingEstimateCard";
import { fetchRoute, reverseGeocode, routePolylineFromMetadata } from "@/lib/geo";

// Fix Leaflet icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface LocationStepProps {
  formData: ServiceRequestFormData;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  currentLocation: string;
  isGettingLocation: boolean;
  onGetCurrentLocation: () => void;
  onLocationSelect?: (lat: number, lng: number) => void;
  requiresDropLocation?: boolean;
  onDropLocationSelect?: (lat: number, lng: number, address?: string) => void;
  onGetCurrentDropLocation?: () => void;
  towingEstimate?: any;
  isEstimatingTowing?: boolean;
  towingEstimateError?: string | null;
}

const LocationMarker = ({ position, label, onDragEnd }: { position: { lat: number, lng: number } | null, label: string, onDragEnd: (lat: number, lng: number) => void }) => {
  const map = useMap();
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    if (position) {
      map.flyTo([position.lat, position.lng], 16);
    }
  }, [position, map]);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          const latLng = marker.getLatLng();
          onDragEnd(latLng.lat, latLng.lng);
        }
      },
    }),
    [onDragEnd],
  );

  if (!position) return null;

  return (
    <Marker
      draggable={true}
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    >
      <Popup>{label}</Popup>
    </Marker>
  );
};

const RouteBounds = ({ pickup, drop, routePath }: { pickup: { lat: number, lng: number } | null, drop: { lat: number, lng: number } | null, routePath?: Array<[number, number]> }) => {
  const map = useMap();
  useEffect(() => {
    if (!pickup || !drop) return;
    if (routePath && routePath.length > 1) {
      map.fitBounds(routePath, { padding: [32, 32] });
      return;
    }
    map.fitBounds(
      [
        [pickup.lat, pickup.lng],
        [drop.lat, drop.lng],
      ],
      { padding: [32, 32] }
    );
  }, [drop, map, pickup, routePath]);
  return null;
};

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
  towingEstimateError
}: LocationStepProps) => {

  const [markerPosition, setMarkerPosition] = useState<{ lat: number, lng: number } | null>(
    formData.locationCoordinates
      ? { lat: formData.locationCoordinates.lat, lng: formData.locationCoordinates.lng }
      : formData.locationLat && formData.locationLng
        ? { lat: Number(formData.locationLat), lng: Number(formData.locationLng) }
        : { lat: 12.9716, lng: 77.5946 }
  );
  const dropPosition = formData.dropLocationCoordinates
    ? { lat: formData.dropLocationCoordinates.lat, lng: formData.dropLocationCoordinates.lng }
    : formData.dropLat && formData.dropLng
      ? { lat: Number(formData.dropLat), lng: Number(formData.dropLng) }
      : null;
  const [routePath, setRoutePath] = useState<Array<[number, number]>>([]);

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

  const handlePickupPlaceSelect = (place: { address: string; lat: number; lng: number }) => {
    emitTextChange("location", place.address);
    setMarkerPosition({ lat: place.lat, lng: place.lng });
    onLocationSelect?.(place.lat, place.lng);
  };

  const handleDropPlaceSelect = (place: { address: string; lat: number; lng: number }) => {
    emitTextChange("dropLocation", place.address);
    onDropLocationSelect?.(place.lat, place.lng, place.address);
  };

  const handleMarkerDragEnd = async (lat: number, lng: number, type: "pickup" | "drop" = "pickup") => {
    // 1. Update coordinates
    if (type === "pickup") {
      setMarkerPosition({ lat, lng });
      onLocationSelect?.(lat, lng);
    } else {
      onDropLocationSelect?.(lat, lng);
    }

    try {
      const result = await reverseGeocode(lat, lng);
      if (result.address) {
        const address = result.address;
        const inputEvent = {
          target: {
            name: type === "pickup" ? "location" : "dropLocation",
            value: address
          }
        } as React.ChangeEvent<HTMLInputElement>;
        onInputChange(inputEvent);
        if (type === "drop") onDropLocationSelect?.(lat, lng, address);
      }
    } catch (error) {
      console.error("Reverse geocoding failed", error);
    }
  };

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
  }, [dropPosition?.lat, dropPosition?.lng, markerPosition?.lat, markerPosition?.lng, requiresDropLocation, towingEstimate]);

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
            <MapContainer
              center={markerPosition || [12.9716, 77.5946]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <LocationMarker position={markerPosition} label="Pickup" onDragEnd={(lat, lng) => handleMarkerDragEnd(lat, lng, "pickup")} />
              {requiresDropLocation && (
                <>
                  <LocationMarker position={dropPosition} label="Drop" onDragEnd={(lat, lng) => handleMarkerDragEnd(lat, lng, "drop")} />
                  {markerPosition && dropPosition && (
                    <>
                      {routePath.length > 1 && (
                        <Polyline
                          positions={routePath}
                          pathOptions={{ color: "#0f172a", weight: 4, opacity: 0.8 }}
                        />
                      )}
                      <RouteBounds pickup={markerPosition} drop={dropPosition} routePath={routePath} />
                    </>
                  )}
                </>
              )}
            </MapContainer>

            {/* Premium Floating Badge */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] text-[10px] font-bold tracking-widest uppercase text-white z-[400] pointer-events-none flex items-center gap-2 border border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              {requiresDropLocation ? "Drag pins to refine route" : "Drag to refine location"}
            </div>
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
                className="h-8 gap-1.5 rounded-full border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors shadow-none text-xs font-bold px-3"
                onClick={onGetCurrentLocation}
                disabled={isGettingLocation}
              >
                {isGettingLocation ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                {isGettingLocation ? "Locating" : "Auto Detect"}
              </Button>
            </div>

            {/* GPS Reference (if available) */}
            {currentLocation && (
              <div className="px-4 py-3 bg-blue-50/50 border-b border-blue-100/50">
                <div className="flex gap-2 items-start">
                  <div className="mt-0.5 text-blue-600">🎯</div>
                  <p className="text-[11px] font-semibold text-blue-900 leading-tight pr-2">
                    {currentLocation}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3 p-4 border-b border-border">
              <div className="space-y-2">
                <Label htmlFor="location" className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Pickup Location</Label>
                <OpenStreetMapPlaceInput
                  id="location"
                  name="location"
                  value={formData.location}
                  placeholder="Search pickup address..."
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
                      onClick={onGetCurrentDropLocation}
                      className="h-7 gap-1 rounded-full px-2 text-[11px] font-bold text-slate-500"
                    >
                      <Navigation className="h-3 w-3" />
                      Use current
                    </Button>
                  </div>
                  <OpenStreetMapPlaceInput
                    id="dropLocation"
                    name="dropLocation"
                    value={formData.dropLocation || ""}
                    placeholder="Search garage, home, or service center..."
                    iconTone="drop"
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
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationStep;
