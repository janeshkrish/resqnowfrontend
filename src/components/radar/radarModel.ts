import { SERVICE_CATALOG } from "@/config/serviceCatalog";
import { brandOf, initialsOf } from "@/lib/brands";
import { googleMapsDirectionsUrl, formatChargingPower, type EVChargingStation } from "@/lib/evCharging";
import type { FuelStation } from "@/lib/fuelStations";
import type { FuelPrice } from "@/lib/homeApi";
import type { EvView, FuelView, RowView, TechnicianView } from "./RadarParts";

export interface Technician {
  id: string;
  name: string;
  serviceType: string;
  specialties: string[];
  vehicleTypes: string[];
  distance: number;
  rating: number;
  jobs: number;
  latitude: number;
  longitude: number;
  photo: string | null;
  recommended: boolean;
}

const toNumber = (value: unknown, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const title = (value: string) =>
  String(value || "").trim().replace(/[_-]+/g, " ").split(/\s+/).filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");

export const distanceKm = (fromLat: number, fromLng: number, toLat: number, toLng: number) => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(rad(toLat - fromLat) / 2) ** 2 + Math.cos(rad(fromLat)) * Math.cos(rad(toLat)) * Math.sin(rad(toLng - fromLng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Rough arrival estimate from distance, the same one the booking screens use. */
export const etaMinutes = (km: number) => Math.max(8, Math.round(toNumber(km, 0) * 2.15 + 4));

export const formatKm = (km: number | undefined | null) =>
  typeof km === "number" && Number.isFinite(km) ? (km < 1 ? `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m` : `${km.toFixed(1)} km`) : "—";

const vehicleList = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (value && typeof value === "object") return Object.entries(value as Record<string, unknown>).filter(([, on]) => Boolean(on)).map(([key]) => key);
  return [];
};

/** Nearby technicians from /api/technicians/nearby, with a usable photo URL when they have one. */
export function normalizeTechnicians(input: unknown, origin: [number, number], resolvePhoto: (path: string) => string): Technician[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item, index): Technician | null => {
      const raw = (item ?? {}) as Record<string, unknown>;
      const latitude = toNumber(raw.latitude ?? raw.lat, NaN);
      const longitude = toNumber(raw.longitude ?? raw.lng, NaN);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude === 0 || longitude === 0) return null;
      const photoPath = typeof raw.profile_photo === "string" ? raw.profile_photo.trim() : "";
      return {
        id: String(raw.id ?? `tech-${index}`),
        name: String(raw.name ?? "Nearby technician"),
        serviceType: String(raw.service_type ?? raw.serviceType ?? "Roadside help"),
        specialties: Array.isArray(raw.specialties) ? raw.specialties.map(String).filter(Boolean) : [],
        vehicleTypes: vehicleList(raw.vehicle_types ?? raw.vehicleTypes),
        distance: toNumber(raw.distance, distanceKm(origin[0], origin[1], latitude, longitude)),
        rating: toNumber(raw.rating, 0),
        jobs: toNumber(raw.jobs_completed ?? raw.completedJobs, 0),
        latitude,
        longitude,
        photo: photoPath ? (/^https?:\/\//i.test(photoPath) ? photoPath : resolvePhoto(photoPath)) : null,
        recommended: Boolean(raw.aiRecommended),
      };
    })
    .filter((tech): tech is Technician => Boolean(tech))
    .sort((a, b) => a.distance - b.distance);
}

const serviceName = (key: string) => {
  const normalized = String(key || "").toLowerCase();
  const match = SERVICE_CATALOG.find((service) => service.id === normalized || normalized.includes(service.id));
  return (match?.name ?? title(key)).replace(/ Services$/, "");
};

const VEHICLES: Array<[RegExp, string, string]> = [
  [/bike|two|scooter|2w/i, "Bike", "two_wheeler"],
  [/suv|jeep/i, "SUV", "airport_shuttle"],
  [/truck|commercial|heavy|lorry/i, "Truck", "local_shipping"],
  [/car|4w|sedan|hatch/i, "Car", "directions_car"],
];

export function toTechnicianView(t: Technician): TechnicianView {
  const services = Array.from(new Set((t.specialties.length ? t.specialties : [t.serviceType]).map(title))).slice(0, 5);
  const vehicles = Array.from(new Map(
    t.vehicleTypes.map((v) => VEHICLES.find(([pattern]) => pattern.test(v)))
      .filter((match): match is [RegExp, string, string] => Boolean(match))
      .map(([, label, icon]) => [label, { label, icon }]),
  ).values());
  return {
    id: t.id,
    name: t.name,
    sub: serviceName(t.serviceType),
    rating: t.rating > 0 ? t.rating.toFixed(1) : "New",
    jobs: t.jobs,
    etaMinutes: etaMinutes(t.distance),
    km: formatKm(t.distance),
    services,
    vehicles,
    photo: t.photo,
    logo: null,
    initials: initialsOf(t.name),
  };
}

