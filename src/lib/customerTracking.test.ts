import { describe, expect, it } from "vitest";

import {
  arrivesByText,
  canCustomerCancel,
  canResizeTrackingSheet,
  etaBasisText,
  firstName,
  formatTrackingMoney,
  formatWorkClock,
  isCancelClosed,
  staleLocationNotice,
  technicianInitials,
  trackingHeadline,
  trackingPhase,
  trackingSteps,
  trackingStripHeadline,
  vehicleArt,
  type TrackingHeadlineInput,
} from "./customerTracking";
import type { LiveEta } from "./liveEta";

const at = (hours: number, minutes: number) => new Date(2026, 9, 5, hours, minutes, 0).getTime();

const eta = (overrides: Partial<LiveEta> = {}): LiveEta => ({
  requestId: "5502",
  etaSeconds: 5 * 60,
  distanceMeters: 1600,
  trafficAware: true,
  provider: "mappls",
  calculatedAt: at(21, 41),
  receivedAt: at(21, 41),
  destinationLat: 11.01,
  destinationLng: 76.96,
  ...overrides,
});

const input = (overrides: Partial<TrackingHeadlineInput> = {}): TrackingHeadlineInput => ({
  phase: "way",
  isTowing: false,
  technicianName: "Arun Kumar",
  requestId: "5502",
  createdAt: new Date(at(21, 31)).toISOString(),
  startedAt: new Date(at(21, 47)).toISOString(),
  elapsedSeconds: 252,
  liveEta: eta(),
  distanceLabel: "1.6 km away",
  amountLabel: "₹110.00",
  dropAddress: null,
  fallback: { title: "Request status updated", subtitle: "Your request is being processed." },
  ...overrides,
});

describe("cancelling", () => {
  it("is open only until the technician sets off", () => {
    expect(["pending", "assigned", "accepted"].filter(canCustomerCancel)).toEqual(["pending", "assigned", "accepted"]);
    for (const status of [
      "en-route", "en_route_pickup", "arrived", "arrived_pickup", "in-progress", "vehicle_loaded", "enroute_drop",
      "arrived_drop", "service_completed", "payment_pending", "completed", "paid", "closed", "cancelled", "",
    ]) {
      expect(canCustomerCancel(status), status).toBe(false);
    }
  });

  it("explains itself only while the job is under way", () => {
    expect(isCancelClosed("en-route")).toBe(true);
    expect(isCancelClosed("in-progress")).toBe(true);
    expect(isCancelClosed("accepted")).toBe(false);
    expect(isCancelClosed("payment_pending")).toBe(false);
    expect(isCancelClosed("cancelled")).toBe(false);
  });
});

describe("trackingPhase", () => {
  const phase = (status: string, paymentDue = false, paymentCompleted = false) =>
    trackingPhase({ status, paymentDue, paymentCompleted });

  it("follows the request status", () => {
    expect(phase("pending")).toBe("search");
    expect(phase("assigned")).toBe("accepted");
    expect(phase("accepted")).toBe("accepted");
    expect(phase("en-route")).toBe("way");
    expect(phase("en_route_pickup")).toBe("way");
    expect(phase("arrived")).toBe("arrived");
    expect(phase("arrived_pickup")).toBe("arrived");
    expect(phase("in-progress")).toBe("working");
    expect(phase("vehicle_loaded")).toBe("loaded");
    expect(phase("enroute_drop")).toBe("towing");
    expect(phase("arrived_drop")).toBe("dropped");
    expect(phase("service_completed")).toBe("finished");
    expect(phase("closed")).toBe("closed");
    expect(phase("cancelled")).toBe("cancelled");
    expect(phase("something-new")).toBe("other");
  });

  it("asks for payment while it is due and for a rating once it is paid", () => {
    expect(phase("payment_pending", true)).toBe("pay");
    expect(phase("completed", true)).toBe("pay");
    expect(phase("payment_pending", false, true)).toBe("rate");
    expect(phase("completed", false, true)).toBe("rate");
    expect(phase("paid", false, true)).toBe("rate");
    expect(phase("closed", false, true)).toBe("closed");
    expect(phase("cancelled", true, true)).toBe("cancelled");
  });

  it("keeps one size for the screens that need an answer", () => {
    expect(canResizeTrackingSheet("way")).toBe(true);
    expect(canResizeTrackingSheet("pay")).toBe(true);
    expect(canResizeTrackingSheet("rate")).toBe(false);
    expect(canResizeTrackingSheet("closed")).toBe(false);
    expect(canResizeTrackingSheet("cancelled")).toBe(false);
  });
});

