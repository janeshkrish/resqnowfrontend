import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ apiFetch }));

import {
  EVStationsError,
  EV_SEARCH_RADIUS_METERS,
  fetchEvStations,
  formatChargingPower,
  formatRadius,
  formatStationDistance,
  googleMapsDirectionsUrl,
  hasChargerDetails,
  nextSearchAnchor,
  operatingStatus,
  type EVChargingStation,
} from "./evCharging";

const station = (overrides: Partial<EVChargingStation> = {}): EVChargingStation => ({
  id: "EV1",
  name: "Tata Power EZ Charge",
  address: "Race Course Road, Coimbatore",
  latitude: 11.0228,
  longitude: 76.9648,
  ...overrides,
});

describe("EV charging helpers", () => {
  it("builds Google Maps directions from the station's coordinates", () => {
    expect(googleMapsDirectionsUrl(station())).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=11.0228%2C76.9648",
    );
    expect(googleMapsDirectionsUrl(station({ latitude: null, longitude: null }))).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("Tata Power EZ Charge, Race Course Road, Coimbatore")}`,
    );
  });

  it("sends an approximate OpenStreetMap pin to Google Maps by name and address", () => {
    expect(googleMapsDirectionsUrl(station({ positionSource: "osm" }))).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent("Tata Power EZ Charge, Race Course Road, Coimbatore")}`,
    );
    expect(googleMapsDirectionsUrl(station({ positionSource: "osm", name: "", address: undefined }))).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=11.0228%2C76.9648",
    );
  });

  it("passes on whether more pins are coming and their credit", async () => {
    apiFetch.mockResolvedValueOnce(new Response(JSON.stringify({ stations: [], radiusMeters: 5000, total: 0, located: 0, source: "mappls", positionsPending: true, positionsAttribution: "© OpenStreetMap contributors" }), { status: 200 }));
    expect(await fetchEvStations({ lat: 11, lng: 76 })).toMatchObject({ positionsPending: true, positionsAttribution: "© OpenStreetMap contributors" });
    apiFetch.mockResolvedValueOnce(new Response(JSON.stringify({ stations: [], total: 0, located: 0 }), { status: 200 }));
    expect(await fetchEvStations({ lat: 11, lng: 76 })).toMatchObject({ positionsPending: false, positionsAttribution: undefined });
  });

  it("keeps the search anchor until the customer moves 500 m", () => {
    const first = nextSearchAnchor(null, { lat: 11.01684, lng: 76.95583 });
    expect(first).toEqual({ lat: 11.0168, lng: 76.9558 });
    expect(nextSearchAnchor(first, { lat: 11.0199, lng: 76.9558 })).toBe(first); // ~340 m
    expect(nextSearchAnchor(first, { lat: 11.0218, lng: 76.9558 })).toEqual({ lat: 11.0218, lng: 76.9558 }); // ~560 m
    expect(nextSearchAnchor(first, null)).toBe(first);
  });

  it("formats only the values Mappls returned", () => {
    expect(formatStationDistance(640)).toBe("640 m away");
    expect(formatStationDistance(1830)).toBe("1.8 km away");
    expect(formatStationDistance(undefined)).toBeNull();
    expect(formatChargingPower(60)).toBe("60 kW");
    expect(formatChargingPower("7.4")).toBe("7.4 kW");
    expect(formatChargingPower(undefined)).toBeNull();
    expect(formatRadius(EV_SEARCH_RADIUS_METERS)).toBe("5 km");
    expect(operatingStatus(station({ isOpen: true }))).toBe("open");
    expect(operatingStatus(station({ isOpen: false }))).toBe("closed");
    expect(operatingStatus(station())).toBeNull();
    expect(hasChargerDetails(station())).toBe(false);
    expect(hasChargerDetails(station({ connectorTypes: ["CCS2"] }))).toBe(true);
  });

  it("asks the backend, not Mappls, and surfaces its error code", async () => {
    apiFetch.mockResolvedValueOnce(new Response(JSON.stringify({ stations: [station()], radiusMeters: 5000, total: 1, located: 1, source: "mappls" }), { status: 200 }));
    const result = await fetchEvStations({ lat: 11.0168, lng: 76.9558 });
    expect(apiFetch).toHaveBeenLastCalledWith("/api/public/ev-stations?lat=11.0168&lng=76.9558&radius=5000", { signal: undefined });
    expect(result.stations).toHaveLength(1);

    apiFetch.mockResolvedValueOnce(new Response(JSON.stringify({ code: "ev_search_unavailable" }), { status: 503 }));
    await expect(fetchEvStations({ lat: 11, lng: 76 })).rejects.toMatchObject({ code: "ev_search_unavailable" });
    apiFetch.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    await expect(fetchEvStations({ lat: 11, lng: 76 })).rejects.toBeInstanceOf(EVStationsError);
  });
});

describe("EV provider boundary", () => {
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sourceFiles(path);
      return /\.(ts|tsx|js|jsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
    });

  it("never calls Mappls search APIs or loads the Google Maps SDK in the browser", () => {
    const offenders = sourceFiles(join(process.cwd(), "src")).filter((file) =>
      /search\.mappls\.com|place\.mappls\.com|atlas\.mapmyindia|maps\.googleapis\.com\/maps\/api\/js|MAPPLS_REST_API_KEY/.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(offenders).toEqual([]);
  });
});
