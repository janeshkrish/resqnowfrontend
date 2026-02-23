import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Card, CardContent } from "../ui/card";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

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

interface LiveTrackingMapProps {
    techLocation: { lat: number; lng: number } | null;
    userLocation: { lat: number; lng: number } | null;
    eta?: string;
    className?: string;
    variant?: 'card' | 'fullscreen';
}

const getCustomIcon = (color: string, type: 'tech' | 'user') => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>`;

    return L.divIcon({
        className: 'custom-icon',
        html: svg,
        iconSize: [36, 36],
        iconAnchor: [18, 36],
        popupAnchor: [0, -36]
    });
};

const techIcon = getCustomIcon('#3B82F6', 'tech'); // Blue
const userIcon = getCustomIcon('#22C55E', 'user'); // Green

function MapController({ techLoc, userLoc }: { techLoc: { lat: number, lng: number } | null, userLoc: { lat: number, lng: number } | null }) {
    const map = useMap();

    useEffect(() => {
        if (techLoc && userLoc) {
            const bounds = L.latLngBounds([techLoc.lat, techLoc.lng], [userLoc.lat, userLoc.lng]);
            map.fitBounds(bounds, { padding: [50, 50] });
        } else if (techLoc) {
            map.setView(techLoc, 13);
        } else if (userLoc) {
            map.setView(userLoc, 13);
        }
    }, [map, techLoc, userLoc]);

    return null;
}

const LiveTrackingMap: React.FC<LiveTrackingMapProps> = ({ techLocation, userLocation, eta, className, variant = 'card' }) => {
    const [routePath, setRoutePath] = useState<[number, number][]>([]);

    useEffect(() => {
        if (techLocation && userLocation) {
            // Fetch route from OSRM
            const fetchRoute = async () => {
                try {
                    const url = `https://router.project-osrm.org/route/v1/driving/${techLocation.lng},${techLocation.lat};${userLocation.lng},${userLocation.lat}?overview=full&geometries=geojson`;
                    const res = await fetch(url);
                    const data = await res.json();

                    if (data.routes && data.routes[0]) {
                        // OSRM returns [lng, lat], Leaflet needs [lat, lng]
                        const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
                        setRoutePath(coords);
                    }
                } catch (e) {
                    // Fallback
                    setRoutePath([
                        [techLocation.lat, techLocation.lng],
                        [userLocation.lat, userLocation.lng]
                    ]);
                }
            };
            fetchRoute();
        } else {
            setRoutePath([]);
        }
    }, [techLocation, userLocation]);

    const center: [number, number] = userLocation
        ? [userLocation.lat, userLocation.lng]
        : techLocation
            ? [techLocation.lat, techLocation.lng]
            : [20.5937, 78.9629];

    const renderMap = () => (
        <MapContainer
            center={center}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <MapController techLoc={techLocation} userLoc={userLocation} />

            {techLocation && (
                <Marker position={[techLocation.lat, techLocation.lng]} icon={techIcon}>
                    <Popup>Technician</Popup>
                </Marker>
            )}

            {userLocation && (
                <Marker position={[userLocation.lat, userLocation.lng]} icon={userIcon}>
                    <Popup>You</Popup>
                </Marker>
            )}

            {routePath.length > 0 && (
                <Polyline positions={routePath} color="#2563eb" weight={4} opacity={0.7} />
            )}
        </MapContainer>
    );

    if (variant === 'fullscreen') {
        return (
            <div className={cn("relative w-full h-full", className)}>
                {eta && (
                    <div className="absolute top-24 right-4 z-[400] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-slate-100 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span className="text-sm font-bold text-slate-800">{eta}</span>
                    </div>
                )}
                {renderMap()}
            </div>
        );
    }

    return (
        <Card className={cn("overflow-hidden border-0 shadow-lg mb-6 ring-1 ring-slate-900/5", className)}>
            <CardContent className="p-0 relative h-[300px]">
                {eta && (
                    <div className="absolute top-4 right-4 z-[400] bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg border border-slate-100 flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                        <span className="text-sm font-bold text-slate-800">{eta}</span>
                    </div>
                )}
                {renderMap()}
            </CardContent>
        </Card>
    );
};

export default LiveTrackingMap;
