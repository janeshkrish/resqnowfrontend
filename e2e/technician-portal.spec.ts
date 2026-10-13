import { expect, test, type Page } from "@playwright/test";

import { TECHNICIAN, fakeSocketServer } from "./fixtures/technicianPortal";

// The technician app outside a job: home, money, jobs, rating, me, and a towing operator's vehicles and team.
// Every figure on screen comes from the answers below, shaped as resqnowbackend/routes/technicians.js sends them.

const todayAt = (hour: number, minute = 0) => {
  const day = new Date();
  day.setHours(hour, minute, 0, 0);
  return day.toISOString();
};
const daysAgo = (days: number, hour = 13) => {
  const day = new Date();
  day.setDate(day.getDate() - days);
  day.setHours(hour, 22, 0, 0);
  return day.toISOString();
};

const requests = [
  { id: "9003", service_type: "car-battery", status: "pending", amount: 179, created_at: todayAt(0, 5), updated_at: todayAt(0, 5) },
  { id: "9004", service_type: "car-flat-tire", status: "accepted", amount: 315, created_at: todayAt(0, 4), updated_at: todayAt(0, 4), accepted_time: todayAt(0, 4) },
  { id: "9002", service_type: "car-flat-tire", status: "completed", amount: 315, created_at: todayAt(0, 2), completed_at: todayAt(0, 3), sla_deadline: todayAt(0, 1) },
  { id: "9001", service_type: "bike-battery", status: "paid", amount: 179, created_at: todayAt(0, 0), completed_at: todayAt(0, 1), sla_deadline: todayAt(0, 2) },
  { id: "9005", service_type: "car-lockout", status: "cancelled", amount: 0, created_at: daysAgo(1), updated_at: daysAgo(1) },
  { id: "9006", service_type: "car-mechanical", status: "completed", amount: 449, created_at: daysAgo(3, 13), completed_at: daysAgo(3, 13) },
];

const history = [
  { id: "9002", service_type: "car-flat-tire", vehicle_type: "car", vehicle_model: "Maruti Swift", address: "Race Course Road", status: "completed", created_at: todayAt(0, 2), amount: 315 },
  { id: "9001", service_type: "bike-battery", vehicle_type: "bike", vehicle_model: "Honda Activa", address: "RS Puram", status: "paid", created_at: todayAt(0, 0), amount: 179 },
  { id: "9005", service_type: "car-lockout", vehicle_type: "car", vehicle_model: "Hyundai i20", address: "Peelamedu", status: "cancelled", created_at: daysAgo(1), amount: null },
  { id: "9007", service_type: "car-flat-tire", vehicle_type: "bike", vehicle_model: "Bajaj Pulsar", address: "Singanallur", status: "rejected", created_at: daysAgo(1, 8), amount: null },
  { id: "9006", service_type: "car-mechanical", vehicle_type: "car", vehicle_model: "Tata Nexon", address: "Saibaba Colony", status: "completed", created_at: daysAgo(3), amount: 449 },
];

const withdrawals = [
  { id: 43, withdrawalReference: "WD-1043", amount: 500, currency: "INR", status: "pending", upiId: "arun@upi", beneficiaryName: "Arun Kumar", createdAt: daysAgo(1) },
  { id: 38, withdrawalReference: "WD-1038", amount: 2000, currency: "INR", status: "paid", upiId: "arun@upi", payoutReference: "UTR52790041", createdAt: daysAgo(7), paidAt: daysAgo(6) },
  { id: 31, withdrawalReference: "WD-1031", amount: 800, currency: "INR", status: "rejected", rejectionReason: "UPI name did not match.", createdAt: daysAgo(12) },
];

const wallet = {
  total_earnings: 12840, withdrawable_balance: 3120, total_paid_out: 9220, on_hold_balance: 500, pending_withdrawals: 500,
  recent_withdrawals: withdrawals,
};

const activity = [
  { entry_type: "payment_credit", payment_id: 71, service_type: "car-flat-tire", technician_amount: 315, balance_after: 3620, created_at: todayAt(0, 3) },
  { entry_type: "payment_credit", payment_id: 70, service_type: "bike-battery", technician_amount: 179.5, balance_after: 3305, created_at: todayAt(0, 1) },
  { entry_type: "payout_debit", payout_id: 12, technician_amount: 2000, balance_after: 366, created_at: daysAgo(6) },
];

const reviews = [
  { id: "r1", reviewer_name: "Asha", rating: 5, comment: "Came quickly and fixed the puncture in ten minutes.", created_at: todayAt(0, 4) },
  { id: "r2", reviewer_name: "Ravi", rating: 4, comment: "Good work. A little late.", created_at: daysAgo(3) },
  { id: "r3", reviewer_name: "Karthik", rating: 5, comment: "Explained what was wrong before starting.", created_at: daysAgo(8) },
];

const notifications = [
  { id: "n1", type: "success", title: "₹315 added to your wallet", message: "Flat tyre job", is_read: false, created_at: todayAt(0, 3) },
  { id: "n2", type: "info", title: "Payout sent", message: "₹2,000 sent to arun@upi", is_read: true, created_at: daysAgo(6) },
];

