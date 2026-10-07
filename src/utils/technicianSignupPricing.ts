import type { PricingRow, PricingTemplate } from "@/components/technician/DynamicPricingStep";
import type { VehicleArtId } from "@/lib/vehicleClasses";
import {
  canonicalizeServiceKey,
  canonicalizeVehicleKey,
} from "@/config/technicianNormalization";

type SupportedVehicleType = "bike" | "car" | "commercial" | "ev";

type PricingConfigEntry = Record<string, any>;

const SUPPORTED_VEHICLE_TYPES: SupportedVehicleType[] = [
  "bike",
  "car",
  "commercial",
  "ev",
];

const toNumberOrNull = (value: unknown) => {
  if (value === "" || value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const pruneEmpty = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const next = value
      .map((entry) => pruneEmpty(entry))
      .filter((entry) => entry !== null && entry !== undefined);
    return next.length > 0 ? next : null;
  }

  if (value && typeof value === "object") {
    const nextEntries = Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => [key, pruneEmpty(entryValue)] as const)
      .filter(([, entryValue]) => {
        if (entryValue == null) return false;
        if (Array.isArray(entryValue)) return entryValue.length > 0;
        if (typeof entryValue === "object") return Object.keys(entryValue as Record<string, unknown>).length > 0;
        return true;
      });

    return nextEntries.length > 0 ? Object.fromEntries(nextEntries) : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  return value ?? null;
};

const uniqueStrings = (values: unknown[]): string[] =>
  Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );

const isSupportedVehicleType = (value: string): value is SupportedVehicleType =>
  (SUPPORTED_VEHICLE_TYPES as string[]).includes(value);

const normalizeVehicleCategories = (values: unknown): SupportedVehicleType[] => {
  if (!Array.isArray(values)) return [];
  return uniqueStrings(values)
    .map((value) => canonicalizeVehicleKey(value))
    .filter(isSupportedVehicleType);
};

const buildGenericVehiclePricing = (value: unknown) => {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return pruneEmpty({
    service_charge: toNumberOrNull(row.service_charge),
    visit_charge: toNumberOrNull(row.visit_charge),
    delivery_charge: toNumberOrNull(row.delivery_charge),
    labour_min: toNumberOrNull(row.labour_min),
    labour_max: toNumberOrNull(row.labour_max),
    free_distance: toNumberOrNull(row.free_distance),
    extra_km_charge: toNumberOrNull(row.extra_km_charge),
  }) as Record<string, unknown> | null;
};

const getVehicleBasePriceKey = (vehicleType: SupportedVehicleType) => {
  if (vehicleType === "bike") return "price_2w_min";
  if (vehicleType === "car") return "price_4w_min";
  if (vehicleType === "commercial") return "price_commercial_min";
  return "price_ev_min";
};

const buildFlatTireVehiclePricing = (
  value: unknown,
  vehicleType: SupportedVehicleType
) => {
  const row = value && typeof value === "object" ? (value as Record<string, any>) : {};
  const selectedSubcategories = uniqueStrings(
    Array.isArray(row.selected_subcategories) ? row.selected_subcategories : []
  );
  const rawSubcategories =
    row.subcategories && typeof row.subcategories === "object"
      ? (row.subcategories as Record<string, Record<string, unknown>>)
      : {};

  const subcategories = selectedSubcategories
    .map((subcategoryId) => {
      const rawSubcategory = rawSubcategories[subcategoryId] || {};
      const tubeTyrePrice = toNumberOrNull(rawSubcategory.tube_tyre_price);
      const tubelessPrice = toNumberOrNull(rawSubcategory.tubeless_price);
      const label = String(rawSubcategory.label || subcategoryId).trim();
      if (tubeTyrePrice == null && tubelessPrice == null) return null;
      return pruneEmpty({
        id: subcategoryId,
        label,
        tube_tyre_price: tubeTyrePrice,
        tubeless_price: tubelessPrice,
      });
    })
    .filter(Boolean);

  const candidatePrices = subcategories.flatMap((subcategory) => {
    const entry = subcategory as Record<string, unknown>;
    return [toNumberOrNull(entry.tube_tyre_price), toNumberOrNull(entry.tubeless_price)].filter(
      (price): price is number => price != null
    );
  });
  const minimumPrice = candidatePrices.length > 0 ? Math.min(...candidatePrices) : null;

  return pruneEmpty({
    service_charge: minimumPrice,
    visit_charge: toNumberOrNull(row.visit_charge),
    free_distance: toNumberOrNull(row.free_distance),
    extra_km_charge: toNumberOrNull(row.extra_km_charge),
    [getVehicleBasePriceKey(vehicleType)]: minimumPrice,
    subcategories,
  }) as Record<string, unknown> | null;
};