describe("trackingSteps", () => {
  const states = (phase: Parameters<typeof trackingSteps>[0], towing = false) =>
    trackingSteps(phase, towing).map((step) => `${step.label}:${step.state}`);

  it("walks a repair from finding to done", () => {
    expect(states("search")).toEqual(["Finding:now", "On the way:todo", "At vehicle:todo", "Done:todo"]);
    expect(states("accepted")).toEqual(["Found:now", "On the way:todo", "At vehicle:todo", "Done:todo"]);
    expect(states("way")).toEqual(["Found:done", "On the way:now", "At vehicle:todo", "Done:todo"]);
    expect(states("working")).toEqual(["Found:done", "On the way:done", "At vehicle:now", "Done:todo"]);
    expect(states("pay")).toEqual(["Found:done", "On the way:done", "At vehicle:done", "Done:now"]);
    expect(states("rate")).toEqual(["Found:done", "On the way:done", "At vehicle:done", "Done:done"]);
  });

  it("walks a tow through pickup and the drop", () => {
    expect(states("way", true)).toEqual(["Found:done", "To pickup:now", "Towing:todo", "Done:todo"]);
    expect(states("arrived", true)).toEqual(["Found:done", "To pickup:now", "Towing:todo", "Done:todo"]);
    expect(states("towing", true)).toEqual(["Found:done", "To pickup:done", "Towing:now", "Done:todo"]);
    expect(states("dropped", true)).toEqual(["Found:done", "To pickup:done", "Towing:now", "Done:todo"]);
  });
});

describe("trackingHeadline", () => {
  it("shows minutes, the arrival time and what they are based on while the technician travels", () => {
    expect(trackingHeadline(input())).toEqual({
      say: "Arun is on the way",
      big: "5 min",
      bigIsText: false,
      side: "Arrives by 9:46 pm",
      sub: "1.6 km away · live traffic",
    });
    expect(trackingHeadline(input({ liveEta: eta({ trafficAware: false }) })).sub).toBe("1.6 km away · road estimate");
  });

  it("makes up no minutes when the backend has sent no ETA", () => {
    expect(trackingHeadline(input({ liveEta: null, distanceLabel: "≈ 1.1 km away" }))).toEqual({
      say: "Arun is on the way",
      big: "On the way",
      bigIsText: true,
      side: null,
      sub: "≈ 1.1 km away",
    });
    expect(trackingHeadline(input({ liveEta: null, distanceLabel: null })).sub).toBe("Live location is on.");
  });

  it("covers the stages before the technician sets off", () => {
    expect(trackingHeadline(input({ phase: "search", technicianName: null, liveEta: null }))).toMatchObject({
      say: "Request sent · 9:31 pm",
      big: "Finding a technician",
      bigIsText: true,
    });
    expect(trackingHeadline(input({ phase: "accepted", liveEta: eta({ etaSeconds: 8 * 60 }), distanceLabel: "2.4 km away" }))).toMatchObject({
      say: "Arun accepted your request",
      big: "8 min away",
      sub: "2.4 km away · getting ready to leave",
    });
    expect(trackingHeadline(input({ phase: "accepted", liveEta: null, distanceLabel: null }))).toMatchObject({
      big: "Technician assigned",
      bigIsText: true,
      sub: "getting ready to leave",
    });
  });

  it("covers arrival, the work and payment", () => {
    expect(trackingHeadline(input({ phase: "arrived" }))).toMatchObject({ say: "Arun has arrived", big: "At your location" });
    expect(trackingHeadline(input({ phase: "working" }))).toMatchObject({ say: "Work in progress", big: "04:12", sub: "Started at 9:47 pm" });
    expect(trackingHeadline(input({ phase: "working", elapsedSeconds: 0, startedAt: null }))).toMatchObject({
      big: "Work has started",
      bigIsText: true,
    });
    expect(trackingHeadline(input({ phase: "pay" }))).toEqual({
      say: "Work finished",
      big: "₹110.00",
      bigIsText: false,
      side: "to pay",
      sub: "Pay online, or give cash to Arun.",
    });
    expect(trackingHeadline(input({ phase: "rate" }))).toMatchObject({ say: "Payment received · ₹110.00", big: "How was Arun?" });
    expect(trackingHeadline(input({ phase: "cancelled" }))).toMatchObject({ say: "Request #5502", big: "Request cancelled" });
    expect(trackingHeadline(input({ phase: "other" }))).toMatchObject({ big: "Request status updated", sub: "Your request is being processed." });
  });

  it("covers a tow", () => {
    const tow = { isTowing: true, technicianName: "Selvam R", dropAddress: "Ganapathy workshop, Sathy Road" };
    expect(trackingHeadline(input({ ...tow, phase: "way" })).say).toBe("Selvam is heading to pickup");
    expect(trackingHeadline(input({ ...tow, phase: "arrived" })).big).toBe("At the pickup point");
    expect(trackingHeadline(input({ ...tow, phase: "loaded" })).sub).toBe("Going to Ganapathy workshop, Sathy Road");
    expect(trackingHeadline(input({ ...tow, phase: "towing", distanceLabel: "1.7 km away" }))).toMatchObject({
      say: "Towing to the drop point",
      big: "5 min",
      side: "Arrives by 9:46 pm",
      sub: "1.7 km away · Ganapathy workshop, Sathy Road",
    });
    expect(trackingHeadline(input({ ...tow, phase: "dropped" })).big).toBe("At the drop location");
  });
});

