import { describe, expect, it } from "vitest";

import { classesFor } from "@/lib/vehicleClasses";
import { CATALOG_BRANDS, VEHICLE_CATALOG, getBikeBrands, getCarBrands, getCommercialBrands, indianVehicleBrands } from "./indianVehicles";

describe("vehicle catalogue", () => {
  it("gives every model a class that belongs to its kind of vehicle", () => {
    for (const model of VEHICLE_CATALOG) {
      const classes = classesFor(model.family).map((entry) => entry.id);
      expect(classes, `${model.brand} ${model.model}`).toContain(model.vehicleClass);
      if (model.evClass) expect(classesFor("ev").map((entry) => entry.id)).toContain(model.evClass);
    }
  });

  it("has no duplicate ids or duplicate models within a brand", () => {
    const ids = VEHICLE_CATALOG.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(CATALOG_BRANDS.map((brand) => brand.id)).size).toBe(CATALOG_BRANDS.length);
  });

  it("covers models on sale, no longer sold and imported", () => {
    const find = (brand: string, model: string) => VEHICLE_CATALOG.find((entry) => entry.brand === brand && entry.model === model);
    expect(find("Maruti Suzuki", "800")).toMatchObject({ status: "old", vehicleClass: "hatchback" });
    expect(find("Hindustan Motors", "Ambassador")).toMatchObject({ status: "old", vehicleClass: "sedan" });
    expect(find("Yamaha", "RX 100")).toMatchObject({ status: "old" });
    expect(find("Hummer", "H2")).toMatchObject({ status: "import", vehicleClass: "luxury" });
    expect(find("Toyota", "Innova Crysta")).toMatchObject({ status: "sale", vehicleClass: "big-suv" });
    expect(find("Tata Motors", "Ace")).toMatchObject({ family: "commercial", vehicleClass: "pickup-mini-truck" });
    expect(VEHICLE_CATALOG.length).toBeGreaterThan(700);
  });

  it("keeps the names My garage already saved vehicles under", () => {
    const models = (name: string) => indianVehicleBrands.find((brand) => brand.name === name)?.models ?? [];
    expect(models("Maruti Suzuki")).toEqual(expect.arrayContaining(["Swift", "Swift (2nd Gen)", "Vitara Brezza (Old)", "Omni"]));
    expect(models("Honda Motorcycles")).toEqual(expect.arrayContaining(["Activa", "Activa 3G/4G/5G/6G", "CB350 H'ness"]));
    expect(models("Tata Motors")).toEqual(expect.arrayContaining(["Nexon", "Nexon EV", "Indica Vista"]));
    // The garage only saves cars and bikes, so the commercial list stays out of it.
    expect(getCarBrands().some((brand) => brand.models.includes("Ace"))).toBe(false);
    expect(getBikeBrands().some((brand) => brand.name === "Ather Energy")).toBe(true);
    expect(getCommercialBrands().map((brand) => brand.name)).toContain("Ashok Leyland");
  });
});
