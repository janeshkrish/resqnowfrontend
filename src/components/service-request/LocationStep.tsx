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
    <div className="space-y-4 md:space-y-6 animate-in fade-in-50 duration-500">
      <div className="mb-4 md:mb-6">
        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-1 md:mb-2">Location Details</h3>
        <p className="text-sm text-muted-foreground">Pinpoint your location or describe it below.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        {/* Map Section - Mobile Optimized Height */}
        <Card className="p-0 border-border/50 bg-accent/20 overflow-hidden shadow-md flex-1 md:flex-[1.5]">
          <div className="h-[35vh] md:h-[400px] w-full relative z-0">
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

            <div className="absolute top-2 right-2 bg-white/90 p-2 rounded-lg shadow-sm text-xs z-[400] pointer-events-none max-w-[200px] border">
              Drag marker to refine location
            </div>
          </div>
        </Card>

        {/* Address Input Section - Scrollable if needed */}
        <div className="flex-1 space-y-4">
          <Card className="p-4 md:p-6 border-border/50 bg-accent/20 hover:bg-accent/30 transition-colors">
            <div className="space-y-3 md:space-y-4">
              <div className="flex items-center justify-between mb-1 md:mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <Label className="text-base font-semibold">Address Details</Label>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs h-8 border-primary/20 bg-primary/5 hover:bg-primary/10 text-primary"
                  onClick={onGetCurrentLocation}
                  disabled={isGettingLocation}
                >
                  {isGettingLocation ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />}
                  {isGettingLocation ? "Locating..." : "Auto Detect"}
                </Button>
              </div>

              {currentLocation && (
                <div className="p-2 md:p-3 bg-primary/5 rounded-lg border border-primary/20 mb-2 md:mb-3">
                  <p className="text-xs font-medium text-primary mb-0.5">📍 GPS Reference:</p>
                  <p className="text-xs md:text-sm text-foreground truncate">{currentLocation}</p>
                </div>
              )}

              <Textarea
                id="location"
                name="location"
                value={formData.location}
                onChange={handleTextareaChange}
                placeholder="Type your address here..."
                className="min-h-[80px] md:min-h-[100px] text-sm md:text-base border-2 focus:border-primary resize-none rounded-xl"
                required
              />
              <p className="text-[10px] md:text-xs text-muted-foreground">
                💡 Include landmarks for faster service
              </p>
            </div>
          </Card>

          <Card className="p-4 md:p-6 border-border/50 bg-accent/20 hover:bg-accent/30 transition-colors">
            <div className="space-y-2 md:space-y-3">
              <Label htmlFor="details" className="text-sm md:text-base font-semibold">Additional Details (Optional)</Label>
              <Textarea
                id="details"
                name="details"
                placeholder="Gate code, etc..."
                value={formData.details}
                onChange={handleTextareaChange}
                rows={2}
                className="text-sm md:text-base border-2 focus:border-primary resize-none rounded-xl"
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default LocationStep;
