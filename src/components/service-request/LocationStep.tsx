import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Input } from "../ui/input";
import { Card } from "../ui/card";
import { ServiceRequestFormData } from "./types";
import { MapPin, Loader2 } from "lucide-react";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

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
}

const LocationMarker = ({ position, onDragEnd }: { position: { lat: number, lng: number } | null, onDragEnd: (lat: number, lng: number) => void }) => {
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
      <Popup>Your Location</Popup>
    </Marker>
  );
};

const LocationStep = ({
  formData,
  onInputChange,
  currentLocation,
  isGettingLocation,
  onGetCurrentLocation,
  onLocationSelect
}: LocationStepProps) => {

  const [markerPosition, setMarkerPosition] = useState<{ lat: number, lng: number } | null>(
    formData.locationCoordinates ? { lat: formData.locationCoordinates.lat, lng: formData.locationCoordinates.lng } : { lat: 12.9716, lng: 77.5946 }
  );

  // Update map center if we have coordinates from props
  useEffect(() => {
    if (formData.locationCoordinates) {
      setMarkerPosition(formData.locationCoordinates);
    }
  }, [formData.locationCoordinates]);

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const inputEvent = {
      target: {
        name: e.target.name,
        value: e.target.value
      }
    } as React.ChangeEvent<HTMLInputElement>;
    onInputChange(inputEvent);
  };

  const handleMarkerDragEnd = async (lat: number, lng: number) => {
    // 1. Update coordinates
    setMarkerPosition({ lat, lng });
    if (onLocationSelect) {
      onLocationSelect(lat, lng);
    }

    // 2. Reverse Geocode
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
      const data = await res.json();

      if (data && data.display_name) {
        const address = data.display_name;
        const inputEvent = {
          target: {
            name: 'location',
            value: address
          }
        } as React.ChangeEvent<HTMLInputElement>;
        onInputChange(inputEvent);
      }
    } catch (error) {
      console.error("Reverse geocoding failed", error);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="mb-4 px-1">
        <h3 className="text-2xl font-black tracking-tight text-foreground mb-2">Service Location</h3>
        <p className="text-sm font-medium text-muted-foreground/80">Pinpoint your exact location for fastest arrival.</p>
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
              <LocationMarker position={markerPosition} onDragEnd={handleMarkerDragEnd} />
            </MapContainer>

            {/* Premium Floating Badge */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.15)] text-[10px] font-bold tracking-widest uppercase text-white z-[400] pointer-events-none flex items-center gap-2 border border-white/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Drag to refine location
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
                <Label className="text-[11px] uppercase font-bold tracking-widest text-muted-foreground/80">Address Details</Label>
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

            {/* Address Textarea */}
            <div className="p-4 border-b border-border">
              <Textarea
                id="location"
                name="location"
                value={formData.location}
                onChange={handleTextareaChange}
                placeholder="Enter complete address..."
                className="min-h-[80px] border-0 px-0 focus-visible:ring-0 text-base font-bold text-foreground resize-none rounded-none shadow-none placeholder:text-slate-300"
                required
              />
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
                onChange={handleTextareaChange as any}
                className="h-10 text-sm border-0 focus-visible:ring-0 px-0 rounded-none bg-transparent placeholder:text-slate-300 font-semibold text-muted-foreground shadow-none"
              />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default LocationStep;
