import { describe, expect, it } from "vitest";

import { getNavigationProgress } from "./routeNavigation";

describe("route navigation", () => {
  const route: Array<[number, number]> = [
    [12.9716, 77.5946],
    [12.9726, 77.5946],
    [12.9726, 77.5966],
  ];

  it("snaps progress to the nearest route segment and returns the remaining line", () => {
    const result = getNavigationProgress({
      current: { lat: 12.9721, lng: 77.59462 },
      route,
    });

    expect(result?.remainingPolyline[0][0]).toBeCloseTo(12.9721, 3);
    expect(result?.remainingDistanceMeters).toBeGreaterThan(150);
  });

  it("describes the next meaningful right turn", () => {
    const result = getNavigationProgress({
      current: { lat: 12.9717, lng: 77.5946 },
      route,
    });

    expect(result?.maneuver.kind).toBe("turn-right");
    expect(result?.instruction).toMatch(/right/i);
    expect(result?.distanceToManeuverMeters).toBeGreaterThan(50);
  });

  it("does not fabricate direct destination guidance when no road route is available", () => {
    const result = getNavigationProgress({
      current: { lat: 12.97, lng: 77.59 },
      destination: { lat: 12.98, lng: 77.6 },
      route: [],
    });

    expect(result).toBeNull();
  });

  it("uses provider route distance and duration for remaining metrics", () => {
    const result = getNavigationProgress({
      current: { lat: 12.9716, lng: 77.5946 },
      route,
      routeDistanceKm: 3,
      routeDurationMinutes: 12,
    });

    expect(result?.remainingDistanceMeters).toBeCloseTo(3_000, -1);
    expect(result?.remainingEtaMinutes).toBe(12);
  });
});
