import { describe, expect, it } from "vitest";

import {
  defaultNavigationVehicleMode,
  isPlausibleLocationSample,
  isUsableLocationFix,
  isWithinArrivalRange,
  normalizeNavigationVehicleMode,
  resolveNavigationMotion,
  smoothNavigationPoint,
} from "./technicianNavigation";

describe("technician navigation safety", () => {
  it("requires recent, accurate, non-placeholder GPS coordinates", () => {
    const now = 10_000;

    expect(
      isUsableLocationFix(
        { lat: 12.9716, lng: 77.5946, accuracy: 24, timestamp: now - 1_000 },
        now,
      ),
    ).toBe(true);
    expect(
      isUsableLocationFix(
        { lat: 0, lng: 0, accuracy: 10, timestamp: now },
        now,
      ),
    ).toBe(false);
    expect(
      isUsableLocationFix(
        { lat: 12.9716, lng: 77.5946, accuracy: 250, timestamp: now },
        now,
      ),
    ).toBe(false);
    expect(
      isUsableLocationFix(
        { lat: 12.9716, lng: 77.5946, accuracy: 10, timestamp: now - 60_000 },
        now,
      ),
    ).toBe(false);
  });

  it("normalizes vehicle selection and defaults from the registered vehicle", () => {
    expect(normalizeNavigationVehicleMode("bike")).toBe("two-wheeler");
    expect(normalizeNavigationVehicleMode("tow truck")).toBe("commercial-tow");
    expect(defaultNavigationVehicleMode(["motorcycle"])).toBe("two-wheeler");
    expect(defaultNavigationVehicleMode(["flatbed towing"])).toBe("commercial-tow");
    expect(defaultNavigationVehicleMode(undefined)).toBe("car");
  });

  it("uses native speed and heading, or derives bounded motion from samples", () => {
    const previous = {
      lat: 12.9716,
      lng: 77.5946,
      accuracy: 15,
      timestamp: 1_000,
      speedKmh: 18,
      heading: 90,
    };

    expect(
      resolveNavigationMotion(previous, {
        lat: 12.9717,
        lng: 77.5946,
        accuracy: 12,
        timestamp: 2_000,
        speedMetersPerSecond: 10,
        heading: 120,
      }),
    ).toMatchObject({ speedKmh: 27, heading: 120 });

    const derived = resolveNavigationMotion(previous, {
      lat: 12.9717,
      lng: 77.5946,
      accuracy: 12,
      timestamp: 3_000,
      speedMetersPerSecond: null,
      heading: null,
    });
    expect(derived.speedKmh).toBeGreaterThan(10);
    expect(derived.speedKmh).toBeLessThan(40);
    expect(derived.heading).toBeCloseTo(0, 0);
  });

  it("rejects impossible GPS jumps and smooths plausible movement", () => {
    const previous = {
      lat: 12.9716,
      lng: 77.5946,
      accuracy: 10,
      timestamp: 1_000,
    };

    expect(
      isPlausibleLocationSample(previous, {
        lat: 28.6139,
        lng: 77.209,
        accuracy: 10,
        timestamp: 2_000,
      }),
    ).toBe(false);
    expect(
      isPlausibleLocationSample(previous, {
        lat: 12.9717,
        lng: 77.5947,
        accuracy: 10,
        timestamp: 2_000,
      }),
    ).toBe(true);

    const smoothed = smoothNavigationPoint(previous, {
      lat: 12.9717,
      lng: 77.5947,
    });
    expect(smoothed.lat).toBeGreaterThan(previous.lat);
    expect(smoothed.lat).toBeLessThan(12.9717);
  });
});

describe("being close enough to mark arrival", () => {
  const customer = { lat: 11.0092, lng: 76.9605 };
  // Metres north of the customer.
  const north = (metres: number) => ({ lat: customer.lat + metres / 111_320, lng: customer.lng });

  it("is true within 80 m of the destination, and not before", () => {
    expect(isWithinArrivalRange(north(40), customer)).toBe(true);
    expect(isWithinArrivalRange(north(79), customer)).toBe(true);
    expect(isWithinArrivalRange(north(120), customer)).toBe(false);
    expect(isWithinArrivalRange(north(1_500), customer)).toBe(false);
  });

  it("is true at the end of the road route when the pin is a little way in", () => {
    // The road ends at the gate, 150 m from the customer's pin inside the compound.
    expect(isWithinArrivalRange(north(150), customer, 20)).toBe(true);
    // Still 400 m of road to go.
    expect(isWithinArrivalRange(north(150), customer, 400)).toBe(false);
  });

  it("is not fooled by a short stretch of route left while far from the destination", () => {
    expect(isWithinArrivalRange(north(900), customer, 20)).toBe(false);
  });

  it("needs both a position and a destination", () => {
    expect(isWithinArrivalRange(null, customer, 10)).toBe(false);
    expect(isWithinArrivalRange(north(10), undefined, 10)).toBe(false);
    expect(isWithinArrivalRange({ lat: 0, lng: 0 }, customer, 10)).toBe(false);
  });
});
