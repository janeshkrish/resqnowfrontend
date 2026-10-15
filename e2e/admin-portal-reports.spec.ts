import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, shot } from "./fixtures/adminPortal";

// Reports: the period's numbers against the period before, requests each day, the drop-off from request to paid,
// the busiest hours, the service mix and why requests were cancelled.

test("reports for 30 days, then 7 days", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/reports");
  const reports = page.getByTestId("reports-page");
  await expect(reports.getByTestId("kpi-requests")).toContainText("1,748");
  await expect(reports.getByTestId("kpi-requests")).toContainText("+12% vs before");
  await expect(reports.getByTestId("kpi-collected")).toContainText("₹11.9 lakh");
  await expect(reports).toContainText("90% of requests");
  await expect(reports).toContainText("down from 8.2%");
  await expect(reports.getByTestId("funnel")).toContainText("Paid");
  await expect(reports.getByTestId("funnel")).toContainText("90%");
  await expect(reports.getByTestId("busy-hours")).toContainText("Fri 6p to 8p is the busiest two hours, with 18 requests.");
  await expect(reports.getByTestId("service-mix")).toContainText("Towing");
  await expect(reports.getByTestId("cancel-reasons")).toContainText("Took too long to find one");
  await expect(reports.getByTestId("per-day").getByRole("img")).toHaveCount(1);
  await shot(page, "reports", info.project.name);
  expect(await noSideScroll(page)).toBe(true);

  await reports.getByRole("radio", { name: "7 days" }).click();
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType("resource").some((entry) => entry.name.includes("/portal/reports?days=7")))).toBe(true);
  await expect(reports.getByTestId("per-day")).toContainText("250 a day on average");
  expect(w.calls).toEqual([]);
  expect(errors).toEqual([]);
});
