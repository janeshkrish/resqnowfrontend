import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
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

interface ActiveJobMapProps {
    technicianLocation?: { lat: number; lng: number };
    customerLocation?: { lat: number; lng: number };
    destinationLocation?: { lat: number; lng: number };
}

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
const destinationIcon = getCustomIcon('#111827');

function MapController({ techLoc, custLoc, destLoc }: { techLoc?: { lat: number, lng: number }, custLoc?: { lat: number, lng: number }, destLoc?: { lat: number, lng: number } }) {
    const map = useMap();

    useEffect(() => {
        const points = [techLoc, custLoc, destLoc].filter(Boolean) as { lat: number; lng: number }[];
        if (points.length > 1) {
            const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number]));
            map.fitBounds(bounds, { padding: [50, 50] });
        } else if (techLoc) {
            map.setView([techLoc.lat, techLoc.lng], 13);
        } else if (custLoc) {
            map.setView([custLoc.lat, custLoc.lng], 13);
        }
    }, [map, techLoc, custLoc, destLoc]);

    return null;
}

const ActiveJobMap: React.FC<ActiveJobMapProps> = ({
    technicianLocation,
    customerLocation,
    destinationLocation
}) => {
    const [routePath, setRoutePath] = useState<[number, number][]>([]);

    useEffect(() => {
        const waypoints = [technicianLocation, customerLocation, destinationLocation].filter(Boolean) as { lat: number; lng: number }[];
        if (waypoints.length >= 2) {
            // Fetch route from OSRM
            const fetchRoute = async () => {
                try {
                    const coordParam = waypoints.map((point) => `${point.lng},${point.lat}`).join(';');
                    const url = `https://router.project-osrm.org/route/v1/driving/${coordParam}?overview=full&geometries=geojson`;
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
                        ...waypoints.map((point) => [point.lat, point.lng] as [number, number])
                    ]);
                }
            };
            fetchRoute();
        } else {
            setRoutePath([]);
        }
    }, [technicianLocation, customerLocation, destinationLocation]);

    const center: [number, number] = technicianLocation
        ? [technicianLocation.lat, technicianLocation.lng]
        : customerLocation
            ? [customerLocation.lat, customerLocation.lng]
            : [12.9716, 77.5946];

    return (
        <div className="relative z-0 h-full min-h-[240px] w-full overflow-hidden rounded-xl">
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

                <MapController techLoc={technicianLocation} custLoc={customerLocation} destLoc={destinationLocation} />

                {technicianLocation && (
                    <Marker position={[technicianLocation.lat, technicianLocation.lng]} icon={techIcon}>
                        <Popup>Technician</Popup>
                    </Marker>
                )}

                {customerLocation && (
                    <Marker position={[customerLocation.lat, customerLocation.lng]} icon={customerIcon}>
                        <Popup>Pickup</Popup>
                    </Marker>
                )}

                {destinationLocation && (
                    <Marker position={[destinationLocation.lat, destinationLocation.lng]} icon={destinationIcon}>
                        <Popup>Drop</Popup>
                    </Marker>
                )}

                {routePath.length > 0 && (
                    <Polyline positions={routePath} color="#2563eb" weight={4} opacity={0.7} />
                )}
            </MapContainer>
        </div>
    );
};

export default React.memo(ActiveJobMap);
