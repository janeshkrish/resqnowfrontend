import { buildLegacySignupPricingConfig, filterSignupPricing, getSignupPricingError } from "./technicianSignupPricing";
import { technicianSchema } from "@/services/technicianAuthService";
import type { PricingTemplate, PricingRow } from "@/components/technician/DynamicPricingStep";
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


const template: PricingTemplate = {
  services: [{ id: 1, service_name: 'Flat Tire Repair' }, { id: 2, service_name: 'Battery Jumpstart' }],
  categories: [{ id: 1, category_name: 'Bike' }, { id: 2, category_name: 'Car' }], subcategories: [],
  pricingFields: [{ id: 1, service_id: 1, field_key: 'visit_charge', field_label: 'Visit charge', required: true }],
};
const row: PricingRow = { service_id: 1, vehicle_category_id: 1, pricing_json: { vehicle_subtype: 'commuter-bike', vehicle_subtype_label: 'Economy', visit_charge: 0 } };
describe('signup pricing submission', () => {
  it('keeps independent economy, sports and bullet rates under existing customer class identifiers', () => {
    const rows = ['commuter-bike', 'sports-bike', 'premium-bike'].map((subtype, index) => ({ ...row, pricing_json: {
      service_domain: 'flat-tire', vehicle_type: 'bike', vehicle_subtype: subtype, vehicle_subtype_label: ['Economy', 'Sports', 'Bullet'][index],
      visit_charge: 100, tube_tyre_price: 200 + index * 100, tubeless_tyre_price: 300 + index * 100,
    } }));
    const legacy = buildLegacySignupPricingConfig(rows);
    expect(legacy[0]).toMatchObject({ flat_tire_vehicle_pricing: { bike: { subcategories: {
      'commuter-bike': { tubeless_price: 300 }, 'sports-bike': { tubeless_price: 400 }, 'premium-bike': { tubeless_price: 500 },
    } } } });
  });
  it('matches current customer request subtype keys while retaining the new labels', () => {
    const evRows = ['scooter', 'car'].map((subtype, index) => ({ ...row, vehicle_category_id: 4, pricing_json: {
      service_domain: 'flat-tire', vehicle_type: 'ev', vehicle_subtype: subtype, vehicle_subtype_label: subtype,
      visit_charge: 100, tube_tyre_price: index ? 400 : 100, tubeless_tyre_price: index ? 500 : 200,
    } }));
    const legacy = buildLegacySignupPricingConfig(evRows);
    expect(legacy[0]).toMatchObject({ flat_tire_vehicle_pricing: { ev: { subcategories: {
      car: { tubeless_price: 500 }, 'electric-car': { tubeless_price: 500 },
      scooter: { tubeless_price: 200 }, 'electric-scooter': { tubeless_price: 200 },
    } } } });
  });
  it('keeps subtype prices available to existing dispatch and homepage readers', () => {
    const rows = [{ ...row, pricing_json: { service_domain: 'flat-tire', vehicle_type: 'bike', vehicle_subtype: 'scooter', vehicle_subtype_label: 'Scooter', visit_charge: 150, tube_tyre_price: 180, tubeless_tyre_price: 220, cost_per_km: 20 } }];
    const legacy = buildLegacySignupPricingConfig(rows);
    expect(legacy[0]).toMatchObject({ service_domain: 'flat-tire', vehicle_categories: ['bike'], flat_tire_vehicle_pricing: {
      bike: { service_charge: 180, visit_charge: 150, extra_km_charge: 20, subcategories: { scooter: { tubeless_price: 220 } } },
    } });
  });
  it('removes prices belonging to deselected services and vehicles', () => {
    expect(filterSignupPricing([row, { ...row, service_id: 2 }, { ...row, vehicle_category_id: 2 }], template, ['flat-tire'], ['bike'])).toEqual([row]);
  });
  it('retains scooter, bike and EV car classes in the existing pricing format', () => {
    const withEV = { ...template, categories: [...template.categories, { id: 4, category_name: 'EV' }] };
    const retired = { ...row, pricing_json: { ...row.pricing_json, vehicle_subtype: 'bike' } };
    const scooter = { ...row, pricing_json: { ...row.pricing_json, vehicle_subtype: 'scooter' } };
    const evRows = ['bike', 'scooter', 'commuter-bike', 'sports-bike', 'premium-bike', 'sedan', 'suv', 'mpv', 'hatchback'].map(subtype => ({ ...row, vehicle_category_id: 4, pricing_json: { ...row.pricing_json, vehicle_subtype: subtype } }));
    const genericEVCar = { ...row, vehicle_category_id: 4, pricing_json: { ...row.pricing_json, vehicle_subtype: 'car' } };
    expect(filterSignupPricing([row, retired, scooter, genericEVCar, ...evRows], withEV, ['flat-tire'], ['bike', 'ev'])).toEqual([row, scooter, ...evRows]);
  });
  it('accepts a zero price and rejects missing or negative required prices', () => {
    expect(getSignupPricingError([row], template, ['flat-tire'], ['bike'])).toBeNull();
    expect(getSignupPricingError([], template, ['flat-tire'], ['bike'])).toMatch(/Choose a bike subtype/);
    expect(getSignupPricingError([{ ...row, pricing_json: { ...row.pricing_json, visit_charge: '' } }], template, ['flat-tire'], ['bike'])).toMatch(/valid visit charge/);
    expect(getSignupPricingError([{ ...row, pricing_json: { ...row.pricing_json, visit_charge: -1 } }], template, ['flat-tire'], ['bike'])).toMatch(/valid visit charge/);
  });
  it('reports unavailable service templates instead of silently omitting selected services', () => {
    expect(getSignupPricingError([], template, ['towing'], ['bike'])).toMatch(/unavailable/);
  });
});

