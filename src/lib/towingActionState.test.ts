import { describe, expect, it } from "vitest";
import { getTowingAction } from "./towingActionState";

describe("getTowingAction", () => {
  it.each([
    ["accepted", "en_route_pickup", "START PICKUP"],
    ["en_route_pickup", "arrived_pickup", "REACHED PICKUP"],
    ["arrived_pickup", "vehicle_loaded", "VEHICLE LOADED"],
    ["vehicle_loaded", "enroute_drop", "START TOW"],
    ["enroute_drop", "arrived_drop", "REACHED DROP LOCATION"],
    ["arrived_drop", "service_completed", "COMPLETE SERVICE"],
    ["service_completed", "payment_pending", "COLLECT PAYMENT"],
  ])("maps %s to %s", (status, nextStatus, label) => {
    expect(getTowingAction(status, "pending")).toMatchObject({
      status: nextStatus,
      label,
    });
  });

  it("only closes a payment-pending towing job after payment", () => {
    expect(getTowingAction("payment_pending", "pending")).toBeNull();
    expect(getTowingAction("payment_pending", "paid")).toMatchObject({
      status: "closed",
      label: "CLOSE JOB",
    });
  });
});
