import React, { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Circle, MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useGeolocation } from "@/hooks/useGeolocation";
import { useIsMobile } from "@/hooks/use-mobile";
import { apiUrl } from "@/lib/api";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  LocateFixed,
  Navigation,
  PhoneCall,
  ShieldCheck,
  Sparkles,
  Star,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946];

type MapMode = "page" | "preview";

interface MapProps {
  mode?: MapMode;
}

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

function MapViewport({
  userPosition,
  activeTechnicianPosition,
  bottomPadding,
  rightPadding,
  reduceMotion,
}: {
  userPosition: [number, number] | null;
  activeTechnicianPosition: [number, number] | null;
  bottomPadding: number;
  rightPadding: number;
  reduceMotion: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    const invalidateTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 160);

    if (userPosition && activeTechnicianPosition) {
      map.fitBounds(L.latLngBounds([userPosition, activeTechnicianPosition]), {
        paddingTopLeft: [28, 92],
        paddingBottomRight: [rightPadding, bottomPadding],
        maxZoom: 14,
        animate: !reduceMotion,
      });
    } else if (userPosition) {
      map.setView(userPosition, 13.5, { animate: !reduceMotion });
    }

    return () => {
      window.clearTimeout(invalidateTimer);
    };
  }, [activeTechnicianPosition, bottomPadding, map, reduceMotion, rightPadding, userPosition]);

  return null;
}

function TowTruckIllustration({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <motion.div
      animate={reduceMotion ? undefined : { y: [0, -4, 0] }}
      transition={reduceMotion ? undefined : { duration: 4.8, repeat: Infinity, ease: "easeInOut" }}
      className="w-[118px] sm:w-[136px]"
    >
      <svg viewBox="0 0 220 140" className="h-auto w-full" role="img" aria-label="Tow truck illustration">
        <defs>
          <linearGradient id="truckCab" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fb7185" />
            <stop offset="100%" stopColor="#ef4444" />
          </linearGradient>
          <linearGradient id="truckBed" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>

        <g opacity="0.9">
          <rect x="142" y="12" width="12" height="58" rx="4" fill="#e2e8f0" />
          <rect x="160" y="2" width="16" height="68" rx="4" fill="#e5e7eb" />
          <rect x="182" y="18" width="14" height="52" rx="4" fill="#cbd5e1" />
          <rect x="199" y="28" width="10" height="42" rx="3" fill="#e2e8f0" />
          <path d="M130 70h84" stroke="#e2e8f0" strokeWidth="6" strokeLinecap="round" />
        </g>

        <ellipse cx="116" cy="110" rx="78" ry="12" fill="#e2e8f0" />

        <g transform="translate(18 28)">
          <path d="M62 54h68l8 16H52z" fill="url(#truckBed)" />
          <path d="M118 42h20c10 0 18 8 18 18v16h-38z" fill="url(#truckCab)" />
          <path d="M121 46h18c7 0 13 6 13 13v7h-31z" fill="#f8fafc" opacity="0.88" />
          <rect x="36" y="52" width="24" height="6" rx="3" fill="#94a3b8" />
          <path d="M26 60l18-18h6l-14 18z" fill="#94a3b8" />
          <path d="M40 42l-8 30" stroke="#94a3b8" strokeWidth="5" strokeLinecap="round" />
          <circle cx="72" cy="80" r="15" fill="#0f172a" />
          <circle cx="72" cy="80" r="6" fill="#cbd5e1" />
          <circle cx="142" cy="80" r="15" fill="#0f172a" />
          <circle cx="142" cy="80" r="6" fill="#cbd5e1" />
          <path d="M51 50h35c9 0 16 7 16 16v4H44v-2c0-10 8-18 18-18z" fill="#f1f5f9" />
          <path d="M66 48h18c4 0 8 3 8 8v7H58v-2c0-7 4-13 8-13z" fill="#cbd5e1" />
          <circle cx="58" cy="70" r="8" fill="#334155" />
          <circle cx="90" cy="70" r="8" fill="#334155" />
          <path d="M153 56h14" stroke="#f8fafc" strokeWidth="4" strokeLinecap="round" />
        </g>
      </svg>
    </motion.div>
  );
}

const toNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const estimateDistanceKm = (
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
) => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const deltaLat = toRadians(toLat - fromLat);
  const deltaLng = toRadians(toLng - fromLng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) * Math.sin(deltaLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const calculateEtaMinutes = (distance: number) => Math.max(8, Math.round(toNumber(distance, 0) * 2.15 + 4));

const formatDistanceCompact = (distance: number) => {
  const value = toNumber(distance, NaN);
  return Number.isFinite(value) ? `${value.toFixed(1)} km` : "-- km";
};

const formatDistanceDetailed = (distance: number) => {
  const value = toNumber(distance, NaN);
  return Number.isFinite(value) ? `${value.toFixed(1)} km` : "--";
};

const formatEtaWindow = (distance: number) => {
  const eta = calculateEtaMinutes(distance);
  return `${eta} - ${eta + 5} mins`;
};

const formatRating = (rating: number) => {
  const value = toNumber(rating, NaN);
  return Number.isFinite(value) && value > 0 ? value.toFixed(1) : "New";
};

const getVendorInitials = (name: string) => {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return "RN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
};

const getServiceHighlights = (tech: Technician) => {
  if (Array.isArray(tech.specialties) && tech.specialties.length > 0) {
    return tech.specialties.slice(0, 3).join(" / ");
  }

  const serviceType = tech.service_type.trim();
  return serviceType ? `${serviceType} / Roadside Help` : "Towing / Recovery / Roadside Help";
};

const buildRouteCurve = (from: [number, number], to: [number, number]): [number, number][] => {
  const [fromLat, fromLng] = from;
  const [toLat, toLng] = to;
  const latDelta = toLat - fromLat;
  const lngDelta = toLng - fromLng;

  const firstCurve: [number, number] = [
    fromLat + latDelta * 0.28 + lngDelta * 0.08,
    fromLng + lngDelta * 0.28 - latDelta * 0.08,
  ];
  const middleCurve: [number, number] = [
    (fromLat + toLat) / 2 + lngDelta * 0.14,
    (fromLng + toLng) / 2 - latDelta * 0.14,
  ];
  const secondCurve: [number, number] = [
    fromLat + latDelta * 0.74 + lngDelta * 0.03,
    fromLng + lngDelta * 0.74 - latDelta * 0.03,
  ];

  return [from, firstCurve, middleCurve, secondCurve, to];
};

const createUserIcon = () =>
  L.divIcon({
    className: "radar-user-marker-wrapper",
    html: `
      <div class="radar-user-marker">
        <span class="radar-user-marker__ring radar-user-marker__ring--outer"></span>
        <span class="radar-user-marker__ring radar-user-marker__ring--middle"></span>
        <span class="radar-user-marker__ring radar-user-marker__ring--inner"></span>
        <span class="radar-user-marker__dot"></span>
      </div>
    `,
    iconSize: [78, 78],
    iconAnchor: [39, 39],
  });

const createTechnicianIcon = (tech: Technician, selected: boolean) => {
  const initials = getVendorInitials(tech.name);
  const eta = calculateEtaMinutes(tech.distance);

  return L.divIcon({
    className: "radar-tech-marker-wrapper",
    html: `
      <div class="radar-tech-marker${selected ? " radar-tech-marker--selected" : ""}">
        <div class="radar-tech-marker__bubble">
          <span class="radar-tech-marker__avatar">${initials}</span>
          <div class="radar-tech-marker__copy">
            <span>${eta} min</span>
            <small>${formatDistanceCompact(tech.distance)}</small>
          </div>
        </div>
        <div class="radar-tech-marker__pin">
          <span class="radar-tech-marker__pulse"></span>
          <span class="radar-tech-marker__core">${initials.slice(0, 1)}</span>
        </div>
      </div>
    `,
    iconSize: [124, 90],
    iconAnchor: [26, 74],
  });
};

const userRadarIcon = createUserIcon();

const normalizeTechnicians = (input: unknown, origin: [number, number]) => {
  if (!Array.isArray(input)) return [];

  return input
    .map((item, index) => {
      const raw = (item ?? {}) as Record<string, unknown>;
      const latitude = toNumber(raw.latitude ?? raw.lat, NaN);
      const longitude = toNumber(raw.longitude ?? raw.lng, NaN);

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude === 0 || longitude === 0) {
        return null;
      }

      const specialties = Array.isArray(raw.specialties)
        ? raw.specialties.map((entry) => String(entry)).filter(Boolean)
        : [];

      const vehicleTypes =
        Array.isArray(raw.vehicle_types) || typeof raw.vehicle_types === "object"
          ? (raw.vehicle_types as Record<string, boolean> | string[])
          : Array.isArray(raw.vehicleTypes)
            ? (raw.vehicleTypes as string[])
            : undefined;

      return {
        id: String(raw.id ?? `tech-${index}`),
        name: String(raw.name ?? raw.shop_name ?? raw.business_name ?? "Nearby Technician"),
        service_type: String(raw.service_type ?? raw.serviceType ?? raw.primary_service ?? "Roadside Help"),
        distance: toNumber(
          raw.distance,
          estimateDistanceKm(origin[0], origin[1], latitude, longitude),
        ),
        rating: toNumber(raw.rating ?? raw.average_rating ?? raw.avg_rating, 4.8),
        latitude,
        longitude,
        aiRecommended: Boolean(
          raw.aiRecommended ?? raw.ai_recommended ?? raw.best_match ?? raw.is_recommended,
        ),
        specialties,
        vehicle_types: vehicleTypes,
      } satisfies Technician;
    })
    .filter((tech): tech is Technician => Boolean(tech));
};

