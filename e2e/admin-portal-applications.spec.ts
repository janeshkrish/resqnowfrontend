import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, shot } from "./fixtures/adminPortal";

// Applications: who is waiting, the checks on each application, their prices next to the city usual, and the decision.

test("check an application, ask for documents, approve it, then reject the next with a reason", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/applications");
  const list = page.getByTestId("applications-page");
  const seg = list.getByRole("radiogroup", { name: "Applications" });
  await expect(seg.getByRole("radio", { name: /Waiting · 2/ })).toBeChecked();
  await expect(seg).toContainText("Approved · 1");
  await expect(seg).toContainText("Rejected · 1");
  await expect(list.getByRole("button", { name: "MK Tyre Works" })).toContainText("Ready to decide");
  await expect(list.getByRole("button", { name: "QuickFix Auto" })).toContainText("0 of 3 checks done");

  const app = page.getByTestId("application");
  await expect(app).toContainText("Mani Kandan · MK Tyre Works");
  await expect(app).toContainText("•••• •••• 1234");
  await expect(app).toContainText("2 of 4 added");
  await expect(app).toContainText("in the app, at sign-up");
  await expect(app).toContainText("07:00 to 22:00, every day");
  await expect(app.locator(".pp-mini").filter({ hasText: "SUV" }).filter({ hasText: "Base Charge" })).toContainText("₹800");
  await expect(app.locator(".pp-mini .ap-warn")).toHaveText(["₹950"]);
  await expect(app).toContainText("1 price is more than 15% above");
  await shot(page, "applications", info.project.name);
  expect(await noSideScroll(page)).toBe(true);

  await app.getByRole("button", { name: "Reject" }).click();
  await expect(app).toContainText("Write the reason first. It is sent to the applicant.");

  await app.getByRole("button", { name: "Ask for documents" }).click();
  const ask = page.getByTestId("ask-dialog");
  await expect(ask.getByLabel("Message")).toHaveValue(/shop photos \(2 missing\)/);
  await expect(ask.getByRole("link", { name: "Open WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/919876543210\?text=/);
  await ask.getByRole("button", { name: "Close" }).click();

  await app.getByRole("button", { name: "Approve" }).click();
  await expect(page).toHaveURL(/\/admin\/applications\/91$/);
  expect(w.calls.find((call) => call.path === "/api/technicians/90/approve")?.body).toMatchObject({ reason: "Documents checked" });
  await expect(seg).toContainText("Waiting · 1");

  await expect(app).toContainText("Joseph D · QuickFix Auto");
  await expect(app.locator(".pp-check")).toContainText("missing");
  await expect(app.locator(".pp-check")).toContainText("no pin");
  await app.getByLabel("Note for the record").fill("Could not verify the shop address.");
  await app.getByRole("button", { name: "Reject" }).click();
  await expect.poll(() => w.calls.find((call) => call.path === "/api/technicians/91/reject")?.body).toMatchObject({ reason: "Could not verify the shop address." });
  await expect(page.getByText("Nobody is waiting")).toBeVisible();

  await seg.getByRole("radio", { name: /Approved/ }).click();
  await expect(list.getByRole("button", { name: "MK Tyre Works" })).toBeVisible();
  await list.getByRole("button", { name: "Squad Recovery" }).click();
  await expect(app.getByRole("link", { name: "Open their record" })).toHaveAttribute("href", "/admin/technicians/42?tab=profile");
  expect(errors).toEqual([]);
});
