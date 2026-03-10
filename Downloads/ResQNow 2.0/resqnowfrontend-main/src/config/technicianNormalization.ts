const SERVICE_ALIASES: Record<string, string[]> = {
  towing: ["towing", "towing assistance", "tow", "towing services"],
  "flat-tire": ["flat tire", "flat tire repair", "tyre / puncture repair", "tubeless", "tubeless tyre repair", "puncture"],
  battery: ["battery", "battery jump start", "battery jumpstart", "jumpstart", "battery replacement"],
  mechanical: ["mechanical", "mechanic", "mechanical issues", "mechanic issues", "car repair", "bike repair", "general servicing", "general repair", "general repairs", "oil change", "brake service", "electrical repair", "engine repair"],
  fuel: ["fuel", "fuel delivery"],
  lockout: ["lockout", "lockout assistance", "lockup"],
  winching: ["winching", "winching services", "recovery", "accident repair", "accident recovery"],
  "ev-charging": ["ev charging", "ev portable charger", "ev support", "ev assistance", "ev help", "charging"],
  other: ["other", "others", "custom", "general", "generic", "misc", "unknown"],
};

const VEHICLE_ALIASES: Record<string, string[]> = {
  bike: ["bike", "two-wheeler", "two wheeler", "motorcycle", "scooter"],
  car: ["car", "four-wheeler", "four wheeler"],
  commercial: ["commercial", "truck", "bus", "van"],
  ev: ["ev", "electric", "electric vehicle"],
};

const normalizeText = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const toTokens = (value: string) => normalizeText(value).split(" ").filter(Boolean);

const overlapCount = (a: string, b: string) => {
  const sa = new Set(toTokens(a));
  const sb = new Set(toTokens(b));
  let count = 0;
  sa.forEach((t) => {
    if (sb.has(t)) count += 1;
  });
  return count;
};

const aliasMatch = (n: string, a: string) => {
  if (!n || !a) return false;
  if (n === a) return true;
  if (n.includes(a) && a.length >= 4) return true;

  const nTokens = toTokens(n).length;
  const aTokens = toTokens(a).length;
  if (nTokens >= 2 && aTokens >= 2 && overlapCount(n, a) >= 2) return true;
  if (nTokens >= 2 && aTokens >= 2 && a.includes(n) && n.length >= 8) return true;
  return false;
};

export function canonicalizeServiceKey(input: unknown): string {
  const n = normalizeText(input);
  if (!n) return "";
  for (const [key, aliases] of Object.entries(SERVICE_ALIASES)) {
    if (aliases.some((a) => aliasMatch(n, normalizeText(a)))) {
      return key;
    }
  }
  return n.replace(/\s+/g, "-");
}

export function canonicalizeVehicleKey(input: unknown): string {
  const n = normalizeText(input);
  if (!n) return "";
  for (const [key, aliases] of Object.entries(VEHICLE_ALIASES)) {
    if (aliases.some((a) => aliasMatch(n, normalizeText(a)))) {
      return key;
    }
  }
  return n;
}

export function normalizeSpecialtiesForApi(specialties: unknown): string[] {
  if (!Array.isArray(specialties)) return [];
  return [...new Set(specialties.map((s) => canonicalizeServiceKey(s)).filter(Boolean))];
}

export function normalizeVehicleTypesForApi(vehicleTypes: unknown): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  if (Array.isArray(vehicleTypes)) {
    vehicleTypes.forEach((v) => {
      const key = canonicalizeVehicleKey(v);
      if (key) out[key] = true;
    });
    return out;
  }
  if (vehicleTypes && typeof vehicleTypes === "object") {
    Object.entries(vehicleTypes as Record<string, unknown>).forEach(([k, enabled]) => {
      if (!enabled) return;
      const key = canonicalizeVehicleKey(k);
      if (key) out[key] = true;
    });
  }
  return out;
}

export function normalizePricingConfigForApi(pricingConfig: unknown) {
  if (!Array.isArray(pricingConfig)) return pricingConfig;
  return pricingConfig.map((entry: Record<string, unknown>) => ({
    ...entry,
    service_domain: canonicalizeServiceKey(entry?.service_domain || entry?.service_name || entry?.service),
  }));
}