const Map = ({ mode = "page" }: MapProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const reduceMotion = useReducedMotion();
  const { coordinates, loading: loadingLocation, error: locationError, requestLocation } = useGeolocation();

  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loadingTechnicians, setLoadingTechnicians] = useState(false);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(null);
  const [sheetExpanded, setSheetExpanded] = useState(false);

  const isPreview = mode === "preview";
  const mapCenter: [number, number] = coordinates ? [coordinates.lat, coordinates.lng] : DEFAULT_CENTER;

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    if (!isMobile) {
      setSheetExpanded(true);
    }
  }, [isMobile]);

  useEffect(() => {
    if (coordinates) {
      fetchTechnicians(coordinates.lat, coordinates.lng);
    }
  }, [coordinates]);

  const fetchTechnicians = async (lat: number, lng: number) => {
    setLoadingTechnicians(true);

    try {
      const token = localStorage.getItem("resqnow_user_token");
      const headers: HeadersInit = { "Content-Type": "application/json" };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(apiUrl(`/api/technicians/nearby?lat=${lat}&lng=${lng}`), { headers });

      if (response.status === 401) {
        setTechnicians([]);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch technicians");
      }

      const data = await response.json();
      setTechnicians(normalizeTechnicians(data, [lat, lng]));
    } catch (error) {
      console.error("Error fetching technicians:", error);
      toast.error("Unable to load nearby technicians", {
        description: "Showing demo radar positions so you can still preview the layout.",
      });

      if (import.meta.env.DEV) {
        const mockTechs = normalizeTechnicians(
          [
            {
              id: "m1",
              name: "Squad Recovery Service",
              service_type: "Towing",
              distance: 4.6,
              rating: 5,
              latitude: lat + 0.012,
              longitude: lng - 0.006,
              aiRecommended: true,
              specialties: ["Towing", "Recovery", "Roadside Help"],
              vehicle_types: ["car", "truck"],
            },
            {
              id: "m2",
              name: "Rapid Tow Service",
              service_type: "Battery",
              distance: 6.2,
              rating: 4.8,
              latitude: lat - 0.011,
              longitude: lng - 0.012,
              specialties: ["Towing", "Battery", "Fuel Delivery"],
              vehicle_types: ["car", "bike"],
            },
            {
              id: "m3",
              name: "AutoTech Service",
              service_type: "Tyre Change",
              distance: 7.1,
              rating: 4.6,
              latitude: lat + 0.018,
              longitude: lng + 0.01,
              specialties: ["Tyre Change", "Jump Start", "Roadside Help"],
              vehicle_types: ["car"],
            },
          ],
          [lat, lng],
        );

        setTechnicians(mockTechs);
      } else {
        setTechnicians([]);
      }
    } finally {
      setLoadingTechnicians(false);
    }
  };

  const orderedTechnicians = [...technicians].sort((a, b) => {
    if (a.aiRecommended && !b.aiRecommended) return -1;
    if (!a.aiRecommended && b.aiRecommended) return 1;
    return toNumber(a.distance, Number.MAX_SAFE_INTEGER) - toNumber(b.distance, Number.MAX_SAFE_INTEGER);
  });

  useEffect(() => {
    if (orderedTechnicians.length === 0) {
      setSelectedTechId(null);
      return;
    }

    const hasActiveSelection = selectedTechId
      ? orderedTechnicians.some((tech) => tech.id === selectedTechId)
      : false;

    if (!hasActiveSelection) {
      setSelectedTechId(orderedTechnicians[0].id);
    }
  }, [orderedTechnicians, selectedTechId]);

  const bestMatch = orderedTechnicians[0] ?? null;
  const activeTech = orderedTechnicians.find((tech) => tech.id === selectedTechId) ?? bestMatch;
  const userPosition = coordinates ? ([coordinates.lat, coordinates.lng] as [number, number]) : null;
  const activeTechPosition = activeTech ? ([activeTech.latitude, activeTech.longitude] as [number, number]) : null;
  const routePath =
    userPosition && activeTechPosition ? buildRouteCurve(activeTechPosition, userPosition) : [];
  const nearbyCount = orderedTechnicians.length;
  const activeEta = activeTech ? calculateEtaMinutes(activeTech.distance) : null;
  const secondaryTechnicians = orderedTechnicians.filter((tech) => tech.id !== activeTech?.id);
  const visibleSecondaryTechnicians =
    sheetExpanded || !isMobile ? secondaryTechnicians : secondaryTechnicians.slice(0, 3);

  const handleTechSelect = (tech: Technician) => {
    setSelectedTechId(tech.id);

    if (isMobile) {
      setSheetExpanded(true);
    }
  };

  const handleBookService = (tech: Technician) => {
    const token = localStorage.getItem("resqnow_user_token");
    const lower = tech.service_type.toLowerCase();
    const serviceRoute = lower.includes("tow")
      ? "towing"
      : lower.includes("tire") || lower.includes("tyre")
        ? "flat-tire"
        : lower.includes("battery")
          ? "battery"
          : "towing";

    const targetUrl = `/request-service/${serviceRoute}/car?techId=${tech.id}`;

    if (!token) {
      sessionStorage.setItem("returnUrl", targetUrl);
      navigate("/login");
      return;
    }

    navigate(targetUrl);
  };

  const containerClasses = isPreview
    ? "relative isolate mx-auto h-[760px] w-full max-w-6xl overflow-hidden rounded-[2.75rem] border border-slate-200 bg-[#eef3fb] shadow-[0_45px_90px_-50px_rgba(15,23,42,0.5)]"
    : "relative isolate h-[calc(100dvh-3.5rem)] overflow-hidden bg-[#eef3fb] md:h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-5rem)]";

  const panelClasses = cn(
    "absolute z-[420] overflow-hidden bg-white/96 backdrop-blur-xl border border-white/70 shadow-[0_-14px_45px_rgba(15,23,42,0.16)]",
    isPreview
      ? "right-6 top-6 bottom-6 w-[388px] rounded-[2rem]"
      : "inset-x-0 bottom-0 rounded-t-[2rem] md:inset-y-6 md:right-6 md:left-auto md:w-[398px] md:rounded-[2rem]",
    !isPreview && (sheetExpanded ? "max-h-[76dvh] md:max-h-none" : "max-h-[56dvh] md:max-h-none"),
  );

  const mapFitBottomPadding = isMobile ? (sheetExpanded ? 336 : 256) : 56;
  const mapFitRightPadding = isMobile ? 32 : 432;

  return (
    <div className={containerClasses}>
      <div className="absolute inset-0">
        <MapContainer
          center={mapCenter}
          zoom={13}
          className="radar-map h-full w-full"
          zoomControl={false}
          attributionControl={false}
          scrollWheelZoom
          dragging
          touchZoom
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />

          <MapViewport
            userPosition={userPosition}
            activeTechnicianPosition={activeTechPosition}
            bottomPadding={mapFitBottomPadding}
            rightPadding={mapFitRightPadding}
            reduceMotion={reduceMotion}
          />

          {userPosition && (
            <>
              <Circle
                center={userPosition}
                radius={240}
                pathOptions={{ color: "transparent", fillColor: "#fb7185", fillOpacity: 0.08 }}
              />
              <Circle
                center={userPosition}
                radius={140}
                pathOptions={{ color: "transparent", fillColor: "#fb7185", fillOpacity: 0.14 }}
              />
              <Marker position={userPosition} icon={userRadarIcon} zIndexOffset={600} />
            </>
          )}

          {activeTechPosition && (
            <Circle
              center={activeTechPosition}
              radius={180}
              pathOptions={{ color: "transparent", fillColor: "#34d399", fillOpacity: 0.11 }}
            />
          )}

          {routePath.length > 1 && (
            <>
              <Polyline
                positions={routePath}
                pathOptions={{
                  color: "rgba(255,255,255,0.88)",
                  weight: 8,
                  opacity: 0.72,
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
              <Polyline
                positions={routePath}
                pathOptions={{
                  color: "#ff4d5a",
                  weight: 4,
                  opacity: 0.92,
                  dashArray: "6 10",
                  lineCap: "round",
                  lineJoin: "round",
                }}
              />
            </>
          )}

          {orderedTechnicians.map((tech) => (
            <Marker
              key={tech.id}
              position={[tech.latitude, tech.longitude]}
              icon={createTechnicianIcon(tech, activeTech?.id === tech.id)}
              eventHandlers={{ click: () => handleTechSelect(tech) }}
              zIndexOffset={activeTech?.id === tech.id ? 400 : 150}
            />
          ))}
        </MapContainer>

        <div
          className="pointer-events-none absolute inset-0 z-[380]"
          style={{
            background:
              "radial-gradient(circle at top right, rgba(255,255,255,0.8), transparent 22%), radial-gradient(circle at bottom left, rgba(255,255,255,0.55), transparent 28%), linear-gradient(180deg, rgba(245,248,255,0.18), rgba(245,248,255,0.34))",
          }}
        />
      </div>

      <div className="pointer-events-none absolute inset-x-4 top-4 z-[430] flex items-start justify-between md:inset-x-6 md:top-6">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="pointer-events-auto max-w-[220px] rounded-[1.35rem] bg-white/96 px-4 py-3 shadow-[0_18px_35px_-22px_rgba(15,23,42,0.4)]"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 shadow-inner shadow-rose-100/60">
              <span className="relative flex h-5 w-5 items-center justify-center">
                <span className="absolute h-5 w-5 rounded-full border-2 border-rose-500/45" />
                <span className="absolute h-2.5 w-2.5 rounded-full bg-rose-500" />
              </span>
            </span>
            <div>
              <p className="text-[15px] font-extrabold tracking-tight text-slate-900">Live Radar</p>
              <p className="text-xs font-medium text-emerald-600">
                {loadingTechnicians ? "Scanning nearby teams" : `${nearbyCount} Tech${nearbyCount === 1 ? "" : "s"} Nearby`}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.24, delay: 0.04 }}
          className="pointer-events-auto"
        >
          <Button
            type="button"
            onClick={requestLocation}
            disabled={loadingLocation || loadingTechnicians}
            className="h-12 w-12 rounded-[1.2rem] bg-white/96 p-0 text-slate-700 shadow-[0_18px_35px_-22px_rgba(15,23,42,0.4)] hover:bg-white"
          >
            {loadingLocation ? <Loader2 className="h-5 w-5 animate-spin" /> : <LocateFixed className="h-5 w-5" />}
          </Button>
        </motion.div>
      </div>

      {locationError && (
        <div className="absolute left-4 top-[5.5rem] z-[430] max-w-[240px] rounded-2xl bg-white/92 px-3 py-2 text-[11px] font-medium text-amber-700 shadow-[0_10px_24px_-16px_rgba(15,23,42,0.35)] md:left-6 md:top-[6.25rem]">
          {locationError}
        </div>
      )}

      {!isPreview && (
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.12 }}
          className="absolute right-4 z-[430] md:right-6"
          style={{ bottom: isMobile ? "calc(env(safe-area-inset-bottom) + 5.4rem)" : "2rem" }}
        >
          <Button
            type="button"
            onClick={() => navigate("/request-service/emergency")}
            className="h-[72px] w-[72px] rounded-full bg-[linear-gradient(135deg,#ff4d4f,#ff1f3d)] p-0 text-white shadow-[0_28px_38px_-24px_rgba(239,68,68,0.9)] hover:opacity-95"
          >
            <span className="flex flex-col items-center justify-center gap-1">
              <PhoneCall className="h-5 w-5" />
              <span className="text-[12px] font-extrabold tracking-wide">SOS</span>
            </span>
          </Button>
        </motion.div>
      )}

      <motion.section
        initial={reduceMotion ? undefined : { opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className={panelClasses}
      >
        <div className="flex h-full flex-col">
          <button
            type="button"
            onClick={() => setSheetExpanded((current) => !current)}
            className="flex items-center justify-center gap-2 pt-3 text-slate-400 transition hover:text-slate-600 md:hidden"
            aria-label={sheetExpanded ? "Collapse nearby technicians panel" : "Expand nearby technicians panel"}
          >
            <span className="h-1.5 w-12 rounded-full bg-slate-300" />
            {sheetExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>

          <div
            className={cn(
              "flex-1 overflow-y-auto px-4 pb-5 pt-2 custom-scrollbar sm:px-5",
              !isPreview && "pb-[calc(env(safe-area-inset-bottom)+5.75rem)] md:pb-5",
            )}
          >
            <div className="space-y-4">
              <div
                className="relative overflow-hidden rounded-[1.9rem] border border-rose-100 px-4 pb-4 pt-4"
                style={{
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(255,245,245,0.94) 100%)",
                }}
              >
                <div className="pr-[7.1rem]">
                  <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-rose-500">
                    <Sparkles className="h-3.5 w-3.5" />
                    {activeTech?.id === bestMatch?.id ? "Best Match Found" : "Alternative Nearby"}
                  </div>
                  <h2 className="mt-3 text-[1.7rem] font-black leading-[1.05] tracking-tight text-slate-950">
                    {activeEta ? `Help arriving in ${activeEta} mins` : "Finding your nearest help"}
                  </h2>
                  <p className="mt-2 max-w-[220px] text-xs font-medium leading-relaxed text-slate-500">
                    {activeTech
                      ? "We found the best nearby technician for you with fast dispatch and verified support."
                      : "Turn on location access so we can match you with nearby support teams."}
                  </p>
                </div>

                <div className="pointer-events-none absolute bottom-1 right-1">
                  <TowTruckIllustration reduceMotion={reduceMotion} />
                </div>
              </div>

              {loadingTechnicians && (
                <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)]">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-500">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-slate-900">Scanning live radar...</p>
                      <p className="text-xs text-slate-500">Matching you with the closest verified technicians.</p>
                    </div>
                  </div>
                </div>
              )}

              {!loadingTechnicians && activeTech && (
                <motion.div
                  layout={!reduceMotion}
                  className="rounded-[1.75rem] border border-slate-100 bg-white p-4 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.26)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-base font-black text-white">
                        {getVendorInitials(activeTech.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[1rem] font-black tracking-tight text-slate-900">
                            {activeTech.name}
                          </p>
                          <Badge className="rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-rose-500 hover:bg-rose-50">
                            {activeTech.id === bestMatch?.id ? "Best Match" : "Nearby"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs font-medium text-slate-500">{getServiceHighlights(activeTech)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[13px] font-black text-amber-500">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      <span>{formatRating(activeTech.rating)}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2.5">
                    <div className="rounded-2xl bg-slate-50 px-3 py-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                        <Navigation className="h-3.5 w-3.5" />
                        Distance
                      </div>
                      <p className="mt-1 text-sm font-black text-slate-900">{formatDistanceDetailed(activeTech.distance)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                        <Clock3 className="h-3.5 w-3.5" />
                        ETA
                      </div>
                      <p className="mt-1 text-sm font-black text-slate-900">{formatEtaWindow(activeTech.distance)}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Verified
                      </div>
                      <p className="mt-1 text-sm font-black text-emerald-600">Trusted</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between rounded-[1.25rem] border border-emerald-100 bg-emerald-50 px-3 py-2.5">
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Background Verified
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-600">Trusted &amp; Verified</span>
                  </div>

                  <Button
                    type="button"
                    onClick={() => handleBookService(activeTech)}
                    className="mt-4 h-12 w-full rounded-[1.2rem] bg-[linear-gradient(135deg,#ff3b4d,#ff263f)] text-sm font-black text-white shadow-[0_24px_32px_-24px_rgba(239,68,68,0.85)] hover:opacity-95"
                  >
                    <span className="flex w-full items-center justify-center gap-2">
                      Request Now
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/20">
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </span>
                  </Button>
                </motion.div>
              )}

              {!loadingTechnicians && !activeTech && (
                <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 text-center shadow-[0_18px_40px_-32px_rgba(15,23,42,0.35)]">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                    <Wrench className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-base font-black tracking-tight text-slate-900">No nearby technicians yet</p>
                  <p className="mt-2 text-sm text-slate-500">
                    Enable location access or refresh the radar to search again.
                  </p>
                  <Button
                    type="button"
                    onClick={requestLocation}
                    className="mt-4 rounded-full bg-slate-900 px-5 text-white hover:bg-slate-800"
                  >
                    Use My Location
                  </Button>
                </div>
              )}

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="text-[0.95rem] font-black tracking-tight text-slate-900">Other Technicians Nearby</p>
                    <p className="text-xs font-medium text-slate-500">
                      {secondaryTechnicians.length > 0
                        ? `${secondaryTechnicians.length} additional options around you`
                        : "No other nearby technicians right now"}
                    </p>
                  </div>
                  {secondaryTechnicians.length > 3 && (
                    <button
                      type="button"
                      onClick={() => setSheetExpanded((current) => !current)}
                      className="text-xs font-extrabold text-rose-500 transition hover:text-rose-600"
                    >
                      {sheetExpanded ? "See less" : "See all"}
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {visibleSecondaryTechnicians.map((tech, index) => {
                    const isBestRow = tech.id === bestMatch?.id;
                    const isSelected = tech.id === activeTech?.id;

                    return (
                      <motion.button
                        key={tech.id}
                        type="button"
                        onClick={() => handleTechSelect(tech)}
                        initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.24, delay: index * 0.04 }}
                        className={cn(
                          "w-full rounded-[1.35rem] border bg-white p-3 text-left shadow-[0_14px_32px_-30px_rgba(15,23,42,0.4)] transition",
                          isSelected
                            ? "border-rose-200 ring-2 ring-rose-100"
                            : "border-slate-100 hover:border-slate-200 hover:shadow-[0_18px_32px_-28px_rgba(15,23,42,0.4)]",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white">
                            {getVendorInitials(tech.name)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-sm font-black tracking-tight text-slate-900">{tech.name}</p>
                              <div className="flex items-center gap-1 text-[12px] font-bold text-amber-500">
                                <Star className="h-3.5 w-3.5 fill-current" />
                                <span>{formatRating(tech.rating)}</span>
                              </div>
                              {isBestRow && (
                                <Badge className="rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-rose-500 hover:bg-rose-50">
                                  Best Match
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">
                              {getServiceHighlights(tech)}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-xs font-black text-slate-900">{formatEtaWindow(tech.distance)}</p>
                            <p className="mt-0.5 text-[11px] font-medium text-slate-500">
                              {formatDistanceCompact(tech.distance)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-end">
                          <span
                            className={cn(
                              "rounded-full border px-4 py-2 text-[11px] font-extrabold transition",
                              isSelected
                                ? "border-rose-200 bg-rose-50 text-rose-500"
                                : "border-rose-100 text-rose-500 hover:bg-rose-50",
                            )}
                          >
                            {isSelected ? "Selected" : "Select"}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>
    </div>
  );
};

export default Map;