const buildTowingVehiclePricing = (value: unknown, fleetTypes: string[]) => {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawFleetPricing =
    row.fleet_pricing && typeof row.fleet_pricing === "object"
      ? (row.fleet_pricing as Record<string, Record<string, unknown>>)
      : {};
  const normalizedFleetTypes = uniqueStrings(
    fleetTypes.length > 0 ? fleetTypes : Object.keys(rawFleetPricing)
  );
  const fleetPricingEntries = normalizedFleetTypes
    .map((fleetType) => {
      const fleetRow =
        rawFleetPricing[fleetType] && typeof rawFleetPricing[fleetType] === "object"
          ? rawFleetPricing[fleetType]
          : {};
      const sanitizedPricing = pruneEmpty({
        base_charge: toNumberOrNull(fleetRow.base_charge),
        free_distance: toNumberOrNull(fleetRow.free_distance),
        extra_km_charge: toNumberOrNull(fleetRow.per_km_charge ?? fleetRow.extra_km_charge),
      }) as Record<string, unknown> | null;

      if (!sanitizedPricing) return null;
      return [fleetType, sanitizedPricing] as const;
    })
    .filter(Boolean) as Array<readonly [string, Record<string, unknown>]>;
  const fleetPricingMap =
    fleetPricingEntries.length > 0 ? Object.fromEntries(fleetPricingEntries) : null;
  const legacyPricing = pruneEmpty({
    base_charge: toNumberOrNull(row.base_charge),
    free_distance: toNumberOrNull(row.free_distance),
    extra_km_charge: toNumberOrNull(row.per_km_charge ?? row.extra_km_charge),
  }) as Record<string, unknown> | null;
  const defaultTowTruckType =
    normalizedFleetTypes.find((fleetType) => fleetPricingMap?.[fleetType]) ||
    fleetPricingEntries[0]?.[0] ||
    null;
  const defaultFleetPricing =
    (defaultTowTruckType && fleetPricingMap?.[defaultTowTruckType]) || legacyPricing;

  return pruneEmpty({
    base_charge: defaultFleetPricing?.base_charge ?? legacyPricing?.base_charge ?? null,
    free_distance: defaultFleetPricing?.free_distance ?? legacyPricing?.free_distance ?? null,
    extra_km_charge: defaultFleetPricing?.extra_km_charge ?? legacyPricing?.extra_km_charge ?? null,
    tow_truck_types: normalizedFleetTypes,
    default_tow_truck_type: defaultTowTruckType,
    fleet_pricing: fleetPricingMap,
  }) as Record<string, unknown> | null;
};

const buildVehiclePricingMap = (
  serviceDomain: string,
  entry: PricingConfigEntry,
  vehicleCategories: SupportedVehicleType[]
) => {
  const out: Partial<Record<SupportedVehicleType, Record<string, unknown>>> = {};
  const towingFleetTypes = uniqueStrings(
    Array.isArray(entry.towing_fleet_types) ? entry.towing_fleet_types : []
  );

  vehicleCategories.forEach((vehicleType) => {
    let vehiclePricing: Record<string, unknown> | null = null;

    if (serviceDomain === "towing") {
      vehiclePricing = buildTowingVehiclePricing(
        entry.towing_vehicle_pricing?.[vehicleType],
        towingFleetTypes
      );
    } else if (serviceDomain === "flat-tire") {
      vehiclePricing = buildFlatTireVehiclePricing(
        entry.flat_tire_vehicle_pricing?.[vehicleType],
        vehicleType
      );
    } else {
      vehiclePricing = buildGenericVehiclePricing(entry.vehicle_pricing?.[vehicleType]);
    }

    if (vehiclePricing) {
      out[vehicleType] = vehiclePricing;
    }
  });

  return out;
};

