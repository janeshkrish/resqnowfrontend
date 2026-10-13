import { describe, expect, it } from "vitest";

import {
  askAgainPath,
  callHref,
  canRate,
  isEarlier,
  isInProgress,
  paymentState,
  requestPath,
  serviceState,
  stageOf,
  wasCancelled,
} from "./activity";
import type { MyRequest } from "./myRequests";

const technician = { id: 9, name: "Arun Kumar", phone: "+91 98765 43210" };
const request = (fields: MyRequest): MyRequest => ({ id: 42, service_type: "towing", vehicle_type: "car", ...fields });

describe("serviceState", () => {
  it("reads every spelling the server has used for a stage", () => {
    expect(serviceState(request({ status: "assigned" }))).toBe("technician_assigned");
    expect(serviceState(request({ status: "en-route" }))).toBe("on_the_way");
    expect(serviceState(request({ status: "On_The_Way" }))).toBe("on_the_way");
    expect(serviceState(request({ status: "service_started" }))).toBe("in_progress");
    expect(serviceState(request({ status: "awaiting_payment" }))).toBe("job_completed");
    expect(serviceState(request({ status: "paid" }))).toBe("job_completed");
    expect(serviceState(request({ status: "" }))).toBe("pending");
  });

  it("prefers serviceStatus over status", () => {
    expect(serviceState(request({ status: "pending", serviceStatus: "arrived" }))).toBe("arrived");
  });
});

describe("paymentState", () => {
  it("is paid only once the payment is completed", () => {
    expect(paymentState(request({ payment_status: "completed" }))).toBe("paid");
    expect(paymentState(request({ paymentStatus: "paid" }))).toBe("paid");
    expect(paymentState(request({ payment_status: "pending" }))).toBe("payment_pending");
    expect(paymentState(request({}))).toBe("payment_pending");
  });
});

describe("in progress or earlier", () => {
  it("keeps a finished request in progress until it is paid", () => {
    const due = request({ status: "completed", payment_status: "pending" });
    expect(isInProgress(due)).toBe(true);
    expect(isEarlier(due)).toBe(false);

    const paid = request({ status: "completed", payment_status: "completed" });
    expect(isEarlier(paid)).toBe(true);
    expect(isInProgress(paid)).toBe(false);
  });

  it("puts a cancelled request with the earlier ones", () => {
    const cancelled = request({ status: "cancelled" });
    expect(isEarlier(cancelled)).toBe(true);
    expect(wasCancelled(cancelled)).toBe(true);
    expect(wasCancelled(request({ status: "completed" }))).toBe(false);
  });
});

describe("requestPath", () => {
  it("goes to live tracking, payment or the summary", () => {
    expect(requestPath(request({ status: "on_the_way" }))).toBe("/service-tracking/42");
    expect(requestPath(request({ status: "pending" }))).toBe("/service-tracking/42");
    expect(requestPath(request({ status: "completed", payment_status: "pending" }))).toBe("/payment/42");
    expect(requestPath(request({ status: "completed", payment_status: "completed" }))).toBe("/service-summary/42");
    expect(requestPath(request({ status: "cancelled" }))).toBe("/service-summary/42");
  });

  it("goes nowhere without an id", () => {
    expect(requestPath({ status: "pending" })).toBeNull();
  });
});

describe("stageOf", () => {
  it("says what is happening, which of the four steps it is, and what to do", () => {
    expect(stageOf(request({ status: "pending" }))).toEqual({ say: "Finding a technician", now: 0, firstStep: "Finding", action: "View request" });
    expect(stageOf(request({ status: "accepted", technician }))).toEqual({ say: "Arun accepted", now: 0, firstStep: "Found", action: "Track live" });
    expect(stageOf(request({ status: "on_the_way", technician }))).toEqual({ say: "Arun is on the way", now: 1, firstStep: "Found", action: "Track live" });
    expect(stageOf(request({ status: "arrived", technician }))).toEqual({ say: "Arun has arrived", now: 2, firstStep: "Found", action: "Track live" });
    expect(stageOf(request({ status: "in_progress", technician }))).toEqual({ say: "Work in progress", now: 2, firstStep: "Found", action: "Track live" });
    expect(stageOf(request({ status: "completed", technician }))).toEqual({ say: "Work finished. Payment is due", now: 3, firstStep: "Found", action: "Pay now" });
  });

  it("still reads well when the technician's name has not arrived", () => {
    expect(stageOf(request({ status: "on_the_way" })).say).toBe("Your technician is on the way");
  });
});

describe("canRate", () => {
  const finished = { status: "completed", payment_status: "completed", technician };

  it("asks only about a finished, paid request that has no rating yet", () => {
    expect(canRate(request(finished))).toBe(true);
    expect(canRate(request({ ...finished, has_review: true }))).toBe(false);
    expect(canRate(request({ ...finished, payment_status: "pending" }))).toBe(false);
    expect(canRate(request({ ...finished, technician: null }))).toBe(false);
    expect(canRate(request({ status: "cancelled", technician }))).toBe(false);
  });
});

describe("askAgainPath", () => {
  it("opens the request form for the same service and kind of vehicle", () => {
    expect(askAgainPath(request({ service_type: "fuel", vehicle_type: "bike" }))).toBe("/request-service/fuel/bike");
    expect(askAgainPath(request({ service_type: "flat_tyre", vehicle_type: "Truck" }))).toBe("/request-service/flat-tire/commercial");
    expect(askAgainPath(request({ service_type: "ev-charging", vehicle_type: "ev" }))).toBe("/request-service/ev-charging/ev");
  });

  it("leaves the kind of vehicle to be picked when the request did not say", () => {
    expect(askAgainPath(request({ service_type: "battery", vehicle_type: null }))).toBe("/request-service/battery");
  });

  it("offers nothing for a service that is not one of ours", () => {
    expect(askAgainPath(request({ service_type: "emergency" }))).toBeNull();
    expect(askAgainPath(request({ service_type: "other" }))).toBeNull();
  });
});

describe("callHref", () => {
  it("is the technician's number as a phone link", () => {
    expect(callHref(request({ technician }))).toBe("tel:+919876543210");
  });

  it("is nothing without a usable number", () => {
    expect(callHref(request({ technician: { id: 9, name: "Arun", phone: "" } }))).toBeNull();
    expect(callHref(request({ technician: { id: 9, name: "Arun", phone: "n/a" } }))).toBeNull();
    expect(callHref(request({}))).toBeNull();
  });
});
