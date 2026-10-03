import { readFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

import { TECHNICIAN, fakeSocketServer, stripValue } from "./fixtures/technicianPortal";

const fakeMappls = readFileSync(new URL("./fixtures/fakeMapplsSdk.js", import.meta.url), "utf8");
const HOME = { latitude: 11.0168, longitude: 76.9558 };
test.use({ geolocation: HOME, permissions: ["geolocation"] });

type Job = Record<string, unknown>;
type Call = { method: string; path: string; body: unknown };

// What GET /api/technicians/me/active-job returns (resqnowbackend buildActiveJobResponse).
const lockout: Job = {
  id: "7201", requestId: "7201", status: "accepted", jobStatus: "accepted", isTowing: false,
  customerName: "Karthik", serviceType: "car-lockout", phoneNumber: "9876543210",
  address: "Brookefields Mall parking, Krishnasamy Road, Coimbatore",
  pickupLatitude: 11.0092, pickupLongitude: 76.9605, amount: 399, vehicle_type: "car",
  vehicleLine: "Hyundai Creta · Compact SUV", vehicleBrand: "Hyundai", vehicleName: "Hyundai Creta",
  problem: ["Someone inside", "Key locked in"],
  answers: [{ id: "inside", question: "Is a child, person or pet stuck inside?", value: "yes", label: "Someone inside" }],
  landmark: "Basement 2, pillar C14", plate: "TN 38 CK 9090", customerNote: "My child is in the back seat",
  urgent: true, attachments: [],
};

const towing: Job = {
  id: "7202", requestId: "7202", status: "accepted", jobStatus: "accepted", isTowing: true,
  customerName: "Meera", serviceType: "car-towing", phoneNumber: "9876501234",
  address: "21, Race Course Road, Coimbatore", pickupLatitude: 11.0005, pickupLongitude: 76.9665,
  destinationLatitude: 11.0351, destinationLongitude: 76.9712, destinationAddress: "Ganapathy workshop, Sathy Road",
  routeDistanceKm: 4.2, estimatedDuration: 14, amount: 820, technicianEstimatedEarning: 820, vehicle_type: "car",
  vehicleLine: "Maruti Suzuki Swift · Hatchback", towTruckType: "flatbed", towTruckLabel: "Flatbed",
  problem: ["Accident", "Won’t move"], answers: [], landmark: "Opposite the petrol bunk", plate: "TN 66 Q 4821",
  customerNote: null, urgent: false, attachments: [],
};

/** Answers the API from one live job, and from the route the backend would calculate. */
async function openActiveJob(page: Page, job: Job, route = { distanceKm: 3.4, durationMinutes: 9 }, dues = 15) {
  const state = { job: { ...job } as Job | null, routeDown: false };
  const calls: Call[] = [];
  /** Every road route the page asked for: its points and how much detail it wanted. */
  const routes: Array<{ points: string; overview: string | null }> = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem("resqnow_technician_token", "e2e-technician-token"));
  await page.route(/\/src\/lib\/mapProvider\/mapplsSdk\.ts(\?.*)?$/, (r) => r.fulfill({ contentType: "application/javascript", body: fakeMappls }));
  await page.route((url) => url.hostname === "api.e2e.test" && !url.pathname.startsWith("/socket.io"), async (r) => {
    const request = r.request();
    const path = new URL(request.url()).pathname;
    const reply = (status: number, body: unknown) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (request.method() !== "GET") calls.push({ method: request.method(), path, body: request.postDataJSON() });

    if (path === "/api/technicians/me") return reply(200, TECHNICIAN);
    if (path === "/api/technicians/me/active-job" || path === "/api/technician/active-job/7") return reply(200, state.job);
    if (path === "/api/technicians/me/dues") return reply(200, { total: dues });
    if (path === "/api/public/route") {
      const query = new URL(request.url()).searchParams;
      routes.push({ points: String(query.get("points")), overview: query.get("overview") });
      if (state.routeDown) return reply(502, { error: "Route provider failed.", code: "route_failed" });
      return reply(200, { ...route, polyline: [[11.0168, 76.9558], [11.0141, 76.9571], [11.0117, 76.9589], [11.0092, 76.9605]] });
    }
    if (path === "/api/technicians/me/location") return reply(200, { success: true });
    if (request.method() === "PATCH" && /^\/api\/service-requests\/\d+\/technician-status$/.test(path)) {
      // The customer still has to pay after the work is done.
      const asked = String(request.postDataJSON()?.status);
      const next = asked === "completed" ? "payment_pending" : asked;
      if (state.job) state.job = { ...state.job, status: next, jobStatus: next };
      return reply(200, { success: true, status: next, request: { id: state.job?.id, amount: state.job?.amount } });
    }
    if (path === "/api/technicians/requests" || path === "/api/technicians/me/notifications") return reply(200, []);
    return reply(404, {});
  });
  return { state, calls, routes, errors };
}

