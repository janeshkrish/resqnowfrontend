import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, shot } from "./fixtures/adminPortal";

// Technicians: who is on a job, free or offline now, their last 30 days, hiding from new jobs, reminders and deleting.

test("the list: right now, services, the 30-day numbers, dues, and the tabs", async ({ page }, info) => {
  const { errors } = await openPortal(page, "/admin/technicians");
  await expect(page.getByRole("heading", { name: "Technicians", level: 1 })).toBeVisible();
  await expect(page.getByText("61 approved partners · 23 on duty now · 9 on a job")).toBeVisible();
  const table = page.getByTestId("technicians-table");
  const squad = table.getByRole("row", { name: "Squad Recovery" });
  await expect(squad).toContainText("Selvam Rajendran · Thudiyalur");
  await expect(squad).toContainText("On a job");
  await expect(squad).toContainText("#5501");
  await expect(squad).toContainText("72");
  await expect(squad).toContainText("6 h 10");
  const ravi = table.getByRole("row", { name: "Ravi N" });
  await expect(ravi).toContainText("Stopped on the way");
  await expect(ravi.locator(".ap-warn")).toHaveText(["84%"]);
  await expect(table.getByRole("row", { name: "Murugan S" })).toContainText("+1");
  const bala = table.getByRole("row", { name: "Bala S" });
  await expect(bala).toContainText("Offline");
  await expect(bala.locator(".ap-warn")).toHaveText(["61%", "₹1,240"]);
  await expect(bala.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  await shot(page, "technicians", info.project.name);
  expect(await noSideScroll(page)).toBe(true);

  await page.getByRole("navigation", { name: "Technicians" }).getByRole("button", { name: /^Needs a look/ }).click();
  await expect(table.getByRole("row", { name: /^(Squad Recovery|Murugan S)$/ })).toHaveCount(0);
  await expect(table.getByRole("row", { name: "Ravi N" })).toBeVisible();
  await page.getByRole("button", { name: "Add technician" }).click();
  await expect(page).toHaveURL(/\/admin\/technicians\/new$/);
  expect(errors).toEqual([]);
});

test("hiding from new jobs, a log-in reminder and deleting, from the row", async ({ page }) => {
  const { w, errors } = await openPortal(page, "/admin/technicians");
  const table = page.getByTestId("technicians-table");
  const openMenu = async () => {
    const more = table.getByRole("button", { name: "More for Bala S" });
    // The mobile table scrolls horizontally; its menu intentionally closes on
    // scroll. Finish revealing the action before opening that menu.
    await more.scrollIntoViewIfNeeded();
    await expect(more).toBeInViewport({ ratio: 1 });
    await more.click();
  };
  await table.getByRole("switch", { name: "Murugan S shown to customers" }).click();
  await expect.poll(() => w.calls.find((call) => call.path === "/api/admin/technician/toggle")?.body).toMatchObject({ technicianId: 12, isVisible: false });
  await expect(table.getByRole("switch", { name: "Murugan S shown to customers" })).toHaveAttribute("aria-checked", "false");
  await expect(page).toHaveURL(/\/admin\/technicians$/);

  await openMenu();
  await page.getByRole("menuitem", { name: "Send a log-in reminder" }).click();
  await expect.poll(() => w.calls.find((call) => call.path === "/api/admin/technician/send-login-reminder")?.body).toMatchObject({ technicianId: 21 });

  await openMenu();
  await page.getByRole("menuitem", { name: "Delete technician" }).click();
  const dialog = page.getByTestId("delete-technician");
  await expect(dialog).toContainText("Owes ₹1,240 in cash dues");
  await expect(dialog.getByRole("button", { name: "Delete technician" })).toBeDisabled();
  await dialog.getByLabel("Type BALA S to confirm").fill("bala s");
  await dialog.getByRole("button", { name: "Delete technician" }).click();
  await expect(dialog).toHaveCount(0);
  expect(w.calls.some((call) => call.method === "DELETE" && call.path === "/api/admin/technicians/21")).toBe(true);
  await expect(table.getByRole("row", { name: "Bala S" })).toHaveCount(0);

  await table.getByRole("row", { name: "Ravi N" }).click();
  await expect(page).toHaveURL(/\/admin\/technicians\/9$/);
  expect(errors).toEqual([]);
});
