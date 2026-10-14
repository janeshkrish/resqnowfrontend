import { describe, expect, it } from "vitest";

import type { MonitorRequest } from "../api/adminMonitorApi";
import { ago, attentionOf, chipOf, inTab, liveLine, runningFor, stepClasses } from "./monitorFormat";

const NOW = Date.parse("2026-10-14T11:00:00.000Z");
const at = (ms: number) => new Date(NOW + ms).toISOString();

function request(over: Partial<MonitorRequest> = {}): MonitorRequest {
  return {
    id: 5502, createdAt: at(-600_000), updatedAt: at(-60_000), status: "on-the-way", phase: "on_the_way", steps: { done: 1, now: 1 },
    serviceType: "truck-lockout", vehicleType: "truck", vehicleModel: "Tata Yodha",
    customer: { id: 41, name: "Asha Raman", phoneMasked: null }, technician: { id: 7, name: "Arun Kumar", rating: 4.8, serviceType: null },
    address: null, location: { lat: 11, lng: 76.9 }, drop: null, fare: 110, paymentMethod: "cash", paymentStatus: null,
    acceptedAt: at(-480_000), promisedAt: at(360_000), promiseSource: "accepted", arrivedAt: null, workStartedAt: null, completedAt: null,
    search: { sent: 2, declined: 1, expired: 0, pending: 0, accepted: 1, startedAt: at(-600_000) },
    alerts: [],
    live: { lat: 11, lng: 76.9, heading: null, speedKmh: null, lastSeenAt: at(-8_000), gpsStale: false, etaSeconds: 360, etaCalculatedAt: at(-20_000), trafficAware: true, distanceKm: 2.4, distanceSource: "route" },
    ...over,
  };
}

describe("admin monitor wording", () => {
  it("a job on time needs nothing; its line gives minutes, arrival and last GPS", () => {
    expect(attentionOf(request(), NOW)).toBeNull();
    expect(chipOf(request(), NOW).label).toBe("On the way");
    const line = liveLine(request(), NOW);
    expect(line.main).toMatch(/^6 min · arrives /);
    expect(line.sub).toBe("seen 8 s ago");
  });

  it("alerts come first, then quiet GPS, then a broken promise", () => {
    const alert = { code: "movement_stationary", text: "Stationary", level: "high", since: at(-300_000), etaMinutes: null };
    expect(attentionOf(request({ alerts: [alert] }), NOW)).toEqual({ code: "movement_stationary", label: "Stopped on the way", tone: "bad" });
    const quiet = request({ live: { ...request().live!, lastSeenAt: at(-180_000), gpsStale: true } });
    expect(attentionOf(quiet, NOW)?.label).toBe("GPS quiet 3 min");
    expect(chipOf(quiet, NOW).icon).toBe("location_off");
    expect(attentionOf(request({ promisedAt: at(-240_000) }), NOW)).toEqual({ code: "late", label: "Late by 4 min", tone: "warn" });
    expect(attentionOf(request({ promisedAt: at(-240_000), arrivedAt: at(-300_000), phase: "arrived" }), NOW)).toBeNull();
  });

  it("without an ETA the straight-line distance is said as such", () => {
    const line = liveLine(request({ live: { ...request().live!, etaSeconds: null, distanceKm: 3.2, distanceSource: "straight" } }), NOW);
    expect(line.main).toBe("3.2 km away");
  });

  it("the search, the work timer and the wait for payment", () => {
    expect(liveLine(request({ phase: "finding", technician: null, live: null }), NOW)).toEqual({ main: "Searching 10:00", sub: "offered to 2 · 1 declined" });
    expect(liveLine(request({ phase: "working", workStartedAt: at(-860_000), live: null }), NOW).main).toBe("14:20 on the job");
    expect(liveLine(request({ phase: "payment_due", completedAt: at(-360_000), live: null }), NOW)).toEqual({ main: "Waiting 6:00", sub: "cash chosen" });
  });

  it("tabs sort the jobs", () => {
    expect(inTab(request({ phase: "offered" }), "finding", NOW)).toBe(true);
    expect(inTab(request(), "moving", NOW)).toBe(true);
    expect(inTab(request({ phase: "arrived" }), "working", NOW)).toBe(true);
    expect(inTab(request({ phase: "payment_due" }), "payment", NOW)).toBe(true);
    expect(inTab(request(), "attention", NOW)).toBe(false);
  });

  it("steps and clocks", () => {
    expect(stepClasses({ steps: { done: 1, now: 1 } }, false)).toEqual(["is-done", "is-now", "", ""]);
    expect(stepClasses({ steps: { done: 1, now: 1 } }, true)).toEqual(["is-done", "is-late", "", ""]);
    expect(ago(NOW - 8_000, NOW)).toBe("8 s ago");
    expect(ago(NOW - 7_200_000, NOW)).toBe("2 h ago");
    expect(runningFor(at(-3_900_000), NOW)).toBe("1 h 5 min");
  });
});
