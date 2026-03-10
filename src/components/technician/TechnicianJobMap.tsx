import React, { useEffect, useState, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Card, CardContent } from "../ui/card";
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

// Custom Icons
const getCustomIcon = (color: string) => {
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

const techIcon = getCustomIcon('#3B82F6'); // Blue
const customerIcon = getCustomIcon('#EF4444'); // Red

interface TechnicianJobMapProps {
    techLocation: { lat: number; lng: number } | null;
    jobLocation: { lat: number; lng: number } | null;
    showRoute?: boolean;
}

function MapController({ techLoc, jobLoc }: { techLoc: { lat: number, lng: number } | null, jobLoc: { lat: number, lng: number } | null }) {
    const map = useMap();

    useEffect(() => {
        if (techLoc && jobLoc) {
            const bounds = L.latLngBounds([techLoc.lat, techLoc.lng], [jobLoc.lat, jobLoc.lng]);
            map.fitBounds(bounds, { padding: [50, 50] });
        } else if (techLoc) {
            map.setView([techLoc.lat, techLoc.lng], 13);
        } else if (jobLoc) {
            map.setView([jobLoc.lat, jobLoc.lng], 13);
        }
    }, [map, techLoc, jobLoc]);

    return null;
}

const TechnicianJobMap: React.FC<TechnicianJobMapProps> = ({ techLocation, jobLocation, showRoute = false }) => {
    const [routePath, setRoutePath] = useState<[number, number][]>([]);

    useEffect(() => {
        if (showRoute && techLocation && jobLocation) {
            // Fetch route from OSRM
            const fetchRoute = async () => {
                try {
                    const url = `https://router.project-osrm.org/route/v1/driving/${techLocation.lng},${techLocation.lat};${jobLocation.lng},${jobLocation.lat}?overview=full&geometries=geojson`;
                    const res = await fetch(url);
                    const data = await res.json();

                    if (data.routes && data.routes[0]) {
                        // OSRM returns [lng, lat], Leaflet needs [lat, lng]
                        const coords = data.routes[0].geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
                        setRoutePath(coords);
                    }
                } catch (e) {
                    console.error("OSRM Fetch Error:", e);
                    // Fallback to straight line
                    setRoutePath([
                        [techLocation.lat, techLocation.lng],
                        [jobLocation.lat, jobLocation.lng]
                    ]);
                }
            };
            fetchRoute();
        } else {
            setRoutePath([]);
        }
    }, [showRoute, techLocation, jobLocation]);

    const center: [number, number] = techLocation
        ? [techLocation.lat, techLocation.lng]
        : jobLocation
            ? [jobLocation.lat, jobLocation.lng]
            : [12.9716, 77.5946];

    return (
        <Card className="overflow-hidden border-0 shadow-none h-full">
            <CardContent className="p-0 h-full">
                <div className="h-full w-full relative z-0 min-h-[300px]">
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

                        <MapController techLoc={techLocation} jobLoc={jobLocation} />

                        {techLocation && (
                            <Marker position={[techLocation.lat, techLocation.lng]} icon={techIcon}>
                                <Popup>You (Technician)</Popup>
                            </Marker>
                        )}

                        {jobLocation && (
                            <Marker position={[jobLocation.lat, jobLocation.lng]} icon={customerIcon}>
                                <Popup>Customer Location</Popup>
                            </Marker>
                        )}

                        {routePath.length > 0 && (
                            <Polyline positions={routePath} color="#2563eb" weight={4} opacity={0.7} />
                        )}
                    </MapContainer>
                </div>
            </CardContent>
        </Card>
    );
};

export default TechnicianJobMap;