export function getSelectedSignupVehicleTypes(vehicleTypes: unknown): SupportedVehicleType[] {
  if (!vehicleTypes || typeof vehicleTypes !== "object") return [];

  return Object.entries(vehicleTypes as Record<string, unknown>)
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => canonicalizeVehicleKey(key))
    .filter(isSupportedVehicleType);
}

export function buildSignupPricingPayload(pricingConfig: unknown) {
  const entries = Array.isArray(pricingConfig) ? pricingConfig : [];
  const serviceCosts: Record<string, unknown>[] = [];
  const pricingSummary: Record<string, Record<string, unknown>> = {};

  entries.forEach((rawEntry) => {
    const entry = rawEntry && typeof rawEntry === "object" ? (rawEntry as PricingConfigEntry) : {};
    const serviceDomain = canonicalizeServiceKey(
      entry.service_domain || entry.service_name || entry.service
    );
    if (!serviceDomain) return;

    const vehicleCategories = normalizeVehicleCategories(entry.vehicle_categories);
    const vehiclePricingMap = buildVehiclePricingMap(serviceDomain, entry, vehicleCategories);

    if (Object.keys(vehiclePricingMap).length === 0) return;

    const sanitizedEntry = pruneEmpty({
      service_name: serviceDomain,
      service_domain: serviceDomain,
      vehicle_categories: vehicleCategories,
      towing_fleet_types:
        serviceDomain === "towing"
          ? uniqueStrings(Array.isArray(entry.towing_fleet_types) ? entry.towing_fleet_types : [])
          : undefined,
      towing_vehicle_pricing: serviceDomain === "towing" ? vehiclePricingMap : undefined,
      flat_tire_vehicle_pricing: serviceDomain === "flat-tire" ? vehiclePricingMap : undefined,
      vehicle_pricing:
        serviceDomain !== "towing" && serviceDomain !== "flat-tire"
          ? vehiclePricingMap
          : undefined,
    });

    if (!sanitizedEntry || typeof sanitizedEntry !== "object") return;
    serviceCosts.push(sanitizedEntry as Record<string, unknown>);
    pricingSummary[serviceDomain] = vehiclePricingMap as Record<string, unknown>;
  });

  return {
    serviceCosts,
    pricingSummary,
  };
}


