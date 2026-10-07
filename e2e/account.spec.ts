import { expect, test, type Page } from "@playwright/test";

const SHOTS = process.env.PAGES_SHOTS_DIR;

type Json = Record<string, unknown>;
type Options = {
  me?: Json;
  settings?: Record<string, Json>;
  failSettings?: boolean;
  path?: string;
};

const ME = { id: 41, name: "Asha Raman", email: "asha@example.test", phone: "9876543210", birthday: "1994-03-12", gender: "female", isVerified: true, subscription: "free", googleId: null };
const VEHICLES = [
  { id: 1, type: "car", make: "Maruti Suzuki", model: "Swift", license_plate: "TN37AB1234", status: "ready", created_at: "2026-09-01T07:30:00Z" },
  { id: 2, type: "bike", make: "Honda", model: "Activa 6G", license_plate: "TN38CD5678", status: "ready", created_at: "2026-09-03T07:30:00Z" },
];
// Noon-ish times in the month the tests run in, so the month a request falls in is the same in every time zone.
const thisMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01T07:30:00Z`;
};
const requests = () => [
  { id: 5502, service_type: "lockout", vehicle_type: "car", vehicle_model: "Maruti Suzuki Swift", status: "on_the_way", created_at: thisMonth() },
  { id: 5488, service_type: "towing", vehicle_type: "car", vehicle_model: "Maruti Suzuki Swift", status: "completed", created_at: thisMonth() },
  { id: 5481, service_type: "fuel", vehicle_type: "bike", vehicle_model: "Honda Activa 6G", status: "paid", created_at: thisMonth() },
  { id: 5467, service_type: "flat-tire", vehicle_type: "bike", vehicle_model: "Honda Activa 6G", status: "cancelled", created_at: thisMonth() },
  { id: 5431, service_type: "battery", vehicle_type: "car", vehicle_model: "Hyundai i20", status: "completed", created_at: "2021-01-15T07:30:00Z" },
];

async function openAccount(page: Page, { me = {}, settings = {}, failSettings = false, path = "/settings" }: Options = {}) {
  const calls: string[] = [];
  const errors: string[] = [];
  let account: Json = { ...ME, ...me };
  let saved: Record<string, Json> = { ...settings };
  page.on("pageerror", (error) => errors.push(error.message));
  // A signed-in customer: the test token only ever reaches the mocked API below.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("e2e-signed-in")) {
      localStorage.setItem("resqnow_user_token", "e2e-customer-token");
      sessionStorage.setItem("e2e-signed-in", "1");
    }
  });
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (method !== "GET") calls.push(`${method} ${url.pathname} ${request.postData() ?? ""}`.trim());
    if (url.pathname === "/api/auth/me") return reply(200, account);
    if (url.pathname === "/api/auth/logout") return reply(200, { success: true });
    if (url.pathname === "/api/vehicles") return reply(200, VEHICLES);
    if (url.pathname === "/api/service-requests") return reply(200, requests());
    if (url.pathname === "/api/users/41" && method === "PUT") {
      account = { ...account, ...JSON.parse(request.postData() || "{}") };
      return reply(200, { message: "Profile updated", user: account });
    }
    if (url.pathname === "/api/users/me/settings" && method === "GET") return reply(200, saved);
    if (url.pathname === "/api/users/me/settings" && method === "PATCH") {
      if (failSettings) return reply(500, { error: "Failed" });
      const patch = JSON.parse(request.postData() || "{}") as Record<string, Json>;
      for (const [group, values] of Object.entries(patch)) saved = { ...saved, [group]: { ...(saved[group] || {}), ...values } };
      return reply(200, { settings: saved });
    }
    return reply(404, {});
  });
  await page.goto(path);
  return { calls, errors };
}

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-account-${name}.png`, fullPage: false });
};

