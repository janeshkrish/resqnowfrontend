import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, shot } from "./fixtures/adminPortal";

// All requests: the list with its tabs and filters, and one request opened in the side panel —
// what happened, the fare and its split, people, photos, notes, who dispatch could offer it to, and its payment checks.

test("all requests: tabs with counts, arrival against the promise, fare with the margin, payment and status", async ({ page }, info) => {
  const { errors } = await openPortal(page, "/admin/requests");
  const list = page.getByTestId("requests-page");
  const tabs = list.getByRole("navigation", { name: "Requests" });
  await expect(tabs.getByRole("button", { name: /^All/ })).toContainText("412");
  await expect(tabs.getByRole("button", { name: /^Payment due/ })).toContainText("4");

  const first = list.getByRole("row", { name: "Request 5466" });
  await expect(first).toContainText("Ganesh P");
  await expect(first).toContainText("Mahindra Bolero");
  await expect(first).toContainText("7 min late");
  await expect(first).toContainText("44 min");
  await expect(first).toContainText("₹1,100");
  await expect(first).toContainText("ResQNow ₹132");
  await expect(first).toContainText("Cash, collected");
  await expect(first).toContainText("Completed");
  await expect(list.getByRole("row", { name: "Request 5491" })).toContainText("High");
  await expect(list.getByRole("row", { name: "Request 5491" })).toContainText("on time");
  await expect(list.getByRole("row", { name: "Request 5442" })).toContainText("Refunded ₹450");
  await expect(list.getByRole("row", { name: "Request 5493" })).toContainText("nothing charged");
  await expect(list).toContainText("1–20 of 412 in last 7 days");
  await shot(page, "requests", info.project.name);
  expect(await noSideScroll(page)).toBe(true);

  await tabs.getByRole("button", { name: /^Cancelled/ }).click();
  await expect(list.getByRole("row", { name: /^Request \d+$/ })).toHaveCount(1);
  await expect(list.getByRole("row", { name: "Request 5493" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("one request: the story, the fare split, people, photos and notes; marking it high priority", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/requests");
  await page.getByRole("row", { name: "Request 5466" }).click();
  await expect(page).toHaveURL(/\/admin\/requests\/5466$/);
  const panel = page.getByTestId("request-panel");
  await expect(panel).toContainText("#5466 · ");
  await expect(panel).toContainText("Completed");
  await expect(panel).toContainText("Ganesh P · Mahindra Bolero · TN 37 AB 1234");
  await expect(panel).toContainText("7 min late · promised");
  await expect(panel).toContainText("44 min");
  await expect(panel).toContainText("4 ★");
  await expect(panel).toContainText("Not moving for 4 min");
  await expect(panel).toContainText("Base charge");
  await expect(panel).toContainText("₹600");
  await expect(panel).toContainText("To the technician");
  await expect(panel).toContainText("₹935");
  await expect(panel).toContainText("Squad Recovery");
  await expect(panel).toContainText("207 jobs");
  await expect(panel).toContainText("before photo");
  await expect(panel).toContainText("Called Ganesh to say the truck is 7 min away.");
  await expect(panel.getByRole("button", { name: "Change fare" })).toBeDisabled();
  await shot(page, "request-panel", info.project.name);

  await panel.getByRole("textbox", { name: "New note" }).fill("Customer asked for the invoice by email.");
  await panel.getByRole("button", { name: "Add note" }).click();
  await expect(panel).toContainText("Customer asked for the invoice by email.");
  expect(w.calls.some((call) => call.path === "/api/admin/monitor/requests/5466/notes")).toBe(true);

  await panel.getByRole("button", { name: "Mark high priority" }).click();
  await expect(panel.locator(".ap-pill", { hasText: "High priority" })).toBeVisible();
  expect(w.calls.find((call) => call.path === "/api/admin/requests/high-priority")?.body).toMatchObject({ requestId: 5466 });

  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/requests$/);
  expect(errors).toEqual([]);
});

test("one request: who dispatch could offer it to, and why not; the payment checks", async ({ page }, info) => {
  const { errors } = await openPortal(page, "/admin/requests/5466");
  const panel = page.getByTestId("request-panel");
  await panel.getByRole("button", { name: /^Who could take it/ }).click();
  const check = panel.getByTestId("dispatch-check");
  await expect(check).toContainText("2 can take it");
  await expect(check).toContainText("1 Off duty");
  await expect(check).toContainText("1 Doesn't do this service");
  await expect(check.getByRole("row").filter({ hasText: "Murugan S" })).toContainText("Declined");
  await expect(check.getByRole("row").filter({ hasText: "Senthil P" })).toContainText("Not sent");
  await expect(check.getByRole("row").filter({ hasText: "Squad Recovery" })).toContainText("Too far · works within 5 km");
  await expect(panel.getByRole("button", { name: /^Who could take it/ })).toContainText("5");
  await shot(page, "request-dispatch", info.project.name);

  await panel.getByRole("button", { name: "Payment", exact: true }).click();
  const pay = panel.getByTestId("payment-checks");
  await expect(pay).toContainText("2 checks failed");
  await expect(pay).toContainText("The request is completed, but its payment status is still pending");
  await expect(pay).toContainText("No invoice was made for this request");
  await expect(pay).toContainText("₹165 · pending");
  await expect(pay).toContainText("paid-sync");
  await shot(page, "request-payment", info.project.name);
  expect(errors).toEqual([]);
});
