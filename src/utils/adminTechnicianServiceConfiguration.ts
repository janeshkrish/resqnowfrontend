import {
  ADMIN_TOWING_FLEET_TYPES,
  ADMIN_VEHICLE_TYPES,
  type AdminVehicleTypeId,
} from "@/config/adminTechnicianServicePricingCatalog";
import {
  canonicalizeServiceKey,
  canonicalizeVehicleKey,
} from "@/config/technicianNormalization";
import { buildSignupPricingPayload } from "@/utils/technicianSignupPricing";

type UnknownRecord = Record<string, unknown>;
type VehiclePricingMap = Record<string, UnknownRecord>;

export type AdminServicePricingEntry = UnknownRecord & {
  service_name: string;
  service_domain: string;
  vehicle_categories: string[];
  towing_fleet_types?: string[];
  towing_vehicle_pricing?: VehiclePricingMap;
  flat_tire_vehicle_pricing?: VehiclePricingMap;
  vehicle_pricing?: VehiclePricingMap;
};

const SUPPORTED_VEHICLE_TYPES = ADMIN_VEHICLE_TYPES.map(({ id }) => id);
const SUPPORTED_VEHICLE_TYPE_SET = new Set(SUPPORTED_VEHICLE_TYPES);

const isObject = (value: unknown): value is UnknownRecord =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseMaybeJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (!trimmed.startsWith("[") && !trimmed.startsWith("{")) return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const toTokens = (value: unknown): unknown[] => {
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed)) {
    return parsed.flatMap((entry) => toTokens(entry));
  }
  if (isObject(parsed)) {
    return Object.entries(parsed)
      .filter(([, enabled]) => enabled !== false && enabled != null)
      .map(([key]) => key);
  }

  return String(parsed || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

const unique = <T,>(values: T[]): T[] => Array.from(new Set(values));

const uniqueNormalized = (
  values: unknown[],
  normalizer: (value: unknown) => string,
  allowedValues?: Set<string>
) =>
  unique(
    values
      .map((value) => normalizer(value))
      .filter((value) => value && (!allowedValues || allowedValues.has(value)))
  );

const optionId = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const formatLabel = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const getAdminVehicleTypesFromValue = (value: unknown): string[] =>
  uniqueNormalized(toTokens(value), canonicalizeVehicleKey, SUPPORTED_VEHICLE_TYPE_SET);

export const parseAdminServiceTokens = (value: unknown): string[] =>
  uniqueNormalized(toTokens(value), canonicalizeServiceKey);

const pricingMapKeys = (value: unknown): string[] =>
  isObject(value)
    ? uniqueNormalized(Object.keys(value), canonicalizeVehicleKey, SUPPORTED_VEHICLE_TYPE_SET)
    : [];

const getVehicleCategories = (
  rawEntry: UnknownRecord,
  fallbackVehicleTypes: string[]
) => {
  const explicit = getAdminVehicleTypesFromValue(rawEntry.vehicle_categories);
  if (explicit.length > 0) return explicit;

  const nestedVehicles = uniqueNormalized(
    [
      ...pricingMapKeys(rawEntry.towing_vehicle_pricing),
      ...pricingMapKeys(rawEntry.flat_tire_vehicle_pricing),
      ...pricingMapKeys(rawEntry.vehicle_pricing),
      rawEntry.vehicle_type,
      rawEntry.vehicle_type_pricing,
    ],
    canonicalizeVehicleKey,
    SUPPORTED_VEHICLE_TYPE_SET
  );
  if (nestedVehicles.length > 0) return nestedVehicles;

  return getAdminVehicleTypesFromValue(fallbackVehicleTypes);
};

const clone = <T,>(value: T): T => {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
};

const emptyVehiclePricing = (serviceDomain: string): UnknownRecord => {
  if (serviceDomain === "flat-tire") {
    return {
      visit_charge: "",
      free_distance: "",
      extra_km_charge: "",
      selected_subcategories: [],
      subcategories: {},
    };
  }

  if (serviceDomain === "towing") {
    return {
      base_charge: "",
      free_distance: "",
      extra_km_charge: "",
      fleet_pricing: {},
    };
  }

  return {};
};

const ensureVehiclePricing = (
  serviceDomain: string,
  vehicleCategories: string[],
  existing?: VehiclePricingMap
) => {
  const next: VehiclePricingMap = {};
  vehicleCategories.forEach((vehicleType) => {
    next[vehicleType] = {
      ...emptyVehiclePricing(serviceDomain),
      ...(isObject(existing?.[vehicleType]) ? clone(existing?.[vehicleType]) : {}),
    };
  });
  return next;
};

const getDefaultFleetTypes = (rawEntry: UnknownRecord) =>
  unique(
    [
      ...toTokens(rawEntry.towing_fleet_types),
      ...toTokens(rawEntry.tow_truck_types),
      ...toTokens(rawEntry.default_tow_truck_type),
    ]
      .map((value) => optionId(value))
      .filter(Boolean)
  );

const normalizeFleetPricing = (
  value: unknown,
  fallbackFleetTypes: string[]
): Record<string, Record<string, unknown>> => {
  const raw = isObject(value) ? value : {};
  const fleetTypes =
    fallbackFleetTypes.length > 0
      ? fallbackFleetTypes
      : unique(
          [
            ...Object.keys(raw),
            ...ADMIN_TOWING_FLEET_TYPES.map(({ id }) => id),
          ].filter(Boolean)
        );

  const out: Record<string, Record<string, unknown>> = {};
  fleetTypes.forEach((fleetType) => {
    const row = isObject(raw[fleetType]) ? raw[fleetType] : {};
    out[fleetType] = {
      base_charge: row.base_charge ?? "",
      free_distance: row.free_distance ?? "",
      per_km_charge: row.per_km_charge ?? row.extra_km_charge ?? "",
    };
  });
  return out;
};

const normalizeTowingVehiclePricing = (
  value: unknown,
  fallbackFleetTypes: string[]
) => {
  const raw = isObject(value) ? value : {};
  return {
    base_charge: raw.base_charge ?? "",
    free_distance: raw.free_distance ?? "",
    extra_km_charge: raw.extra_km_charge ?? raw.per_km_charge ?? "",
    fleet_pricing: normalizeFleetPricing(raw.fleet_pricing, fallbackFleetTypes),
  };
};

const normalizeFlatTireSubcategories = (value: unknown) => {
  const subcategories: Record<string, Record<string, unknown>> = {};
  const selected: string[] = [];

  if (Array.isArray(value)) {
    value.forEach((rawSubcategory) => {
      const row = isObject(rawSubcategory) ? rawSubcategory : {};
      const id = optionId(row.id || row.value || row.label);
      if (!id) return;
      selected.push(id);
      subcategories[id] = {
        label: String(row.label || formatLabel(id)),
        tube_tyre_price: row.tube_tyre_price ?? "",
        tubeless_price: row.tubeless_price ?? "",
      };
    });
  } else if (isObject(value)) {
    Object.entries(value).forEach(([rawId, rawSubcategory]) => {
      const row = isObject(rawSubcategory) ? rawSubcategory : {};
      const id = optionId(row.id || rawId);
      if (!id) return;
      selected.push(id);
      subcategories[id] = {
        label: String(row.label || formatLabel(id)),
        tube_tyre_price: row.tube_tyre_price ?? "",
        tubeless_price: row.tubeless_price ?? "",
      };
    });
  }

  return {
    subcategories,
    selected: unique(selected),
  };
};

const normalizeFlatTireVehiclePricing = (value: unknown) => {
  const raw = isObject(value) ? value : {};
  const { subcategories, selected } = normalizeFlatTireSubcategories(raw.subcategories);
  const explicitSelected = unique(
    toTokens(raw.selected_subcategories)
      .map((entry) => optionId(entry))
      .filter(Boolean)
  );
  const selectedSubcategories =
    explicitSelected.length > 0 ? explicitSelected : selected;

  return {
    visit_charge: raw.visit_charge ?? "",
    free_distance: raw.free_distance ?? "",
    extra_km_charge: raw.extra_km_charge ?? raw.per_km_charge ?? "",
    selected_subcategories: selectedSubcategories,
    subcategories,
  };
};

const normalizeGenericVehiclePricing = (value: unknown) => {
  const raw = isObject(value) ? value : {};
  return {
    service_charge: raw.service_charge ?? raw.serviceCharge ?? "",
    visit_charge: raw.visit_charge ?? raw.visitCharge ?? "",
    delivery_charge: raw.delivery_charge ?? raw.deliveryCharge ?? "",
    labour_min: raw.labour_min ?? raw.labourMin ?? "",
    labour_max: raw.labour_max ?? raw.labourMax ?? "",
    free_distance: raw.free_distance ?? "",
    extra_km_charge: raw.extra_km_charge ?? raw.extraKmCharge ?? raw.per_km_charge ?? "",
  };
};

const normalizeLegacyRowPricing = (
  serviceDomain: string,
  rawEntry: UnknownRecord
) => {
  if (serviceDomain === "flat-tire") {
    const serviceCharge =
      rawEntry.service_charge ?? rawEntry.serviceCharge ?? rawEntry.amount ?? rawEntry.price;
    const subcategories =
      serviceCharge == null || serviceCharge === ""
        ? {}
        : {
            standard: {
              label: "Standard Puncture",
              tube_tyre_price: serviceCharge,
              tubeless_price: serviceCharge,
            },
          };
    return {
      visit_charge: rawEntry.visit_charge ?? rawEntry.visitCharge ?? "",
      free_distance: rawEntry.free_distance ?? "",
      extra_km_charge: rawEntry.extra_km_charge ?? rawEntry.extraKmCharge ?? "",
      selected_subcategories: Object.keys(subcategories),
      subcategories,
    };
  }

  if (serviceDomain === "towing") {
    return normalizeTowingVehiclePricing(
      {
        base_charge: rawEntry.base_charge ?? rawEntry.visit_charge ?? "",
        free_distance: rawEntry.free_distance ?? "",
        extra_km_charge: rawEntry.extra_km_charge ?? rawEntry.extraKmCharge ?? "",
      },
      getDefaultFleetTypes(rawEntry)
    );
  }

  return normalizeGenericVehiclePricing(rawEntry);
};

const createAdminServicePricingEntry = (
  serviceDomainInput: unknown,
  fallbackVehicleTypes: string[] = []
): AdminServicePricingEntry => {
  const serviceDomain = canonicalizeServiceKey(serviceDomainInput);
  const vehicleCategories = getAdminVehicleTypesFromValue(fallbackVehicleTypes);
  const entry: AdminServicePricingEntry = {
    service_name: serviceDomain,
    service_domain: serviceDomain,
    vehicle_categories: vehicleCategories,
  };

  if (serviceDomain === "towing") {
    entry.towing_fleet_types = [];
    entry.towing_vehicle_pricing = ensureVehiclePricing(
      serviceDomain,
      vehicleCategories
    );
  } else if (serviceDomain === "flat-tire") {
    entry.flat_tire_vehicle_pricing = ensureVehiclePricing(
      serviceDomain,
      vehicleCategories
    );
  } else {
    entry.vehicle_pricing = ensureVehiclePricing(serviceDomain, vehicleCategories);
  }

  return entry;
};

const normalizeExistingEntry = (
  value: unknown,
  fallbackVehicleTypes: string[] = [],
  serviceHint?: string
): AdminServicePricingEntry | null => {
  if (!isObject(value)) return null;

  const serviceDomain = canonicalizeServiceKey(
    value.service_domain || value.service_name || value.service || serviceHint
  );
  if (!serviceDomain) return null;

  const vehicleCategories = getVehicleCategories(value, fallbackVehicleTypes);
  const entry = createAdminServicePricingEntry(serviceDomain, vehicleCategories);
  entry.vehicle_categories = vehicleCategories;

  if (serviceDomain === "towing") {
    const fleetTypes = getDefaultFleetTypes(value);
    const nested = isObject(value.towing_vehicle_pricing)
      ? value.towing_vehicle_pricing
      : {};
    entry.towing_fleet_types = fleetTypes;
    entry.towing_vehicle_pricing = {};
    vehicleCategories.forEach((vehicleType) => {
      const rawVehiclePricing = isObject(nested[vehicleType])
        ? nested[vehicleType]
        : normalizeLegacyRowPricing(serviceDomain, value);
      entry.towing_vehicle_pricing![vehicleType] = normalizeTowingVehiclePricing(
        rawVehiclePricing,
        fleetTypes
      );
    });
  } else if (serviceDomain === "flat-tire") {
    const nested = isObject(value.flat_tire_vehicle_pricing)
      ? value.flat_tire_vehicle_pricing
      : {};
    entry.flat_tire_vehicle_pricing = {};
    vehicleCategories.forEach((vehicleType) => {
      const rawVehiclePricing = isObject(nested[vehicleType])
        ? nested[vehicleType]
        : normalizeLegacyRowPricing(serviceDomain, value);
      entry.flat_tire_vehicle_pricing![vehicleType] =
        normalizeFlatTireVehiclePricing(rawVehiclePricing);
    });
  } else {
    const nested = isObject(value.vehicle_pricing) ? value.vehicle_pricing : {};
    entry.vehicle_pricing = {};
    vehicleCategories.forEach((vehicleType) => {
      const rawVehiclePricing = isObject(nested[vehicleType])
        ? nested[vehicleType]
        : normalizeLegacyRowPricing(serviceDomain, value);
      entry.vehicle_pricing![vehicleType] =
        normalizeGenericVehiclePricing(rawVehiclePricing);
    });
  }

  return entry;
};

const mergeServiceEntries = (
  first: AdminServicePricingEntry,
  second: AdminServicePricingEntry
): AdminServicePricingEntry => {
  const vehicleCategories = unique([
    ...first.vehicle_categories,
    ...second.vehicle_categories,
  ]);
  const merged = createAdminServicePricingEntry(first.service_domain, vehicleCategories);
  merged.vehicle_categories = vehicleCategories;

  if (first.service_domain === "towing") {
    merged.towing_fleet_types = unique([
      ...(first.towing_fleet_types || []),
      ...(second.towing_fleet_types || []),
    ]);
    merged.towing_vehicle_pricing = {
      ...(first.towing_vehicle_pricing || {}),
      ...(second.towing_vehicle_pricing || {}),
    };
  } else if (first.service_domain === "flat-tire") {
    merged.flat_tire_vehicle_pricing = {
      ...(first.flat_tire_vehicle_pricing || {}),
      ...(second.flat_tire_vehicle_pricing || {}),
    };
  } else {
    merged.vehicle_pricing = {
      ...(first.vehicle_pricing || {}),
      ...(second.vehicle_pricing || {}),
    };
  }

  return merged;
};

const normalizeEntries = (
  value: unknown,
  fallbackVehicleTypes: string[] = []
): AdminServicePricingEntry[] => {
  const parsed = parseMaybeJson(value);
  const rawEntries: Array<{ serviceHint?: string; value: unknown }> = [];

  if (Array.isArray(parsed)) {
    parsed.forEach((entry) => rawEntries.push({ value: entry }));
  } else if (isObject(parsed)) {
    Object.entries(parsed).forEach(([serviceHint, entryValue]) => {
      if (isObject(entryValue)) {
        rawEntries.push({ serviceHint, value: { service_domain: serviceHint, ...entryValue } });
      } else {
        rawEntries.push({
          serviceHint,
          value: { service_domain: serviceHint, service_charge: entryValue },
        });
      }
    });
  }

  const byService = new Map<string, AdminServicePricingEntry>();
  rawEntries.forEach(({ value: rawEntry, serviceHint }) => {
    const normalized = normalizeExistingEntry(
      rawEntry,
      fallbackVehicleTypes,
      serviceHint
    );
    if (!normalized) return;
    const current = byService.get(normalized.service_domain);
    byService.set(
      normalized.service_domain,
      current ? mergeServiceEntries(current, normalized) : normalized
    );
  });

  return Array.from(byService.values());
};

export const syncAdminServicePricing = (
  entries: unknown,
  services: unknown,
  fallbackVehicleTypes: unknown = []
): AdminServicePricingEntry[] => {
  const serviceDomains = parseAdminServiceTokens(services);
  if (serviceDomains.length === 0) return [];

  const fallbackVehicles = getAdminVehicleTypesFromValue(fallbackVehicleTypes);
  const normalizedEntries = normalizeEntries(entries, []);
  const byService = new Map(
    normalizedEntries.map((entry) => [entry.service_domain, entry])
  );

  return serviceDomains.map((serviceDomain) => {
    const existing = byService.get(serviceDomain);
    if (existing) {
      const normalized = normalizeExistingEntry(existing, [], serviceDomain);
      if (normalized?.vehicle_categories.length) return normalized;
      return createAdminServicePricingEntry(serviceDomain, fallbackVehicles);
    }
    return createAdminServicePricingEntry(serviceDomain, fallbackVehicles);
  });
};

export const hydrateAdminServicePricing = (
  value: unknown,
  services: unknown = [],
  fallbackVehicleTypes: unknown = []
): AdminServicePricingEntry[] => {
  const fallbackVehicles = getAdminVehicleTypesFromValue(fallbackVehicleTypes);
  const normalized = normalizeEntries(value, fallbackVehicles);
  const serviceDomains = parseAdminServiceTokens(services);
  if (serviceDomains.length === 0) return normalized;
  return syncAdminServicePricing(normalized, serviceDomains, fallbackVehicles);
};

export const updateAdminServiceVehicleCategories = (
  entry: AdminServicePricingEntry,
  vehicleCategoriesInput: unknown
): AdminServicePricingEntry => {
  const vehicleCategories = getAdminVehicleTypesFromValue(vehicleCategoriesInput);
  const next = createAdminServicePricingEntry(entry.service_domain, vehicleCategories);
  next.vehicle_categories = vehicleCategories;

  if (entry.service_domain === "towing") {
    next.towing_fleet_types = [...(entry.towing_fleet_types || [])];
    next.towing_vehicle_pricing = ensureVehiclePricing(
      entry.service_domain,
      vehicleCategories,
      entry.towing_vehicle_pricing
    );
  } else if (entry.service_domain === "flat-tire") {
    next.flat_tire_vehicle_pricing = ensureVehiclePricing(
      entry.service_domain,
      vehicleCategories,
      entry.flat_tire_vehicle_pricing
    );
  } else {
    next.vehicle_pricing = ensureVehiclePricing(
      entry.service_domain,
      vehicleCategories,
      entry.vehicle_pricing
    );
  }

  return next;
};

export const buildAdminServicePricingPayload = (
  entries: unknown
): Record<string, unknown>[] => {
  const normalizedEntries = normalizeEntries(entries, []);
  return buildSignupPricingPayload(normalizedEntries).serviceCosts;
};

export const isSupportedAdminVehicleType = (
  value: string
): value is AdminVehicleTypeId => SUPPORTED_VEHICLE_TYPE_SET.has(value);