test("Account: who you are, the three shortcuts, the plan and the settings list", async ({ page, isMobile }) => {
  const { calls, errors } = await openAccount(page);

  await expect(page.getByRole("heading", { name: "Asha Raman", level: 1 })).toBeVisible();
  await expect(page.locator(".rq-ac-pill")).toHaveText(/^paymentsPay as you go$/);
  await expect(page.getByText("9876543210 · asha@example.test")).toBeVisible();
  await expect(page.getByRole("button", { name: "Your details", exact: true }).first()).toHaveText("AR");
  await expect(page.locator(".rq-ac-nudge")).toHaveCount(0);

  // The three places opened most, each with its own live count.
  const garage = page.getByRole("link", { name: "My garage 2 vehicles" });
  await expect(garage).toHaveAttribute("href", "/my-garage");
  await expect(garage.locator("img")).toHaveAttribute("src", "/images/vehicles/car.webp");
  await expect(page.getByRole("button", { name: "Requests 5 so far" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Help Call or chat" })).toBeVisible();

  // The plan on sale, named and priced as the app's own plan list has it.
  const plan = page.locator(".rq-ac-plan");
  await expect(plan.locator(".rq-ac-plan-tag")).toHaveText(/^workspace_premiumSmart Care · ₹99\/month$/);
  await expect(plan.getByText("Priority help, zero fees")).toBeVisible();
  await expect(plan.getByRole("link", { name: "View plan" })).toHaveAttribute("href", "/subscription");

  // The settings list, with what is chosen now.
  const list = page.locator(".rq-ac-list");
  await expect(list.locator(".rq-ac-row")).toHaveCount(6);
  await expect(list.getByRole("button", { name: "Alerts Off" })).toBeVisible();
  await expect(list.getByRole("button", { name: "Appearance Match phone" })).toBeVisible();
  await expect(list.getByRole("link", { name: "Work with ResQNow Join as a technician" })).toHaveAttribute("href", "/technician/login");
  const foot = page.locator(".rq-ac-foot");
  await expect(foot.getByRole("link", { name: "Terms of service" })).toHaveAttribute("href", "/terms-of-service");
  await expect(foot.getByRole("link", { name: "Privacy policy" })).toHaveAttribute("href", "/privacy-policy");

  expect(await noSideScroll(page)).toBe(true);
  if (isMobile) {
    // The page brings its own heading; the bottom bar shows where you are.
    await expect(page.getByAltText("ResQNow Logo")).toBeHidden();
    await expect(page.getByRole("link", { name: /account/i })).toHaveAttribute("aria-current", "page");
  }
  await shot(page, "main");

  // Opening the page changes nothing on the server.
  expect(calls).toEqual([]);
  expect(errors).toEqual([]);
});

test("Your details: one thing is changed at a time, and the email stays as it is", async ({ page }) => {
  const { calls, errors } = await openAccount(page);

  await page.getByRole("button", { name: "Your details", exact: true }).first().click();
  await expect(page).toHaveURL(/\/settings\?tab=profile$/);
  await expect(page.getByRole("heading", { name: "Your details", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: "Name: Asha Raman. Change" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Birthday: 12 Mar 1994. Change" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gender: Female. Change" })).toBeVisible();
  const email = page.locator("div.rq-ac-field");
  await expect(email).toContainText("asha@example.test");
  await expect(email).toContainText("Verified");
  await expect(email.getByRole("button")).toHaveCount(0);
  await shot(page, "details");

  // Phone: the sheet opens with the number on file, and Save sends only the phone.
  await page.getByRole("button", { name: "Phone: 9876543210. Change" }).click();
  const sheet = page.getByRole("dialog", { name: "Phone number" });
  await expect(sheet.getByRole("textbox", { name: "Phone number" })).toHaveValue("9876543210");
  await sheet.getByRole("textbox", { name: "Phone number" }).fill("9123456780");
  await shot(page, "edit-phone");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole("button", { name: "Phone: 9123456780. Change" })).toBeVisible();

  // Gender: pick one.
  await page.getByRole("button", { name: "Gender: Female. Change" }).click();
  const gender = page.getByRole("dialog", { name: "Gender" });
  await expect(gender.getByRole("radio", { name: "Female" })).toBeChecked();
  await gender.getByRole("radio", { name: "Other" }).click();
  await gender.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Gender: Other. Change" })).toBeVisible();

  // A name can't be saved empty, and Cancel leaves it alone.
  await page.getByRole("button", { name: "Name: Asha Raman. Change" }).click();
  const name = page.getByRole("dialog", { name: "Your name" });
  await name.getByRole("textbox", { name: "Your name" }).fill("  ");
  await expect(name.getByRole("button", { name: "Save" })).toBeDisabled();
  await name.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: "Name: Asha Raman. Change" })).toBeVisible();

  expect(calls).toEqual(['PUT /api/users/41 {"phone":"9123456780"}', 'PUT /api/users/41 {"gender":"other"}']);

  // Back goes to Account, which now shows the new number.
  await page.getByRole("button", { name: "Back to Account" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByText("9123456780 · asha@example.test")).toBeVisible();
  expect(errors).toEqual([]);
});

