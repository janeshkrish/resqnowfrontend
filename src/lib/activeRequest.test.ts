import { describe, expect, it } from "vitest";

import { activeStage, pickActiveRequest } from "./activeRequest";

describe("active request on home", () => {
  it("maps backend statuses to the four visible stages", () => {
    expect(activeStage({ status: "pending" })).toBe("pending");
    expect(activeStage({ status: "technician_assigned" })).toBe("assigned");
    expect(activeStage({ serviceStatus: "en-route", status: "assigned" })).toBe("on_the_way");
    expect(activeStage({ status: "arrived" })).toBe("arrived");
    expect(activeStage({ status: "in_progress" })).toBe("in_progress");
    expect(activeStage({ status: "completed" })).toBeNull();
    expect(activeStage({ status: "cancelled" })).toBeNull();
  });

  it("shows the most recently updated request that is still in progress", () => {
    const picked = pickActiveRequest([
      { id: 1, status: "completed", updated_at: "2026-09-26T10:00:00Z" },
      { id: 2, status: "on_the_way", updated_at: "2026-09-26T09:00:00Z" },
      { id: 3, status: "pending", updated_at: "2026-09-26T09:30:00Z" },
    ]);
    expect(picked?.id).toBe(3);
    expect(picked?.stage).toBe("pending");
    expect(pickActiveRequest([{ id: 9, status: "cancelled" }])).toBeNull();
  });
});
