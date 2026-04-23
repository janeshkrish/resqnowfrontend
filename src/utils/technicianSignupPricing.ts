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
    [getVehicleBasePriceKey(vehicleType)]: minimumPrice,
    subcategories,
  }) as Record<string, unknown> | null;
};

const buildTowingVehiclePricing = (value: unknown, fleetTypes: string[]) => {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return pruneEmpty({
    base_charge: toNumberOrNull(row.base_charge),
    free_distance: toNumberOrNull(row.free_distance),
    extra_km_charge: toNumberOrNull(row.per_km_charge ?? row.extra_km_charge),
    tow_truck_types: uniqueStrings(fleetTypes),
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