const earningsHistory = [620, 890, 710, 269, 442, 449, 494].map((amount, index) => ({ date: `Day ${index + 1}`, amount }));

const vehicles = [
  { id: "v1", vehicle_id: "V-01", vehicle_type: "flatbed", vehicle_number: "TN37TR1001", capacity: "3.5 ton", status: "available" },
  { id: "v2", vehicle_id: "V-02", vehicle_type: "wheel-lift", vehicle_number: "TN37TR1002", capacity: null, status: "busy" },
];
const employees = [
  { id: "e1", employee_id: "E-01", name: "Selvam R", phone: "+91 98765 00011", role: "driver", status: "active", assigned_vehicle_id: "v1", assigned_vehicle: { id: "v1", vehicle_id: "V-01", vehicle_number: "TN37TR1001", vehicle_type: "flatbed" } },
  { id: "e2", employee_id: "E-02", name: "Ravi P", phone: "+91 98765 00012", role: "helper", status: "offline", assigned_vehicle_id: null },
];

type Call = { method: string; path: string; body: unknown };
type Options = {
  technician?: Record<string, unknown>;
  pendingDues?: number;
  notification?: NotificationPermission;
  language?: "ta" | "hi";
};

async function signIn(page: Page, options: Options = {}) {
  const errors: string[] = [];
  const calls: Call[] = [];
  const technician = { ...TECHNICIAN, technician_id: "RQT-0007", rating: 4.7, upi_id: "arun@upi", address: "14 Gandhipuram, Coimbatore", service_area_range: 10, experience: 6, ...options.technician };
  const settings = {
    appearance: { theme: "light" },
    notifications: { email_notifications: true, push_notifications: true },
    navigation: { mobile_bottom_nav_enabled: true, auto_hide_bottom_nav: false },
  };
  let online = true;
  let dues = options.pendingDues ?? 0;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(
    ({ me, permission, language }) => {
      // A signed-in technician: the test token only ever reaches the mocked API below.
      localStorage.setItem("resqnow_technician_token", "e2e-technician-token");
      localStorage.setItem("resqnow_technician", JSON.stringify(me));
      if (language && !localStorage.getItem("resqnow_technician_language")) localStorage.setItem("resqnow_technician_language", language);
      let state: NotificationPermission = permission;
      Object.defineProperty(Notification, "permission", { configurable: true, get: () => state });
      Notification.requestPermission = async () => {
        const answer = (window as unknown as { __notificationAnswer?: NotificationPermission }).__notificationAnswer;
        if (answer) state = answer;
        return state;
      };
    },
    { me: technician, permission: options.notification ?? "granted", language: options.language ?? null },
  );
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const reply = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    let body: unknown = null;
    if (method !== "GET") {
      try { body = request.postDataJSON(); } catch { body = request.postData(); }
      calls.push({ method, path, body });
    }

    if (path === "/api/technicians/me") return reply(200, { ...technician, is_active: online });
    if (path === "/api/technicians/me/active-job" || path === "/api/technician/active-job/7") return reply(200, null);
    if (path === "/api/technicians/dashboard-stats") return reply(200, { totalEarnings: 12840, withdrawableBalance: 3120, totalPaidOut: 9220, completedJobs: 38, todayEarnings: 494 });
    if (path === "/api/technicians/requests") return reply(200, requests);
    if (path === "/api/technicians/earnings-history") return reply(200, earningsHistory);
    if (path === "/api/technicians/me/reviews") return reply(200, reviews);
    if (path === "/api/technicians/me/notifications") return reply(200, notifications);
    if (path === "/api/technicians/me/financials") return reply(200, { total_earnings: 12840, pending_dues: dues });
    if (path === "/api/technicians/me/wallet") return reply(200, wallet);
    if (path === "/api/technicians/jobs/history") return reply(200, history);
    if (path === "/api/technicians/me/payout-transactions") return reply(200, activity);
    if (path === "/api/technicians/me/withdrawals") return method === "GET" ? reply(200, { data: withdrawals }) : reply(200, { success: true });
    if (path === "/api/technicians/me/status") {
      online = Boolean((body as { active?: boolean })?.active);
      return reply(200, { success: true, is_active: online });
    }
    if (path === "/api/technicians/me/pay-dues/order") {
      dues = 0;
      return reply(400, { error: "No pending dues" });
    }
    if (path === "/api/technicians/me/settings") {
      if (method !== "GET") {
        const patch = body as Partial<typeof settings>;
        Object.assign(settings.appearance, patch.appearance);
        Object.assign(settings.notifications, patch.notifications);
        Object.assign(settings.navigation, patch.navigation);
      }
      return reply(200, settings);
    }
    if (path === "/api/technicians/me/profile") {
      Object.assign(technician, body);
      return reply(200, { technician });
    }
    if (path === "/api/technicians/vehicles") return method === "GET" ? reply(200, vehicles) : reply(200, { id: "v3", vehicle_id: "V-03", ...(body as object) });
    if (path.startsWith("/api/technicians/vehicles/")) return reply(200, { ...vehicles[0], ...(body as object) });
    if (path === "/api/technicians/employees") return method === "GET" ? reply(200, employees) : reply(200, { id: "e3", employee_id: "E-03", ...(body as object) });
    if (path.startsWith("/api/technicians/employees/")) return reply(200, { ...employees[0], ...(body as object) });
    if (method !== "GET") return reply(200, {});
    return reply(404, {});
  });
  return { errors, calls };
}

