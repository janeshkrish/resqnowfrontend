import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, shot } from "./fixtures/adminPortal";

// Settings: the real dispatch and alert values in use, and editing an email template with a live preview.

test("the values in use, read from the server", async ({ page }, info) => {
  const { errors } = await openPortal(page, "/admin/settings");
  const settings = page.getByTestId("settings-page");
  await expect(settings.getByTestId("phone-sign-in")).toContainText("On");
  await expect(settings.getByTestId("dispatch-settings")).toContainText("Time to accept an offer");
  await expect(settings.getByTestId("dispatch-settings")).toContainText("10 s");
  await expect(settings.getByTestId("alert-settings")).toContainText("checked every 45 s");
  await expect(settings.getByTestId("alert-settings")).toContainText("GPS stopped updating");
  await expect(settings).toContainText("ops@resqnow.test");
  await shot(page, "settings", info.project.name);
  expect(await noSideScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});

test("edit an email template, see it filled in, undo or save", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/settings/emails");
  const editor = page.getByTestId("email-editor");
  await expect(editor.getByLabel("Template")).toHaveValue("REQUEST_CONFIRMED");
  await expect(editor).toContainText("{{requestId}}");
  const preview = page.getByTestId("email-preview");
  await expect(preview).toContainText("Your ResQNow help is booked · #5502");
  await expect(preview.locator("iframe")).toHaveAttribute("srcdoc", /<h2>Your help is booked, Asha<\/h2>/);
  await editor.getByLabel("Subject").fill("Help is on its way · #{{requestId}}");
  await expect(preview).toContainText("Help is on its way · #5502");
  await editor.getByRole("button", { name: "Undo changes" }).click();
  await expect(editor.getByLabel("Subject")).toHaveValue("Your ResQNow help is booked · #{{requestId}}");
  await editor.getByLabel("Subject").fill("Help is on its way · #{{requestId}}");
  await shot(page, "emails", info.project.name);
  await editor.getByRole("button", { name: "Save" }).click();
  await expect(editor.getByRole("button", { name: "Save" })).toBeDisabled();
  expect(w.calls.find((call) => call.path === "/api/admin/email-templates/REQUEST_CONFIRMED")?.body).toMatchObject({ subject: "Help is on its way · #{{requestId}}" });
  await editor.getByLabel("Template").selectOption("TECHNICIAN_APPROVED");
  await expect(editor.getByLabel("Subject")).toHaveValue("You're approved");
  expect(errors).toEqual([]);
});
