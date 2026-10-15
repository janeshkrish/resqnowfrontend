import { describe, expect, it } from "vitest";

import type { Vehicle } from "@/lib/garage";
import {
  catalogFor,
  brandsFor,
  choiceFromCatalog,
  choiceFromGarage,
  classSentence,
  displayName,
  findCatalogModel,
  garageForFamily,
  manualChoice,
  searchCatalog,
} from "./vehicleChoice";

const vehicle = (id: number, type: string, make: string, model: string, plate: string | null = null): Vehicle =>
  ({ id, type, make, model, license_plate: plate, status: "ready" });

describe("searchCatalog", () => {
  it("finds old bikes by an old brand name", () => {
    const names = searchCatalog("bike", "hero honda").map((model) => `${model.brand} ${model.model}`);
    expect(names).toContain("Hero Honda Splendor");
    expect(names).toContain("Hero Honda CD 100");
    expect(names.every((name) => name.startsWith("Hero Honda"))).toBe(true);
  });

  it("matches every word across brand and model, with names that start with the query first", () => {
    const rx = searchCatalog("bike", "rx 100");
    expect(rx[0]).toMatchObject({ brand: "Yamaha", model: "RX 100", status: "old" });
    expect(searchCatalog("car", "esteem")[0]).toMatchObject({ brand: "Maruti Suzuki", model: "Esteem", vehicleClass: "sedan" });
    expect(searchCatalog("car", "defender")[0]).toMatchObject({ brand: "Land Rover", vehicleClass: "luxury" });
  });

  it("shows popular models before anything is typed", () => {
    const popular = searchCatalog("car", "  ");
    expect(popular.length).toBeGreaterThan(5);
    expect(popular.every((model) => model.popular)).toBe(true);
  });

  it("offers only electric models in the EV lists, priced as electric classes", () => {
    const ev = catalogFor("ev");
    expect(ev.every((model) => model.evClass)).toBe(true);
    expect(searchCatalog("ev", "nexon")[0]).toMatchObject({ model: "Nexon EV", evClass: "electric-suv" });
    expect(searchCatalog("ev", "ather 450x")[0]).toMatchObject({ evClass: "electric-scooter" });
    expect(searchCatalog("ev", "swift")).toEqual([]);
  });

  it("keeps pure EV models and brands out of ordinary choices without removing combustion or hybrid models", () => {
    expect(searchCatalog("car", "tiago ev")).toEqual([]);
    expect(searchCatalog("bike", "ather 450x")).toEqual([]);
    expect(brandsFor("bike").map(brand => brand.id)).not.toContain("ather");
    expect(brandsFor("car").map(brand => brand.id)).toContain("tata");
    expect(searchCatalog("car", "grand vitara").some(model => model.model === "Grand Vitara")).toBe(true);
    expect(searchCatalog("car", "swift").some(model => model.model === "Swift")).toBe(true);
    expect(catalogFor("ev").some(model => model.model === "450X")).toBe(true);
  });
});

describe("choices", () => {
  it("fills the class from the catalogue and sends the full name", () => {
    const [swift] = searchCatalog("car", "swift").filter((model) => model.model === "Swift");
    const choice = choiceFromCatalog(swift, "car");
    expect(choice).toMatchObject({ vehicleBrand: "Maruti Suzuki", vehicleModel: "Maruti Suzuki Swift", vehicleSubtype: "hatchback", vehicleSource: "catalog" });
    expect(displayName(choice)).toBe("Maruti Swift");
    expect(classSentence(choice)).toBe("Swift is a hatchback");
  });

  it.each([
    ["tiago ev", "Tiago EV", "electric-car", "hatchback"],
    ["tigor ev", "Tigor EV", "electric-car", "sedan"],
    ["nexon ev", "Nexon EV", "electric-suv", "compact-suv"],
    ["ioniq 5", "Ioniq 5", "electric-suv", "big-suv"],
    ["revolt rv400", "RV400", "electric-bike", "commuter-bike"],
    ["ultraviolette f77", "F77", "electric-bike", "sports-bike"],
  ])("preserves the physical body for catalogue EV %s", (query, name, evClass, baseClass) => {
    const model = searchCatalog("ev", query).find(entry => entry.model === name)!;
    expect(choiceFromCatalog(model, "ev")).toMatchObject({ vehicleSubtype: evClass, vehicleBaseSubtype: baseClass });
  });

  it("preserves a saved EV's known body and clears it for a newly typed vehicle", () => {
    expect(choiceFromGarage(vehicle(8, "car", "Tata Motors", "Tiago EV"), "ev")).toMatchObject({ vehicleSubtype: "electric-car", vehicleBaseSubtype: "hatchback" });
    expect(manualChoice("Prototype EV")).toMatchObject({ vehicleSubtype: "", vehicleBaseSubtype: "" });
  });

  it("finds a saved garage vehicle in the catalogue so its class fills in", () => {
    const nexon = vehicle(1, "car", "Tata Motors", "Nexon", "ka01ab1234");
    const choice = choiceFromGarage(nexon, "car");
    expect(choice).toMatchObject({ vehicleSubtype: "compact-suv", vehicleModel: "Tata Motors Nexon", plate: "KA 01 AB 1234", garageVehicleId: 1 });
    expect(displayName(choice)).toBe("Tata Nexon");
    // Something the catalogue doesn't know leaves the class for the customer to tap.
    expect(choiceFromGarage(vehicle(2, "car", "Tata Motors", "Prototype X"), "car").vehicleSubtype).toBe("");
    expect(findCatalogModel("Honda Motorcycles", "Activa 125", "bike")?.vehicleClass).toBe("scooter");
  });

  it("offers garage vehicles that fit the request", () => {
    const garage = [vehicle(1, "car", "Tata Motors", "Nexon EV"), vehicle(2, "bike", "Ather Energy", "450X"), vehicle(3, "car", "Maruti Suzuki", "Swift"), vehicle(4, "car", "Tata Motors", "Tata Motors Tiago EV")];
    expect(garageForFamily(garage, "car").map((entry) => entry.id)).toEqual([3]);
    expect(garageForFamily(garage, "bike").map((entry) => entry.id)).toEqual([]);
    expect(garageForFamily(garage, "ev").map((entry) => entry.id)).toEqual([1, 2, 4]);
    expect(garageForFamily(garage, "commercial")).toEqual([]);
  });

  it("keeps a typed name as it is, with no class until one is tapped", () => {
    const choice = manualChoice("  Opel   Astra");
    expect(choice).toMatchObject({ vehicleModel: "Opel Astra", vehicleBrand: "", vehicleSubtype: "", vehicleSource: "manual" });
    expect(classSentence({ ...choice, vehicleSubtype: "sedan" })).toBeNull();
  });

  it("accepts an explicit manual brand while clearing catalog and physical-class identity", () => {
    expect(manualChoice(" Prototype   X ", " Ather Energy ")).toMatchObject({
      vehicleModel: "Prototype X", vehicleBrand: "Ather Energy", vehicleSource: "manual",
      catalogBrandId: null, catalogModelId: null, vehicleSubtype: "", vehicleBaseSubtype: "",
    });
  });
});