/** A picture of the whole page for looking over the design; only taken when a folder is given. */
async function shot(page: Page, name: string) {
  if (!process.env.REQUEST_SHOTS_DIR) return;
  await page.screenshot({ path: `${process.env.REQUEST_SHOTS_DIR}/${test.info().project.name}-tech-${name}.png`, fullPage: true, animations: "disabled" });
}

/** The page never scrolls sideways, on a phone or a wide screen. */
const fitsWidth = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);

test.describe("technician app", () => {
  test("home: duty, today's money and the places to go, with nothing of the old dashboard", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors, calls } = await signIn(page);
    await page.goto("/technician/dashboard");

    const home = page.getByTestId("technician-home");
    await expect(home).toBeVisible();
    await expect(home.getByText("Arun Kumar")).toBeVisible();

    const duty = page.getByTestId("technician-duty");
    await expect(duty).toHaveAttribute("data-state", "on");
    await expect(duty.getByText("ON DUTY")).toBeVisible();
    await expect(duty.getByText("Waiting for a job. Your phone will ring loudly.")).toBeVisible();

    const today = page.getByTestId("technician-today");
    await expect(today).toContainText("Earned today");
    await expect(today).toContainText("₹494");
    await expect(today).toContainText("2 jobs done today");
    // floor(12,840 / 1,000) + 38 jobs × 5.
    await expect(today).toContainText("202 points");

    await expect(home.getByRole("link", { name: /My money/ })).toContainText("₹3,120 ready");
    await expect(home.getByRole("link", { name: /My jobs/ })).toContainText("38 done");
    // The three reviews: (5 + 4 + 5) / 3.
    await expect(home.getByRole("link", { name: /My rating/ })).toContainText("4.7 out of 5");
    await expect(home.getByRole("link", { name: /Help/ })).toHaveAttribute("href", "tel:+919566510080");
    // Only towing operators get vehicles and a team.
    await expect(home.getByRole("button", { name: /My vehicles/ })).toHaveCount(0);
    await expect(home.getByRole("button", { name: "Messages, 1 new" })).toBeVisible();

    // The old dashboard, its header and its bottom bar are gone.
    for (const old of ["Order Overview", "Order Statistics", "Recent Alerts", "Total Earnings", "Notification Settings"]) {
      await expect(page.getByText(old, { exact: true })).toHaveCount(0);
    }
    const bar = page.getByTestId("technician-nav");
    await expect(bar.locator(".tp-tab > span:last-child")).toHaveText(["Home", "Money", "Jobs", "Me"]);
    await expect(bar.getByRole("button", { name: "Home" })).toHaveAttribute("aria-current", "page");
    await shot(page, "home");
    expect(await fitsWidth(page)).toBe(true);

    // Going off duty and back on tells the server, as the old switch did.
    await duty.getByRole("button", { name: "Go off duty" }).click();
    await expect(duty).toHaveAttribute("data-state", "off");
    await expect(duty.getByText("OFF DUTY")).toBeVisible();
    await shot(page, "home-off");
    await duty.getByRole("button", { name: "Go ON duty" }).click();
    await expect(duty).toHaveAttribute("data-state", "on");
    expect(calls.filter((call) => call.path === "/api/technicians/me/status")).toEqual([
      { method: "PATCH", path: "/api/technicians/me/status", body: { active: false } },
      { method: "PATCH", path: "/api/technicians/me/status", body: { active: true } },
    ]);
    expect(errors).toEqual([]);
  });

  test("home: the bar and the tiles lead to money, jobs, rating and me", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors } = await signIn(page);
    await page.goto("/technician/dashboard");
    const bar = page.getByTestId("technician-nav");

    await page.getByTestId("technician-today").click();
    await expect(page).toHaveURL(/\/technician\/earnings$/);
    await expect(page.getByRole("heading", { name: "My money", level: 1 })).toBeVisible();
    await expect(bar.getByRole("button", { name: "Money" })).toHaveAttribute("aria-current", "page");

    await bar.getByRole("button", { name: "Jobs", exact: true }).click();
    await expect(page).toHaveURL(/\/technician\/history$/);
    await expect(page.getByRole("heading", { name: "My jobs", level: 1 })).toBeVisible();

    await bar.getByRole("button", { name: "Me", exact: true }).click();
    await expect(page).toHaveURL(/\/technician\/profile$/);
    await expect(page.getByTestId("technician-me")).toBeVisible();

    await bar.getByRole("button", { name: "Home", exact: true }).click();
    await page.getByTestId("technician-home").getByRole("link", { name: /My rating/ }).click();
    await expect(page).toHaveURL(/\/technician\/reviews$/);
    await expect(page.getByRole("heading", { name: "My rating", level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page.getByTestId("technician-home")).toBeVisible();
    // None of these pages carries the site header or footer any more.
    await expect(page.getByText("ResQNow Technician Portal. All rights reserved.")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("language: Tamil and Hindi change the words, and the choice stays", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors } = await signIn(page);
    await page.goto("/technician/dashboard");
    const duty = page.getByTestId("technician-duty");
    await expect(duty.getByText("ON DUTY")).toBeVisible();

    await page.getByRole("button", { name: "Change language" }).click();
    const sheet = page.getByRole("dialog", { name: "Choose your language" });
    await expect(sheet.getByRole("radio")).toHaveText([/English/, /தமிழ்/, /हिंदी/]);
    await expect(sheet.getByRole("radio", { name: /English/ })).toHaveAttribute("aria-checked", "true");
    await shot(page, "language");
    await sheet.getByRole("radio", { name: /தமிழ்/ }).click();
    await expect(sheet).toHaveCount(0);

    await expect(duty.getByText("வேலைக்குத் தயார்")).toBeVisible();
    await expect(page.getByTestId("technician-today")).toContainText("இன்றைய வருமானம்");
    await expect(page.getByTestId("technician-today")).toContainText("₹494");
    await expect(page.getByTestId("technician-nav").locator(".tp-tab > span:last-child")).toHaveText(["முகப்பு", "பணம்", "வேலைகள்", "நான்"]);
    await shot(page, "home-tamil");
    expect(await fitsWidth(page)).toBe(true);

    // The choice is kept on this phone and holds on the other pages.
    await page.reload();
    await expect(duty.getByText("வேலைக்குத் தயார்")).toBeVisible();
    await page.getByTestId("technician-nav").getByRole("button", { name: "பணம்" }).click();
    await expect(page.getByRole("heading", { name: "என் பணம்", level: 1 })).toBeVisible();
    expect(await fitsWidth(page)).toBe(true);

    await page.getByTestId("technician-nav").getByRole("button", { name: "நான்" }).click();
    await page.getByRole("button", { name: /மொழி/ }).click();
    await page.getByRole("dialog").getByRole("radio", { name: /हिंदी/ }).click();
    await expect(page.getByRole("button", { name: /भाषा/ })).toBeVisible();
    await page.getByTestId("technician-nav").getByRole("button", { name: "होम" }).click();
    await expect(duty.getByText("ड्यूटी चालू है")).toBeVisible();
    await shot(page, "home-hindi");
    expect(await fitsWidth(page)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("messages: the bell opens them, new ones first, and Back returns home", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors } = await signIn(page);
    await page.goto("/technician/dashboard");
    await page.getByRole("button", { name: "Messages, 1 new" }).click();
    await expect(page).toHaveURL(/\/technician\/dashboard\?view=messages$/);

    const messages = page.getByTestId("technician-messages");
    await expect(messages.getByRole("heading", { name: "Messages" })).toBeVisible();
    await expect(messages.locator(".tp-day")).toHaveText(["New", "Before"]);
    await expect(messages.locator(".tp-list").first()).toContainText("₹315 added to your wallet");
    await expect(messages.locator(".tp-list").last()).toContainText("Payout sent");
    await shot(page, "messages");
    await expect(page.getByTestId("technician-home")).toHaveCount(0);

    await messages.getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("technician-home")).toBeVisible();
    await expect(page).toHaveURL(/\/technician\/dashboard$/);
    expect(errors).toEqual([]);
  });

  test("things to do first: the phone setting for job alerts, and a fee to pay", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors, calls } = await signIn(page, { pendingDues: 120, notification: "default" });
    await page.goto("/technician/dashboard");

    const banner = page.getByTestId("job-alerts-banner");
    await expect(banner.getByText("Don’t miss a job")).toBeVisible();
    await expect(banner.getByText("Turn on notifications")).toBeVisible();
    await shot(page, "todo");
    // This time they answer Allow.
    await page.evaluate(() => Object.assign(window, { __notificationAnswer: "granted" }));
    await banner.getByRole("button", { name: "Turn on" }).click();
    await expect(banner).toHaveCount(0);

    const fee = page.getByTestId("technician-dues");
    await expect(fee.getByText("You need to pay ₹120")).toBeVisible();
    await fee.getByRole("button", { name: "Pay ₹120 now" }).click();
    await expect.poll(() => calls.filter((call) => call.path === "/api/technicians/me/pay-dues/order").length).toBe(1);
    // The server says nothing is owed any more: the note goes.
    await expect(fee).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("the alerts note can be put away for this visit", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors } = await signIn(page, { notification: "default" });
    await page.goto("/technician/dashboard");
    const banner = page.getByTestId("job-alerts-banner");
    await expect(banner).toBeVisible();
    await banner.getByRole("button", { name: "Hide for now" }).click();
    await expect(banner).toHaveCount(0);
    await page.reload();
    await expect(page.getByTestId("technician-home")).toBeVisible();
    await expect(banner).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("my money: what is ready, where the rest is, the week, requests, and money in and out", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors } = await signIn(page);
    await page.goto("/technician/earnings");

    await expect(page.getByTestId("money-ready")).toHaveText("₹3,120");
    const where = page.getByTestId("money-where").locator(".tp-row");
    await expect(where.nth(0)).toContainText("Waiting to be paid");
    await expect(where.nth(0)).toContainText("₹500");
    await expect(where.nth(1)).toContainText("Paid to you so far");
    await expect(where.nth(1)).toContainText("₹9,220");
    // The one request that was not approved.
    await expect(where.nth(2)).toContainText("₹800");

    const earned = page.getByTestId("money-earned");
    await expect(earned.locator(".tp-bar")).toHaveCount(7);
    await expect(earned.locator(".tp-bar.is-today")).toContainText("₹494");
    await expect(earned.locator(".tp-bar.is-today")).toContainText("Today");
    await expect(earned.locator(".tp-row").nth(0)).toHaveText("Today₹494");
    // 620 + 890 + 710 + 269 + 442 + 449 + 494.
    await expect(earned.locator(".tp-row").nth(1)).toHaveText("Last 7 days₹3,874");
    await expect(earned.locator(".tp-row").nth(2)).toHaveText("All time₹12,840");

    const asked = page.getByTestId("money-asked").locator(".tp-row");
    await expect(asked).toHaveCount(3);
    await expect(asked.nth(0)).toContainText("₹500");
    await expect(asked.nth(0)).toContainText("No. WD-1043");
    await expect(asked.nth(0)).toContainText("arun@upi");
    await expect(asked.nth(0).locator(".tp-state")).toHaveText("Waiting");
    await expect(asked.nth(1).locator(".tp-state")).toContainText("Paid");
    await expect(asked.nth(1)).toContainText("UTR52790041");
    await expect(asked.nth(2).locator(".tp-state")).toHaveText("Not given");
    await expect(asked.nth(2)).toContainText("Not given: UPI name did not match.");

    const activity = page.getByTestId("money-activity").locator(".tp-row");
    await expect(activity).toHaveCount(3);
    await expect(activity.nth(0)).toContainText("Flat tyre");
    await expect(activity.nth(0)).toContainText("+₹315");
    await expect(activity.nth(0)).toContainText("Now ₹3,620");
    // Paise are never rounded away.
    await expect(activity.nth(1)).toContainText("+₹179.50");
    await expect(activity.nth(2)).toContainText("Paid to you");
    await expect(activity.nth(2)).toContainText("−₹2,000");
    await shot(page, "money");

    await expect(page.getByText("Wallet & Withdrawals")).toHaveCount(0);
    expect(await fitsWidth(page)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("take money out: an amount, a note, and the request goes as before", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors, calls } = await signIn(page);
    await page.goto("/technician/earnings");
    await page.getByRole("button", { name: "Take money out" }).click();

    const sheet = page.getByRole("dialog", { name: "Take money out" });
    await expect(sheet.getByText("How much do you want? You have ₹3,120.")).toBeVisible();
    const amount = sheet.getByRole("spinbutton", { name: "Amount in rupees" });
    // It starts with everything that is ready.
    await expect(amount).toHaveValue("3120.00");
    await expect(sheet.getByText("Goes to arun@upi")).toBeVisible();

    await sheet.getByRole("button", { name: "₹1,000" }).click();
    await expect(amount).toHaveValue("1000");
    await expect(sheet.getByRole("button", { name: "Take out ₹1,000" })).toBeVisible();
    await shot(page, "take");
    await sheet.getByRole("textbox", { name: "Note for ResQNow (if you want)" }).fill("For tyre stock");
    await sheet.getByRole("button", { name: "Take out ₹1,000" }).click();

    await expect(sheet).toHaveCount(0);
    const sent = calls.filter((call) => call.method === "POST" && call.path === "/api/technicians/me/withdrawals");
    expect(sent).toHaveLength(1);
    expect(sent[0].body).toMatchObject({ amount: 1000, note: "For tyre stock" });
    expect(String((sent[0].body as { idempotencyKey?: string }).idempotencyKey || "")).not.toBe("");
    expect(errors).toEqual([]);
  });

  test("my jobs: what is open now, then every job by day, with three ways to look", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors } = await signIn(page);
    await page.goto("/technician/history");

    // The same counts the old Order Overview showed: 1 pending, none assigned, 1 accepted, none in progress.
    await expect(page.getByTestId("jobs-now").locator("div")).toHaveText(["1New", "0Assigned", "1Accepted", "0Working"]);
    const filters = page.getByRole("radiogroup", { name: "Show" }).getByRole("radio");
    await expect(filters).toHaveText(["5All", "3Done", "1Cancelled"]);

    const rows = page.getByTestId("job-row");
    await expect(rows).toHaveCount(5);
    await expect(page.locator(".tp-day").filter({ hasText: /^Today$/ })).toHaveCount(1);
    await expect(page.locator(".tp-day").filter({ hasText: /^Yesterday$/ })).toHaveCount(1);
    await expect(rows.nth(0)).toContainText("Flat tyre");
    await expect(rows.nth(0)).toContainText("Maruti Swift");
    await expect(rows.nth(0)).toContainText("Race Course Road");
    await expect(rows.nth(0)).toContainText("₹315");
    await expect(rows.nth(0).locator(".tp-state")).toContainText("Done");
    await expect(rows.nth(2).locator(".tp-state")).toContainText("Cancelled");
    await expect(rows.nth(3).locator(".tp-state")).toContainText("You said no");
    await shot(page, "jobs");

    await filters.nth(1).click();
    await expect(rows).toHaveCount(3);
    await expect(page.locator('[data-testid="job-row"][data-status="cancelled"]')).toHaveCount(0);
    await filters.nth(2).click();
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Lockout");
    await filters.nth(0).click();
    await expect(rows).toHaveCount(5);

    await expect(page.getByText("Job History")).toHaveCount(0);
    expect(await fitsWidth(page)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("my rating: the average, reaching on time, and what customers said", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors } = await signIn(page);
    await page.goto("/technician/reviews");

    const average = page.getByTestId("rating-average");
    await expect(average.locator("b")).toHaveText("4.7");
    await expect(average).toContainText("from 3 customers");
    // Five requests count (the cancelled one does not); one finished after its deadline.
    const onTime = page.getByTestId("rating-on-time");
    await expect(onTime).toContainText("4 of 5 jobs on time");
    await expect(onTime).toContainText("On time · 4");
    await expect(onTime).toContainText("Late · 1");
    await expect(onTime).toContainText("Last job:");

    const said = page.getByTestId("rating-reviews").locator(".tp-review");
    await expect(said).toHaveCount(3);
    await expect(said.nth(0)).toContainText("Asha");
    await expect(said.nth(0)).toContainText("Came quickly and fixed the puncture in ten minutes.");
    await expect(said.nth(1).getByRole("img", { name: "4 stars" })).toBeVisible();
    await shot(page, "rating");
    expect(await fitsWidth(page)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("me: who you are, then details, work, alerts, screen and password, each saving as before", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors, calls } = await signIn(page);
    await page.goto("/technician/profile");

    const me = page.getByTestId("technician-me");
    await expect(me.getByRole("heading", { name: "Arun Kumar" })).toBeVisible();
    await expect(me).toContainText("ID RQT-0007");
    await expect(me).toContainText("arun@example.test");
    await expect(me.locator(".tp-tags")).toContainText("Verified");
    await expect(me.locator(".tp-tags")).toContainText("4.7");
    await expect(me.locator(".tp-tags")).toContainText("202 points");
    await expect(me.getByRole("link", { name: "Call ResQNow for help" })).toHaveAttribute("href", "tel:+919566510080");
    await shot(page, "me");
    expect(await fitsWidth(page)).toBe(true);

    // My details: the same fields, saved with the same request.
    await me.getByRole("button", { name: /My details/ }).click();
    const details = page.getByTestId("technician-details");
    await expect(details.getByRole("textbox", { name: "Full name" })).toHaveValue("Arun Kumar");
    await expect(details.getByRole("textbox", { name: "Email" })).toBeDisabled();
    await expect(details.getByRole("spinbutton", { name: "How far you will go (km)" })).toHaveValue("10");
    await expect(details.getByRole("button", { name: "Gallery" })).toBeVisible();
    await expect(details.getByRole("button", { name: "Camera" })).toBeVisible();
    await shot(page, "details");
    await details.getByRole("textbox", { name: "Phone number" }).fill("9876511111");
    await details.getByRole("spinbutton", { name: "Years of experience" }).fill("7");
    await details.getByRole("button", { name: "Save" }).click();
    await expect.poll(() => calls.filter((call) => call.path === "/api/technicians/me/profile").length).toBe(1);
    expect(calls.find((call) => call.path === "/api/technicians/me/profile")).toEqual({
      method: "PATCH",
      path: "/api/technicians/me/profile",
      body: { name: "Arun Kumar", phone: "9876511111", address: "14 Gandhipuram, Coimbatore", service_area_range: 10, experience: 7 },
    });
    await details.getByRole("button", { name: "Back" }).click();

    // My work.
    await me.getByRole("button", { name: /My work/ }).click();
    const work = page.getByTestId("technician-work");
    await expect(work.locator(".tp-amounts .tp-row")).toHaveText([/^Documents.*Verified$/, "Jobs done38", "Total earned₹12,840"]);
    await expect(work).toContainText("Flat tyre");
    await shot(page, "work");
    await work.getByRole("button", { name: "Back" }).click();

    // Job alerts: each switch saves its own setting.
    await me.getByRole("button", { name: /Job alerts/ }).click();
    const alerts = page.getByTestId("technician-alerts");
    const emails = alerts.getByRole("switch", { name: "Emails" });
    await expect(emails).toHaveAttribute("aria-checked", "true");
    await shot(page, "alerts");
    await emails.click();
    await expect(emails).toHaveAttribute("aria-checked", "false");
    await alerts.getByRole("button", { name: "Back" }).click();

    // Screen: the theme, and the bar at the bottom.
    await me.getByRole("button", { name: /Screen/ }).click();
    const screen = page.getByTestId("technician-screen");
    await expect(screen.getByRole("radio", { name: "Light" })).toHaveAttribute("aria-checked", "true");
    await shot(page, "screen");
    await screen.getByRole("radio", { name: "Dark" }).click();
    await expect(screen.getByRole("radio", { name: "Dark" })).toHaveAttribute("aria-checked", "true");
    await screen.getByRole("radio", { name: "Light" }).click();
    const bar = page.getByTestId("technician-nav");
    await expect(bar).toBeVisible();
    await screen.getByRole("switch", { name: "Show the bottom bar" }).click();
    await expect(bar).toHaveCount(0);
    await expect(screen.getByRole("switch", { name: "Hide it while scrolling" })).toBeDisabled();
    // Without the bar there is still a way home.
    await expect(page.getByRole("link", { name: "Home" })).toBeVisible();
    await screen.getByRole("switch", { name: "Show the bottom bar" }).click();
    await expect(bar).toBeVisible();
    await screen.getByRole("button", { name: "Back" }).click();

    expect(calls.filter((call) => call.path === "/api/technicians/me/settings").map((call) => call.body)).toEqual([
      { notifications: { email_notifications: false } },
      { appearance: { theme: "dark" } },
      { appearance: { theme: "light" } },
      { navigation: { mobile_bottom_nav_enabled: false } },
      { navigation: { mobile_bottom_nav_enabled: true } },
    ]);

    await me.getByRole("button", { name: /Password and app data/ }).click();
    const security = page.getByTestId("technician-security");
    await expect(security.getByRole("button", { name: "Change password" })).toBeVisible();
    await shot(page, "security");
    await security.getByRole("button", { name: "Clear app data" }).click();
    await expect(page.getByText("Cache cleared")).toBeVisible();
    await security.getByRole("button", { name: "Back" }).click();

    await me.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(await page.evaluate(() => localStorage.getItem("resqnow_technician"))).toBeNull();
    expect(errors).toEqual([]);
  });

  test("the old links to a profile tab still open that page", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors } = await signIn(page);
    await page.goto("/technician/settings");
    await expect(page).toHaveURL(/\/technician\/profile\?tab=appearance$/);
    await expect(page.getByTestId("technician-screen")).toBeVisible();
    await page.goto("/technician/profile?tab=profile");
    await expect(page.getByTestId("technician-details")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("before approval: the documents page, with no way into the app", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors } = await signIn(page, { technician: { verification_status: "pending" } });
    await page.goto("/technician/dashboard");
    await expect(page).toHaveURL(/\/technician\/verification$/);

    const status = page.getByTestId("technician-verification");
    await expect(status.getByRole("heading", { name: "Your documents", exact: true })).toBeVisible();
    await expect(status.getByText("We are checking your documents")).toBeVisible();
    await expect(status.locator(".tp-steps li")).toHaveCount(3);
    await shot(page, "verify");
    await expect(status.getByRole("link", { name: "Call ResQNow for help" })).toBeVisible();
    await expect(page.getByTestId("technician-nav")).toHaveCount(0);
    expect(await fitsWidth(page)).toBe(true);
    expect(errors).toEqual([]);
  });

  test("not approved: what happened and who to talk to", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors } = await signIn(page, { technician: { verification_status: "rejected" } });
    await page.goto("/technician/verification");
    const status = page.getByTestId("technician-verification");
    await expect(status.getByText("Not approved yet")).toBeVisible();
    await expect(status.getByRole("link", { name: "Contact support" })).toHaveAttribute("href", "/contact");
    await shot(page, "verify-no");
    expect(errors).toEqual([]);
  });
});

