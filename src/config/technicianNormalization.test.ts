import { describe, expect, it } from "vitest";
import { canonicalizeVehicleKey, normalizeVehicleTypesForApi } from "./technicianNormalization";

describe("technician vehicle identity", () => {
  it.each(["Electric Bike", "electric-scooter", "EV Scooter", "Electric Car", "EV SUV"])("keeps %s in the EV family", (label) => {
    expect(canonicalizeVehicleKey(label)).toBe("ev");
  });

  it("deduplicates electric labels without changing ordinary vehicle families", () => {
    expect(normalizeVehicleTypesForApi(["Electric Bike", "EV Scooter", "Bike", "Car", "Truck"])).toEqual({ ev: true, bike: true, car: true, commercial: true });
  });
});