export type SignupVehicle = 'bike' | 'car' | 'commercial' | 'ev';
export const SIGNUP_VEHICLES = [
  { id: 'bike', label: 'Bike', description: 'Economy · Sports · Bullet · Scooter', image: '/images/vehicles/bike.webp' },
  { id: 'car', label: 'Car', description: 'Sedan · Hatchback · SUV · MPV', image: '/images/vehicles/car.webp' },
  { id: 'commercial', label: 'Truck', description: 'SCV · LCV · MCV · HCV', image: '/images/vehicles/truck.webp' },
  { id: 'ev', label: 'EV', description: 'Electric vehicles', image: '/images/vehicles/ev.webp' },
] as const;
export const SIGNUP_SUBTYPES: Record<SignupVehicle, { id: string; label: string; detail?: string; art?: VehicleArtId }[]> = {
  bike: [{ id: 'commuter-bike', label: 'Economy', art: 'commuter' }, { id: 'sports-bike', label: 'Sports', art: 'sports' }, { id: 'premium-bike', label: 'Bullet', art: 'cruiser' }, { id: 'scooter', label: 'Scooter', art: 'scooter' }],
  car: [{ id: 'sedan', label: 'Sedan' }, { id: 'hatchback', label: 'Hatchback' }, { id: 'suv', label: 'SUV' }, { id: 'mpv', label: 'MPV' }],
  commercial: [{ id: 'scv', label: 'SCV', detail: 'Small commercial' }, { id: 'lcv', label: 'LCV', detail: 'Light commercial' }, { id: 'mcv', label: 'MCV', detail: 'Medium commercial' }, { id: 'hcv', label: 'HCV', detail: 'Heavy commercial' }],
  ev: [{ id: 'commuter-bike', label: 'Economy', art: 'commuter' }, { id: 'sports-bike', label: 'Sports', art: 'sports' }, { id: 'premium-bike', label: 'Bullet', art: 'cruiser' }, { id: 'scooter', label: 'Scooter', art: 'scooter' }, { id: 'bike', label: 'Bike', art: 'commuter' }, { id: 'bus', label: 'Bus' }, { id: 'sedan', label: 'Sedan', art: 'sedan' }, { id: 'suv', label: 'SUV', art: 'suv' }, { id: 'mpv', label: 'MPV', art: 'muv' }, { id: 'hatchback', label: 'Hatchback', art: 'hatch' }],
};
export const SIGNUP_SERVICES = [
  { id: 'towing', label: 'Towing', description: 'Vehicle towing' },
  { id: 'flat-tire', label: 'Flat tyre', description: 'Tyre & puncture repair' },
  { id: 'battery', label: 'Battery', description: 'Battery jumpstart' },
  { id: 'mechanical', label: 'Mechanic', description: 'Roadside repairs' },
  { id: 'fuel', label: 'Fuel', description: 'Emergency fuel delivery' },
  { id: 'lockout', label: 'Lockout', description: 'Vehicle unlocking' },
  { id: 'winching', label: 'Winching', description: 'Vehicle recovery' },
  { id: 'ev-charging', label: 'EV charging', description: 'Portable charging' },
] as const;

const REQUEST_SUBTYPE_ALIASES: Record<string, Record<string, string[]>> = {
  bike: { bike: ['commuter-bike', 'sports-bike', 'premium-bike'], scooter: ['scooter'] },
  car: { sedan: ['sedan'], hatchback: ['hatchback'], suv: ['compact-suv', 'big-suv'], mpv: ['mpv'] },
  commercial: { scv: ['pickup-mini-truck'], lcv: ['tempo-van', 'light-commercial'], mcv: ['mcv'], hcv: ['heavy-truck'] },
  ev: { scooter: ['electric-scooter'], bike: ['electric-bike'], car: ['electric-car', 'electric-suv'], bus: ['electric-bus'] },
};

