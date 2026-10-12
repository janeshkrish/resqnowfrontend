import { expect, test, type Page } from "@playwright/test";

const SHOTS = process.env.PAGES_SHOTS_DIR;

type Request = Record<string, unknown> & { id: number };

const tech = (id: number, name: string) => ({ id, name, phone: "+91 98765 43210", rating: 4.8 });
const done = (id: number, service: string, vehicle: string, kind: string, day: string, name: string, reviewed: boolean): Request => ({
  id, service_type: service, vehicle_type: kind, vehicle_model: vehicle, address: "Race Course Road, Coimbatore", status: "completed", payment_status: "completed",
  created_at: `${day}T07:30:00Z`, technician: tech(id + 100, name), has_review: reviewed,
});

// Noon-ish times, so the day shown is the same in every time zone the tests run in.
const onTheWay = (): Request => ({
  // Spelled the way the request form saves it, with the kind of vehicle in front.
  id: 5502, service_type: "commercial-lockout", vehicle_type: "commercial", vehicle_model: "Tata Yodha", address: "Bharathi Nagar, Coimbatore",
  status: "on_the_way", payment_status: "pending", created_at: "2026-10-05T07:30:00Z", technician: tech(9, "Arun Kumar"),
});
const paymentDue = (): Request => ({
  id: 5498, service_type: "flat-tire", vehicle_type: "bike", vehicle_model: "Honda Shine", status: "completed", payment_status: "pending",
  created_at: "2026-10-05T06:30:00Z", technician: tech(12, "Karthik"),
});
const finding = (): Request => ({ id: 5505, service_type: "battery", vehicle_type: "car", vehicle_model: "Maruti Swift", status: "pending", created_at: "2026-10-05T07:45:00Z", technician: null });
const earlier = (): Request[] => [
  done(5488, "towing", "Maruti Swift", "car", "2026-10-01", "Selvam", false),
  done(5481, "fuel", "Honda Activa 6G", "bike", "2026-10-01", "Mani", true),
  { id: 5467, service_type: "flat-tire", vehicle_type: "commercial", vehicle_model: "Ashok Leyland Dost", status: "cancelled", created_at: "2026-09-28T07:30:00Z", technician: null },
  done(5440, "ev-charging", "Tata Nexon EV", "ev", "2026-09-24", "Ravi", false),
  done(5431, "battery", "Hyundai i20", "car", "2026-09-19", "Arun", true),
];

type Options = { requests?: Request[]; alerts?: "default" | "granted"; failAfterFirst?: boolean };

