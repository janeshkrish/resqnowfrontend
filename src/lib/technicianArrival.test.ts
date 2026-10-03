import { describe, expect, it } from "vitest";

import type { LiveEta } from "@/lib/liveEta";
import { formatArrivalMinutes, formatClockTime, resolveArrival, toTrafficArrival } from "./technicianArrival";

const NOW = new Date(2026, 9, 3, 16, 30, 0).getTime(); // 4:30 pm on this machine's clock
const customer = { lat: 11.0092, lng: 76.9605 };

const eta = (overrides: Partial<LiveEta> = {}): LiveEta => ({
  requestId: "7201",
  etaSeconds: 21 * 60,
  distanceMeters: 3900,
  trafficAware: true,
  provider: "mappls",
  calculatedAt: Date.parse("2026-10-03T11:00:00.000Z"),
  receivedAt: NOW,
  destinationLat: customer.lat,
  destinationLng: customer.lng,
  ...overrides,
});

describe("when the technician will arrive", () => {
  it("uses the backend's traffic-aware ETA and says so", () => {
    const traffic = toTrafficArrival(eta(), "2026-10-03T11:00:00.000Z");
    const arrival = resolveArrival({ traffic, requestId: "7201", destination: customer, routeMinutes: 9, now: NOW });

    // 21 minutes with traffic, not the 9 the empty road suggests.
    expect(arrival).toMatchObject({ minutes: 21, clockText: "4:51 pm", trafficAware: true });
  });

  it("counts down between updates and keeps the same arrival time", () => {
    const traffic = toTrafficArrival(eta(), "2026-10-03T11:00:00.000Z");
    const later = resolveArrival({ traffic, requestId: "7201", destination: customer, routeMinutes: 9, now: NOW + 2 * 60_000 });

    expect(later).toMatchObject({ minutes: 19, clockText: "4:51 pm", trafficAware: true });
  });

  it("allows for how old the ETA already was when it arrived, whatever the phone's clock says", () => {
    // Worked out 40 seconds before the server answered: 40 seconds of the 21 minutes are gone.
    const traffic = toTrafficArrival(eta({ calculatedAt: Date.parse("2026-10-03T11:00:00.000Z") }), "2026-10-03T11:00:40.000Z");
    expect(traffic.arrivalAt).toBe(NOW + 21 * 60_000 - 40_000);
    // A server answer without a usable clock is taken as fresh.
    expect(toTrafficArrival(eta(), undefined).arrivalAt).toBe(NOW + 21 * 60_000);
  });

  it("does not claim traffic for a road-only ETA from the backend", () => {
    const traffic = toTrafficArrival(eta({ trafficAware: false, provider: "osrm" }), "2026-10-03T11:00:00.000Z");
    const arrival = resolveArrival({ traffic, requestId: "7201", destination: customer, routeMinutes: 9, now: NOW });

    expect(arrival).toMatchObject({ minutes: 21, trafficAware: false });
  });

  it("falls back to the app's own road route when there is no backend ETA", () => {
    const arrival = resolveArrival({ traffic: null, requestId: "7201", destination: customer, routeMinutes: 9, now: NOW });
    expect(arrival).toMatchObject({ minutes: 9, clockText: "4:39 pm", trafficAware: false });
  });

  it("drops a backend ETA that is old, for another job, or for another destination", () => {
    const traffic = toTrafficArrival(eta(), "2026-10-03T11:00:00.000Z");
    const fallback = { minutes: 9, trafficAware: false };

    // No update for over three minutes.
    expect(resolveArrival({ traffic, requestId: "7201", destination: customer, routeMinutes: 9, now: NOW + 4 * 60_000 })).toMatchObject(fallback);
    expect(resolveArrival({ traffic, requestId: "7300", destination: customer, routeMinutes: 9, now: NOW })).toMatchObject(fallback);
    // The pickup's ETA once the tow is heading for the drop point.
    expect(resolveArrival({ traffic, requestId: "7201", destination: { lat: 11.0351, lng: 76.9712 }, routeMinutes: 9, now: NOW })).toMatchObject(fallback);
  });

  it("shows nothing rather than a made-up time when neither is known", () => {
    expect(resolveArrival({ traffic: null, requestId: "7201", routeMinutes: null, now: NOW })).toBeNull();
    expect(resolveArrival({ traffic: null, requestId: "7201", routeMinutes: 0, now: NOW })).toBeNull();
    expect(resolveArrival({ traffic: null, requestId: null, routeMinutes: Number.NaN, now: NOW })).toBeNull();
  });

  it("never shows less than a minute, or an arrival time already past", () => {
    const traffic = toTrafficArrival(eta({ etaSeconds: 20 }), "2026-10-03T11:00:00.000Z");
    const arrival = resolveArrival({ traffic, requestId: "7201", destination: customer, routeMinutes: 9, now: NOW + 60_000 });

    expect(arrival?.minutes).toBe(1);
    expect(arrival?.arrivalAt).toBeGreaterThan(NOW + 60_000);
  });

  it("writes times the way they are said", () => {
    expect(formatClockTime(new Date(2026, 9, 3, 0, 5).getTime())).toBe("12:05 am");
    expect(formatClockTime(new Date(2026, 9, 3, 9, 0).getTime())).toBe("9:00 am");
    expect(formatClockTime(new Date(2026, 9, 3, 12, 30).getTime())).toBe("12:30 pm");
    expect(formatClockTime(new Date(2026, 9, 3, 23, 59).getTime())).toBe("11:59 pm");

    expect(formatArrivalMinutes(9)).toBe("9 min");
    expect(formatArrivalMinutes(0.2)).toBe("1 min");
    expect(formatArrivalMinutes(60)).toBe("1 hr");
    expect(formatArrivalMinutes(65)).toBe("1 hr 5 min");
  });
});
