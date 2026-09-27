import { apiFetch } from "@/lib/api";
import { getBikeBrands, getCarBrands, indianVehicleBrands, type VehicleBrand } from "@/data/indianVehicles";

/** A vehicle the customer saved in My garage (GET /api/vehicles). */
export interface Vehicle {
  id: number;
  type: string;
  make: string;
  model: string;
  license_plate: string | null;
  status?: string;
  created_at?: string;
}

export type VehicleType = "car" | "bike";
export type VehicleStatus = "ready" | "maintenance" | "inactive";

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  ready: "Ready",
  maintenance: "In service",
  inactive: "Not in use",
};

export const GARAGE_QUERY_KEY = ["garage", "vehicles"] as const;

export const normalizeStatus = (status?: string | null): VehicleStatus =>
  status === "maintenance" || status === "inactive" ? status : "ready";

export const vehicleTypeOf = (type?: string | null): VehicleType => (type === "bike" ? "bike" : "car");

export class GarageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GarageError";
  }
}

async function send(path: string, init: RequestInit, failure: string) {
  const response = await apiFetch(path, init);
  if (!response.ok) throw new GarageError(failure);
  return response;
}

export async function listVehicles(): Promise<Vehicle[]> {
  const response = await send("/api/vehicles", {}, "Your vehicles didn’t load.");
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function addVehicle(input: { type: VehicleType; make: string; model: string; license_plate: string }): Promise<{ id: number }> {
  const response = await send("/api/vehicles", { method: "POST", body: JSON.stringify(input) }, "The vehicle wasn’t saved.");
  return response.json();
}

export async function removeVehicle(id: number): Promise<void> {
  await send(`/api/vehicles/${id}`, { method: "DELETE" }, "The vehicle wasn’t removed.");
}

export async function setVehicleStatus(id: number, status: VehicleStatus): Promise<void> {
  await send(`/api/vehicles/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, "The status wasn’t changed.");
}

/** "ka01ab1234" → "KA 01 AB 1234"; anything that isn't an Indian plate is just tidied. */
export function formatPlate(value: string): string {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const match = compact.match(/^([A-Z]{2})(\d{1,2})([A-Z]{0,3})(\d{1,4})$/);
  if (match) return [match[1], match[2].padStart(2, "0"), match[3], match[4]].filter(Boolean).join(" ");
  return String(value || "").toUpperCase().replace(/[^A-Z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

const SHORT_MAKES: Record<string, string> = {
  "maruti suzuki": "Maruti", "tata motors": "Tata", "honda cars": "Honda", "honda motorcycles": "Honda",
  "hero motocorp": "Hero", "tvs motor": "TVS", "tvs electric": "TVS", "mg motor": "MG", "ather energy": "Ather",
  "ola electric": "Ola", "force motors": "Force", "revolt motors": "Revolt", "simple energy": "Simple",
  "jawa / yezdi": "Jawa", "bajaj electric": "Bajaj",
};

/** The short name people use: "Tata Nexon", not "Tata Motors Nexon". */
export const shortMake = (make: string) => SHORT_MAKES[String(make || "").trim().toLowerCase()] ?? String(make || "").trim();

export function initialsOf(name: string) {
  const words = String(name || "").split(/[\s/-]+/).filter((word) => /[A-Za-z0-9]/.test(word));
  if (!words.length) return "?";
  // Acronym brands keep their letters: "TVS Motor" → "TVS", "MG Motor" → "MG".
  if (/^[A-Z]{2,3}$/.test(words[0])) return words[0];
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export const brandFor = (make: string): VehicleBrand | undefined => {
  const key = String(make || "").trim().toLowerCase();
  return indianVehicleBrands.find((brand) => brand.name.toLowerCase() === key);
};

export const brandsFor = (type: VehicleType) => (type === "bike" ? getBikeBrands() : getCarBrands());

/** Where "Get help for this car" goes: the emergency request with this vehicle filled in. */
export const helpPath = (vehicle: Pick<Vehicle, "id" | "type">) =>
  `/request-service/emergency/${vehicleTypeOf(vehicle.type)}?vehicle=${encodeURIComponent(String(vehicle.id))}`;
