import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Navigation,
  Map as MapIcon,
  Clock3,
  Search,
  RefreshCw,
  Locate,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Star,
  User,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useGeolocation } from "@/hooks/useGeolocation";
import { apiUrl } from "@/lib/api";

// Fix Leaflet's default icon issue with Webpack/Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Icons as Leaflet DivIcons or custom images
const getCustomIcon = (color: string) => {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="${color}" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
      <circle cx="12" cy="10" r="3"/>
    </svg>`;

  return L.divIcon({
    className: 'custom-icon',
    html: svg,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

const userIcon = getCustomIcon('#3B82F6'); // Blue
const techIcon = getCustomIcon('#EF4444'); // Red
const recommendedIcon = getCustomIcon('#10B981'); // Green

// Default center (Bangalore)
const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

interface Technician {
  id: string;
  name: string;
  service_type: string;
  distance: number;
  rating: number;
  latitude: number;
  longitude: number;
  aiRecommended?: boolean;
  specialties?: string[];
  vehicle_types?: Record<string, boolean> | string[];
}

// Component to handle map movement
function MapUpdater({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 13);
    }
  }, [center, map]);
  return null;
}

const Map = () => {
  const navigate = useNavigate();
  const { coordinates, address, loading: loadingLocation, error: locationError, requestLocation } = useGeolocation();

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [selectedTech, setSelectedTech] = useState<Technician | null>(null);

  // Filters & Sorting
  const [filterService, setFilterService] = useState<string>("all");
  const [filterVehicle, setFilterVehicle] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("distance");

  // Initial location request
  useEffect(() => {
    requestLocation();
  }, []);

  // Fetch technicians when coordinates change
  useEffect(() => {
    if (coordinates) {
      fetchTechnicians(coordinates.lat, coordinates.lng);
    }
  }, [coordinates]);

  const fetchTechnicians = async (lat: number, lng: number) => {
    setLoadingTechnicians(true);
    try {
      const token = localStorage.getItem('resqnow_user_token');
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const response = await fetch(apiUrl(`/api/technicians/nearby?lat=${lat}&lng=${lng}`), { headers });

      if (response.status === 401) {
        setTechnicians([]);
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch technicians');
      const data = await response.json();
      if (Array.isArray(data)) setTechnicians(data);
      else setTechnicians([]);

    } catch (error) {
      console.error('Error fetching technicians:', error);
      toast.error("Error", { description: "Failed to load technicians." });

      if (import.meta.env.DEV) {
        // Mock data
        const mockTechs: Technician[] = [
          {
            id: 'm1', name: 'Demo Tech A', service_type: 'General', distance: 2.5, rating: 4.8,
            latitude: lat + 0.01, longitude: lng + 0.01, aiRecommended: true,
            vehicle_types: ['car', 'bike'], specialties: ['Flat Tire', 'Jump Start']
          },
          {
            id: 'm2', name: 'Demo Tech B', service_type: 'Towing', distance: 5.0, rating: 4.5,
            latitude: lat - 0.02, longitude: lng - 0.01, aiRecommended: false,
            vehicle_types: ['car'], specialties: ['Towing', 'Accident Recovery']
          },
        ];
        setTechnicians(mockTechs);
      }
    } finally {
      setLoadingTechnicians(false);
    }
  };

  const handleTechSelect = (tech: Technician) => {
    setSelectedTech(tech);
    // Note: In Leaflet we might need a ref to flyTo, but MapUpdater handles basic centering if we update a state, 
    // or we can let the user manually move. 
    // For now, selecting a tech centers the map on them via MapContainer's child component if we passed it down, 
    // or we can just open the popup.
  };

  const handleBookService = (tech: Technician) => {
    const token = localStorage.getItem('resqnow_user_token');
    const lower = tech.service_type.toLowerCase();
    const serviceRoute = lower.includes('tow') ? 'towing' :
      lower.includes('tire') ? 'flat-tire' :
        lower.includes('battery') ? 'battery' : 'towing';

    const targetUrl = `/request-service/${serviceRoute}/car?techId=${tech.id}`;

    if (!token) {
      sessionStorage.setItem('returnUrl', targetUrl);
      navigate('/login');
    } else {
      navigate(targetUrl);
    }
  };

  // Helper functions
  const calculateETA = (distance: number) => {
    const minutes = Math.round(distance * 2) + 5;
    return `${minutes} - ${minutes + 5} mins`;
  };

  const formatDistance = (distance: number) => {
    const value = Number(distance);
    if (!Number.isFinite(value)) return "-- km";
    return `${value.toFixed(2)} km`;
  };

  const formatRating = (rating: number) => {
    const value = Number(rating);
    if (!Number.isFinite(value) || value <= 0) return "N/A";
    return value.toFixed(1);
  };

  const getVendorInitials = (name: string) => {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "V";
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  const checkVehicleSupport = (tech: Technician, type: string) => {
    if (type === 'all') return true;
    const types = tech.vehicle_types;
    if (!types) return true;
    if (Array.isArray(types)) return types.map(t => t.toLowerCase()).includes(type.toLowerCase());
    return (types as Record<string, boolean>)[type.toLowerCase()];
  };

  const filteredTechnicians = technicians.filter(tech =>
    tech &&
    typeof tech.latitude === 'number' &&
    typeof tech.longitude === 'number' &&
    tech.latitude !== 0 &&
    (filterService === 'all' || tech.service_type.toLowerCase() === filterService.toLowerCase()) &&
    checkVehicleSupport(tech, filterVehicle)
  ).sort((a, b) => {
    if (sortBy === 'distance') return a.distance - b.distance;
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'service') return a.service_type.localeCompare(b.service_type);
    return 0;
  });

  const uniqueServices = Array.from(new Set(technicians.map(t => t.service_type))).filter(Boolean);
  const uniqueVehicles = ["Car", "Bike", "Truck", "Bus"];

  const mapCenter: [number, number] = coordinates ? [coordinates.lat, coordinates.lng] : DEFAULT_CENTER;

  return (
    <div className="relative w-full h-[calc(100dvh-4rem)] overflow-hidden bg-muted/50 isolate">

      {/* Floating Top Controls */}
      <div className="absolute top-4 inset-x-4 z-[400] flex justify-between items-start pointer-events-none data-map-controls">
        <div className="flex flex-col gap-2">
          {/* Header Pill */}
          <div className="pointer-events-auto bg-card dark:bg-slate-900/95 backdrop-blur-md pl-2 pr-4 py-2 rounded-full shadow-lg shadow-slate-900/5 border border-border/50 flex items-center gap-3">
            <div className="bg-red-50 p-1.5 rounded-full">
              <MapIcon className="h-4 w-4 text-red-500" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground leading-none">Live Radar</h2>
            </div>
          </div>

          {(address || locationError) && (
            <div className="pointer-events-auto bg-card dark:bg-slate-900/95 backdrop-blur flex items-center gap-2 px-3 py-2 rounded-2xl shadow-md border border-border max-w-[200px] sm:max-w-xs animate-in slide-in-from-top-2">
              {locationError ? (
                <>
                  <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  <p className="text-amber-700 text-[10px] font-medium leading-tight">{locationError}</p>
                </>
              ) : address ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  <p className="text-muted-foreground text-[10px] font-medium leading-tight line-clamp-2">{address}</p>
                </>
              ) : null}
            </div>
          )}
        </div>

        <Button
          onClick={requestLocation}
          disabled={loadingLocation || loadingTechnicians}
          className="pointer-events-auto h-12 w-12 rounded-full shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-white shrink-0 p-0"
        >
          {loadingLocation ? <Loader2 className="h-5 w-5 animate-spin" /> : <Locate className="h-5 w-5" />}
        </Button>
      </div>

      {/* Full Screen Map Container */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={mapCenter}
          zoom={13}
          style={{ height: '100%', width: '100%', zIndex: 0 }}
          zoomControl={false}
          scrollWheelZoom={true}
          dragging={true}
          touchZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {coordinates && <MapUpdater center={[coordinates.lat, coordinates.lng]} />}

          {/* User Marker */}
          {coordinates && (
            <Marker position={[coordinates.lat, coordinates.lng]} icon={userIcon}>
              <Popup>You are here</Popup>
            </Marker>
          )}

          {/* Technician Markers */}
          {filteredTechnicians.map((tech) => (
            <Marker
              key={tech.id}
              position={[tech.latitude, tech.longitude]}
              icon={tech.aiRecommended ? recommendedIcon : techIcon}
              eventHandlers={{
                click: () => handleTechSelect(tech),
              }}
            >
              <Popup>
                <div className="p-1 min-w-[150px]">
                  <h3 className="font-bold text-sm mb-1 text-foreground">{tech.name}</h3>
                  <p className="text-xs text-muted-foreground mb-2">{tech.service_type}</p>
                  <Button
                    size="sm"
                    className="w-full h-7 text-xs"
                    onClick={() => handleBookService(tech)}
                  >
                    Book Now
                  </Button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {loadingTechnicians && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-card dark:bg-slate-900/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-border flex items-center gap-2 text-xs font-bold text-muted-foreground z-[400]">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Fetching Radar...
          </div>
        )}
      </div>
      {/* Bottom Sheet Overlay - Technician List */}
      {/* On desktop, we can pin this to the right side if needed, but going mobile-first: */}
      <div className="absolute inset-x-0 bottom-0 z-[500] lg:right-6 lg:left-auto lg:top-6 lg:bottom-6 lg:w-[400px] lg:rounded-[2rem] bg-card dark:bg-slate-900 rounded-t-[2.5rem] shadow-[0_-10px_40px_rgba(0,0,0,0.12)] border border-border flex flex-col max-h-[55dvh] lg:max-h-full transition-all duration-300">

        {/* Mobile Drag Handle */}
        <div className="w-full flex justify-center pt-4 pb-2 shrink-0 lg:hidden">
          <div className="w-12 h-1.5 bg-border rounded-full"></div>
        </div>

        <div className="px-5 pb-4 pt-1 border-b border-border/60 shrink-0 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-800 shadow-sm text-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-black text-xl text-foreground tracking-tight leading-none mb-1">Available Techs</h2>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{filteredTechnicians.length} Online</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Controls (Horizontal Scrollable) */}
          <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1">
            <Select value={filterService} onValueChange={setFilterService}>
              <SelectTrigger className="h-9 min-w-[120px] text-xs font-bold bg-muted border-border rounded-xl shadow-none text-muted-foreground hover:bg-muted/50 transition-colors">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {uniqueServices.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterVehicle} onValueChange={setFilterVehicle}>
              <SelectTrigger className="h-9 min-w-[120px] text-xs font-bold bg-muted border-border rounded-xl shadow-none text-muted-foreground hover:bg-muted/50 transition-colors">
                <SelectValue placeholder="Vehicle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Vehicles</SelectItem>
                {uniqueVehicles.map(v => <SelectItem key={v} value={v.toLowerCase()} className="text-xs">{v}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-9 min-w-[120px] text-xs font-bold bg-muted border-border rounded-xl shadow-none text-muted-foreground hover:bg-muted/50 transition-colors">
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="distance" className="text-xs">Nearest First</SelectItem>
                <SelectItem value="rating" className="text-xs">Highest Rated</SelectItem>
                <SelectItem value="service" className="text-xs">By Service</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 bg-muted/50 rounded-b-[2rem] overflow-y-auto overscroll-contain pb-6 hide-scrollbar relative">
          <div className="p-4 space-y-3">
            {loadingTechnicians ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-3">
                <div className="bg-primary/10 p-3 rounded-full animate-pulse">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
                <p className="font-medium text-sm">Locating experts...</p>
              </div>
            ) : filteredTechnicians.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 lg:py-10 text-muted-foreground text-center px-6">
                <div className="bg-card p-3 rounded-full mb-3 shadow-sm border border-border">
                  <Search className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="font-medium text-foreground text-sm">No technicians found</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[150px]">Try changing your filters.</p>
                <Button variant="outline" size="sm" className="mt-3 gap-2 h-8 text-xs" onClick={() => { setFilterService("all"); setFilterVehicle("all"); }}>
                  <RefreshCw className="h-3 w-3" /> Reset Filters
                </Button>
              </div>
            ) : (
              filteredTechnicians.map((tech) => (
                <Card
                  key={tech.id}
                  className={`group cursor-pointer transition-all duration-300 border rounded-2xl ${selectedTech?.id === tech.id
                    ? 'border-sky-300 ring-2 ring-sky-100 bg-card dark:bg-slate-900 shadow-[0_16px_28px_-24px_rgba(2,132,199,0.65)]'
                    : 'border-border bg-card dark:bg-slate-900 hover:border-slate-300 hover:shadow-[0_12px_24px_-22px_rgba(15,23,42,0.45)]'
                    }`}
                  onClick={() => handleTechSelect(tech)}
                >
                  <CardContent className="p-4 space-y-3">
                    {/* Header: Name, Badge, Rating */}
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 w-full overflow-hidden">
                        <div className="flex justify-between items-start w-full gap-2">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-10 w-10 rounded-xl bg-muted/50 border border-border flex items-center justify-center text-muted-foreground font-bold text-sm shrink-0">
                              {getVendorInitials(tech.name)}
                            </div>
                            <h4 className="font-bold text-base text-foreground leading-tight truncate group-hover:text-muted-foreground transition-colors">{tech.name}</h4>
                          </div>
                          <div className="flex items-center gap-1 text-xs font-bold bg-amber-50 px-2 py-1 rounded-full text-amber-700 border border-amber-200 shrink-0">
                            <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                            <span>{formatRating(tech.rating)}</span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 pl-[52px]">
                          <Badge variant="secondary" className="font-semibold text-[10px] px-2 py-0.5 h-auto bg-muted/50 text-muted-foreground border border-border">
                            {tech.service_type}
                          </Badge>
                          {tech.aiRecommended && (
                            <Badge className="bg-emerald-600 text-[10px] uppercase font-bold shadow-sm border-0 tracking-wide px-2 py-0.5 h-auto flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3" />
                              Best Match
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 text-[10px] sm:text-xs">
                      <div className="bg-muted p-2.5 rounded-xl border border-border flex flex-col justify-center">
                        <span className="text-muted-foreground/80 font-medium flex items-center gap-1.5"><Navigation className="h-3 w-3 text-muted-foreground/80" /> Distance</span>
                        <p className="font-bold text-foreground ml-4">{formatDistance(tech.distance)}</p>
                      </div>
                      <div className="bg-muted p-2.5 rounded-xl border border-border flex flex-col justify-center">
                        <span className="text-muted-foreground/80 font-medium flex items-center gap-1.5"><Clock3 className="h-3 w-3 text-muted-foreground/80" /> Est. Time</span>
                        <p className="font-bold text-emerald-700 ml-4">{calculateETA(tech.distance)}</p>
                      </div>
                    </div>

                    <div className={`pt-1 transition-all duration-300 ${selectedTech?.id === tech.id ? 'opacity-100' : 'opacity-100 lg:opacity-60 lg:group-hover:opacity-100'}`}>
                      <Button
                        size="sm"
                        className={`w-full font-bold shadow-sm h-9 text-xs rounded-xl ${selectedTech?.id === tech.id
                          ? 'bg-slate-900 hover:bg-slate-800 text-white'
                          : 'bg-card dark:bg-slate-900 text-muted-foreground border border-slate-300 hover:border-slate-800 hover:text-foreground hover:bg-muted'
                          }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookService(tech);
                        }}
                      >
                        {selectedTech?.id === tech.id ? 'Book Vendor' : 'Select'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div >
  );
};

export default Map;
