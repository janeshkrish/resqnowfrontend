import { describe, expect, it } from "vitest";

import {
  defaultNavigationVehicleMode,
  isPlausibleLocationSample,
  isUsableLocationFix,
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
