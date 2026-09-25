import { describe, expect, it } from "vitest";
import { isServiceRequestFlowPath, isVehicleSelectionPath } from "./appShellRoutes";

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
