import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { apiUrl } from "@/lib/api";
import { PlatformLegacyMap, useLegacyMapCamera } from '@/lib/mapProvider/PlatformLegacyMap';
import type { MapMarkerSpec } from '@/lib/mapProvider/types';

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
    onLocationDetected: (location: Partial<LocationState>) => void;
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
    const locationRequest = useRef<AbortController | null>(null);
    const { latitude, longitude } = defaultLocation ?? {};

    const [markerPosition, setMarkerPosition] = useState<{ lat: number, lng: number } | null>(
        latitude != null && longitude != null ? { lat: latitude, lng: longitude } : null
    );

    useEffect(() => () => locationRequest.current?.abort(), []);

    const startLocationRequest = () => {
        locationRequest.current?.abort();
        const request = new AbortController();
        locationRequest.current = request;
        setLoading(true);
        setError(null);
        return request.signal;
    };

    const geocodePosition = async (lat: number, lng: number, signal: AbortSignal) => {
        setMarkerPosition({ lat, lng });
        const coordinates = { latitude: lat, longitude: lng, accuracy: 10 };
        let detected: Partial<LocationState> = coordinates;
        try {
            const res = await fetch(apiUrl(`/api/public/reverse-geocode?lat=${lat}&lng=${lng}`), { signal });
            const data = await res.json();
            if (!res.ok || !data?.address || !data.display_name) throw new Error("No address found");

            const addr = data.address;
            detected = {
                ...coordinates,
                locality: addr.suburb || addr.neighbourhood || addr.village || '',
                city: addr.city || addr.town || addr.municipality || '',
                district: addr.county || addr.district || '',
                state: addr.state || '',
                pincode: addr.postcode || '',
                address: data.display_name,
            };
        } catch {
            if (signal.aborted) return;
            setError("We found your GPS position but could not fill in the address. You can enter it manually.");
        }

        if (signal.aborted) return;
        setLocation(current => ({ ...current, ...detected }));
        onLocationDetected(detected);
        setLoading(false);
    };

    const detectLocation = () => {
        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser");
            return;
        }

        const signal = startLocationRequest();
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (signal.aborted) return;
                const { latitude, longitude } = position.coords;
                void geocodePosition(latitude, longitude, signal);
            },
            (err) => {
                if (signal.aborted) return;
                setLoading(false);
                let msg = "Failed to detect location.";
                if (err.code === 1) msg = "Location permission was denied.";
                if (err.code === 2) msg = "Location unavailable.";
                if (err.code === 3) msg = "Request timed out.";
                setError(msg);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
        );
    };

    const handleMarkerDragEnd = (lat: number, lng: number) => {
        void geocodePosition(lat, lng, startLocationRequest());
    };
    const nativeMarkers: MapMarkerSpec[] = markerPosition ? [{id:'shop',position:markerPosition,html:'',draggable:true,
        visual:{kind:'shop',accessibleLabel:'Your Location'},onDragEnd:({lat,lng})=>void handleMarkerDragEnd(lat,lng)}] : [];
    const nativeCamera=useLegacyMapCamera([markerPosition ?? {lat:12.9716,lng:77.5946}],0,markerPosition ? 16 : 13);

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-2">
                <Button
                    type="button"
                    onClick={detectLocation}
                    disabled={loading}
                    variant="outline"
                    className="w-full flex gap-2 items-center justify-center"
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <MapPin className="h-4 w-4" />
                    )}
                    {markerPosition ? "Update My Location (GPS)" : "Detect My Location (GPS)"}
                </Button>

                {location.accuracy != null && (
                    <p className="text-xs text-muted-foreground text-center">
                        Accuracy: ±{Math.round(location.accuracy)} meters
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

            <div className="rounded-md border overflow-hidden mt-4 bg-muted relative z-0">
                <div className="h-[300px] w-full">
                    <PlatformLegacyMap ariaLabel="Shop location selection" markers={nativeMarkers} camera={nativeCamera}>
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
                    </PlatformLegacyMap>
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
                        <p className="text-xs text-red-600 italic text-center mt-2">
                            Tip: Drag the marker to pinpoint your specific shop location.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LocationDetector;
