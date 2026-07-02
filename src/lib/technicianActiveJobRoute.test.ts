import { describe, expect, it } from "vitest";
import {
  getTechnicianActiveJobPath,
  selectMatchingActiveJobNavigationState,
} from "./technicianActiveJobRoute";

describe("technician active-job routing", () => {
  it("keys navigation state to the request id in the route", () => {
    const previousTowingJob = { id: "tow-1", isTowing: true, dropAddress: "Workshop" };

    expect(
      selectMatchingActiveJobNavigationState(previousTowingJob, "flat-tire-2")
    ).toBeNull();
    expect(
      selectMatchingActiveJobNavigationState(previousTowingJob, "tow-1")
    ).toBe(previousTowingJob);
  });

  it("builds an encoded request-specific path", () => {
    expect(getTechnicianActiveJobPath("request 42")).toBe(
      "/technician/active-job/request%2042"
    );
  });
});
