import { describe, expect, it } from "vitest";

import { googleMapsNavigationUrl } from "./externalNavigation";

const customer = { lat: 11.0092, lng: 76.9605 };

describe("the Google Maps hand-over link", () => {
  it("starts navigation to the destination's own coordinates, from wherever the phone is", () => {
    const url = new URL(String(googleMapsNavigationUrl(customer, "car")));

    expect(`${url.origin}${url.pathname}`).toBe("https://www.google.com/maps/dir/");
    expect(url.searchParams.get("api")).toBe("1");
    expect(url.searchParams.get("destination")).toBe("11.0092,76.9605");
    expect(url.searchParams.get("dir_action")).toBe("navigate");
    // No origin: Google Maps uses the phone's position and starts turn-by-turn.
    expect(url.searchParams.has("origin")).toBe(false);
  });

  it("asks for the route the technician's vehicle can take", () => {
    const mode = (vehicle: Parameters<typeof googleMapsNavigationUrl>[1]) =>
      new URL(String(googleMapsNavigationUrl(customer, vehicle))).searchParams.get("travelmode");

    expect(mode("two-wheeler")).toBe("two-wheeler");
    expect(mode("car")).toBe("driving");
    expect(mode("commercial-tow")).toBe("driving");
    expect(mode(undefined)).toBe("driving");
  });

  it("keeps the coordinates to a precision Google Maps reads, without rounding the place away", () => {
    const url = new URL(String(googleMapsNavigationUrl({ lat: 11.009234567891, lng: 76.960512345678 })));
    expect(url.searchParams.get("destination")).toBe("11.009235,76.960512");
  });

  it("gives no link when there is nowhere to go", () => {
    expect(googleMapsNavigationUrl(null)).toBeNull();
    expect(googleMapsNavigationUrl(undefined)).toBeNull();
    expect(googleMapsNavigationUrl({ lat: 0, lng: 0 })).toBeNull();
    expect(googleMapsNavigationUrl({ lat: Number.NaN, lng: 76.96 })).toBeNull();
    expect(googleMapsNavigationUrl({ lat: 95, lng: 76.96 })).toBeNull();
  });
});