async function openActivity(page: Page, { requests = [onTheWay(), ...earlier()], alerts = "granted", failAfterFirst = false }: Options = {}) {
  const calls: string[] = [];
  const errors: string[] = [];
  let lists = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  // A signed-in customer: the test token only ever reaches the mocked API below.
  await page.addInitScript((permission) => {
    localStorage.setItem("resqnow_user_token", "e2e-customer-token");
    // The phone's own answer about alerts, so the test does not depend on the browser's.
    const asked = { permission, requestPermission: async () => { asked.permission = "granted"; return "granted"; } };
    Object.defineProperty(window, "Notification", { configurable: true, writable: true, value: asked });
  }, alerts);
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (method !== "GET") calls.push(`${method} ${url.pathname} ${request.postData() ?? ""}`.trim());
    if (url.pathname === "/api/auth/me") return reply(200, { id: 41, name: "Asha", email: "asha@example.test", isVerified: true });
    if (url.pathname === "/api/service-requests" && method === "GET") {
      lists += 1;
      return failAfterFirst && lists > 1 ? reply(500, {}) : reply(200, requests);
    }
    if (url.pathname === "/api/users/reviews" && method === "POST") {
      const body = JSON.parse(request.postData() || "{}");
      requests = requests.map((entry) => (entry.id === body.request_id ? { ...entry, has_review: true } : entry));
      return reply(200, { message: "Thank you for your feedback!" });
    }
    if (url.pathname === "/api/users/me/settings") return reply(200, {});
    return reply(404, {});
  });
  await page.goto("/my-requests");
  return { calls, errors };
}

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-activity-${name}.png`, fullPage: false });
};

test("one screen: the request in progress, who to rate, and the latest earlier requests", async ({ page, isMobile }) => {
  const { calls, errors } = await openActivity(page);

  await expect(page.getByRole("heading", { name: "Activity", level: 1 })).toBeVisible();
  await expect(page.getByText("1 in progress · 5 earlier")).toBeVisible();
  await expect(page.getByText("Live", { exact: true })).toBeVisible();

  // The request in progress: what is happening, how far along, and the one thing to do.
  const job = page.getByRole("article", { name: "Lockout: Arun is on the way" });
  await expect(job.getByText(/^Lockout · Tata Yodha · \d{1,2}:\d{2} (am|pm)$/)).toBeVisible();
  await expect(job.getByRole("list", { name: "Step 2 of 4" })).toBeVisible();
  await expect(job.locator(".rq-av-steps li.is-now")).toHaveText("On the way");
  await expect(job.locator(".rq-av-art img")).toHaveAttribute("src", "/images/home/services/lockout.webp");
  await expect(job.getByRole("link", { name: "Call Arun" })).toHaveAttribute("href", "tel:+919876543210");
  await expect(job.getByRole("button", { name: "Track live" })).toBeVisible();

  // The latest three earlier requests, each with its own action.
  await expect(page.locator(".rq-av-row")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "Towing · Maruti Swift · 1 Oct", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ask for Fuel again" })).toHaveAttribute("href", "/request-service/fuel/bike");
  await expect(page.locator(".rq-av-row.is-void")).toContainText("Cancelled");

  expect(await noSideScroll(page)).toBe(true);
  if (isMobile) {
    // The page brings its own heading, and everything fits without scrolling.
    await expect(page.getByAltText("ResQNow Logo")).toBeHidden();
    await expect(page.getByRole("link", { name: /activity/i })).toHaveAttribute("aria-current", "page");
    await expect(page.locator(".rq-av-row").last()).toBeInViewport({ ratio: 1 });
  }
  await shot(page, "live");

  // Two technicians still to rate; tapping the fourth star opens the rating with four chosen.
  await expect(page.getByRole("heading", { name: "Rate your technicians" })).toBeVisible();
  await page.getByRole("group", { name: "Rate Selvam" }).getByRole("button", { name: "4 stars" }).click();
  const sheet = page.getByRole("dialog", { name: "How was Selvam?" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("Towing · Maruti Swift · 1 Oct")).toBeVisible();
  await expect(sheet.getByRole("radio", { name: "4 stars" })).toBeChecked();
  await expect(sheet.getByText("Very good")).toBeVisible();
  await shot(page, "rate");
  await sheet.getByRole("radio", { name: "5 stars" }).click();
  await sheet.getByRole("textbox").fill("Quick and careful");
  await sheet.getByRole("button", { name: "Send rating" }).click();
  await expect(sheet).toHaveCount(0);
  expect(calls).toContain('POST /api/users/reviews {"technician_id":5588,"rating":5,"comment":"Quick and careful","request_id":5488}');
  // One left to rate, and the rated request now offers "Ask again".
  await expect(page.getByRole("heading", { name: "Rate your technician", exact: true })).toBeVisible();
  await expect(page.getByRole("group", { name: "Rate Selvam" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ask for Towing again" })).toHaveAttribute("href", "/request-service/towing/car");

  // Track live opens the request.
  await job.getByRole("button", { name: "Track live" }).click();
  await expect(page).toHaveURL(/\/service-tracking\/5502$/);
  expect(errors).toEqual([]);
});

test("See all shows every earlier request, by month, with filters", async ({ page }) => {
  const { errors } = await openActivity(page);
  await page.getByRole("button", { name: "See all 5" }).click();
  await expect(page).toHaveURL(/\/my-requests\?view=all$/);

  await expect(page.getByRole("heading", { name: "All requests" })).toBeVisible();
  await expect(page.locator(".rq-av-row")).toHaveCount(5);
  await expect(page.getByRole("heading", { name: "October 2026" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "September 2026" })).toBeVisible();
  const show = page.getByRole("radiogroup", { name: "Show" });
  await expect(show.getByRole("radio", { name: "All 5" })).toBeChecked();
  await shot(page, "all");

  await show.getByRole("radio", { name: "Cancelled 1" }).click();
  await expect(page.locator(".rq-av-row")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Flat tyre · Ashok Leyland Dost · 28 Sep, cancelled" })).toBeVisible();
  await show.getByRole("radio", { name: "Completed 4" }).click();
  await expect(page.locator(".rq-av-row")).toHaveCount(4);
  // An unrated one can be rated from here too.
  await page.getByRole("button", { name: /^Rate Ravi for EV charge/ }).click();
  await expect(page.getByRole("dialog", { name: "How was Ravi?" })).toBeVisible();
  await page.keyboard.press("Escape");

  // A finished request opens its summary; Back returns to the list, and Back again to Activity.
  await page.getByRole("button", { name: "Battery · Hyundai i20 · 19 Sep", exact: true }).click();
  await expect(page).toHaveURL(/\/service-summary\/5431$/);
  await page.goBack();
  await expect(page.getByRole("heading", { name: "All requests" })).toBeVisible();
  await page.getByRole("button", { name: "Back to Activity" }).click();
  await expect(page.getByRole("heading", { name: "Activity", level: 1 })).toBeVisible();
  await expect(page).toHaveURL(/\/my-requests$/);
  expect(errors).toEqual([]);
});

test("two requests at once: payment due, and still finding a technician", async ({ page }) => {
  const { errors } = await openActivity(page, { requests: [paymentDue(), finding(), ...earlier()] });

  await expect(page.getByText("2 in progress · 5 earlier")).toBeVisible();
  // Newest first: the one still finding a technician has nobody to call.
  const search = page.getByRole("article", { name: "Battery: Finding a technician" });
  await expect(search.locator(".rq-av-steps li.is-now")).toHaveText("Finding");
  await expect(search.getByRole("button", { name: "View request" })).toBeVisible();
  await expect(search.getByRole("link", { name: /Call/ })).toHaveCount(0);
  const pay = page.getByRole("article", { name: "Flat tyre: Work finished. Payment is due" });
  await expect(pay.locator(".rq-av-steps li.is-now")).toHaveText("Done");
  await expect(pay.getByRole("link", { name: "Call Karthik" })).toBeVisible();
  // With two cards on screen the rating row steps aside.
  await expect(page.getByRole("heading", { name: /Rate your technician/ })).toHaveCount(0);
  await expect(page.locator(".rq-av-row")).toHaveCount(2);
  await shot(page, "two");

  await pay.getByRole("button", { name: "Pay now" }).click();
  await expect(page).toHaveURL(/\/payment\/5498$/);
  expect(errors).toEqual([]);
});

test("nothing in progress, and a customer with no requests at all", async ({ page }) => {
  const { errors } = await openActivity(page, { requests: earlier() });
  await expect(page.getByText("5 requests so far")).toBeVisible();
  await expect(page.getByText("Nothing in progress right now.")).toBeVisible();
  await expect(page.getByText("Live", { exact: true })).toHaveCount(0);
  await expect(page.locator(".rq-av-row")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "See all 5" })).toBeVisible();
  await shot(page, "idle");
  expect(errors).toEqual([]);

  const fresh = await page.context().newPage();
  const second = await openActivity(fresh, { requests: [] });
  await expect(fresh.getByRole("heading", { name: "No requests yet" })).toBeVisible();
  await expect(fresh.getByRole("link", { name: "Get help" }).last()).toHaveAttribute("href", "/services");
  await expect(fresh.locator(".rq-av-new img")).toHaveAttribute("src", "/images/vehicles/car.webp");
  expect(second.errors).toEqual([]);
  await fresh.close();
});

test("alerts can be turned on from the page, and a dropped connection is said plainly", async ({ page }) => {
  const { errors } = await openActivity(page, { alerts: "default", failAfterFirst: true });

  await expect(page.getByText("Get an alert when help arrives")).toBeVisible();
  // The prompt takes a little room, so one earlier request fewer is shown.
  await expect(page.locator(".rq-av-row")).toHaveCount(2);
  await shot(page, "alerts");
  await page.getByRole("button", { name: "Turn on" }).click();
  await expect(page.getByText("Get an alert when help arrives")).toHaveCount(0);
  expect(await page.evaluate(() => Notification.permission)).toBe("granted");

  // The next refresh fails: the page keeps what it has and says it is reconnecting.
  await expect(page.getByText("Reconnecting…")).toBeVisible();
  await expect(page.getByRole("article", { name: "Lockout: Arun is on the way" })).toBeVisible();
  expect(errors).toEqual([]);
});
