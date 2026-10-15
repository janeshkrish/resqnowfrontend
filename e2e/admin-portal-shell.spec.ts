import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, ready, shot } from "./fixtures/adminPortal";

// The admin portal's shell, Today, search, the bell, the account menu and the technician page.
// Everything on screen comes from the pretend back end in fixtures/adminPortal.ts.

test("one side bar for everything, with live counts; old addresses open the new pages", async ({ page, isMobile }) => {
  const { errors } = await openPortal(page, "/admin/extended/requests");
  await expect(page).toHaveURL(/\/admin\/live$/);
  await ready(page);
  if (isMobile) await page.getByRole("button", { name: "Open the menu" }).click();
  const nav = page.getByRole("navigation", { name: "Admin" });
  for (const label of ["Today", "Live requests", "All requests", "Alerts", "Watch list", "Technicians", "Add technician", "Applications", "Customers", "Payments", "Payouts", "Reports", "Complaints", "Messages", "Services and prices", "Settings", "Audit log"]) {
    await expect(nav.getByRole("link", { name: new RegExp(`^${label}`) })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: /^Live requests/ })).toContainText("3");
  await expect(nav.getByRole("link", { name: /^Applications/ })).toContainText("4");
  await expect(nav.getByRole("link", { name: /^Alerts/ }).locator("i")).toHaveClass(/is-warn/);
  await expect(nav.getByRole("link", { name: /^Live requests/ })).toHaveAttribute("aria-current", "page");
  await nav.getByRole("link", { name: /^Today/ }).click();
  await expect(page).toHaveURL(/\/admin\/today$/);
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();

  for (const [from, to] of [["/admin/dashboard", /\/admin\/today$/], ["/admin/users", /\/admin\/customers$/], ["/admin/extended/command-center", /\/admin\/alerts$/], ["/admin/technician/42", /\/admin\/technicians\/42\?tab=profile$/], ["/admin/email-templates", /\/admin\/settings\/emails$/]] as const) {
    await page.goto(from);
    await expect(page).toHaveURL(to);
  }
  expect(errors).toEqual([]);
});

test("Today: the live numbers, the city map, what needs a person, the day by the hour and the money", async ({ page }, info) => {
  const { errors } = await openPortal(page, "/admin/today");
  const today = page.getByTestId("today");
  await expect(today.getByTestId("kpi-live")).toContainText("3");
  await expect(today.getByTestId("kpi-live")).toContainText("1 finding a technician");
  await expect(today.getByTestId("kpi-attention")).toContainText("1");
  await expect(today.getByTestId("kpi-completed")).toContainText("46");
  await expect(today.getByTestId("kpi-completed")).toContainText("+6 on last");
  await expect(today.getByTestId("kpi-collected")).toContainText("₹38,420");
  await expect(today.getByTestId("kpi-duty")).toContainText("9 on a job, 14 free");
  await expect(today.getByTestId("kpi-arrival")).toContainText("12");

  const map = today.getByTestId("city-map");
  await expect(map.locator("[data-fake-marker]")).toHaveCount(5);
  await expect(map.locator(".cm-pin.is-warn")).toHaveCount(1);
  await expect(map.locator(".cm-tag").filter({ hasText: "#5499" })).toBeVisible();
  await expect(map).toContainText("14 free technicians");

  const needs = today.getByTestId("needs-you");
  await expect(needs).toContainText("#5499 · Ravi N");
  await expect(needs).toContainText("4 technician applications waiting");
  await expect(needs).toContainText("The oldest, MK Tyre Works");
  await expect(needs).toContainText("3 payout requests · ₹14,250");
  await expect(needs).toContainText("5 open complaints · 1 older than a day");

  await expect(today.getByRole("img", { name: /Requests each hour today, 58 in all/ })).toBeVisible();
  await expect(today).toContainText("Towing");
  await expect(today).toContainText("₹28,560");
  await expect(today).toContainText("₹14,250 to pay out");
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, "today", info.project.name);

  await needs.getByRole("button", { name: "Review" }).click();
  await expect(page).toHaveURL(/\/admin\/applications$/);
  await page.goBack();
  await map.locator(".cm-pin.is-warn").click();
  await expect(page).toHaveURL(/\/admin\/live\?open=5499$/);
  expect(errors).toEqual([]);
});