test("the active job card shows the job's own earnings, route, address, vehicle and answers", async ({ page }) => {
  const { errors } = await openActiveJob(page, lockout);
  await page.goto("/technician/active-job/7201");
  const card = page.getByRole("region", { name: "Active job" });

  await expect(card.getByRole("heading", { name: /car lockout/i })).toBeVisible();
  await expect(card.locator(".tj-status")).toHaveText("Accepted");
  await expect(stripValue(card, "You earn")).toHaveText("₹399");
  // Distance and time come from the road route, and wait for it instead of guessing.
  await expect(stripValue(card, "Distance")).toHaveText("3.4 km");
  await expect(stripValue(card, "Reach in")).toHaveText("9 min");
  await expect(page.locator(".tj-banner")).toContainText("9 min · 3.4 km");

  const location = card.getByTestId("job-location");
  await expect(location).toContainText("Customer location");
  await expect(location).toContainText("Brookefields Mall parking, Krishnasamy Road, Coimbatore");
  await expect(location).toContainText("Basement 2, pillar C14");

  const vehicle = card.getByTestId("job-vehicle");
  await expect(vehicle).toContainText("Hyundai Creta · Compact SUV");
  await expect(vehicle).toContainText("TN 38 CK 9090");
  await expect(vehicle.locator("img")).toHaveAttribute("src", "/images/vehicles/car.webp");

  await expect(card.getByRole("alert")).toContainText("Urgent · Someone is stuck inside the vehicle");
  await expect(card.locator(".tj-line", { hasText: "Customer" }).locator("b")).toHaveText("Karthik");
  await expect(card.getByRole("list", { name: "Customer says" })).toHaveText(/Someone inside\s*Key locked in/);
  await expect(card).toContainText("“My child is in the back seat”");
  await expect(card.getByRole("button", { name: /Platform due · tap to pay/ })).toContainText("₹15");
  await expect(card.getByRole("link", { name: "Call customer" })).toHaveAttribute("href", "tel:9876543210");
  if (process.env.REQUEST_SHOTS_DIR) await page.screenshot({ path: `${process.env.REQUEST_SHOTS_DIR}/${test.info().project.name}-active-job.png` });
  expect(errors).toEqual([]);
});

test("a towing job shows its own figures, the drop point and the truck it needs", async ({ page }) => {
  const { errors } = await openActiveJob(page, towing, { distanceKm: 2.6, durationMinutes: 11 }, 0);
  await page.goto("/technician/active-job/7202");
  const card = page.getByRole("region", { name: "Active job" });

  await expect(stripValue(card, "You earn")).toHaveText("₹820");
  await expect(stripValue(card, "Distance")).toHaveText("2.6 km");
  await expect(stripValue(card, "Reach in")).toHaveText("11 min");
  const location = card.getByTestId("job-location");
  await expect(location).toContainText("Pickup location");
  await expect(location).toContainText("21, Race Course Road, Coimbatore");
  await expect(location).toContainText("Drop · 4.2 km · 14 min");
  await expect(location).toContainText("Ganapathy workshop, Sathy Road");
  await expect(card.getByTestId("job-vehicle")).toContainText("Maruti Suzuki Swift · Hatchback");
  await expect(card.getByTestId("job-vehicle")).toContainText("Flatbed needed");
  await expect(card.getByTestId("job-vehicle")).toContainText("TN 66 Q 4821");
  // Nothing owed: the due line is not a pay button.
  await expect(card.locator("button.tj-line")).toBeDisabled();
  await expect(card.locator("button.tj-line")).toContainText("₹0");
  await expect(card.getByRole("button", { name: "Start pickup" })).toBeEnabled();
  expect(errors).toEqual([]);
});

