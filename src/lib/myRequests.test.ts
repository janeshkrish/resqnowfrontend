import { describe, expect, it } from "vitest";

import { isCancelled, isPaid, isPast, isWorkDone, newestFirst, requestDay, requestId, requestTime, type MyRequest } from "./myRequests";

describe("request states", () => {
  it("counts rejected and both spellings of cancelled as cancelled", () => {
    expect(isCancelled({ status: "cancelled" })).toBe(true);
    expect(isCancelled({ status: "Canceled" })).toBe(true);
    expect(isCancelled({ status: "rejected" })).toBe(true);
    expect(isCancelled({ status: "completed" })).toBe(false);
  });

  it("knows a finished request from a paid one", () => {
    const due: MyRequest = { status: "completed", payment_status: "pending" };
    expect(isWorkDone(due)).toBe(true);
    expect(isPaid(due)).toBe(false);
    expect(isPast(due)).toBe(false);

    const paid: MyRequest = { status: "completed", payment_status: "completed" };
    expect(isPaid(paid)).toBe(true);
    expect(isPast(paid)).toBe(true);
    expect(isPast({ status: "paid" })).toBe(true);
    expect(isPast({ status: "cancelled" })).toBe(true);
    expect(isPast({ status: "on_the_way" })).toBe(false);
  });
});

describe("request times", () => {
  it("reads either spelling of the creation time, and 0 when there is none", () => {
    expect(requestTime({ created_at: "2026-10-01T07:30:00Z" })).toBe(Date.parse("2026-10-01T07:30:00Z"));
    expect(requestTime({ createdAt: "2026-10-01T07:30:00Z" })).toBe(Date.parse("2026-10-01T07:30:00Z"));
    expect(requestTime({})).toBe(0);
    expect(requestTime({ created_at: "soon" })).toBe(0);
  });

  it("sorts newest first without changing the list it was given", () => {
    const list: MyRequest[] = [{ id: 1, created_at: "2026-09-01T07:30:00Z" }, { id: 2, created_at: "2026-10-01T07:30:00Z" }, { id: 3 }];
    expect(newestFirst(list).map(requestId)).toEqual(["2", "1", "3"]);
    expect(list.map(requestId)).toEqual(["1", "2", "3"]);
  });

  it("writes the day with a three-letter month, and the year only when it is not this year", () => {
    // Noon-ish times, so the day is the same in every time zone the tests run in.
    const now = new Date("2026-10-07T07:30:00Z");
    expect(requestDay({ created_at: "2026-10-01T07:30:00Z" }, now)).toBe("1 Oct");
    expect(requestDay({ created_at: "2026-09-19T07:30:00Z" }, now)).toBe("19 Sep");
    expect(requestDay({ created_at: "2025-12-03T07:30:00Z" }, now)).toBe("3 Dec 2025");
    expect(requestDay({}, now)).toBe("");
  });
});

describe("requestId", () => {
  it("uses id, then _id", () => {
    expect(requestId({ id: 42 })).toBe("42");
    expect(requestId({ _id: "abc" })).toBe("abc");
    expect(requestId({})).toBe("");
  });
});
