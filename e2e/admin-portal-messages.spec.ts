import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, shot } from "./fixtures/adminPortal";

// Messages: an announcement to every technician, a message to chosen technicians, urgent ones, and what was sent.

test("message chosen technicians, by picking and by pasting IDs, confirmed before it goes", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/messages");
  const composer = page.getByTestId("composer");
  await expect(page.getByTestId("reach")).toContainText("Reaches 4 technicians");
  await expect(page.getByTestId("sent")).toContainText("Flat tyre kits: collect from the office");
  await expect(page.getByTestId("sent")).toContainText("3 chosen technicians");
  await expect(page.getByTestId("sent")).toContainText("Urgent");

  await composer.getByRole("radio", { name: "Pick technicians" }).click();
  await page.getByTestId("picker").locator(".ex-pick-row").filter({ hasText: "Murugan S" }).locator(".ap-check").click();
  await composer.getByLabel("Or paste technician IDs").fill("9, 21");
  await expect(page.getByTestId("reach")).toContainText("Reaches 3 technicians");
  await expect(composer.getByLabel("Chosen")).toContainText("Ravi N #9");
  await composer.getByLabel("Title").fill("Flat tyre kits: collect from the office");
  await composer.getByLabel(/^Message/).fill("New puncture kits are at the Gandhipuram office. Collect yours before Saturday.");
  await expect(page.locator(".ms-note")).toContainText("New puncture kits are at the Gandhipuram office.");
  await shot(page, "messages", info.project.name);
  expect(await noSideScroll(page)).toBe(true);
  await composer.getByRole("button", { name: "Send to 3 technicians" }).click();
  await composer.getByRole("button", { name: "Yes, send to 3" }).click();
  await expect(page.getByText("Sent to 3 technicians")).toBeVisible();
  expect(w.calls.find((call) => call.path === "/api/admin-extended/notifications/technician-broadcast")?.body).toEqual({
    title: "Flat tyre kits: collect from the office", message: "New puncture kits are at the Gandhipuram office. Collect yours before Saturday.", technicianIds: [12, 9, 21],
  });
  expect(errors).toEqual([]);
});

test("an urgent message always goes to every technician", async ({ page }) => {
  const { w, errors } = await openPortal(page, "/admin/messages");
  const composer = page.getByTestId("composer");
  await composer.getByRole("radio", { name: "By filter" }).click();
  await composer.getByText("Urgent", { exact: true }).click();
  await expect(composer.getByRole("radio", { name: "All technicians" })).toBeChecked();
  await expect(composer.getByRole("radio", { name: "Pick technicians" })).toBeDisabled();
  await composer.getByLabel("Title").fill("Ukkadam flyover closed");
  await composer.getByLabel(/^Message/).fill("Use the Trichy Road route until noon.");
  await composer.getByRole("button", { name: /^Send to/ }).click();
  await composer.getByRole("button", { name: /^Yes, send/ }).click();
  await expect.poll(() => w.calls.find((call) => call.path === "/api/admin-extended/notifications/emergency-message")?.body).toEqual({ title: "Ukkadam flyover closed", message: "Use the Trichy Road route until noon." });
  expect(errors).toEqual([]);
});
