import { describe, expect, it, vi } from "vitest";

import {
  resolveActiveJobNavigationTarget,
  startJourneyAndNavigate,
} from "./activeJobNavigation";

describe("active-job navigation helpers", () => {
  it("uses pickup before towing pickup completion and drop afterward", () => {
    const job = {
      pickupLatitude: 12.97,
      pickupLongitude: 77.59,
      destinationLatitude: 12.99,
      destinationLongitude: 77.61,
    };

    expect(resolveActiveJobNavigationTarget(job, "en_route_pickup")).toEqual({
      lat: 12.97,
      lng: 77.59,
    });
    expect(resolveActiveJobNavigationTarget(job, "vehicle_loaded")).toEqual({
      lat: 12.99,
      lng: 77.61,
    });
  });

  it("starts navigation only after START JOURNEY status succeeds", async () => {
    const setNavigationActive = vi.fn();

    await startJourneyAndNavigate(
      vi.fn().mockResolvedValue(false),
      setNavigationActive,
    );
    expect(setNavigationActive).not.toHaveBeenCalled();

    await startJourneyAndNavigate(
      vi.fn().mockResolvedValue(true),
      setNavigationActive,
    );
    expect(setNavigationActive).toHaveBeenCalledWith(true);
  });

  it("rejects placeholder and out-of-range navigation targets", () => {
    expect(
      resolveActiveJobNavigationTarget(
        { pickupLatitude: 0, pickupLongitude: 0 },
        "accepted",
      ),
    ).toBeNull();
    expect(
      resolveActiveJobNavigationTarget(
        { pickupLatitude: 120, pickupLongitude: 77 },
        "accepted",
      ),
    ).toBeNull();
  });
});
