/** How the technician's job cards write money, distance and time, and pick the vehicle photo. */

const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

/** A dash when the value is missing: the cards never show a made-up number. */
export const formatRupees = (value: number | null | undefined) =>
  isNumber(value) ? `₹${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—";

export const formatKm = (value: number | null | undefined) => (isNumber(value) ? `${value.toFixed(1)} km` : "—");

export const formatMinutes = (value: number | null | undefined) =>
  isNumber(value) ? `${Math.max(1, Math.round(value))} min` : "—";

/** "START PICKUP" from the status helpers, as the cards write buttons: "Start pickup". */
export const sentenceCase = (label: string) => {
  const text = String(label || "").trim().toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
};

/** The studio photo for the customer's kind of vehicle (public/images/vehicles). */
export function vehicleImageFor(vehicleType: unknown) {
  const type = String(vehicleType || "").toLowerCase();
  if (/bike|two|scooter|motor/.test(type)) return "/images/vehicles/bike.webp";
  if (/commercial|truck|tow|bus|van/.test(type)) return "/images/vehicles/truck.webp";
  if (/^ev\b|electric/.test(type)) return "/images/vehicles/ev.webp";
  return "/images/vehicles/car.webp";
}
