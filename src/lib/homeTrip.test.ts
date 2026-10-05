import { describe, expect, it } from "vitest";

import { TRIP_UNKNOWN, approachDistance, homeTrackingHeadline, phaseForStage, tripProgress } from "./homeTrip";
import type { LiveEta } from "./liveEta";

const at = (hours: number, minutes: number) => new Date(2026, 9, 5, hours, minutes, 0).getTime();

const eta = (minutes: number, overrides: Partial<LiveEta> = {}): LiveEta => ({
  requestId: "5502",
  etaSeconds: minutes * 60,
  distanceMeters: 1600,
  trafficAware: true,
  provider: "mappls",
  calculatedAt: at(21, 41),
  receivedAt: at(21, 41),
  destinationLat: 11.0168,
  destinationLng: 76.9558,
  ...overrides,
});

describe("where the technician is drawn on the line", () => {
  it("waits at the start until they set off, and is at the vehicle from arrival on", () => {
    expect(tripProgress("search", null)).toBe(0);
    expect(tripProgress("accepted", eta(8))).toBe(0);
    expect(tripProgress("arrived", null)).toBe(1);
    expect(tripProgress("working", null)).toBe(1);
  });

  it("follows the minutes left while they travel", () => {
    expect(tripProgress("way", eta(25))).toBeCloseTo(0.06, 5);
    expect(tripProgress("way", eta(20))).toBeCloseTo(0.06, 5);
    expect(tripProgress("way", eta(10))).toBeCloseTo(0.49, 5);
    expect(tripProgress("way", eta(5))).toBeCloseTo(0.705, 5);
    expect(tripProgress("way", eta(0))).toBeCloseTo(0.92, 5);
    // Closer in time is always further along the line, and never on top of the vehicle.
    for (let minutes = 20; minutes > 0; minutes -= 1) {
      expect(tripProgress("way", eta(minutes - 1))).toBeGreaterThan(tripProgress("way", eta(minutes)));
    }
    expect(tripProgress("way", eta(0))).toBeLessThan(1);
  });

  it("claims no position when the backend has sent no minutes", () => {
    expect(tripProgress("way", null)).toBe(TRIP_UNKNOWN);
  });

  it("reads the home card's stages", () => {
    expect(phaseForStage("pending")).toBe("search");
    expect(phaseForStage("assigned")).toBe("accepted");
    expect(phaseForStage("on_the_way")).toBe("way");
    expect(phaseForStage("arrived")).toBe("arrived");
    expect(phaseForStage("in_progress")).toBe("working");
  });
});

describe("how far away the technician is said to be", () => {
  const customer = { lat: 11.0168, lng: 76.9558 };
  const technician = { lat: 11.0268, lng: 76.9458 };

  it("uses the backend's road distance when there is one", () => {
    expect(approachDistance({ distanceMeters: 1640 }, technician, customer)).toBe("1.6 km");
  });

  it("marks a straight-line distance as approximate", () => {
    expect(approachDistance(null, technician, customer)).toBe("≈ 1.6 km");
  });

  it("says nothing when it does not know", () => {
    expect(approachDistance(null, null, customer)).toBeNull();
    expect(approachDistance(null, technician, null)).toBeNull();
  });
});

describe("what the card says", () => {
  const base = {
    technicianName: "Arun Kumar",
    createdAt: new Date(at(21, 31)).toISOString(),
    startedAt: new Date(at(21, 47)).toISOString(),
    elapsedSeconds: 252,
    liveEta: eta(5),
    distance: "1.6 km",
  };
  const say = (overrides: Partial<Parameters<typeof homeTrackingHeadline>[0]>) =>
    homeTrackingHeadline({ ...base, phase: "way", ...overrides });

  it("shows the minutes and the arrival time while the technician travels", () => {
    expect(say({})).toEqual({ say: "Arun is on the way · 1.6 km", big: "5 min", bigIsText: false, side: "Arrives by 9:46 pm" });
    expect(say({ liveEta: eta(95) }).big).toBe("1 hr 35 min");
  });

  it("makes up no minutes when the backend has sent none", () => {
    expect(say({ liveEta: null, distance: "≈ 1.1 km" })).toEqual({
      say: "Arun is on the way",
      big: "≈ 1.1 km away",
      bigIsText: true,
      side: null,
    });
    expect(say({ liveEta: null, distance: null })).toEqual({
      say: "Arun is coming to you",
      big: "On the way",
      bigIsText: true,
      side: null,
    });
  });

  it("covers finding and assigning a technician", () => {
    expect(say({ phase: "search", technicianName: null, liveEta: null, distance: null })).toEqual({
      say: "Request sent · 9:31 pm",
      big: "Finding a technician",
      bigIsText: true,
      side: null,
    });
    expect(say({ phase: "search", createdAt: null }).say).toBe("Request sent");
    expect(say({ phase: "accepted", liveEta: eta(8), distance: "2.4 km" })).toEqual({
      say: "Arun accepted · 2.4 km away",
      big: "8 min away",
      bigIsText: false,
      side: null,
    });
    expect(say({ phase: "accepted", liveEta: null, distance: null })).toEqual({
      say: "Arun accepted",
      big: "Getting ready to leave",
      bigIsText: true,
      side: null,
    });
  });

  it("covers arrival and the work", () => {
    expect(say({ phase: "arrived" })).toEqual({ say: "Arun has arrived", big: "At your location", bigIsText: true, side: null });
    expect(say({ phase: "working" })).toEqual({ say: "Work in progress", big: "04:12", bigIsText: false, side: "since 9:47 pm" });
    expect(say({ phase: "working", elapsedSeconds: 0, startedAt: null })).toEqual({
      say: "Work in progress",
      big: "Work has started",
      bigIsText: true,
      side: null,
    });
  });

  it("has a plain name for a technician whose name is missing", () => {
    expect(say({ technicianName: "", liveEta: null, distance: null }).say).toBe("Your technician is coming to you");
  });
});
