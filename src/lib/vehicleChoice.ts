import { CATALOG_BRANDS, VEHICLE_CATALOG, type CatalogBrand, type CatalogModel } from "@/data/indianVehicles";
import { formatPlate, shortMake, vehicleTypeOf, type Vehicle } from "@/lib/garage";
import { vehicleClassInfo, type VehicleClassId, type VehicleFamily } from "@/lib/vehicleClasses";

/** What the request form keeps about the chosen vehicle (inside the flow's form data). */
export type VehicleChoice = {
  vehicleTab?: "garage" | "choose";
  vehicleSource?: "garage" | "catalog" | "manual" | "";
  garageVehicleId?: number | null;
  catalogBrandId?: string | null;
  catalogModelId?: string | null;
  manualName?: string;
  /** Brand name sent as vehicle_brand. */
  vehicleBrand?: string;
  /** Full name sent as vehicle_model ("Maruti Suzuki Swift"). */
  vehicleModel?: string;
  /** Class id sent as vehicle_subtype. */
  vehicleSubtype?: string;
  plate?: string;
};

export const vehicleWord = (family: VehicleFamily) =>
  family === "car" ? "car" : family === "bike" ? "bike" : family === "ev" ? "EV" : "vehicle";

/** The class a model is priced as in this family's form. */
export const classOf = (model: CatalogModel, family: VehicleFamily): VehicleClassId =>
  family === "ev" ? model.evClass ?? model.vehicleClass : model.vehicleClass;

export function catalogFor(family: VehicleFamily): CatalogModel[] {
  if (family === "ev") return VEHICLE_CATALOG.filter((model) => model.evClass);
  return VEHICLE_CATALOG.filter((model) => model.family === family);
}

export function brandsFor(family: VehicleFamily): CatalogBrand[] {
  if (family === "ev") return CATALOG_BRANDS.filter((brand) => brand.hasEv);
  return CATALOG_BRANDS.filter((brand) => brand.family === family);
}

export const brandById = (id?: string | null) => CATALOG_BRANDS.find((brand) => brand.id === id) ?? null;
export const modelById = (id?: string | null) => VEHICLE_CATALOG.find((model) => model.id === id) ?? null;

/** "Maruti Suzuki Swift", without repeating a brand the model name already has ("Yezdi Roadster"). */
export function fullName(model: CatalogModel) {
  return model.model.toLowerCase().startsWith(model.short.toLowerCase()) ? model.model : `${model.brand} ${model.model}`;
}

