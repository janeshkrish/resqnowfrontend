// What My garage says about a saved vehicle beyond its name and plate: its kind, whether it is still sold,
// when it was saved, and the help it has had.
import { vehicleTypeOf, type Vehicle } from "@/lib/garage";
import { MONTHS, isCancelled, isWorkDone, newestFirst, requestDay, type MyRequest } from "@/lib/myRequests";
import { serviceName } from "@/lib/services";
import { findCatalogModel } from "@/lib/vehicleChoice";
import { vehicleClassInfo } from "@/lib/vehicleClasses";

export type VehicleKind = { label: string; noLongerSold: boolean };

/** "Small SUV", "Scooter"... from the app's vehicle list; plain "Car" or "Bike" for a model it does not know. */
export function kindOf(vehicle: Pick<Vehicle, "make" | "model" | "type">): VehicleKind {
  const family = vehicleTypeOf(vehicle.type);
  const model = findCatalogModel(vehicle.make, vehicle.model, family);
  const label = model ? vehicleClassInfo(model.evClass ?? model.vehicleClass)?.label : null;
  return { label: label ?? (family === "bike" ? "Bike" : "Car"), noLongerSold: model?.status === "old" };
}

/** "Mar 2025": the month the vehicle was saved. "Today" on the day itself. */
export function savedSince(createdAt: string | null | undefined, now = new Date()): string | null {
  const time = Date.parse(String(createdAt ?? ""));
  if (!Number.isFinite(time)) return null;
  const date = new Date(time);
  if (date.toDateString() === now.toDateString()) return "Today";
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** The name a request carries for this vehicle ("Tata Motors Nexon"), which is how its past requests are found. */
export const requestNameOf = (vehicle: Pick<Vehicle, "make" | "model">) =>
  vehicle.model.toLowerCase().startsWith(vehicle.make.toLowerCase()) ? vehicle.model : `${vehicle.make} ${vehicle.model}`;

const sameName = (a: string, b: string) => a.trim().toLowerCase().replace(/\s+/g, " ") === b.trim().toLowerCase().replace(/\s+/g, " ");

export type HelpHistory = { times: number; last: string | null };

/** How often this vehicle was helped (finished requests), and the latest one: "Battery · 19 Sep". */
export function helpHistory(vehicle: Pick<Vehicle, "make" | "model">, requests: MyRequest[], now = new Date()): HelpHistory {
  const name = requestNameOf(vehicle);
  const helped = newestFirst(requests).filter(
    (request) => !isCancelled(request) && isWorkDone(request) && sameName(String(request.vehicle_model ?? ""), name),
  );
  const latest = helped[0];
  return {
    times: helped.length,
    last: latest ? [serviceName(latest.service_type), requestDay(latest, now)].filter(Boolean).join(" · ") : null,
  };
}

/** "3 vehicles · 2 cars, 1 bike"; the split is left out when they are all one kind. */
export function garageCountLine(vehicles: Pick<Vehicle, "type">[]): string {
  const total = vehicles.length;
  const bikes = vehicles.filter((vehicle) => vehicleTypeOf(vehicle.type) === "bike").length;
  const cars = total - bikes;
  const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  return cars && bikes ? `${count(total, "vehicle")} · ${count(cars, "car")}, ${count(bikes, "bike")}` : count(total, "vehicle");
}
