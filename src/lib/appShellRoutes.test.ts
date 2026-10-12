import { describe, expect, it } from "vitest";
import {
  isGaragePath,
  isServiceRequestFlowPath,
  isServiceRequestFormPath,
  isTabPagePath,
  isVehicleSelectionPath,
  shouldHideSupportSurfaces,
} from "./appShellRoutes";

describe("isGaragePath", () => {
  it("matches the garage and its add steps only", () => {
    expect(isGaragePath("/my-garage")).toBe(true);
    expect(isGaragePath("/my-garage/")).toBe(true);
    expect(isGaragePath("/my-garage/add")).toBe(true);

    expect(isGaragePath("/my-garages")).toBe(false);
    expect(isGaragePath("/settings")).toBe(false);
  });

  it("hides the chat bubble in the garage, where it would cover the toast", () => {
    expect(shouldHideSupportSurfaces("/my-garage")).toBe(true);
    expect(shouldHideSupportSurfaces("/services")).toBe(false);
  });
});

describe("isTabPagePath", () => {
  it("matches Get help, Activity and Account, which bring their own heading", () => {
    expect(isTabPagePath("/services")).toBe(true);
    expect(isTabPagePath("/my-requests")).toBe(true);
    expect(isTabPagePath("/settings")).toBe(true);
    expect(isTabPagePath("/settings/")).toBe(true);
    expect(isTabPagePath("/profile")).toBe(true);

    expect(isTabPagePath("/")).toBe(false);
    expect(isTabPagePath("/services/towing")).toBe(false);
    expect(isTabPagePath("/subscription")).toBe(false);
    expect(isTabPagePath("/technician/settings")).toBe(false);
  });

  it("keeps the chat bubble there, since Account's Help opens it", () => {
    expect(shouldHideSupportSurfaces("/settings")).toBe(false);
    expect(shouldHideSupportSurfaces("/my-requests")).toBe(false);
  });
});

describe("isVehicleSelectionPath", () => {
  it("matches only the first step of a service request", () => {
    expect(isVehicleSelectionPath("/request-service/towing")).toBe(true);
    expect(isVehicleSelectionPath("/request-service/towing/")).toBe(true);

    expect(isVehicleSelectionPath("/request-service/towing/car")).toBe(false);
    expect(isVehicleSelectionPath("/request-service/")).toBe(false);
    expect(isVehicleSelectionPath("/request-service-tracking/abc")).toBe(false);
    expect(isVehicleSelectionPath("/")).toBe(false);
  });

  it("stays inside the service request flow", () => {
    expect(isServiceRequestFlowPath("/request-service/towing")).toBe(true);
  });
});

describe("isServiceRequestFormPath", () => {
  it("matches the form for each vehicle type, not the type picker or tracking", () => {
    expect(isServiceRequestFormPath("/request-service/towing/car")).toBe(true);
    expect(isServiceRequestFormPath("/request-service/emergency/bike/")).toBe(true);
    expect(isServiceRequestFormPath("/request-service/ev-charging/ev")).toBe(true);
    expect(isServiceRequestFormPath("/request-service/fuel/commercial")).toBe(true);

    expect(isServiceRequestFormPath("/request-service/towing")).toBe(false);
    expect(isServiceRequestFormPath("/request-service/towing/truck")).toBe(false);
    expect(isServiceRequestFormPath("/request-service-tracking/42")).toBe(false);
  });
});