test.describe("towing operator", () => {
  const towing = { technician: { service_type: "towing", specialties: ["towing"] } };

  test("home has vehicles and a team; a vehicle can be added, changed and removed", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors, calls } = await signIn(page, towing);
    await page.goto("/technician/dashboard");

    const home = page.getByTestId("technician-home");
    await expect(home.getByRole("button", { name: /My vehicles/ })).toContainText("2 tow trucks");
    await expect(home.getByRole("button", { name: /My team/ })).toContainText("2 people");
    await shot(page, "home-towing");
    await home.getByRole("button", { name: /My vehicles/ }).click();
    await expect(page).toHaveURL(/\?view=fleet$/);

    const fleet = page.getByTestId("technician-fleet");
    await expect(fleet.getByText("2 tow trucks · 1 free now")).toBeVisible();
    const rows = fleet.getByTestId("fleet-vehicle");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toContainText("Flatbed");
    await expect(rows.nth(0)).toContainText("TN37TR1001");
    await expect(rows.nth(0)).toContainText("#V-01 · 3.5 ton");
    await expect(rows.nth(0).locator(".tp-state")).toContainText("Free");
    await expect(rows.nth(1).locator(".tp-state")).toContainText("On a job");
    await shot(page, "fleet");
    expect(await fitsWidth(page)).toBe(true);

    // Add.
    await fleet.getByRole("button", { name: "Add a vehicle" }).click();
    const add = page.getByRole("dialog", { name: "Add a vehicle" });
    await add.getByRole("radio", { name: "Recovery" }).click();
    await add.getByRole("textbox", { name: "Number plate" }).fill("tn37tr1003");
    await add.getByRole("textbox", { name: "How much it can carry (if you know)" }).fill("5 ton");
    await add.getByRole("radio", { name: "Not in use" }).click();
    await shot(page, "vehicle");
    await add.getByRole("button", { name: "Save vehicle" }).click();
    await expect(add).toHaveCount(0);
    expect(calls).toContainEqual({
      method: "POST",
      path: "/api/technicians/vehicles",
      body: { vehicle_type: "recovery", vehicle_number: "TN37TR1003", capacity: "5 ton", status: "offline" },
    });

    // Change: the sheet opens with what is saved.
    await rows.nth(0).getByRole("button", { name: "Change" }).click();
    const change = page.getByRole("dialog", { name: "Change this vehicle" });
    await expect(change.getByRole("textbox", { name: "Number plate" })).toHaveValue("TN37TR1001");
    await expect(change.getByRole("radio", { name: "Flatbed" })).toHaveAttribute("aria-checked", "true");
    await change.getByRole("radio", { name: "On a job" }).click();
    await change.getByRole("button", { name: "Save vehicle" }).click();
    await expect(change).toHaveCount(0);
    expect(calls).toContainEqual({
      method: "PATCH",
      path: "/api/technicians/vehicles/v1",
      body: { vehicle_type: "flatbed", vehicle_number: "TN37TR1001", capacity: "3.5 ton", status: "busy" },
    });

    // Remove: asked once, as before.
    page.once("dialog", (dialog) => void dialog.accept());
    await rows.nth(0).getByRole("button", { name: "Change" }).click();
    await page.getByRole("dialog", { name: "Change this vehicle" }).getByRole("button", { name: "Remove this vehicle" }).click();
    await expect.poll(() => calls.some((call) => call.method === "DELETE" && call.path === "/api/technicians/vehicles/v1")).toBe(true);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await fleet.getByRole("button", { name: "Back" }).click();
    await expect(page.getByTestId("technician-home")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the team: call, add, change and remove a person", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors, calls } = await signIn(page, towing);
    await page.goto("/technician/dashboard?view=team");

    const team = page.getByTestId("technician-team");
    await expect(team.getByText("2 people · 1 working now")).toBeVisible();
    const people = team.getByTestId("team-person");
    await expect(people).toHaveCount(2);
    await expect(people.nth(0)).toContainText("Selvam R");
    await expect(people.nth(0)).toContainText("Driver · TN37TR1001");
    await expect(people.nth(0).locator(".tp-state")).toHaveText("Working");
    await expect(people.nth(0).getByRole("link", { name: "Call Selvam R" })).toHaveAttribute("href", "tel:+919876500011");
    await expect(people.nth(1)).toContainText("Helper · no vehicle");
    await expect(people.nth(1).locator(".tp-state")).toHaveText("Not working");
    await shot(page, "team");
    expect(await fitsWidth(page)).toBe(true);

    await team.getByRole("button", { name: "Add a person" }).click();
    const add = page.getByRole("dialog", { name: "Add a person" });
    await add.getByRole("textbox", { name: "Name" }).fill("Mani K");
    await add.getByRole("textbox", { name: "Phone number" }).fill("+91 98765 00013");
    await add.getByRole("radio", { name: "Helper" }).click();
    await add.getByRole("combobox", { name: "Which vehicle?" }).selectOption("v2");
    await add.getByRole("button", { name: "Save" }).click();
    await expect(add).toHaveCount(0);
    expect(calls).toContainEqual({
      method: "POST",
      path: "/api/technicians/employees",
      body: { name: "Mani K", phone: "+91 98765 00013", role: "helper", status: "active", assigned_vehicle: "v2" },
    });

    await people.nth(0).getByRole("button", { name: "Change" }).click();
    const change = page.getByRole("dialog", { name: "Change this person" });
    await expect(change.getByRole("textbox", { name: "Name" })).toHaveValue("Selvam R");
    await expect(change.getByRole("combobox", { name: "Which vehicle?" })).toHaveValue("v1");
    await shot(page, "person");
    await change.getByRole("radio", { name: "Not working" }).click();
    await change.getByRole("button", { name: "Save" }).click();
    await expect(change).toHaveCount(0);
    expect(calls).toContainEqual({
      method: "PATCH",
      path: "/api/technicians/employees/e1",
      body: { name: "Selvam R", phone: "+91 98765 00011", role: "driver", status: "offline", assigned_vehicle: "v1" },
    });

    page.once("dialog", (dialog) => void dialog.accept());
    await people.nth(0).getByRole("button", { name: "Change" }).click();
    await page.getByRole("dialog", { name: "Change this person" }).getByRole("button", { name: "Remove this person" }).click();
    await expect.poll(() => calls.some((call) => call.method === "DELETE" && call.path === "/api/technicians/employees/e1")).toBe(true);
    expect(errors).toEqual([]);
  });

  test("someone who does not tow cannot open the vehicles page", async ({ page }) => {
    await fakeSocketServer(page);
    const { errors } = await signIn(page);
    await page.goto("/technician/dashboard?view=fleet");
    await expect(page.getByTestId("technician-home")).toBeVisible();
    await expect(page.getByTestId("technician-fleet")).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