test("no phone number yet: Account asks for it, and Add opens the phone sheet", async ({ page }) => {
  const { calls } = await openAccount(page, { me: { phone: "", birthday: null, gender: "" } });

  await expect(page.locator(".rq-ac-nudge")).toContainText("Add your phone number so your technician can call you.");
  await expect(page.getByText("asha@example.test", { exact: true })).toBeVisible();
  await shot(page, "no-phone");
  await page.locator(".rq-ac-nudge").getByRole("button", { name: "Add" }).click();

  const sheet = page.getByRole("dialog", { name: "Phone number" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("textbox", { name: "Phone number" }).fill("9000012345");
  await sheet.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Phone: 9000012345. Change" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Birthday: not added. Add" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Gender: not added. Add" })).toBeVisible();
  expect(calls).toEqual(['PUT /api/users/41 {"phone":"9000012345"}']);
});

test("Alerts: each switch is saved as soon as it is flipped", async ({ page }) => {
  const { calls, errors } = await openAccount(page, { settings: { notifications: { push_alerts: true, service_updates_email: true, marketing_email: false } } });

  await page.getByRole("button", { name: "Alerts On" }).click();
  await expect(page).toHaveURL(/\/settings\?tab=notifications$/);
  await expect(page.getByRole("heading", { name: "Alerts", level: 1 })).toBeVisible();
  const phone = page.getByRole("switch", { name: /Alerts on this phone/ });
  const updates = page.getByRole("switch", { name: /Request updates by email/ });
  const offers = page.getByRole("switch", { name: /Offers and news by email/ });
  await expect(phone).toBeChecked();
  await expect(updates).toBeChecked();
  await expect(updates).toContainText("Sent to asha@example.test");
  await expect(offers).not.toBeChecked();
  await shot(page, "alerts");

  await offers.click();
  await expect(offers).toBeChecked();
  await phone.click();
  await expect(phone).not.toBeChecked();
  expect(calls).toEqual([
    'PATCH /api/users/me/settings {"notifications":{"marketing_email":true}}',
    'PATCH /api/users/me/settings {"notifications":{"push_alerts":false}}',
  ]);

  // Account shows the new answer.
  await page.getByRole("button", { name: "Back to Account" }).click();
  await expect(page.getByRole("button", { name: "Alerts Off" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("a switch that could not be saved goes back to where it was", async ({ page }) => {
  await openAccount(page, { failSettings: true, path: "/settings?tab=notifications" });

  const updates = page.getByRole("switch", { name: /Request updates by email/ });
  await expect(updates).toBeChecked();
  await updates.click();
  await expect(page.getByText("Failed to save settings")).toBeVisible();
  await expect(updates).toBeChecked();

  // Opened directly, Back still leads to Account.
  await page.getByRole("button", { name: "Back to Account" }).click();
  await expect(page.getByRole("heading", { name: "Asha Raman", level: 1 })).toBeVisible();
});

test("Appearance: the theme and the bottom bar", async ({ page }) => {
  const { calls, errors } = await openAccount(page, { settings: { appearance: { theme: "light" } } });

  await page.getByRole("button", { name: "Appearance Light" }).click();
  await expect(page).toHaveURL(/\/settings\?tab=appearance$/);
  await expect(page.getByRole("radio", { name: "Light" })).toBeChecked();
  await expect(page.locator("html")).toHaveClass(/light/);
  await shot(page, "appearance");

  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.getByRole("radio", { name: "Dark" })).toBeChecked();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.getByRole("radio", { name: "Match phone" }).click();
  await expect(page.getByRole("radio", { name: "Match phone" })).toBeChecked();

  // Hiding on scroll only means something while the bar is shown.
  const bar = page.getByRole("switch", { name: /Show the bottom bar/ });
  const hide = page.getByRole("switch", { name: /Hide it while scrolling/ });
  await expect(bar).toBeChecked();
  await expect(hide).toBeChecked();
  await hide.click();
  await expect(hide).not.toBeChecked();
  await bar.click();
  await expect(bar).not.toBeChecked();
  await expect(hide).toBeDisabled();

  expect(calls).toEqual([
    'PATCH /api/users/me/settings {"appearance":{"theme":"dark","force_dark_mode":true}}',
    'PATCH /api/users/me/settings {"appearance":{"theme":"system","force_dark_mode":false}}',
    'PATCH /api/users/me/settings {"navigation":{"auto_hide_bottom_nav":false}}',
    'PATCH /api/users/me/settings {"navigation":{"mobile_bottom_nav_enabled":false}}',
  ]);
  expect(errors).toEqual([]);
});

test("Your requests: how many, how they went, and the last six months", async ({ page }) => {
  const { errors } = await openAccount(page);

  await page.getByRole("button", { name: "Requests 5 so far" }).click();
  await expect(page).toHaveURL(/\/settings\?tab=stats$/);
  await expect(page.getByRole("heading", { name: "Your requests", level: 1 })).toBeVisible();
  await expect(page.getByText("5 requests so far.")).toBeVisible();
  await expect(page.locator(".rq-ac-count").nth(0)).toHaveText("Completed3");
  await expect(page.locator(".rq-ac-count").nth(1)).toHaveText("In progress1");
  await expect(page.locator(".rq-ac-count").nth(2)).toHaveText("Cancelled1");

  // Six months, this month last with its four requests; the request from 2021 is in none of them.
  const bars = page.locator(".rq-ac-bar");
  await expect(bars).toHaveCount(6);
  await expect(bars.last().locator("b")).toHaveText("4");
  await expect(bars.last()).toHaveClass(/is-now/);
  await expect(page.locator(".rq-ac-bar.is-none")).toHaveCount(5);
  await expect(page.getByRole("img", { name: /^Requests each month: / })).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, "numbers");

  await page.getByRole("link", { name: "See every request" }).click();
  await expect(page).toHaveURL(/\/my-requests$/);
  expect(errors).toEqual([]);
});

test("Privacy and security, and reaching support", async ({ page }) => {
  const { calls, errors } = await openAccount(page);

  await page.getByRole("button", { name: "Privacy and security" }).click();
  await expect(page).toHaveURL(/\/settings\?tab=privacy$/);
  await expect(page.getByText("Signed in with email")).toBeVisible();
  await expect(page.getByRole("link", { name: "How we use your data Privacy policy" })).toHaveAttribute("href", "/privacy-policy");
  await shot(page, "security");

  // Neither of these can be done in the app yet, so each one leads to the people who can do it.
  await page.getByRole("button", { name: "Change password" }).click();
  const password = page.getByRole("dialog", { name: "Change password" });
  await expect(password.getByText("This isn’t in the app yet. Our support team will do it for you.")).toBeVisible();
  await expect(password.getByRole("link", { name: /Call us/ })).toHaveAttribute("href", "tel:+919566510080");
  await password.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: /Delete my account/ }).click();
  const remove = page.getByRole("dialog", { name: "Delete my account" });
  await expect(remove.getByRole("link", { name: /Email us/ })).toHaveAttribute("href", "mailto:resqnow01@gmail.com");
  await remove.getByRole("button", { name: "Close" }).click();

  // Help, from Account: four ways to reach us.
  await page.getByRole("button", { name: "Back to Account" }).click();
  await page.getByRole("button", { name: "Help Call or chat" }).click();
  const help = page.getByRole("dialog", { name: "Contact support" });
  await expect(help.locator(".rq-ac-row")).toHaveCount(4);
  await expect(help.getByRole("link", { name: /Call us \+91 95665 10080/ })).toHaveAttribute("href", "tel:+919566510080");
  await expect(help.getByRole("link", { name: /Send a message/ })).toHaveAttribute("href", "/contact");
  await shot(page, "help");
  await help.getByRole("button", { name: /Ask the assistant/ }).click();
  await expect(help).toBeHidden();
  await expect(page.getByText("ResQNow Assistant")).toBeVisible();

  expect(calls).toEqual([]);
  expect(errors).toEqual([]);
});

test("someone signed in with Google has no password to change", async ({ page }) => {
  await openAccount(page, { me: { googleId: "g-123" }, path: "/settings?tab=privacy" });

  await expect(page.getByText("Signed in with Google")).toBeVisible();
  await expect(page.getByRole("button", { name: /Delete my account/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Change password" })).toHaveCount(0);
});

test("logging out asks first", async ({ page }) => {
  const { calls } = await openAccount(page);

  await page.getByRole("button", { name: "Log out" }).click();
  const sheet = page.getByRole("dialog", { name: "Log out?" });
  await expect(sheet).toBeVisible();
  await shot(page, "log-out");
  await sheet.getByRole("button", { name: "Stay signed in" }).click();
  await expect(sheet).toBeHidden();
  expect(calls).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem("resqnow_user_token"))).toBe("e2e-customer-token");

  await page.getByRole("button", { name: "Log out" }).click();
  await page.getByRole("dialog", { name: "Log out?" }).getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect.poll(() => page.evaluate(() => localStorage.getItem("resqnow_user_token"))).toBeNull();
  expect(calls).toEqual(["POST /api/auth/logout"]);
});

test("a member sees their plan, and the old garage link still opens My garage", async ({ page }) => {
  await openAccount(page, { me: { subscription: "basic" }, path: "/settings?tab=garage" });

  // /settings?tab=garage is where My garage used to live.
  await expect(page).toHaveURL(/\/my-garage$/);
  await expect(page.getByRole("heading", { name: "My garage", level: 1 })).toBeVisible();

  await page.goto("/settings");
  await expect(page.locator(".rq-ac-pill")).toHaveText(/^workspace_premiumSmart Care member$/);
  await expect(page.locator(".rq-ac-plan-tag")).toHaveText(/^workspace_premiumSmart Care$/);
  await expect(page.locator(".rq-ac-plan").getByText("You’re covered")).toBeVisible();
  await expect(page.getByRole("link", { name: "Manage plan" })).toHaveAttribute("href", "/subscription");
  await shot(page, "member");
});

test("with the bottom bar switched off, phones keep the top bar as the way home", async ({ page, isMobile }) => {
  test.skip(!isMobile, "The bottom bar is only on phones");
  await openAccount(page, { settings: { navigation: { mobile_bottom_nav_enabled: false } } });

  await expect(page.getByRole("heading", { name: "Asha Raman", level: 1 })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await expect(page.getByAltText("ResQNow Logo")).toBeVisible();
  await page.getByAltText("ResQNow Logo").click();
  await expect(page).toHaveURL(/\/$/);
});
