import { describe, expect, it } from "vitest";

const flatTireDocument = [
  {
    service_domain: "flat-tire",
    vehicle_categories: ["bike"],
    flat_tire_vehicle_pricing: {
      bike: {
        service_charge: 180,
        visit_charge: 120,
        free_distance: 3,
        extra_km_charge: 20,
        subcategories: [
          {
            id: "scooter",
            label: "Scooter",
            tube_tyre_price: 180,
            tubeless_price: 220,
          },
        ],
      },
    },
  },
];

const configurationModulePath = "./adminTechnicianServiceConfiguration";
const loadConfigurationModule = async () =>
  import(/* @vite-ignore */ configurationModulePath).catch(() => null);

describe("admin technician service configuration", () => {
  it("canonicalizes and deduplicates comma-separated services", async () => {
    const module = await loadConfigurationModule();
    expect(module?.parseAdminServiceTokens).toBeTypeOf("function");

    expect(
      module!.parseAdminServiceTokens("flat tire, battery, flat-tire")
    ).toEqual(["flat-tire", "battery"]);
  });

  it("creates a flat-tire editor for the technician vehicle categories", async () => {
    const module = await loadConfigurationModule();
    expect(module?.syncAdminServicePricing).toBeTypeOf("function");

    const entries = module!.syncAdminServicePricing([], ["flat-tire"], ["bike"]);
    expect(entries[0].service_domain).toBe("flat-tire");
    expect(entries[0].vehicle_categories).toEqual(["bike"]);
    expect(
      entries[0].flat_tire_vehicle_pricing.bike.subcategories
    ).toEqual({});
  });

  it("hydrates submitted puncture prices into editable subcategories", async () => {
    const module = await loadConfigurationModule();
    expect(module?.hydrateAdminServicePricing).toBeTypeOf("function");

    const entries = module!.hydrateAdminServicePricing(
      flatTireDocument,
      ["flat-tire"],
      ["bike"]
    );
    expect(
      entries[0].flat_tire_vehicle_pricing.bike.subcategories.scooter
        .tubeless_price
    ).toBe(220);
    expect(
      entries[0].flat_tire_vehicle_pricing.bike.selected_subcategories
    ).toEqual(["scooter"]);
  });

  it("builds registration-compatible nested service costs", async () => {
    const module = await loadConfigurationModule();
    expect(module?.buildAdminServicePricingPayload).toBeTypeOf("function");

    const entries = module!.hydrateAdminServicePricing(
      flatTireDocument,
      ["flat-tire"],
      ["bike"]
    );
    const payload = module!.buildAdminServicePricingPayload(entries);
    expect(payload[0].service_domain).toBe("flat-tire");
    expect(
      payload[0].flat_tire_vehicle_pricing.bike.subcategories[0]
        .tube_tyre_price
    ).toBe(180);
  });
});
