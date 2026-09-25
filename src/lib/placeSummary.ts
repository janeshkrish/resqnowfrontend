export type PlaceSummary = {
  /** The area people recognise, e.g. "Peelamedu". */
  title: string;
  /** A short address line, e.g. "Avinashi Road, Peelamedu, Coimbatore 641004". */
  subtitle: string;
};

const clean = (value: unknown) => String(value ?? "").trim();

/**
 * Turns a reverse-geocode result (the backend's Nominatim payload) into a
 * header-sized place: the area as a title and a short address line, instead
 * of Nominatim's long display_name with district, state and country.
 */
export function summarizePlace(result: unknown): PlaceSummary | null {
  if (!result || typeof result !== "object") return null;
  const data = result as { address?: unknown; display_name?: unknown; name?: unknown };
  const parts = data.address && typeof data.address === "object"
    ? (data.address as Record<string, unknown>)
    : {};
  const pick = (...keys: string[]) => keys.map((key) => clean(parts[key])).find(Boolean) || "";

  const area = pick("suburb", "neighbourhood", "quarter", "city_district", "village", "town", "hamlet");
  const city = pick("city", "town", "village", "municipality", "county", "state_district");
  const title = area || city || clean(data.name);
  const street = [pick("house_number"), pick("road", "pedestrian", "residential")].filter(Boolean).join(", ");
  const cityLine = [city, pick("postcode")].filter(Boolean).join(" ");

  const segments: string[] = [];
  for (const segment of [street, area, cityLine]) {
    if (segment && !segments.some((existing) => existing.toLowerCase() === segment.toLowerCase())) {
      segments.push(segment);
    }
  }
  if (title && segments.length) return { title, subtitle: segments.join(", ") };

  const display = clean(data.display_name).split(",").map((segment) => segment.trim()).filter(Boolean);
  if (!display.length) return title ? { title, subtitle: "" } : null;
  return {
    title: title || display[0],
    subtitle: display.slice(title ? 0 : 1, 4).join(", "),
  };
}
