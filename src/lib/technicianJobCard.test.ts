import { describe, expect, it } from "vitest";
import { formatKm, formatMinutes, formatRupees, sentenceCase, vehicleImageFor } from "./technicianJobCard";

describe("job card values", () => {
  it("writes money, distance and time, and a dash when the value is missing", () => {
    expect(formatRupees(820)).toBe("₹820");
    expect(formatRupees(125000)).toBe("₹1,25,000");
    expect(formatRupees(0)).toBe("₹0");
    expect(formatRupees(null)).toBe("—");
    expect(formatKm(2.44)).toBe("2.4 km");
    expect(formatKm(undefined)).toBe("—");
    expect(formatMinutes(7.6)).toBe("8 min");
    expect(formatMinutes(0.2)).toBe("1 min");
    expect(formatMinutes(Number.NaN)).toBe("—");
  });

  it("writes the status helpers' labels as buttons", () => {
    expect(sentenceCase("REACHED DROP LOCATION")).toBe("Reached drop location");
    expect(sentenceCase("")).toBe("");
  });

  it("picks the photo for the customer's kind of vehicle", () => {
    expect(vehicleImageFor("bike")).toBe("/images/vehicles/bike.webp");
    expect(vehicleImageFor("two-wheeler")).toBe("/images/vehicles/bike.webp");
    expect(vehicleImageFor("commercial")).toBe("/images/vehicles/truck.webp");
    expect(vehicleImageFor("ev")).toBe("/images/vehicles/ev.webp");
    expect(vehicleImageFor("car")).toBe("/images/vehicles/car.webp");
    expect(vehicleImageFor(undefined)).toBe("/images/vehicles/car.webp");
  });
});
