import { apiFetch } from "@/lib/api";

export type ServicePrice = {
  service: string;
  startingPrice: number | null;
  technicians: number;
};

export type ServicePricesResponse = {
  vehicle: string;
  currency: string;
  services: ServicePrice[];
};

export type FuelType = "petrol" | "diesel" | "cng" | "ev";

export type FuelPrice = {
  fuel: FuelType;
  label: string;
  price: number;
  unit: string;
  change: number | null;
  effectiveDate: string;
};

export type FuelPricesResponse = {
  available: boolean;
  location?: { area: string; state: string; scope: string };
  asOf?: string;
  stale?: boolean;
  prices?: FuelPrice[];
};

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await apiFetch(path, { signal });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return (await response.json()) as T;
}

/** "Starts from" price per service, from approved technicians' rates (fees included). */
export function fetchServicePrices(vehicle: string, signal?: AbortSignal) {
  return getJson<ServicePricesResponse>(`/api/public/service-prices?vehicle=${encodeURIComponent(vehicle)}`, signal);
}

/** Today's fuel prices for the customer's area. */
export function fetchFuelPrices(coords: { lat: number; lng: number }, signal?: AbortSignal) {
  const lat = coords.lat.toFixed(4);
  const lng = coords.lng.toFixed(4);
  return getJson<FuelPricesResponse>(`/api/public/fuel-prices?lat=${lat}&lng=${lng}`, signal);
}

const rupees = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const rupeesExact = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatRupees(value: number, { exact = false } = {}) {
  return (exact ? rupeesExact : rupees).format(value);
}