test("search: Ctrl K from any page finds requests and people; Enter opens the first", async ({ page }, info) => {
  const { errors } = await openPortal(page, "/admin/today");
  await ready(page);
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  await page.keyboard.press("Control+k");
  const dialog = page.getByTestId("search-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Search" }).fill("asha");
  await expect(dialog).toContainText("#5502 · Lockout · Asha Raman");
  await expect(dialog).toContainText("+91 98••• ••210");
  await shot(page, "search", info.project.name);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/admin\/requests\/5502$/);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByTestId("request-panel")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/admin\/requests$/);

  await page.getByRole("button", { name: "Search requests, people, payments" }).click();
  await page.getByRole("textbox", { name: "Search" }).fill("selvam");
  await page.getByRole("button", { name: /Squad Recovery/ }).click();
  await expect(page).toHaveURL(/\/admin\/technicians\/42$/);
  expect(errors).toEqual([]);
});

test("the bell lists applications and alerts, and marks them read; the account menu signs out", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/today");
  const bell = page.getByRole("button", { name: /^Notifications, 2 new/ });
  await expect(bell).toBeVisible();
  await bell.click();
  const menu = page.getByTestId("bell-menu");
  await expect(menu).toContainText("Notifications · 2 new");
  await expect(menu).toContainText("MK Tyre Works submitted an application.");
  await expect(menu).toContainText("4 applications waiting");
  await shot(page, "bell", info.project.name);
  await menu.getByRole("button", { name: "Mark all as read" }).click();
  await expect(page.getByRole("button", { name: /^Notifications$/ })).toBeVisible();
  await page.mouse.click(5, 300);
  await expect(menu).toHaveCount(0);
  expect(w.calls.some((call) => call.path === "/api/admin/portal/notifications/read-all")).toBe(true);

  await page.getByRole("button", { name: "Your account" }).click();
  const account = page.getByRole("menu", { name: "Your account" });
  await expect(account).toContainText("ops@resqnow.test");
  await account.getByRole("menuitem", { name: "Audit log" }).click();
  await expect(page).toHaveURL(/\/admin\/audit$/);
  await page.getByRole("button", { name: "Your account" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  expect(await page.evaluate(() => localStorage.getItem("resqnow_admin_token"))).toBeNull();
  expect(errors).toEqual([]);
});

test("a technician: profile and documents, prices next to the city usual, payouts, log-in hours, and hiding", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/technicians/42?tab=profile");
  const tech = page.getByTestId("technician-page");
  await expect(tech).toContainText("Squad Recovery · Selvam Rajendran");
  const profile = page.getByTestId("tech-profile");
  await expect(profile).toContainText("14, Mettupalayam Road, Thudiyalur, Coimbatore, Tamil Nadu");
  await expect(profile).toContainText("24 × 7");
  await expect(profile).toContainText("•••• •••• 4410");
  await expect(profile).not.toContainText("123456784410");
  await expect(profile).toContainText("Flatbed Trucks");
  await expect(profile).toContainText("2 of 4 · from sign-up");
  await expect(profile).toContainText("selvam.squad@okaxis");
  await expect(profile).toContainText("HDFC ••4410");
  await expect(profile).toContainText("Approved by ops@resqnow.test");
  await expect(profile).toContainText("Good with night jobs.");
  await shot(page, "tech-profile", info.project.name);

  await profile.getByRole("switch", { name: "Shown to customers" }).click();
  await expect.poll(() => w.calls.find((call) => call.path === "/api/admin/technician/toggle")?.body).toMatchObject({ technicianId: 42, isVisible: false });
  await expect(tech.locator(".ap-pill", { hasText: "Hidden" })).toBeVisible();

  await page.getByRole("button", { name: "Services and prices" }).click();
  const pricing = page.getByTestId("tech-pricing");
  await expect(pricing).toContainText("Towing");
  await expect(pricing).toContainText("SUV");
  await expect(pricing).toContainText("₹950");
  await expect(pricing).toContainText("usual ₹800");
  await expect(pricing.locator(".ap-warn")).toHaveText("₹950");
  await shot(page, "tech-pricing", info.project.name);

  await page.getByRole("button", { name: "Payouts" }).click();
  const payouts = page.getByTestId("tech-payouts");
  await expect(payouts).toContainText("₹6,420");
  await expect(payouts).toContainText("428713390021");

  await page.getByRole("button", { name: "Log-in activity" }).click();
  const activity = page.getByTestId("tech-activity");
  await expect(activity).toContainText("On duty now");
  await expect(activity).toContainText("Reminder to come on duty");
  await expect(activity.getByRole("button", { name: "On duty" })).toBeDisabled();
  await shot(page, "tech-activity", info.project.name);
  expect(await noSideScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});
