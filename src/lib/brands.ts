/**
 * Fuel and EV charging brands the radar can show a logo for. The backend
 * detects the brand from the place name Mappls returns; anything it cannot
 * match shows the place's initials instead.
 */
const BRANDS: Record<string, { name: string; logo: string }> = {
  indianoil: { name: "IndianOil", logo: "/images/brands/indianoil.png" },
  bpcl: { name: "Bharat Petroleum", logo: "/images/brands/bpcl.png" },
  hpcl: { name: "HP", logo: "/images/brands/hpcl.png" },
  nayara: { name: "Nayara Energy", logo: "/images/brands/nayara.png" },
  shell: { name: "Shell", logo: "/images/brands/shell.png" },
  jiobp: { name: "Jio-bp", logo: "/images/brands/jiobp.png" },
  tatapower: { name: "Tata Power EZ Charge", logo: "/images/brands/tatapower.png" },
  statiq: { name: "Statiq", logo: "/images/brands/statiq.png" },
};

export function brandOf(key?: string | null) {
  return key && Object.prototype.hasOwnProperty.call(BRANDS, key) ? BRANDS[key] : null;
}

/** Up to two initials for a logo tile. */
export function initialsOf(name: string) {
  const parts = String(name || "").trim().split(/\s+/).filter((part) => /[A-Za-z0-9]/.test(part));
  if (parts.length === 0) return "RN";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
}
