import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, shot } from "./fixtures/adminPortal";

// Complaints: the open ones oldest first, who has each one, what has happened, the linked request, and resolving.

test("work a complaint: take it, add a note, then resolve it", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/complaints");
  const list = page.getByTestId("complaints-page");
  await expect(list.getByRole("radio", { name: "Open · 2" })).toBeChecked();
  await expect(list.getByRole("button", { name: "Technician was rude on the phone" })).toContainText("Nobody yet");
  const complaint = page.getByTestId("complaint");
  await expect(complaint).toContainText("Technician was rude on the phone");
  await list.getByRole("button", { name: "Technician asked for ₹200 extra in cash" }).click();
  await expect(page).toHaveURL(/\/admin\/complaints\/1042$/);
  await expect(complaint).toContainText("With kavya");
  await expect(complaint).toContainText("Called the customer: paid ₹550 in all.");
  await expect(complaint).toContainText("#5466 · ");
  await expect(complaint).toContainText("Ganesh P");
  await expect(complaint.getByRole("link", { name: "Refund" })).toHaveAttribute("href", "/admin/payments?refund=5466");
  await shot(page, "complaint", info.project.name);
  expect(await noSideScroll(page)).toBe(true);

  await complaint.getByRole("button", { name: "Take it" }).click();
  await expect(complaint).toContainText("With ops");
  expect(w.calls.find((call) => call.path === "/api/admin-extended/complaints/1042/assign")?.body).toMatchObject({ assignedAdminId: "ops@resqnow.test" });
  await complaint.getByRole("textbox", { name: "Internal note" }).fill("Called the technician: says the tube was torn.");
  await complaint.getByRole("button", { name: "Add internal note" }).click();
  await expect(complaint).toContainText("Called the technician: says the tube was torn.");
  await complaint.getByLabel("How it was put right").fill("₹200 refunded from the technician's share.");
  await complaint.getByRole("button", { name: "Resolve" }).click();
  await expect(complaint.locator(".ap-pill", { hasText: "Resolved" })).toBeVisible();
  expect(w.calls.find((call) => call.path === "/api/admin-extended/complaints/1042/resolve")?.body).toMatchObject({ resolutionNote: "₹200 refunded from the technician's share." });
  expect(errors).toEqual([]);
});

test("log a complaint told by phone, linked to its request", async ({ page }) => {
  const { w, errors } = await openPortal(page, "/admin/complaints");
  await page.getByTestId("complaints-page").getByRole("button", { name: "New" }).click();
  const dialog = page.getByTestId("new-complaint");
  await dialog.getByLabel("What is the problem?").fill("Charged, but the app says not paid");
  await dialog.getByLabel("Request number").fill("5479");
  await dialog.getByLabel("How serious").selectOption("high");
  await dialog.getByLabel("Details").fill("Ajay K called.");
  await dialog.getByRole("button", { name: "Log complaint" }).click();
  await expect(page).toHaveURL(/\/admin\/complaints\/1050$/);
  expect(w.calls.find((call) => call.path === "/api/admin-extended/complaints" && call.method === "POST")?.body).toEqual({ title: "Charged, but the app says not paid", description: "Request #5479. Ajay K called.", severity: "high" });
  await expect(page.getByTestId("complaint")).toContainText("Charged, but the app says not paid");
  expect(errors).toEqual([]);
});
