import { describe, expect, it } from "vitest";
import { isGaragePath, isServiceRequestFlowPath, isVehicleSelectionPath, shouldHideSupportSurfaces } from "./appShellRoutes";

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