/** "Maruti Swift" for the screen. */
export function shortName(model: CatalogModel) {
  return model.model.toLowerCase().startsWith(model.short.toLowerCase()) ? model.model : `${model.short} ${model.model}`;
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Models matching every word typed, across brand and model ("hero honda splendor", "rx 100").
 * Names starting with the query come first. With nothing typed, the popular ones.
 */
export function searchCatalog(family: VehicleFamily, query: string, limit = 40): CatalogModel[] {
  const pool = catalogFor(family);
  const q = normalize(query);
  if (!q) return pool.filter((model) => model.popular);
  const tokens = q.split(" ");
  const matches = pool.filter((model) => {
    const haystack = normalize(`${model.brand} ${model.short} ${model.model}`);
    return tokens.every((token) => haystack.includes(token));
  });
  const starts = (model: CatalogModel) => (normalize(model.model).startsWith(q) ? 0 : 1);
  return matches
    .sort((a, b) => starts(a) - starts(b) || Number(a.status === "old") - Number(b.status === "old") || a.model.localeCompare(b.model, "en", { numeric: true }))
    .slice(0, limit);
}

/** The catalogue entry for a saved garage vehicle, so its class fills in by itself. */
export function findCatalogModel(make: string, model: string, family: VehicleFamily): CatalogModel | null {
  const brandKey = normalize(make);
  const modelKey = normalize(model);
  const pool = catalogFor(family);
  return (
    pool.find((entry) => normalize(entry.brand) === brandKey && normalize(entry.model) === modelKey) ??
    pool.find((entry) => normalize(entry.short) === normalize(shortMake(make)) && normalize(entry.model) === modelKey) ??
    null
  );
}

/** Saved vehicles that fit this form: cars for car requests, bikes for bike requests, electric ones for EV requests. */
export function garageForFamily(vehicles: Vehicle[], family: VehicleFamily): Vehicle[] {
  if (family === "commercial") return [];
  if (family === "ev") return vehicles.filter((vehicle) => findCatalogModel(vehicle.make, vehicle.model, "ev"));
  return vehicles.filter((vehicle) => vehicleTypeOf(vehicle.type) === family);
}

export function choiceFromGarage(vehicle: Vehicle, family: VehicleFamily): VehicleChoice {
  const match = findCatalogModel(vehicle.make, vehicle.model, family);
  const name = vehicle.model.toLowerCase().startsWith(vehicle.make.toLowerCase()) ? vehicle.model : `${vehicle.make} ${vehicle.model}`;
  return {
    vehicleTab: "garage",
    vehicleSource: "garage",
    garageVehicleId: vehicle.id,
    catalogBrandId: null,
    catalogModelId: null,
    manualName: "",
    vehicleBrand: vehicle.make,
    vehicleModel: name,
    vehicleSubtype: match ? classOf(match, family) : "",
    plate: vehicle.license_plate ? formatPlate(vehicle.license_plate) : "",
  };
}

export function choiceFromCatalog(model: CatalogModel, family: VehicleFamily): VehicleChoice {
  return {
    vehicleTab: "choose",
    vehicleSource: "catalog",
    garageVehicleId: null,
    catalogBrandId: model.brandId,
    catalogModelId: model.id,
    manualName: "",
    vehicleBrand: model.brand,
    vehicleModel: fullName(model),
    vehicleSubtype: classOf(model, family),
    plate: "",
  };
}

export function manualChoice(name: string): VehicleChoice {
  const clean = name.replace(/\s+/g, " ").trimStart().slice(0, 80);
  return {
    vehicleTab: "choose",
    vehicleSource: "manual",
    garageVehicleId: null,
    catalogBrandId: null,
    catalogModelId: null,
    manualName: clean,
    vehicleBrand: "",
    vehicleModel: clean.trim(),
    vehicleSubtype: "",
    plate: "",
  };
}

export const clearedChoice = (tab: "garage" | "choose"): VehicleChoice => ({
  vehicleTab: tab,
  vehicleSource: "",
  garageVehicleId: null,
  catalogBrandId: null,
  catalogModelId: null,
  manualName: "",
  vehicleBrand: "",
  vehicleModel: "",
  vehicleSubtype: "",
  plate: "",
});

export const hasVehicle = (choice: VehicleChoice) => Boolean(String(choice.vehicleModel || "").trim());

/** The name people use on screen: "Maruti Swift", "Tata Nexon" (the request still carries the full name). */
export function displayName(choice: VehicleChoice) {
  const model = modelById(choice.catalogModelId);
  if (model) return shortName(model);
  const full = String(choice.vehicleModel || "").trim();
  const brand = String(choice.vehicleBrand || "").trim();
  if (!brand || !full.toLowerCase().startsWith(brand.toLowerCase())) return full;
  return `${shortMake(brand)}${full.slice(brand.length)}`;
}

/** "Swift is a hatchback", to confirm the class that filled in. */
export function classSentence(choice: VehicleChoice) {
  const info = vehicleClassInfo(choice.vehicleSubtype);
  if (!info || !hasVehicle(choice) || choice.vehicleSource === "manual") return null;
  const model = modelById(choice.catalogModelId);
  const name = model ? model.model : String(choice.vehicleModel || "").replace(new RegExp(`^${escapeRegExp(choice.vehicleBrand || "")}\\s*`, "i"), "");
  return `${name || choice.vehicleModel} is ${info.phrase}`;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