describe("trackingStripHeadline", () => {
  const strip = (overrides: Partial<TrackingHeadlineInput> = {}, freshness: "LIVE" | "DELAYED" = "LIVE") =>
    trackingStripHeadline({ ...input(overrides), freshness });

  it("keeps the minutes and arrival time in the small strip", () => {
    expect(strip()).toEqual({ big: "5 min", bigIsText: false, side: "Arrives by 9:46 pm", sub: "Arun is on the way · 1.6 km away" });
  });

  it("says when the position is old", () => {
    expect(strip({}, "DELAYED").sub).toBe("Location delayed · last seen position");
  });

  it("shows the amount when payment is due and the timer during the work", () => {
    expect(strip({ phase: "pay" })).toEqual({ big: "₹110.00", bigIsText: false, side: "to pay", sub: "Work finished" });
    expect(strip({ phase: "working" })).toEqual({ big: "04:12", bigIsText: false, side: "Work in progress", sub: "Started at 9:47 pm" });
    expect(strip({ phase: "arrived" })).toMatchObject({ big: "Arun has arrived", bigIsText: true });
    expect(strip({ phase: "search", liveEta: null })).toMatchObject({ big: "Finding a technician", sub: "Checking nearby partners" });
  });
});

describe("small formatters", () => {
  it("formats money, names and the work clock", () => {
    expect(formatTrackingMoney(110)).toBe("₹110.00");
    expect(formatTrackingMoney(110, "INR", { whole: true })).toBe("₹110");
    expect(formatTrackingMoney(1014.5, "INR", { whole: true })).toBe("₹1,014.50");
    expect(formatTrackingMoney(110, "usd")).toBe("USD 110.00");
    expect(firstName("Arun Kumar")).toBe("Arun");
    expect(firstName("")).toBe("Your technician");
    expect(technicianInitials("arun kumar")).toBe("AK");
    expect(technicianInitials("Selvam")).toBe("S");
    expect(technicianInitials(null)).toBe("T");
    expect(formatWorkClock(252)).toBe("04:12");
    expect(formatWorkClock(3725)).toBe("62:05");
  });

  it("never claims live traffic it does not have", () => {
    expect(etaBasisText({ trafficAware: true })).toBe("live traffic");
    expect(etaBasisText({ trafficAware: false })).toBe("road estimate");
    expect(arrivesByText({ receivedAt: at(9, 5), etaSeconds: 600 })).toBe("Arrives by 9:15 am");
  });

  it("explains an old position and picks the vehicle picture", () => {
    expect(staleLocationNotice("LIVE", "Arun Kumar")).toBeNull();
    expect(staleLocationNotice("UPDATING", "Arun Kumar")).toBeNull();
    expect(staleLocationNotice("DELAYED", "Arun Kumar")).toBe("Location is delayed. Showing where Arun was last seen.");
    expect(staleLocationNotice("RECONNECTING", "Arun Kumar")).toMatch(/^Reconnecting/);
    expect(vehicleArt("bike")).toBe("/images/vehicles/bike.webp");
    expect(vehicleArt("commercial")).toBe("/images/vehicles/truck.webp");
    expect(vehicleArt("EV")).toBe("/images/vehicles/ev.webp");
    expect(vehicleArt("car")).toBe("/images/vehicles/car.webp");
    expect(vehicleArt(undefined)).toBe("/images/vehicles/car.webp");
  });
});
