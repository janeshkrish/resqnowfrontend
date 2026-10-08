import { beforeEach, describe, expect, it } from "vitest";

import {
  findingArt,
  findingCopy,
  findingLines,
  hasSeenRequestSent,
  markRequestSentSeen,
  nearbyAvailable,
  sentNextLine,
} from "./findingTechnician";

describe("findingCopy", () => {
  it("has its own words for every service, as the request form saves them", () => {
    const titles = [
      ["car-towing", "Finding a tow truck nearby", "tow operators", "auto_towing"],
      ["bike-flat-tire", "Finding a technician nearby", "tyre technicians", "two_wheeler"],
      ["car-battery", "Finding a technician nearby", "battery technicians", "two_wheeler"],
      ["car-mechanical", "Finding a mechanic nearby", "mechanics", "two_wheeler"],
      ["car-fuel", "Finding fuel nearby", "fuel partners", "two_wheeler"],
      ["commercial-lockout", "Finding a locksmith nearby", "locksmiths", "two_wheeler"],
      ["car-winching", "Finding a recovery truck", "recovery crews", "auto_towing"],
      ["ev-ev-charging", "Finding a charging van nearby", "charging vans", "ev_station"],
    ];
    for (const [type, title, who, glyph] of titles) {
      expect(findingCopy(type)).toEqual({ title, who, glyph });
    }
  });

  it("reads the plain names too", () => {
    expect(findingCopy("towing").title).toBe("Finding a tow truck nearby");
    expect(findingCopy("Flat_Tyre").who).toBe("tyre technicians");
  });

  it("falls back to a technician for SOS and anything else", () => {
    const any = { title: "Finding a technician nearby", who: "technicians", glyph: "two_wheeler" };
    expect(findingCopy("car-emergency")).toEqual(any);
    expect(findingCopy("car-other")).toEqual(any);
    expect(findingCopy(null)).toEqual(any);
  });
});

describe("the lines around the search", () => {
  it("says who is being contacted, then that one of them has to accept", () => {
    expect(findingLines(findingCopy("car-towing"))).toEqual(["Contacting tow operators near you", "Waiting for one of them to accept"]);
    expect(findingLines(findingCopy("car-emergency"))[0]).toBe("Contacting technicians near you");
  });

  it("turns the heading into the line under Request sent", () => {
    expect(sentNextLine(findingCopy("car-towing"))).toBe("Finding a tow truck near you");
    expect(sentNextLine(findingCopy("car-winching"))).toBe("Finding a recovery truck near you");
    expect(sentNextLine(findingCopy("car-fuel"))).toBe("Finding fuel near you");
  });

  it("gives the pins the service's own picture, or none for a service without one", () => {
    expect(findingArt("car-towing")).toBe("/images/home/services/towing.webp");
    expect(findingArt("car-emergency")).toBeNull();
  });
});

describe("nearbyAvailable", () => {
  const feed = [
    { id: 4, latitude: 11.03, longitude: 76.97, distance: 2.4, is_available: true },
    { id: 9, latitude: 11.018, longitude: 76.957, distance: 0.3, is_available: true },
    { id: 5, latitude: 11.02, longitude: 76.96, distance: 0.6, is_available: false },
    { id: 6, latitude: null, longitude: null, distance: 0, is_available: true },
    { id: 7, latitude: 0, longitude: 0, distance: 0, is_available: true },
    { id: 8, latitude: "11.021", longitude: "76.951", distance: 1.1, is_available: true },
  ];

  it("keeps only technicians who are available and have a position, nearest first", () => {
    expect(nearbyAvailable(feed)).toEqual([
      { id: "9", lat: 11.018, lng: 76.957 },
      { id: "8", lat: 11.021, lng: 76.951 },
      { id: "4", lat: 11.03, lng: 76.97 },
    ]);
  });

  it("shows no more than it is asked to", () => {
    expect(nearbyAvailable(feed, 2).map((tech) => tech.id)).toEqual(["9", "8"]);
    const many = Array.from({ length: 20 }, (_, index) => ({ id: index, latitude: 11 + index / 1000, longitude: 76.9, distance: index, is_available: true }));
    expect(nearbyAvailable(many)).toHaveLength(8);
  });

  it("is empty for anything that is not a list", () => {
    expect(nearbyAvailable(null)).toEqual([]);
    expect(nearbyAvailable({ error: "down" })).toEqual([]);
  });
});

describe("the request-sent moment plays once", () => {
  beforeEach(() => sessionStorage.clear());

  it("remembers each request it has been shown for", () => {
    expect(hasSeenRequestSent("5502")).toBe(false);
    markRequestSentSeen("5502");
    expect(hasSeenRequestSent("5502")).toBe(true);
    expect(hasSeenRequestSent("5503")).toBe(false);
  });
});
