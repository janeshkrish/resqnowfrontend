import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, shot } from "./fixtures/adminPortal";

// Payments: today's money, every payment with its checks, the ones that need a look, and a refund.

test("today's money, the payments with their checks, and the ones that need a look", async ({ page }, info) => {
  const { errors } = await openPortal(page, "/admin/payments");
  const pay = page.getByTestId("payments-page");
  await expect(pay.getByTestId("kpi-collected")).toContainText("₹38,420");
  await expect(pay.getByTestId("kpi-look")).toContainText("2");
  await expect(pay).toContainText("2 payments need a look:");
  await expect(pay).toContainText("#5479 paid but not marked paid");
  await expect(pay).toContainText("#5495 pending for more than 30 min");
  const table = pay.getByTestId("payments-table");
  await expect(table.getByRole("row", { name: "Payment for request 5496" })).toContainText("Paid · share in wallet");
  await expect(table.getByRole("row", { name: "Payment for request 5495" })).toContainText("Waiting for cash");
  await expect(table.getByRole("row", { name: "Payment for request 5442" })).toContainText("Settled to technician");
  await expect(table.getByRole("row", { name: "Payment for request 5479" }).locator(".mn-chk .is-bad")).toHaveCount(1);
  await shot(page, "payments", info.project.name);
  expect(await noSideScroll(page)).toBe(true);

  await pay.getByRole("button", { name: "Review" }).click();
  await expect(table.getByRole("row")).toHaveCount(3);
  await table.getByRole("row", { name: "Payment for request 5479" }).click();
  await expect(page).toHaveURL(/\/admin\/payments\?request=5479$/);
  await expect(page.getByTestId("payment-panel").getByTestId("payment-checks")).toContainText("2 checks failed");
  expect(errors).toEqual([]);
});

test("a refund from the request: full or part, with a reason, confirmed before it goes", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/requests/5442");
  await page.getByTestId("request-panel").getByRole("button", { name: "Refund" }).click();
  await expect(page).toHaveURL(/\/admin\/payments\?refund=5442$/);
  const refund = page.getByTestId("payment-panel").getByTestId("refund");
  await expect(refund).toContainText("₹450 can still be refunded");
  await refund.getByRole("radio", { name: "Part" }).click();
  await refund.getByLabel("Amount (₹)").fill("225");
  await expect(refund).toContainText("₹192 of the technician's share is taken back from their wallet.");
  await expect(refund.getByRole("button", { name: "Refund ₹225" })).toBeDisabled();
  await refund.getByLabel("Reason").fill("Battery died again after the visit");
  await refund.getByRole("button", { name: "Refund ₹225" }).click();
  await shot(page, "refund", info.project.name);
  await refund.getByRole("button", { name: "Yes, refund ₹225" }).click();
  await expect(refund).toContainText("₹225 refunded · processed");
  await expect(refund).toContainText("₹192 taken back from the technician");
  const call = w.calls.find((entry) => entry.path === "/api/admin/finance/refund/913");
  expect(call?.body).toMatchObject({ refundAmount: 225, reason: "Battery died again after the visit" });
  expect(errors).toEqual([]);
});
