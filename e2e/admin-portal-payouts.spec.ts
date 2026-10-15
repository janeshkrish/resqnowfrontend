import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, shot } from "./fixtures/adminPortal";

// Payouts: who is waiting, paying by UPI and recording the UTR, turning one down, wallets, one payment at a time, and cash dues.

test("pay the waiting requests: open the UPI app, record the UTR, or turn one down", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/payouts");
  const pay = page.getByTestId("payouts-page");
  await expect(pay.getByTestId("kpi-waiting")).toContainText("₹10,070");
  await expect(pay.getByTestId("kpi-waiting")).toContainText("2 requests");
  const requests = pay.getByTestId("payout-requests");
  const selvam = requests.getByRole("row", { name: "Payout for Squad Recovery" });
  await expect(selvam).toContainText("selvam.squad@okaxis");
  await expect(selvam.getByRole("link", { name: "Pay by UPI" })).toHaveAttribute("href", /^upi:\/\/pay\?pa=selvam\.squad@okaxis/);
  await expect(requests.getByRole("row", { name: "Payout for Arjun D" }).getByRole("link", { name: "Pay by UPI" })).toHaveAttribute("href", /^upi:\/\/pay\?pa=arjun\.d%40ybl&pn=ResQNow%20partner&am=3650\.00&cu=INR/);
  await expect(pay.getByTestId("dues-card")).toContainText("Dinesh M");
  await expect(pay.getByTestId("dues-card")).toContainText("₹1,240");
  await shot(page, "payouts", info.project.name);
  expect(await noSideScroll(page)).toBe(true);

  await selvam.getByRole("button", { name: "Mark paid" }).click();
  const dialog = page.getByTestId("pay-dialog");
  await expect(dialog).toContainText("Mark ₹6,420 paid to Squad Recovery");
  await expect(dialog.getByRole("button", { name: "Mark ₹6,420 paid" })).toBeDisabled();
  await dialog.getByLabel("Paste the UTR from the bank").fill("4291 1530 6712");
  await dialog.getByRole("button", { name: "Mark ₹6,420 paid" }).click();
  await expect(dialog).toHaveCount(0);
  expect(w.calls.find((call) => call.path === "/api/admin/finance/withdrawal-requests/31/mark-paid")?.body).toMatchObject({ externalReference: "429115306712" });
  await expect(requests.getByRole("row", { name: "Payout for Squad Recovery" })).toHaveCount(0);
  await expect(pay.getByTestId("paid")).toContainText("429115306712");

  await requests.getByRole("button", { name: "Turn down Arjun D" }).click();
  const decline = page.getByTestId("decline-dialog");
  await decline.getByLabel("Reason").fill("The UPI ID name does not match");
  await decline.getByRole("button", { name: "Turn down" }).click();
  expect(w.calls.find((call) => call.path === "/api/admin/finance/withdrawal-requests/30/reject")?.body).toMatchObject({ reason: "The UPI ID name does not match" });
  await expect(page.getByText("Nobody is waiting for a payout")).toBeVisible();
  expect(errors).toEqual([]);
});

test("wallets, one payment at a time, and reminding about cash dues", async ({ page }) => {
  const { w, errors } = await openPortal(page, "/admin/payouts");
  const tabs = page.getByRole("navigation", { name: "Payouts" });
  await tabs.getByRole("button", { name: /^Wallets/ }).click();
  await page.getByTestId("wallets").getByRole("button", { name: "Pay whole wallet" }).click();
  const dialog = page.getByTestId("pay-dialog");
  await expect(dialog).toContainText("Mark ₹1,920 paid to Vijay P");
  await dialog.getByLabel("Paste the UTR from the bank").fill("429115306799");
  await dialog.getByRole("button", { name: "Mark ₹1,920 paid" }).click();
  await expect(dialog).toHaveCount(0);
  expect(w.calls.find((call) => call.path === "/api/admin/finance/payouts" && call.method === "POST")?.body).toMatchObject({ technicianId: 15, amount: 1920, externalReference: "429115306799" });

  await tabs.getByRole("button", { name: /^By payment/ }).click();
  await page.getByTestId("by-payment").getByRole("button", { name: "Settle this payment" }).click();
  await expect(page.getByTestId("pay-dialog")).toContainText("their share of #5496");
  await page.getByTestId("pay-dialog").getByLabel("Paste the UTR from the bank").fill("429115306800");
  await page.getByTestId("pay-dialog").getByRole("button", { name: "Mark ₹383 paid" }).click();
  expect(w.calls.find((call) => call.path === "/api/admin/pay-technician/910")?.body).toMatchObject({ externalReference: "429115306800" });
  await expect(page.getByText("Every payment is settled")).toBeVisible();

  await tabs.getByRole("button", { name: /^Cash dues/ }).click();
  await expect(page.getByTestId("cash-dues").getByRole("row").filter({ hasText: "Dinesh M" }).locator(".ap-warn")).toHaveText("₹1,240");
  await page.getByTestId("cash-dues").getByRole("button", { name: "Remind all" }).click();
  await expect.poll(() => w.calls.find((call) => call.path === "/api/admin-extended/notifications/technician-broadcast")?.body).toMatchObject({ technicianIds: [22, 23] });
  expect(errors).toEqual([]);
});