test("the job keeps its steps: start navigation, I've arrived, complete work, payment, then well done and the dashboard", async ({ page }) => {
  const socket = await fakeSocketServer(page);
  const { state, calls, errors } = await openActiveJob(page, { ...lockout, urgent: false, answers: [], problem: ["Key locked in"] });
  await page.goto("/technician/active-job/7201");
  const card = page.getByRole("region", { name: "Active job" });
  const statusCalls = () => calls.filter((call) => call.path.endsWith("/technician-status")).map((call) => (call.body as { status: string }).status);

  // Navigation opens full screen from the button, once the route is ready.
  await card.getByRole("button", { name: "Start navigation" }).click();
  await expect(page.getByRole("button", { name: "Exit navigation" })).toBeVisible();
  await expect.poll(statusCalls).toEqual(["en-route"]);
  await page.getByRole("button", { name: "Exit navigation" }).click();

  await expect(card.getByRole("button", { name: "Open navigation" })).toBeEnabled();
  await card.getByRole("button", { name: "I've arrived" }).click();
  await card.getByRole("button", { name: "Complete work" }).click();
  await expect.poll(statusCalls).toEqual(["en-route", "arrived", "completed"]);
  await expect(card.getByRole("status")).toContainText("Waiting for customer payment");

  // The customer pays: the backend tells the technician's phone over the socket.
  await socket.joined();
  state.job = null;
  socket.send("job:status_update", { requestId: "7201", status: "paid", amount: 399 });

  const outro = page.getByRole("dialog", { name: /Well done, Arun!/ });
  await expect(outro).toBeVisible();
  await expect(outro).toContainText("You earned on this job");
  await expect(outro).toContainText("₹399");
  await expect(outro.getByRole("status")).toContainText(/Going to your dashboard in \d seconds?/);
  if (process.env.REQUEST_SHOTS_DIR) {
    await outro.evaluate((el) => Promise.all(el.getAnimations({ subtree: true }).map((animation) => animation.finished)));
    await page.screenshot({ path: `${process.env.REQUEST_SHOTS_DIR}/${test.info().project.name}-job-outro.png` });
  }

  // It leaves by itself for the existing dashboard.
  await expect(page).toHaveURL(/\/technician\/dashboard$/, { timeout: 12_000 });
  await expect(page.getByRole("heading", { name: /Arun Kumar/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test.describe("the dashboard's job card", () => {
  const strip = (page: Page) => page.locator(".tj-card.is-flat");
  /** The route asked for the card's figures (the map asks for its own, in full detail). */
  const cardRoute = (routes: Array<{ points: string; overview: string | null }>) =>
    routes.filter((route) => route.overview === "simplified").map((route) => route.points);

  test("shows the road distance and time to the customer, not a straight line", async ({ page }) => {
    const { routes, errors } = await openActiveJob(page, { ...lockout, status: "en-route", jobStatus: "en-route" });
    await page.goto("/technician/dashboard");
    const card = strip(page);

    await expect(card.getByRole("heading", { name: /car lockout/i })).toBeVisible();
    await expect(stripValue(card, "You earn")).toHaveText("₹399");
    // 3.4 km by road. A straight line from here to the customer is about 1 km.
    await expect(stripValue(card, "Distance")).toHaveText("3.4 km");
    await expect(stripValue(card, "Reach in")).toHaveText("9 min");
    // From where the technician is, to the customer.
    expect(cardRoute(routes)[0]).toBe(`${HOME.latitude},${HOME.longitude};11.0092,76.9605`);
    await expect(card.getByTestId("job-location")).toContainText("Basement 2, pillar C14");
    if (process.env.REQUEST_SHOTS_DIR) await page.screenshot({ path: `${process.env.REQUEST_SHOTS_DIR}/${test.info().project.name}-dashboard-job.png`, fullPage: true });
    expect(errors).toEqual([]);
  });

  test("shows a dash while there is no route, never a guess", async ({ page }) => {
    const { errors } = await openActiveJob(page, { ...lockout, status: "en-route", jobStatus: "en-route" }, { distanceKm: 0, durationMinutes: 0 });
    await page.goto("/technician/dashboard");
    const card = strip(page);

    await expect(stripValue(card, "You earn")).toHaveText("₹399");
    await page.waitForTimeout(1500);
    await expect(stripValue(card, "Distance")).toHaveText("—");
    await expect(stripValue(card, "Reach in")).toHaveText("—");
    expect(errors).toEqual([]);
  });

  test("a loaded tow is measured to the drop point, with the booked trip beside the drop address", async ({ page }) => {
    const { routes, errors } = await openActiveJob(page, { ...towing, status: "enroute_drop", jobStatus: "enroute_drop" }, { distanceKm: 5.1, durationMinutes: 16 }, 0);
    await page.goto("/technician/dashboard");
    const card = strip(page);

    await expect(stripValue(card, "You earn")).toHaveText("₹820");
    await expect(stripValue(card, "Distance")).toHaveText("5.1 km");
    await expect(stripValue(card, "Reach in")).toHaveText("16 min");
    expect(cardRoute(routes)[0]).toBe(`${HOME.latitude},${HOME.longitude};11.0351,76.9712`);
    await expect(card.getByTestId("job-location")).toContainText("Drop · 4.2 km · 14 min");
    await expect(card.getByTestId("job-location")).toContainText("Ganapathy workshop, Sathy Road");
    expect(errors).toEqual([]);
  });
});

test.describe("a position too rough to navigate by", () => {
  test.use({ geolocation: { ...HOME, accuracy: 800 }, permissions: ["geolocation"] });

  test("the page says why it is waiting, and offers no route or navigation", async ({ page }) => {
    const { errors } = await openActiveJob(page, lockout);
    await page.goto("/technician/active-job/7201");
    const card = page.getByRole("region", { name: "Active job" });

    await expect(page.locator(".tj-banner-hint")).toHaveText(
      "Your location is only accurate to about 800 m. Move outdoors or turn on precise location.",
    );
    // No figure is made up from a position that could be a kilometre off.
    await expect(stripValue(card, "Distance")).toHaveText("—");
    await expect(stripValue(card, "Reach in")).toHaveText("—");
    await expect(card.getByRole("button", { name: "Start navigation" })).toBeDisabled();
    if (process.env.REQUEST_SHOTS_DIR) await page.screenshot({ path: `${process.env.REQUEST_SHOTS_DIR}/${test.info().project.name}-active-job-waiting.png` });
    expect(errors).toEqual([]);
  });
});

test.describe("a technician standing still", () => {
  test.use({ geolocation: { ...HOME, accuracy: 20 }, permissions: ["geolocation"] });

  test("keeps the route: a browser sends no new position until it moves", async ({ page }) => {
    test.setTimeout(90_000);
    const { errors } = await openActiveJob(page, lockout);
    await page.goto("/technician/active-job/7201");
    const card = page.getByRole("region", { name: "Active job" });
    await expect(stripValue(card, "Distance")).toHaveText("3.4 km");

    // Past the 30 seconds after which a position is too old to trust.
    await page.waitForTimeout(40_000);
    await expect(stripValue(card, "Distance")).toHaveText("3.4 km");
    await expect(stripValue(card, "Reach in")).toHaveText("9 min");
    await expect(page.locator(".tj-banner-hint")).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Start navigation" })).toBeEnabled();
    expect(errors).toEqual([]);
  });

  test("a position that stops arriving while moving is flagged, and the last route stays", async ({ page, context }) => {
    test.setTimeout(90_000);
    const { errors } = await openActiveJob(page, lockout);
    await page.goto("/technician/active-job/7201");
    const card = page.getByRole("region", { name: "Active job" });
    await expect(stripValue(card, "Distance")).toHaveText("3.4 km");

    // About 60 m in 6 seconds: riding. Then nothing more, as in a tunnel.
    await page.waitForTimeout(6_000);
    await context.setGeolocation({ latitude: HOME.latitude - 0.00054, longitude: HOME.longitude, accuracy: 20 });
    await page.waitForTimeout(40_000);

    await expect(page.locator(".tj-banner-hint")).toHaveText("Weak GPS signal · showing your last position");
    // What was left from the last position, about 60 m into the 3.4 km route.
    await expect(stripValue(card, "Distance")).toHaveText("3.3 km");
    await expect(stripValue(card, "Reach in")).toHaveText("9 min");
    // Starting to navigate still needs a live position.
    await expect(card.getByRole("button", { name: "Start navigation" })).toBeDisabled();
    expect(errors).toEqual([]);
  });
});

/** Points along the first stretch of the test route, by metres from its start. */
const ON_ROUTE: Record<number, { latitude: number; longitude: number }> = {
  30: { latitude: 11.016556, longitude: 76.955918 },
  60: { latitude: 11.016312, longitude: 76.956035 },
  120: { latitude: 11.015824, longitude: 76.95627 },
  180: { latitude: 11.015336, longitude: 76.956505 },
};
/**
 * A side street heading east from 60 m along the route, a position every 70 m. The first is
 * still within the route's tolerance; from the second on the technician is off it.
 */
const SIDE_STREET = [76.956676, 76.957317, 76.957958, 76.958599, 76.95924, 76.959881]
  .map((longitude) => ({ latitude: 11.016312, longitude }));

/** One position from the phone, then the moment it takes to reach the page. */
async function ride(context: BrowserContext, point: { latitude: number; longitude: number }, pauseMs = 1_200) {
  await context.setGeolocation({ ...point, accuracy: 20 });
  await new Promise((resolve) => setTimeout(resolve, pauseMs));
}

function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Where a route request started, from its `points` parameter. */
const routeOrigin = (points: string) => {
  const [lat, lng] = points.split(";")[0].split(",").map(Number);
  return { lat, lng };
};

test.describe("navigation through a weak signal", () => {
  test.use({ geolocation: { ...HOME, accuracy: 20 }, permissions: ["geolocation"] });
  const job = { ...lockout, urgent: false, answers: [], problem: ["Key locked in"] };

  async function startNavigation(page: Page) {
    await page.goto("/technician/active-job/7201");
    await page.getByRole("region", { name: "Active job" }).getByRole("button", { name: "Start navigation" }).click();
    const navigation = page.getByRole("region", { name: "Turn-by-turn navigation" });
    await expect(navigation.getByText("Remaining")).toBeVisible();
    return navigation;
  }

  test("a rough GPS reading keeps the route on screen, with a note", async ({ page, context }) => {
    const { errors } = await openActiveJob(page, job);
    const navigation = await startNavigation(page);

    // Between tall buildings: the phone still answers, but only to within 800 m.
    await context.setGeolocation({ ...HOME, accuracy: 800 });
    await expect(navigation.getByRole("status")).toHaveText("Weak GPS signal · showing your last position");
    // The guidance and the figures stay: nothing covers the map.
    await expect(navigation.getByText("Acquiring accurate location…")).toHaveCount(0);
    await expect(navigation.getByText("Remaining")).toBeVisible();
    await expect(navigation.getByText("ETA")).toBeVisible();
    await expect(navigation.getByRole("button", { name: "Exit navigation" })).toBeVisible();
    if (process.env.REQUEST_SHOTS_DIR) await page.screenshot({ path: `${process.env.REQUEST_SHOTS_DIR}/${test.info().project.name}-navigation-weak-gps.png` });

    // The signal comes back: the note goes.
    await context.setGeolocation({ ...HOME, accuracy: 15 });
    await expect(navigation.getByRole("status")).toHaveCount(0);
    await expect(navigation.getByText("Remaining")).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a failed route update keeps the last route, with a note", async ({ page, context }) => {
    const { state, routes, errors } = await openActiveJob(page, job);
    const navigation = await startNavigation(page);
    const asked = routes.length;

    // No network for the route service, just as the technician leaves the route.
    state.routeDown = true;
    await page.waitForTimeout(4_500);
    await ride(context, ON_ROUTE[60]);
    for (const point of SIDE_STREET.slice(0, 3)) await ride(context, point);
    await expect.poll(() => routes.length).toBeGreaterThan(asked);
    await expect(navigation.getByRole("status")).toHaveText("Weak network · showing the last route");
    await expect(navigation.getByText("Road route unavailable")).toHaveCount(0);
    await expect(navigation.getByText("Remaining")).toBeVisible();
    if (process.env.REQUEST_SHOTS_DIR) await page.screenshot({ path: `${process.env.REQUEST_SHOTS_DIR}/${test.info().project.name}-navigation-weak-network.png` });

    // Back in coverage, still off the route: the next update succeeds and the note goes.
    state.routeDown = false;
    await page.waitForTimeout(4_500);
    for (const point of SIDE_STREET.slice(3, 5)) await ride(context, point);
    await expect(navigation.getByRole("status")).toHaveCount(0);
    await expect(navigation.getByText("Remaining")).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe("re-routing", () => {
  test.use({ geolocation: { ...HOME, accuracy: 20 }, permissions: ["geolocation"] });
  const job = { ...lockout, urgent: false, answers: [], problem: ["Key locked in"] };

  async function startNavigation(page: Page) {
    await page.goto("/technician/active-job/7201");
    await page.getByRole("region", { name: "Active job" }).getByRole("button", { name: "Start navigation" }).click();
    const navigation = page.getByRole("region", { name: "Turn-by-turn navigation" });
    await expect(navigation.getByText("Remaining")).toBeVisible();
    // Long enough that the first request is not held back by the minimum gap between requests.
    await page.waitForTimeout(4_500);
    return navigation;
  }
  const remaining = (navigation: ReturnType<Page["getByRole"]>) =>
    navigation.getByText("Remaining").locator("xpath=preceding-sibling::p").innerText();

  test("riding along the route asks for no new route, and the figures count down", async ({ page, context }) => {
    const { routes, errors } = await openActiveJob(page, job);
    const navigation = await startNavigation(page);
    const asked = routes.length;
    const atStart = await remaining(navigation);

    // 180 m along the route, a position every few seconds, as a phone sends them.
    for (const metres of [60, 120, 180]) await ride(context, ON_ROUTE[metres], 4_500);

    expect(routes.length).toBe(asked);
    const now = await remaining(navigation);
    expect(now).not.toBe(atStart);
    expect(parseFloat(now)).toBeLessThan(parseFloat(atStart));

    // Leaving navigation, the job card shows what is left, not the distance at the start.
    await navigation.getByRole("button", { name: "Exit navigation" }).click();
    await expect(stripValue(page.getByRole("region", { name: "Active job" }), "Distance")).toHaveText(now);
    expect(errors).toEqual([]);
  });

  test("leaving the route asks for one new route, from where the technician is", async ({ page, context }) => {
    const { routes, errors } = await openActiveJob(page, job);
    await startNavigation(page);
    const asked = routes.length;

    await ride(context, ON_ROUTE[60]);
    await ride(context, SIDE_STREET[0]);
    // One reading off the route could be GPS noise: no request yet.
    await ride(context, SIDE_STREET[1], 2_000);
    expect(routes.length).toBe(asked);

    // A second one confirms it.
    await ride(context, SIDE_STREET[2]);
    await expect.poll(() => routes.length).toBe(asked + 1);
    const origin = routeOrigin(routes[asked].points);
    expect(metresBetween(origin, { lat: HOME.latitude, lng: HOME.longitude })).toBeGreaterThan(150);

    // Nothing more while the new route is being followed from there.
    await page.waitForTimeout(3_000);
    expect(routes.length).toBe(asked + 1);
    expect(errors).toEqual([]);
  });

  test("turning back the way they came asks for a new route", async ({ page, context }) => {
    const { routes, errors } = await openActiveJob(page, job);
    await startNavigation(page);
    const asked = routes.length;

    for (const metres of [60, 120, 180]) await ride(context, ON_ROUTE[metres]);
    expect(routes.length).toBe(asked);

    // Riding back towards the start: still on the route's road, but going the wrong way.
    for (const metres of [120, 60, 30]) await ride(context, ON_ROUTE[metres]);
    await expect.poll(() => routes.length).toBe(asked + 1);
    expect(errors).toEqual([]);
  });
});

test.describe("the navigation screen", () => {
  const statusCalls = (calls: Call[]) =>
    calls.filter((call) => call.path.endsWith("/technician-status")).map((call) => (call.body as { status: string }).status);

  test.describe("on the way to the customer", () => {
    test.use({ geolocation: { ...HOME, accuracy: 20 }, permissions: ["geolocation"] });

    test("shows where to go, and lets the technician call and mark arrived without leaving it", async ({ page }) => {
      const { calls, errors } = await openActiveJob(page, { ...lockout, urgent: false });
      await page.goto("/technician/active-job/7201");
      const card = page.getByRole("region", { name: "Active job" });
      await card.getByRole("button", { name: "Start navigation" }).click();
      const navigation = page.getByRole("region", { name: "Turn-by-turn navigation" });

      // The customer's own address and landmark, from the request.
      const destination = navigation.getByTestId("navigation-destination");
      await expect(destination).toContainText("Customer location");
      await expect(destination).toContainText("Brookefields Mall parking, Krishnasamy Road, Coimbatore");
      await expect(destination).toContainText("Basement 2, pillar C14");
      await expect(navigation.getByRole("link", { name: "Call customer" })).toHaveAttribute("href", "tel:9876543210");
      // Still 3.4 km away: no prompt to mark arrived yet.
      await expect(navigation.getByTestId("navigation-arrival-prompt")).toHaveCount(0);
      if (process.env.REQUEST_SHOTS_DIR) await page.screenshot({ path: `${process.env.REQUEST_SHOTS_DIR}/${test.info().project.name}-navigation-panel.png` });

      await navigation.getByRole("button", { name: "I've arrived" }).click();
      await expect.poll(() => statusCalls(calls)).toEqual(["en-route", "arrived"]);
      // Arriving ends navigation: the job card takes over with the next step.
      await expect(navigation).toHaveCount(0);
      await expect(card.getByRole("button", { name: "Complete work" })).toBeVisible();
      expect(errors).toEqual([]);
    });
  });

  test.describe("close to the customer", () => {
    // 150 m before the end of the route.
    test.use({ geolocation: { latitude: 11.010343, longitude: 76.959768, accuracy: 20 }, permissions: ["geolocation"] });

    test("prompts the technician to mark arrived once they are there", async ({ page, context }) => {
      // A route whose length matches its line, so metres on screen are metres on the road.
      const { calls, errors } = await openActiveJob(page, { ...lockout, urgent: false }, { distanceKm: 0.99, durationMinutes: 4 });
      await page.goto("/technician/active-job/7201");
      await page.getByRole("region", { name: "Active job" }).getByRole("button", { name: "Start navigation" }).click();
      const navigation = page.getByRole("region", { name: "Turn-by-turn navigation" });
      await expect(navigation.getByRole("button", { name: "I've arrived" })).toBeVisible();
      await expect(navigation.getByTestId("navigation-arrival-prompt")).toHaveCount(0);

      // The last stretch: 40 m, then 30 m from the customer.
      await ride(context, { latitude: 11.009505, longitude: 76.960305 });
      await ride(context, { latitude: 11.009429, longitude: 76.960354 });
      await expect(navigation.getByTestId("navigation-arrival-prompt")).toHaveText("You've reached the customer");
      if (process.env.REQUEST_SHOTS_DIR) await page.screenshot({ path: `${process.env.REQUEST_SHOTS_DIR}/${test.info().project.name}-navigation-arrival.png` });

      await navigation.getByRole("button", { name: "I've arrived" }).click();
      await expect.poll(() => statusCalls(calls)).toEqual(["en-route", "arrived"]);
      await expect(navigation).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  });

  test.describe("on a small phone", () => {
    test.use({ viewport: { width: 360, height: 640 }, geolocation: { ...HOME, accuracy: 20 }, permissions: ["geolocation"] });

    test("the technician's own position stays in view above the panel", async ({ page }) => {
      const { errors } = await openActiveJob(page, { ...lockout, urgent: false });
      await page.goto("/technician/active-job/7201");
      await page.getByRole("region", { name: "Active job" }).getByRole("button", { name: "Start navigation" }).click();
      const navigation = page.getByRole("region", { name: "Turn-by-turn navigation" });
      await expect(navigation.getByRole("button", { name: "I've arrived" })).toBeVisible();

      // The follow view keeps the technician at the centre of the map. That centre has to
      // sit in what is left of the screen, between the instruction and the panel.
      const layout = async () => {
        const map = await navigation.locator("[data-fake-map]").boundingBox();
        const instruction = await navigation.getByTestId("navigation-instruction").boundingBox();
        const footer = await navigation.getByTestId("navigation-footer").boundingBox();
        if (!map || !instruction || !footer) return null;
        const centre = map.y + map.height / 2;
        const visibleTop = instruction.y + instruction.height;
        return {
          belowInstruction: centre - visibleTop,
          abovePanel: footer.y - centre,
          offCentre: Math.abs(centre - (visibleTop + footer.y) / 2),
        };
      };
      // Room for the technician's marker and its pulse on both sides.
      await expect.poll(async () => (await layout())?.abovePanel ?? -1).toBeGreaterThan(40);
      const placed = await layout();
      expect(placed?.belowInstruction).toBeGreaterThan(40);
      expect(placed?.offCentre).toBeLessThan(4);
      if (process.env.REQUEST_SHOTS_DIR) await page.screenshot({ path: `${process.env.REQUEST_SHOTS_DIR}/${test.info().project.name}-navigation-small-phone.png` });
      expect(errors).toEqual([]);
    });
  });

  test.describe("towing to the drop point", () => {
    test.use({ geolocation: { ...HOME, accuracy: 20 }, permissions: ["geolocation"] });

    test("shows the drop address and the tow's own arrived step", async ({ page }) => {
      const { calls, errors } = await openActiveJob(page, { ...towing, status: "enroute_drop", jobStatus: "enroute_drop" }, undefined, 0);
      await page.goto("/technician/active-job/7202");
      await page.getByRole("region", { name: "Active job" }).getByRole("button", { name: "Open navigation" }).click();
      const navigation = page.getByRole("region", { name: "Turn-by-turn navigation" });

      const destination = navigation.getByTestId("navigation-destination");
      await expect(destination).toContainText("Drop location");
      await expect(destination).toContainText("Ganapathy workshop, Sathy Road");
      // The pickup's landmark is not where the tow is going now.
      await expect(destination).not.toContainText("Opposite the petrol bunk");
      await expect(navigation.getByRole("link", { name: "Call customer" })).toHaveAttribute("href", "tel:9876501234");

      await navigation.getByRole("button", { name: "Reached drop location" }).click();
      await expect.poll(() => statusCalls(calls)).toEqual(["arrived_drop"]);
      await expect(navigation).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  });
});