// Keep the existing dispatch and homepage pricing readers in sync with the
// detailed subtype rows, using the same existing technician pricing structures.
export function buildLegacySignupPricingConfig(rows: PricingRow[]) {
  const groups = new Map<string, Map<string, PricingRow[]>>();
  for (const row of rows) {
    const domain = String(row.pricing_json.service_domain || '');
    const vehicle = String(row.pricing_json.vehicle_type || '');
    if (!domain || !vehicle) continue;
    if (!groups.has(domain)) groups.set(domain, new Map());
    const vehicles = groups.get(domain)!;
    vehicles.set(vehicle, [...(vehicles.get(vehicle) || []), row]);
  }
  return [...groups].map(([domain, vehicles]) => {
    const vehiclePricing = Object.fromEntries([...vehicles].map(([vehicle, subtypeRows]) => {
      const normalized: Record<string, string | number>[] = subtypeRows.map(row => {
        const fields = row.pricing_json;
        const tyrePrices = [fields.tube_tyre_price, fields.tubeless_tyre_price, fields.tubeless_price]
          .filter(value => value !== '' && value != null).map(Number);
        return { ...fields, label: fields.vehicle_subtype_label,
          service_charge: fields.service_charge ?? fields.jumpstart_charge ?? fields.unlock_charge ?? fields.charging_support_fee ?? fields.recovery_fee ?? (tyrePrices.length ? Math.min(...tyrePrices) : fields.base_charge),
          extra_km_charge: fields.extra_km_charge ?? fields.cost_per_km,
          tubeless_price: fields.tubeless_price ?? fields.tubeless_tyre_price,
          free_km: fields.free_km ?? fields.free_distance,
        };
      });
      const subcategories = Object.fromEntries(subtypeRows.map((row, index) => [row.pricing_json.vehicle_subtype, normalized[index]]));
      for (const [subtype, fields] of Object.entries(subcategories)) {
        for (const alias of REQUEST_SUBTYPE_ALIASES[vehicle]?.[subtype] || []) subcategories[alias] = fields;
      }
      // The current customer SUV/MUV option also covers MPVs when SUV is not offered.
      if (vehicle === 'car' && subcategories.mpv && !subcategories['big-suv']) subcategories['big-suv'] = subcategories.mpv;
      const defaults = [...normalized].sort((a, b) => (Number(a.service_charge || a.delivery_charge || 0) + Number(a.visit_charge || 0)) - (Number(b.service_charge || b.delivery_charge || 0) + Number(b.visit_charge || 0)))[0];
      return [vehicle, { ...defaults, selected_subcategories: subtypeRows.map(row => row.pricing_json.vehicle_subtype),
        subcategories }];
    }));
    const key = domain === 'flat-tire' ? 'flat_tire_vehicle_pricing' : domain === 'towing' ? 'towing_vehicle_pricing' : 'vehicle_pricing';
    return { service_domain: domain, service_name: domain, vehicle_categories: [...vehicles.keys()], [key]: vehiclePricing };
  });
}

export function filterSignupPricing(rows: PricingRow[], template: PricingTemplate, services: string[], vehicles: string[]) {
  return rows.filter(row => {
    const service = template.services.find(item => String(item.id) === String(row.service_id));
    const vehicle = template.categories.find(item => String(item.id) === String(row.vehicle_category_id));
    const vehicleType = vehicle && canonicalizeVehicleKey(vehicle.category_name);
    const validSubtype = vehicleType && SIGNUP_SUBTYPES[vehicleType as SignupVehicle]?.some(subtype => subtype.id === row.pricing_json.vehicle_subtype);
    return service && vehicle && vehicleType && validSubtype && services.includes(canonicalizeServiceKey(service.service_slug || service.service_name))
      && vehicles.includes(vehicleType);
  });
}
export function getSignupPricingError(rows: PricingRow[], template: PricingTemplate, services: string[], vehicles: string[]) {
  for (const serviceId of services) {
    const service = template.services.find(item => canonicalizeServiceKey(item.service_slug || item.service_name) === serviceId);
    if (!service) return 'Pricing is unavailable for a selected service. Please retry loading the prices.';
    const fields = template.pricingFields.filter(field => String(field.service_id) === String(service.id));
    if (!fields.length) return `Pricing fields are unavailable for ${service.service_name}. Please retry.`;
    for (const vehicleId of vehicles) {
      const vehicle = template.categories.find(item => canonicalizeVehicleKey(item.category_name) === vehicleId);
      const relevantRows = rows.filter(row => row.service_id === service.id && row.vehicle_category_id === vehicle?.id);
      if (!vehicle || !relevantRows.length) return `Choose a ${vehicleId} subtype and set its ${SIGNUP_SERVICES.find(s => s.id === serviceId)?.label || serviceId} prices.`;
      for (const row of relevantRows) {
        for (const field of fields) {
          const raw = row.pricing_json[field.field_key];
          if ((field.required && (raw === '' || raw == null)) || (raw !== '' && raw != null && (!Number.isFinite(Number(raw)) || Number(raw) < 0))) {
            return `Enter a valid ${field.field_label.toLowerCase()} for ${row.pricing_json.vehicle_subtype_label}.`;
          }
        }
      }
    }
  }
  return null;
}
