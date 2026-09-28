/**
 * Vehicle classes the request form asks for. The ids are the ones technicians price
 * against in onboarding (and resqnowbackend/services/vehicleClasses.js), so the class a
 * customer taps is the class their price is worked out from.
 */
export type VehicleFamily = "car" | "bike" | "commercial" | "ev";

export type VehicleClassId =
  | "hatchback" | "sedan" | "compact-suv" | "big-suv" | "luxury"
  | "scooter" | "commuter-bike" | "sports-bike" | "premium-bike"
  | "pickup-mini-truck" | "tempo-van" | "light-commercial" | "heavy-truck"
  | "electric-scooter" | "electric-bike" | "electric-car" | "electric-suv";

/** Which picture a class tile shows (see components/request-form/VehicleArt). */
export type VehicleArtId =
  | "hatch" | "sedan" | "suv" | "muv" | "luxury"
  | "scooter" | "commuter" | "sports" | "cruiser"
  | "pickup" | "van" | "lcv" | "truck";

export type VehicleClass = {
  id: VehicleClassId;
  /** Short enough for a tile. */
  label: string;
  /** "Swift is a hatchback". */
  phrase: string;
  art: VehicleArtId;
  electric?: boolean;
};

export const VEHICLE_CLASSES: Record<VehicleFamily, VehicleClass[]> = {
  car: [
    { id: "hatchback", label: "Hatchback", phrase: "a hatchback", art: "hatch" },
    { id: "sedan", label: "Sedan", phrase: "a sedan", art: "sedan" },
    { id: "compact-suv", label: "Small SUV", phrase: "a small SUV", art: "suv" },
    { id: "big-suv", label: "SUV / MUV", phrase: "a big SUV or MUV", art: "muv" },
    { id: "luxury", label: "Luxury", phrase: "a luxury car", art: "luxury" },
  ],
  bike: [
    { id: "scooter", label: "Scooter", phrase: "a scooter", art: "scooter" },
    { id: "commuter-bike", label: "Commuter", phrase: "a commuter bike", art: "commuter" },
    { id: "sports-bike", label: "Sports", phrase: "a sports bike", art: "sports" },
    { id: "premium-bike", label: "Cruiser", phrase: "a cruiser or premium bike", art: "cruiser" },
  ],
  commercial: [
    { id: "pickup-mini-truck", label: "Pickup", phrase: "a pickup or mini truck", art: "pickup" },
    { id: "tempo-van", label: "Tempo / van", phrase: "a tempo or van", art: "van" },
    { id: "light-commercial", label: "Small truck", phrase: "a small truck", art: "lcv" },
    { id: "heavy-truck", label: "Truck / bus", phrase: "a truck or bus", art: "truck" },
  ],
  ev: [
    { id: "electric-scooter", label: "E-scooter", phrase: "an electric scooter", art: "scooter", electric: true },
    { id: "electric-bike", label: "E-bike", phrase: "an electric bike", art: "commuter", electric: true },
    { id: "electric-car", label: "E-car", phrase: "an electric car", art: "hatch", electric: true },
    { id: "electric-suv", label: "E-SUV", phrase: "an electric SUV", art: "suv", electric: true },
  ],
};

const ALL_CLASSES = Object.values(VEHICLE_CLASSES).flat();

export const vehicleClassInfo = (id?: string | null): VehicleClass | null =>
  ALL_CLASSES.find((entry) => entry.id === id) ?? null;

export const classesFor = (family: VehicleFamily) => VEHICLE_CLASSES[family];

/** The electric class for a car or bike class, used when an EV is picked from the car or bike lists. */
export function electricClassFor(id: VehicleClassId): VehicleClassId {
  if (id.startsWith("electric-")) return id;
  if (id === "scooter") return "electric-scooter";
  if (id === "commuter-bike" || id === "sports-bike" || id === "premium-bike") return "electric-bike";
  if (id === "hatchback" || id === "sedan") return "electric-car";
  return "electric-suv";
}

/** Two-wheelers get bike questions (front and back tyre, litres for a bike, a bike carrier). */
export function isTwoWheeler(family: VehicleFamily, classId?: string | null) {
  if (family === "bike") return true;
  return family === "ev" && (classId === "electric-scooter" || classId === "electric-bike");
}