const openStatus = (isOpen: boolean | undefined, hours?: string) => {
  if (isOpen === true) return { text: hours ? `Open · ${hours}` : "Open", tone: "open" as const };
  if (isOpen === false) return { text: hours ? `Closed · ${hours}` : "Closed", tone: "closed" as const };
  return { text: hours ? `Hours: ${hours}` : "Hours not listed", tone: "none" as const };
};

const firstSegment = (address?: string) => address?.split(",")[0]?.trim() || undefined;

/** Mappls names chargers in full ("… Electric Vehicle Charging Station"); "EV" keeps cards readable. */
const shortStationName = (name: string) => name.replace(/\belectric vehicle\b/gi, "EV").replace(/\s{2,}/g, " ").trim();

export function toEvView(e: EVChargingStation): EvView {
  const brand = brandOf(e.brand);
  const power = formatChargingPower(e.chargingPower);
  const area = firstSegment(e.address);
  return {
    id: e.id,
    name: shortStationName(e.name),
    area,
    sub: [brand?.name, area].filter(Boolean).join(" · ") || undefined,
    logo: brand?.logo ?? null,
    photo: null,
    initials: initialsOf(brand?.name ?? e.name),
    status: openStatus(e.isOpen, e.openingHours?.[0]),
    km: formatKm(typeof e.distance === "number" ? e.distance / 1000 : undefined),
    directionsUrl: googleMapsDirectionsUrl(e),
    kw: power ? power.replace(/\s*kW$/, "") : null,
    connectors: e.connectorTypes ?? [],
    chargingTypes: e.chargingTypes ?? [],
    points: e.chargingSlots ?? null,
    address: e.address,
    phone: e.phone,
  };
}

const FUEL_LABELS: Record<string, string> = { petrol: "Petrol", diesel: "Diesel", cng: "CNG" };

export function toFuelView(f: FuelStation, prices: FuelPrice[] | undefined): FuelView {
  const brand = brandOf(f.brand);
  const types = f.stationTypes?.length ? f.stationTypes : ["petrol"];
  const fuels = types.flatMap((type) => (type === "cng" ? ["cng"] : ["petrol", "diesel"]));
  return {
    id: f.id,
    name: f.name,
    logo: brand?.logo ?? null,
    photo: null,
    initials: initialsOf(brand?.name ?? f.name),
    sub: [brand?.name, firstSegment(f.address)].filter(Boolean).join(" · ") || undefined,
    status: openStatus(f.isOpen, f.openingHours?.[0]),
    km: formatKm(typeof f.distance === "number" ? f.distance / 1000 : undefined),
    area: firstSegment(f.address),
    address: f.address,
    phone: f.phone,
    directionsUrl: googleMapsDirectionsUrl({ id: f.id, name: f.name, address: f.address, latitude: f.latitude, longitude: f.longitude }),
    prices: (prices ?? [])
      .filter((price) => fuels.includes(price.fuel))
      .map((price) => ({ label: FUEL_LABELS[price.fuel] ?? price.label, value: `₹${price.price.toFixed(2)}`, change: price.change })),
  };
}

export const techRow = (t: TechnicianView): RowView => ({
  id: t.id, name: t.name, meta: `★ ${t.rating} · ${t.sub}`, value: `${t.etaMinutes} min`, valueSub: t.km, hot: true,
  logo: null, photo: t.photo, initials: t.initials,
});

export const evRow = (e: EvView): RowView => ({
  id: e.id, name: e.name,
  meta: [e.area, e.status.tone === "none" ? null : e.status.text, e.connectors.slice(0, 2).join(", ")].filter(Boolean).join(" · ") || e.status.text,
  value: e.kw ? `${e.kw} kW` : "EV", valueSub: e.km, logo: e.logo, photo: null, initials: e.initials,
});

export const fuelRow = (f: FuelView): RowView => ({
  id: f.id, name: f.name, meta: [f.area, f.status.tone === "none" ? null : f.status.text].filter(Boolean).join(" · ") || f.status.text,
  value: f.prices[0]?.value ?? "—", valueSub: f.km, logo: f.logo, photo: null, initials: f.initials,
});