const valid = {
  name: 'Arun Auto Care', proprietor_name: 'Arun Kumar', phone: '9876543210', email: '', password: '', confirmPassword: '',
  location: { address: '14 Avinashi Road', latitude: 11.025, longitude: 77.005, state: 'Tamil Nadu' },
  serviceAreaRange: 15, experience: 6, specialties: ['flat-tire'], vehicle_types: { bike: true }, towing_fleet_types: [],
  aadhaar_number: '123412341234', documents: {}, working_hours: { opening_time: '', closing_time: '', weekly_off: 'None', is_24x7: true },
  app_readiness: { has_smartphone: false, preferred_language: 'English' }, pricing_config: [], payment_details: { modes: { cash: true } }, consent: { agreed: true },
};
describe('technician registration validation', () => {
  it('accepts an application with no email or password', () => expect(technicianSchema.safeParse(valid).success).toBe(true));
  it('requires a password when an email is entered', () => {
    const result = technicianSchema.safeParse({ ...valid, email: 'arun@example.com' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues.some(issue => issue.path[0] === 'password')).toBe(true);
  });
  it('checks password strength and confirmation before leaving personal details', () => {
    expect(technicianSchema.safeParse({ ...valid, email: 'arun@example.com', password: '12345678', confirmPassword: 'different' }).success).toBe(false);
    expect(technicianSchema.safeParse({ ...valid, password: 'short', confirmPassword: 'short' }).success).toBe(false);
    expect(technicianSchema.safeParse({ ...valid, email: 'arun@example.com', password: '12345678', confirmPassword: '12345678' }).success).toBe(true);
  });
  it('validates working hours only when 24/7 is not selected', () => {
    expect(technicianSchema.safeParse({ ...valid, working_hours: { ...valid.working_hours, is_24x7: false } }).success).toBe(false);
    expect(technicianSchema.safeParse({ ...valid, working_hours: { opening_time: '09:00', closing_time: '18:00', weekly_off: 'Sunday', is_24x7: false } }).success).toBe(true);
  });
  it('requires consent and at least one real vehicle selection', () => {
    expect(technicianSchema.safeParse({ ...valid, consent: { agreed: false } }).success).toBe(false);
    expect(technicianSchema.safeParse({ ...valid, vehicle_types: { bike: false } }).success).toBe(false);
  });
});
