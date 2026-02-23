import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
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

export interface LocationState {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    locality: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
    address: string;
}

interface LocationDetectorProps {
    onLocationDetected: (location: LocationState) => void;
    defaultLocation?: Partial<LocationState>;
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

const LocationDetector: React.FC<LocationDetectorProps> = ({ onLocationDetected, defaultLocation }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [location, setLocation] = useState<Partial<LocationState>>(defaultLocation || {});

    const [markerPosition, setMarkerPosition] = useState<{ lat: number, lng: number } | null>(
        defaultLocation?.latitude && defaultLocation?.longitude
            ? { lat: defaultLocation.latitude, lng: defaultLocation.longitude }
            : null
    );

    useEffect(() => {
        if (defaultLocation?.latitude && defaultLocation?.longitude) {
            setMarkerPosition({ lat: defaultLocation.latitude, lng: defaultLocation.longitude });
        }
    }, [defaultLocation]);

    const geocodePosition = async (lat: number, lng: number) => {
        try {
            const res = await fetch(`/api/public/reverse-geocode?lat=${lat}&lng=${lng}`);
            const data = await res.json();

            if (data && data.address) {
                const addr = data.address;
                const locality = addr.suburb || addr.neighbourhood || addr.village || '';
                const city = addr.city || addr.town || addr.municipality || '';
                const district = addr.county || addr.district || '';
                const state = addr.state || '';
                const pincode = addr.postcode || '';

                const detected: LocationState = {
                    latitude: lat,
                    longitude: lng,
                    accuracy: 10,
                    locality,
                    city,
                    district,
                    state,
                    pincode,
                    address: data.display_name || ''
                };
                setLocation(detected);
                onLocationDetected(detected);
            } else {
                throw new Error("No results found");
            }

        } catch (e) {
            console.error("Geocoding failed", e);
            // Fallback
            const fallback: LocationState = {
                latitude: lat,
                longitude: lng,
                accuracy: 10,
                locality: "",
                city: "",
                district: "",
                state: "",
                pincode: "",
                address: `Lat: ${lat.toFixed(6)}, Lon: ${lng.toFixed(6)}`
            };
            setLocation(fallback);
            onLocationDetected(fallback);
        }
    };

    const detectLocation = () => {
        setLoading(true);
        setError(null);

        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser");
            setLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                setMarkerPosition({ lat: latitude, lng: longitude });
                await geocodePosition(latitude, longitude);
                setLoading(false);
            },
            (err) => {
                setLoading(false);
                let msg = "Failed to detect location.";
                if (err.code === 1) msg = "Permission denied. Please enable GPS.";
                if (err.code === 2) msg = "Location unavailable.";
                if (err.code === 3) msg = "Request timed out.";
                setError(msg);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
    };

    const handleMarkerDragEnd = async (lat: number, lng: number) => {
        setMarkerPosition({ lat, lng });
        await geocodePosition(lat, lng);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2">
                <Button
                    type="button"
                    onClick={detectLocation}
                    disabled={loading}
                    variant={location.latitude ? "outline" : "default"}
                    className="w-full flex gap-2 items-center justify-center"
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <MapPin className="h-4 w-4" />
                    )}
                    {location.latitude ? "Update My Location (GPS)" : "Detect My Location (GPS)"}
                </Button>

                {location.latitude && (
                    <p className="text-xs text-muted-foreground text-center">
                        Accuracy: ±{Math.round(location.accuracy || 0)} meters
                    </p>
                )}
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            <div className="rounded-md border overflow-hidden mt-4 bg-slate-50 relative z-0">
                <div className="h-[300px] w-full">
                    <MapContainer
                        center={markerPosition || [20.5937, 78.9629]}
                        zoom={markerPosition ? 16 : 4}
                        style={{ height: '100%', width: '100%' }}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <LocationMarker position={markerPosition} onDragEnd={handleMarkerDragEnd} />
                    </MapContainer>
                </div>

                {location.address && (
                    <div className="bg-muted p-3 text-sm space-y-2 border-t">
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-xs font-semibold text-muted-foreground block">City</span>
                                {location.city || "—"}
                            </div>
                            <div>
                                <span className="text-xs font-semibold text-muted-foreground block">Area</span>
                                {location.locality || "—"}
                            </div>
                            <div>
                                <span className="text-xs font-semibold text-muted-foreground block">State</span>
                                {location.state || "—"}
                            </div>
                            <div>
                                <span className="text-xs font-semibold text-muted-foreground block">Pincode</span>
                                {location.pincode || "—"}
                            </div>
                        </div>
                        <div className="pt-2 border-t border-muted-foreground/20">
                            <span className="text-xs font-semibold text-muted-foreground block">Full Address</span>
                            <p className="line-clamp-2">{location.address}</p>
                        </div>
                        <p className="text-xs text-blue-600 italic text-center mt-2">
                            Tip: Drag the marker to pinpoint your specific shop location.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LocationDetector;
