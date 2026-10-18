import { describe, expect, it } from "vitest";
import type { LiveEta } from "@/lib/liveEta";
import { chipMinutes, shouldSendTripUpdate, tripLiveUpdate, wholeAmount, type TripLiveUpdateInput } from "./tripLiveUpdate";

// 4:46 pm local time on the day of the design, so "Arrives by" reads like the canvas.
const NOW = new Date(2026, 9, 15, 16, 46, 0).getTime();

const eta = (seconds: number, distanceMeters = 2400): LiveEta => ({
  requestId: "5318",
  etaSeconds: seconds,
  distanceMeters,
  trafficAware: true,
  provider: "mappls",
  calculatedAt: NOW,
  receivedAt: NOW,
  destinationLat: 11.01,
  destinationLng: 76.95,
});

const input = (overrides: Partial<TripLiveUpdateInput>): TripLiveUpdateInput => ({
  requestId: "5318",
  phase: "way",
  isTowing: false,
  technicianName: "Arun Kumar",
  technicianPhone: "+91 98765 43210",
  serviceType: "lockout",
  liveEta: null,
  distanceLabel: null,
  amountLabel: null,
  ...overrides,
});

describe("the Android Live Update for a request", () => {
  it("searches with a moving bar and no technician yet", () => {
    const update = tripLiveUpdate(input({ phase: "search", technicianName: null }));
    expect(update).toMatchObject({ title: "Finding a technician", chip: "Finding", indeterminate: true, tracker: "", alertTitle: "" });
    expect(update?.deepLinkPath).toBe("/service-tracking/5318");
  });

  it("says who accepted, when they arrive and how far, with a short alert", () => {
    const update = tripLiveUpdate(input({ phase: "accepted", liveEta: eta(480, 3100), distanceLabel: "3.1 km away" }));
    expect(update).toMatchObject({
      title: "Arun arrives in 8 min",
      text: "Arrives by 4:54 pm · 3.1 km away",
      chip: "8 min",
      progress: 25,
      tracker: "bike",
      alertTitle: "Arun accepted your request",
      alertText: "Arrives by 4:54 pm · 3.1 km away",
    });
    expect(update?.arrivalAt).toBe(NOW + 480_000);
  });

  it("without an ETA it says so in words, never a made-up number", () => {
    const update = tripLiveUpdate(input({ phase: "way", distanceLabel: "≈ 2.4 km away" }));
    expect(update).toMatchObject({ title: "Arun is on the way", text: "≈ 2.4 km away", chip: "On way", arrivalAt: 0 });
  });

  it("moves the bike along the bar as the minutes fall, in steps of five", () => {
    const start = tripLiveUpdate(input({ phase: "way", liveEta: eta(600), legStartEtaSeconds: 600 }));
    const half = tripLiveUpdate(input({ phase: "way", liveEta: eta(300), legStartEtaSeconds: 600 }));
    const nearly = tripLiveUpdate(input({ phase: "way", liveEta: eta(10), legStartEtaSeconds: 600 }));
    expect(start?.progress).toBe(25);
    expect(half?.progress).toBe(40);
    expect(nearly?.progress).toBe(50);
    expect(half?.title).toBe("Arun arrives in 5 min");
    expect(half?.chip).toBe("5 min");
  });

  it("turns green when the technician arrives", () => {
    const update = tripLiveUpdate(input({ phase: "arrived" }));
    expect(update).toMatchObject({ title: "Arun is here", chip: "Here", tone: "ok", tracker: "check", alertTitle: "Arun is here" });
    expect(tripLiveUpdate(input({ phase: "arrived", isTowing: true }))?.title).toBe("Arun is at the pickup");
  });

  it("lets Android run the work timer in the chip", () => {
    const startedAt = new Date(NOW - 4 * 60_000).toISOString();
    const update = tripLiveUpdate(input({ phase: "working", startedAt }));
    expect(update).toMatchObject({ title: "Work in progress", text: "Started at 4:42 pm", chip: "", tracker: "build" });
    expect(update?.startedAt).toBe(NOW - 4 * 60_000);
  });

  it("asks for the amount due in crimson", () => {
    const update = tripLiveUpdate(input({ phase: "pay", amountLabel: "₹110.00" }));
    expect(update).toMatchObject({
      title: "Work done · ₹110 to pay",
      text: "Pay online, or give cash to Arun.",
      chip: "₹110",
      tone: "hot",
      amountLabel: "₹110",
      alertTitle: "Work done · ₹110 to pay",
    });
    expect(tripLiveUpdate(input({ phase: "pay" }))?.title).toBe("Work done · payment due");
  });

  it("thanks the customer once it is paid, without another alert", () => {
    const update = tripLiveUpdate(input({ phase: "rate" }));
    expect(update).toMatchObject({ title: "Paid · thank you", text: "How was Arun? One tap is enough.", alertTitle: "" });
  });

  it("follows a tow to the drop point", () => {
    expect(tripLiveUpdate(input({ phase: "loaded", isTowing: true, dropAddress: "Lotus Hyundai" }))?.text).toBe("Going to Lotus Hyundai");
    const towing = tripLiveUpdate(input({ phase: "towing", isTowing: true, liveEta: eta(720), legStartEtaSeconds: 720 }));
    expect(towing).toMatchObject({ title: "At the drop point in 12 min", tracker: "truck", progress: 50 });
  });

  it("sends nothing for a stage it has no words for, or without a request", () => {
    expect(tripLiveUpdate(input({ phase: "other" }))).toBeNull();
    expect(tripLiveUpdate(input({ requestId: " " }))).toBeNull();
  });

  it("leaves a request that was already over alone", () => {
    const rate = tripLiveUpdate(input({ phase: "rate" }))!;
    const cancelled = tripLiveUpdate(input({ phase: "cancelled" }))!;
    const way = tripLiveUpdate(input({ phase: "way" }))!;
    expect(shouldSendTripUpdate(rate, false)).toBe(false);
    expect(shouldSendTripUpdate(cancelled, false)).toBe(false);
    expect(shouldSendTripUpdate(rate, true)).toBe(true);
    expect(shouldSendTripUpdate(way, false)).toBe(true);
  });
});

describe("chip and amount wording", () => {
  it("keeps the chip short", () => {
    expect(chipMinutes(30)).toBe("1 min");
    expect(chipMinutes(361)).toBe("7 min");
    expect(chipMinutes(5400)).toBe("1 hr+");
  });

  it("drops empty paise only", () => {
    expect(wholeAmount("₹110.00")).toBe("₹110");
    expect(wholeAmount("₹110.50")).toBe("₹110.50");
    expect(wholeAmount(null)).toBe("");
  });
});
