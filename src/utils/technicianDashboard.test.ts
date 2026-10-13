import { describe, expect, it } from "vitest";

import {
  buildEarningsBreakdown,
  buildOrderOverviewCounts,
  buildOrderPerformanceSummary,
  calculateRewardPoints,
  countJobsDoneToday,
} from "./technicianDashboard";

const now = new Date(2026, 9, 13, 15, 0);
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).toISOString();

describe("jobs done today", () => {
  it("counts finished jobs whose finish time is today", () => {
    const orders = [
      { id: 1, status: "completed", completed_at: at(13, 10) },
      { id: 2, status: "paid", completed_at: at(13, 0, 1) },
      { id: 3, status: "completed", completed_at: at(12, 23, 59) },
    ];
    expect(countJobsDoneToday(orders, now)).toBe(2);
  });

  it("uses the last update when a job has no finish time", () => {
    expect(countJobsDoneToday([{ id: 1, status: "completed", updated_at: at(13, 9) }], now)).toBe(1);
  });

  it("leaves out jobs that are not finished, and jobs with no time at all", () => {
    const orders = [
      { id: 1, status: "accepted", updated_at: at(13, 9) },
      { id: 2, status: "cancelled", updated_at: at(13, 9) },
      { id: 3, status: "completed" },
    ];
    expect(countJobsDoneToday(orders, now)).toBe(0);
    expect(countJobsDoneToday([], now)).toBe(0);
  });
});

describe("what the home and jobs pages read from the same requests", () => {
  const orders = [
    { id: 1, status: "pending", created_at: at(13, 14), updated_at: at(13, 14) },
    { id: 2, status: "accepted", created_at: at(13, 13), updated_at: at(13, 13), accepted_time: at(13, 13) },
    { id: 3, status: "completed", created_at: at(13, 9), completed_at: at(13, 10), sla_deadline: at(13, 9, 30) },
    { id: 4, status: "paid", created_at: at(13, 7), completed_at: at(13, 7, 20), sla_deadline: at(13, 7, 30) },
    { id: 5, status: "cancelled", created_at: at(12, 9), updated_at: at(12, 9) },
  ];

  it("counts the open jobs by where they stand", () => {
    expect(buildOrderOverviewCounts(orders)).toEqual({ newOrders: 1, assigned: 0, acknowledged: 1, inProgress: 0, completed: 2 });
  });

  it("counts a job as late when it finished after its deadline, and ignores cancelled ones", () => {
    const summary = buildOrderPerformanceSummary(orders);
    expect(summary.totalOrders).toBe(4);
    expect(summary.lateOrders).toBe(1);
    expect(summary.onTimeOrders).toBe(3);
  });
});

describe("points and the wallet", () => {
  it("gives a point for each thousand rupees earned and five for each job", () => {
    expect(calculateRewardPoints({ totalEarnings: 12840, completedJobs: 38 })).toBe(202);
    expect(calculateRewardPoints({ totalEarnings: 0, completedJobs: 0 })).toBe(0);
  });

  it("reads what is ready, waiting, paid and not given from the wallet", () => {
    const wallet = {
      withdrawable_balance: 3120,
      total_paid_out: 9220,
      pending_withdrawals: 500,
      recent_withdrawals: [{ amount: 800, status: "rejected" }, { amount: 500, status: "pending" }],
    };
    expect(buildEarningsBreakdown(wallet)).toEqual({ pending: 500, paid: 9220, disputed: 800, withdrawable: 3120 });
    expect(buildEarningsBreakdown(null)).toEqual({ pending: 0, paid: 0, disputed: 0, withdrawable: 0 });
  });
});
