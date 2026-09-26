import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  LIVE_ETA_MAX_AGE_MS,
  etaBasisLabel,
  formatEtaDuration,
  isTerminalRequestStatus,
  mergeLiveEta,
  parseLiveEta,
  usableLiveEta,
} from "./liveEta";

const NOW = Date.parse("2026-09-26T10:00:00.000Z");

const normalized = (overrides: Record<string, unknown> = {}) => ({
  requestId: "42",
  eta: {
    requestId: "42",
    technicianLat: 11.01,
    technicianLng: 76.95,
    destinationLat: 11.02,
    destinationLng: 76.97,
    etaSeconds: 540,
    distanceMeters: 3_200,
    trafficAware: true,
    provider: "mappls",
    calculatedAt: "2026-09-26T09:59:50.000Z",
    ...overrides,
  },
});

describe("parseLiveEta", () => {
  it("reads the normalized backend ETA", () => {
    expect(parseLiveEta(normalized(), "42", NOW)).toEqual({
      requestId: "42",
      etaSeconds: 540,
      distanceMeters: 3_200,
      trafficAware: true,
      provider: "mappls",
      calculatedAt: Date.parse("2026-09-26T09:59:50.000Z"),
      receivedAt: NOW,
      destinationLat: 11.02,
      destinationLng: 76.97,
    });
  });

  it("marks an OSRM fallback as not traffic-aware", () => {
    const eta = parseLiveEta(normalized({ trafficAware: false, provider: "osrm" }), "42", NOW);
    expect(eta).toMatchObject({ trafficAware: false, provider: "osrm" });
    expect(etaBasisLabel(eta!)).toBe("Estimated");
    expect(etaBasisLabel({ trafficAware: true })).toBe("Traffic-aware");
  });

  it("reads the legacy route-metric fields and never treats them as traffic-aware by source name", () => {
    expect(
      parseLiveEta({ distanceKm: 4.2, durationMinutes: 9.4, etaSource: "mappls", receivedAt: "2026-09-26T09:59:58.000Z" }, "42", NOW),
    ).toMatchObject({
      etaSeconds: 564,
      distanceMeters: 4_200,
      trafficAware: false,
      provider: "mappls",
      calculatedAt: Date.parse("2026-09-26T09:59:58.000Z"),
    });
  });

  it("returns null for GPS-only events, invalid values and other requests", () => {
    expect(parseLiveEta({ lat: 11, lng: 76 }, "42", NOW)).toBeNull();
    expect(parseLiveEta({ distanceKm: 4.2 }, "42", NOW)).toBeNull();
    expect(parseLiveEta({ distanceKm: -1, durationMinutes: 5 }, "42", NOW)).toBeNull();
    expect(parseLiveEta(normalized({ etaSeconds: "soon" }), "42", NOW)).toBeNull();
    expect(parseLiveEta(normalized({ requestId: "43" }), "42", NOW)).toBeNull();
    expect(parseLiveEta(null, "42", NOW)).toBeNull();
  });
});

describe("mergeLiveEta", () => {
  const at = (iso: string, etaSeconds: number, receivedAt = NOW) =>
    parseLiveEta(normalized({ calculatedAt: iso, etaSeconds }), "42", receivedAt)!;

  it("keeps the current ETA when an event has none", () => {
    const current = at("2026-09-26T09:59:00.000Z", 600);
    expect(mergeLiveEta(current, null)).toBe(current);
  });

  it("replaces an older calculation with a newer one and never the reverse", () => {
    const older = at("2026-09-26T09:59:00.000Z", 600);
    const newer = at("2026-09-26T09:59:45.000Z", 560);
    expect(mergeLiveEta(older, newer)).toBe(newer);
    expect(mergeLiveEta(newer, older)).toBe(newer);
  });

  it("keeps the first arrival of a re-sent calculation so it cannot look fresher", () => {
    const first = at("2026-09-26T09:59:00.000Z", 600, NOW);
    const repeat = at("2026-09-26T09:59:00.000Z", 600, NOW + 60_000);
    expect(mergeLiveEta(first, repeat)).toBe(first);
  });
});

describe("usableLiveEta", () => {
  const eta = parseLiveEta(normalized(), "42", NOW)!;

  it("is shown for its own request and destination while fresh", () => {
    expect(usableLiveEta(eta, { requestId: "42", destination: { lat: 11.0201, lng: 76.9701 }, now: NOW })).toBe(eta);
    expect(usableLiveEta(eta, { requestId: "42", now: NOW + LIVE_ETA_MAX_AGE_MS })).toBe(eta);
  });

  it("is dropped once stale, for another request, or for another destination", () => {
    expect(usableLiveEta(eta, { requestId: "42", now: NOW + LIVE_ETA_MAX_AGE_MS + 1 })).toBeNull();
    expect(usableLiveEta(eta, { requestId: "7", now: NOW })).toBeNull();
    expect(usableLiveEta(eta, { requestId: "42", destination: { lat: 11.05, lng: 76.97 }, now: NOW })).toBeNull();
  });
});

describe("ETA helpers", () => {
  it("formats durations the way the tracking screen shows them", () => {
    expect(formatEtaDuration(20)).toBe("1 min");
    expect(formatEtaDuration(17 * 60)).toBe("17 min");
    expect(formatEtaDuration(60 * 60)).toBe("1 hr");
    expect(formatEtaDuration(95 * 60)).toBe("1 hr 35 min");
  });

  it("recognises statuses that end live tracking", () => {
    for (const status of ["completed", "Cancelled", "paid", "closed"]) {
      expect(isTerminalRequestStatus(status)).toBe(true);
    }
    for (const status of ["en-route", "arrived", "in_progress", "vehicle_loaded", undefined]) {
      expect(isTerminalRequestStatus(status)).toBe(false);
    }
  });
});

describe("traffic provider boundary", () => {
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.(ts|tsx|js|jsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
    });

  it("never calls a routing or traffic ETA provider from the frontend", () => {
    const offenders = sourceFiles(join(process.cwd(), "src")).filter((file) =>
      /route\.mappls\.com|route_eta|route_traffic|distance_matrix_eta|MAPPLS_REST_API_KEY|TRAFFIC_ETA_/.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
