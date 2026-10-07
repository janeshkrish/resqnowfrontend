import { describe, expect, it } from "vitest";

import { garageCountLine, helpHistory, kindOf, requestNameOf, savedSince } from "./garageShow";
import type { MyRequest } from "./myRequests";

describe("kindOf", () => {
  it("names the kind of vehicle from the app's own list", () => {
    expect(kindOf({ make: "Tata Motors", model: "Nexon", type: "car" }).label).toBe("Small SUV");
    expect(kindOf({ make: "Honda Motorcycles", model: "Activa 125", type: "bike" }).label).toBe("Scooter");
  });

  it("falls back to Car or Bike for a model the list does not have", () => {
    expect(kindOf({ make: "Acme", model: "Roadster 9", type: "car" })).toEqual({ label: "Car", noLongerSold: false });
    expect(kindOf({ make: "Acme", model: "Zip", type: "bike" })).toEqual({ label: "Bike", noLongerSold: false });
  });
});

describe("savedSince", () => {
  // Noon-ish times, so the day is the same in every time zone the tests run in.
  const now = new Date("2026-10-07T07:30:00Z");

  it("is the month the vehicle was saved, with a three-letter month", () => {
    expect(savedSince("2026-09-01T07:30:00Z", now)).toBe("Sep 2026");
    expect(savedSince("2025-03-15T07:30:00Z", now)).toBe("Mar 2025");
  });

  it("is Today on the day itself, and nothing without a date", () => {
    expect(savedSince("2026-10-07T07:30:00Z", now)).toBe("Today");
    expect(savedSince(null, now)).toBeNull();
    expect(savedSince("not a date", now)).toBeNull();
  });
});

describe("requestNameOf", () => {
  it("is the make and model, as requests carry it", () => {
    expect(requestNameOf({ make: "Tata Motors", model: "Nexon" })).toBe("Tata Motors Nexon");
    expect(requestNameOf({ make: "Honda", model: "Honda City" })).toBe("Honda City");
  });
});

describe("helpHistory", () => {
  const now = new Date("2026-10-07T07:30:00Z");
  const nexon = { make: "Tata Motors", model: "Nexon" };
  const requests: MyRequest[] = [
    { id: 1, service_type: "towing", vehicle_model: "Tata Motors Nexon", status: "completed", payment_status: "completed", created_at: "2026-03-12T07:30:00Z" },
    { id: 2, service_type: "battery", vehicle_model: "tata motors  nexon", status: "completed", payment_status: "pending", created_at: "2026-09-19T07:30:00Z" },
    { id: 3, service_type: "fuel", vehicle_model: "Tata Motors Nexon", status: "cancelled", created_at: "2026-10-01T07:30:00Z" },
    { id: 4, service_type: "lockout", vehicle_model: "Tata Motors Nexon", status: "on_the_way", created_at: "2026-10-05T07:30:00Z" },
    { id: 5, service_type: "flat-tire", vehicle_model: "Maruti Suzuki Swift", status: "completed", payment_status: "completed", created_at: "2026-10-02T07:30:00Z" },
  ];

  it("counts this vehicle's finished requests and names the latest", () => {
    expect(helpHistory(nexon, requests, now)).toEqual({ times: 2, last: "Battery · 19 Sep" });
  });

  it("is empty for a vehicle that has had no help", () => {
    expect(helpHistory({ make: "Honda Motorcycles", model: "Activa 125" }, requests, now)).toEqual({ times: 0, last: null });
  });
});

describe("garageCountLine", () => {
  it("splits cars and bikes only when there are both", () => {
    expect(garageCountLine([{ type: "car" }, { type: "car" }, { type: "bike" }])).toBe("3 vehicles · 2 cars, 1 bike");
    expect(garageCountLine([{ type: "car" }, { type: "bike" }, { type: "bike" }])).toBe("3 vehicles · 1 car, 2 bikes");
    expect(garageCountLine([{ type: "car" }, { type: "car" }])).toBe("2 vehicles");
    expect(garageCountLine([{ type: "bike" }])).toBe("1 vehicle");
  });
});
