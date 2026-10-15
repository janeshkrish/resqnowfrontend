import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, shot } from "./fixtures/adminPortal";

// Alerts: what the monitor flagged on live jobs, in plain words, with the call, reminder, reassign and monitor actions;
// what was handled today; and the real limits the monitor uses.

test("an open alert says what is wrong, shows the facts, and the reminder goes to the server", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/alerts");
  const card = page.getByTestId("alert-5499");
  await expect(card).toContainText("High");
  await expect(card).toContainText("Ravi N has stopped on the way");
  await expect(card).toContainText("Priya M");
  await expect(card).toContainText("3 min late");
  await expect(card).toContainText("standing still");
  await expect(card).toContainText("3.2 km");
  await expect(card).toContainText("Also: Ravi N will arrive after the promised time");
  const rules = page.getByTestId("alert-rules");
  await expect(rules).toContainText("Stopped on the way");
  await expect(rules).toContainText("Under 80 m in 8 min");
  await expect(rules).toContainText("every 45 s");
  const handled = page.getByTestId("handled-alerts");
  await expect(handled).toContainText("#5488");
  await expect(handled).toContainText("Added a request note");
  await expect(handled).toContainText("Cleared by itself");
  await expect(page.getByRole("navigation", { name: "Alerts" }).getByRole("button", { name: /^Open/ })).toContainText("1");
  await shot(page, "alerts", info.project.name);
  expect(await noSideScroll(page)).toBe(true);

  await card.getByRole("button", { name: "Send a reminder" }).click();
  await expect.poll(() => w.calls.find((call) => call.path === "/api/admin/command-center/actions/remind-technician")?.body).toMatchObject({ requestId: 5499 });
  await page.getByRole("button", { name: "Check now" }).click();
  await expect(page.getByText("Checked 3 live jobs · 1 flagged, 0 cleared")).toBeVisible();
  await page.getByRole("button", { name: /^Handled today/ }).click();
  await expect(page.getByTestId("handled-alerts")).toContainText("#5480");
  expect(errors).toEqual([]);
});

test("reassign: send offers again within a wider distance, with a reason for the log", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/alerts");
  await page.getByTestId("alert-5499").getByRole("button", { name: "Reassign" }).click();
  const dialog = page.getByTestId("assign-dialog");
  await expect(dialog).toContainText("Reassign #5499");
  await expect(dialog).toContainText("Priya M is waiting at 21, Race Course Road. Ravi N is taken off the job.");
  await expect(dialog).toContainText("2 can take it now · 3 can't");
  await expect(dialog).toContainText("Murugan S");
  await expect(dialog).toContainText("1 off duty");
  await dialog.getByLabel("Look within").selectOption("15");
  await dialog.getByLabel("Reason, for the log").fill("Not moving and not answering calls");
  await shot(page, "reassign", info.project.name);
  await dialog.getByRole("button", { name: "Send out within 15 km" }).click();
  await expect(dialog).toHaveCount(0);
  expect(w.calls.find((call) => call.path === "/api/admin/command-center/actions/reassign")?.body).toMatchObject({ requestId: 5499, radiusKm: 15 });
  expect(w.calls.find((call) => call.path === "/api/admin/monitor/requests/5499/notes")?.body).toMatchObject({ note: "Sent out again: Not moving and not answering calls" });
  await expect(page.getByText("Nothing needs a person right now")).toBeVisible();
  expect(errors).toEqual([]);
});

test("reassign: give the job straight to one technician", async ({ page }) => {
  const { w, errors } = await openPortal(page, "/admin/alerts");
  await page.getByTestId("alert-5499").getByRole("button", { name: "Reassign" }).click();
  const dialog = page.getByTestId("assign-dialog");
  await dialog.getByRole("radio", { name: "Assign directly" }).click();
  await expect(dialog.getByRole("button", { name: /^Give the job to/ })).toBeDisabled();
  await dialog.getByText("Senthil P").click();
  await dialog.getByRole("button", { name: "Give the job to Senthil P" }).click();
  await expect(dialog).toHaveCount(0);
  expect(w.calls.find((call) => call.path === "/api/admin/requests/5499/assign")?.body).toMatchObject({ technicianId: 15 });
  expect(errors).toEqual([]);
});
