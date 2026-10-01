import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

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
  const state = { job: { ...job } as Job | null };
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
