// The roadside services, in the order the app lists them, with the words a driver would use for each.

export type ServiceId =
  | "towing" | "flat-tire" | "battery" | "mechanical" | "fuel" | "lockout" | "winching" | "ev-charging";

export type ServiceInfo = { id: ServiceId; name: string; say: string };

export const SERVICES: ServiceInfo[] = [
  { id: "towing", name: "Towing", say: "Take it to a garage" },
  { id: "flat-tire", name: "Flat tyre", say: "Puncture or flat" },
  { id: "battery", name: "Battery", say: "Won’t start" },
  { id: "mechanical", name: "Mechanic", say: "Broke down" },
  { id: "fuel", name: "Fuel", say: "Ran out of fuel" },
  { id: "lockout", name: "Lockout", say: "Keys locked inside" },
  { id: "winching", name: "Winching", say: "Stuck in mud" },
  { id: "ev-charging", name: "EV charge", say: "Out of charge" },
];

// Requests saved over the years spell the service in a few ways.
const ALIASES: Record<string, ServiceId> = {
  tow: "towing",
  "flat-tyre": "flat-tire",
  tyre: "flat-tire",
  tire: "flat-tire",
  puncture: "flat-tire",
  "jump-start": "battery",
  jumpstart: "battery",
  mechanic: "mechanical",
  "fuel-delivery": "fuel",
  "lock-out": "lockout",
  winch: "winching",
  ev: "ev-charging",
  "ev-charge": "ev-charging",
};

/** The service a request's `service_type` means, or null when it is something else ("other", "emergency"). */
export function serviceOf(type: string | null | undefined): ServiceInfo | null {
  const key = String(type ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-");
  const id = (ALIASES[key] ?? key) as ServiceId;
  return SERVICES.find((service) => service.id === id) ?? null;
}

/** "Flat tyre" for the screen; an unknown type is shown as it was saved, tidied up. */
export function serviceName(type: string | null | undefined): string {
  const known = serviceOf(type);
  if (known) return known.name;
  const words = String(type ?? "").trim().replace(/[-_]+/g, " ");
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Roadside help";
}

/** The service's picture, the one the home page uses; null when the type has none. */
export function serviceArt(type: string | null | undefined): string | null {
  const known = serviceOf(type);
  return known ? `/images/home/services/${known.id}.webp` : null;
}
