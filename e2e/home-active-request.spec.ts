import { readFileSync } from "node:fs";
import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";

const fakeMappls = readFileSync(new URL("./fixtures/fakeMapplsSdk.js", import.meta.url), "utf8");
// The same stand-in map, but one that fails to start, as when the map service is down.
const brokenMappls = fakeMappls.replace(
  "export const initializeMapplsSdk = () => Promise.resolve(runtime);",
  'export const initializeMapplsSdk = () => Promise.reject(new Error("The map service is down"));',
);
const SHOTS = process.env.TRACKING_SHOTS_DIR;

const CUSTOMER_SPOT = { lat: 11.0168, lng: 76.9558 };
const ARUN = { id: 7, name: "Arun Kumar", phone: "9876500000", rating: 4.8, completedJobs: 38, avatar_url: null, location: { lat: 11.0268, lng: 76.9458 } };

type ActiveRequest = Record<string, unknown>;

/** The customer's lockout request, as both the request list and the single request return it. */
const request = (overrides: ActiveRequest = {}): ActiveRequest => ({
  id: 5502,
  _id: "5502",
  user_id: 41,
  status: "en-route",
  serviceStatus: "en-route",
  payment_status: "pending",
  service_type: "lockout",
  vehicle_type: "commercial",
  vehicle_model: "Tata Yodha",
  address: "Bharathi Nagar, Coimbatore",
  location_lat: CUSTOMER_SPOT.lat,
  location_lng: CUSTOMER_SPOT.lng,
  created_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  updated_at: new Date().toISOString(),
  isTowing: false,
  technician: ARUN,
  ...overrides,
});
const withStatus = (status: string, overrides: ActiveRequest = {}) => request({ status, serviceStatus: status, ...overrides });

async function openHome(page: Page, initial: ActiveRequest = request(), { mapWorks = true } = {}) {
  const state = { request: initial };
  const seen = { errors: [] as string[] };
  const sockets = new Set<WebSocketRoute>();
  page.on("pageerror", (error) => seen.errors.push(error.message));

  // A signed-in customer: the test token only ever reaches the mocked API below.
  await page.addInitScript(() => localStorage.setItem("resqnow_user_token", "e2e-customer-token"));
  await page.route(/\/src\/lib\/mapProvider\/mapplsSdk\.ts(\?.*)?$/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: mapWorks ? fakeMappls : brokenMappls }));
  await page.routeWebSocket(/\/socket\.io\//, (ws) => {
    sockets.add(ws);
    ws.send(`0${JSON.stringify({ sid: `e2e-${sockets.size}`, upgrades: [], pingInterval: 25000, pingTimeout: 20000, maxPayload: 1e6 })}`);
    ws.onClose(() => sockets.delete(ws));
    ws.onMessage((message) => {
      const text = String(message);
      if (text === "2") return ws.send("3");
      if (text.startsWith("40")) return ws.send(`40${JSON.stringify({ sid: `e2e-socket-${sockets.size}` })}`);
      const match = /^42(\d+)\[/.exec(text);
      if (match) ws.send(`43${match[1]}${JSON.stringify([{ ok: true }])}`);
    });
  });
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const call = route.request();
    const url = new URL(call.url());
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname === "/api/auth/me") return reply(200, { id: 41, name: "Asha", email: "asha@example.test", phone: "9876543210", isVerified: true });
    if (url.pathname === "/api/service-requests" && call.method() === "GET") return reply(200, [state.request]);
    if (url.pathname === "/api/service-requests/5502" && call.method() === "GET") return reply(200, state.request);
    if (url.pathname === "/api/payments/config") return reply(200, { currency: "INR" });
    return reply(404, {});
  });

  await page.goto("/");
  await expect(page.getByRole("region", { name: "Your active request" })).toBeVisible();
  return {
    state,
    seen,
    send: (event: string, data: unknown) => sockets.forEach((ws) => ws.send(`42${JSON.stringify([event, data])}`)),
  };
}

let sequence = 100;
/** The technician's position reaching the customer's phone, with the backend's minutes when given. */
const fix = (overrides: Record<string, unknown> = {}, etaMinutes?: number) => {
  const now = new Date().toISOString();
  sequence += 1;
  return {
    requestId: "5502",
    technicianId: 7,
    lat: 11.0251,
    lng: 76.9481,
    sequenceId: sequence,
    recordedAt: now,
    receivedAt: now,
    ...(etaMinutes == null ? {} : {
      eta: {
        requestId: "5502", etaSeconds: etaMinutes * 60, distanceMeters: etaMinutes * 320, trafficAware: true, provider: "mappls",
        calculatedAt: now, destinationLat: CUSTOMER_SPOT.lat, destinationLng: CUSTOMER_SPOT.lng,
      },
    }),
    ...overrides,
  };
};

const card = (page: Page) => page.getByRole("region", { name: "Your active request" });
const map = (page: Page) => page.getByTestId("home-request-map");
const technician = (page: Page) => map(page).locator('[data-tracking-marker="technician"]');
const say = (page: Page) => page.getByTestId("home-request-say");
const big = (page: Page) => page.getByTestId("home-request-big");
const trip = (page: Page) => page.getByTestId("home-request-trip");
const rider = (page: Page) => page.getByTestId("home-request-trip-rider");
const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  await expect(page.getByText("Your Roadside Assistance Partner")).toHaveCount(0);
  await card(page).screenshot({ path: `${SHOTS}/home-${name}.png` });
};

test.beforeEach(() => {
  test.skip(test.info().project.name !== "phone", "The active request card is part of the phone home screen only.");
});

test("is a short card: the map, what is happening with Call, and the trip line with Track live", async ({ page }) => {
  const { seen } = await openHome(page);

  // Less than half the height of the card it replaces.
  const box = (await card(page).boundingBox())!;
  expect(box.height).toBeLessThanOrEqual(230);

  // The real map, 92px tall, with the technician and the customer framed inside it.
  await expect(map(page)).toHaveAttribute("data-map", "live");
  await expect(map(page).locator("[data-fake-map]")).toBeVisible();
  await expect(map(page).locator(".rq-h-map-canvas")).toHaveCount(0);
  await expect(technician(page).locator(".tracking-tech-marker__badge")).toBeVisible();
  await expect(technician(page).locator(".rq-symbol")).toHaveText("two_wheeler");
  await expect(map(page).locator('[data-tracking-place="customer"] .tracking-place-marker__dot')).toBeVisible();
  await expect(map(page).locator(".tracking-tech-marker__eta")).toHaveCount(0);
  await expect(map(page).locator(".tracking-place-marker__label")).toHaveCount(0);
  const framed = await page.evaluate(() => (window as unknown as { __fakeMappls: { fits: Array<{ bounds?: unknown; options?: { padding?: unknown } }> } }).__fakeMappls.fits.filter((call) => call.bounds).at(-1));
  expect(framed?.bounds).toEqual([[76.9458, CUSTOMER_SPOT.lat], [CUSTOMER_SPOT.lng, 11.0268]]);
  expect(framed?.options?.padding).toEqual({ top: 22, right: 28, bottom: 18, left: 28 });
  const area = (await map(page).boundingBox())!;
  const surface = (await map(page).locator("[data-fake-map]").boundingBox())!;
  expect(Math.round(area.height)).toBe(92);
  expect(Math.round(surface.height)).toBe(92);
  expect(Math.round(surface.width)).toBe(Math.round(area.width));
  // The small disc is drawn where the full-size one would be: over its own map point.
  const marker = (await technician(page).boundingBox())!;
  const disc = (await technician(page).locator(".tracking-tech-marker__badge").boundingBox())!;
  expect(Math.round(disc.width)).toBe(28);
  expect(Math.round(disc.x + disc.width / 2 - (marker.x + marker.width / 2))).toBe(0);
  expect(Math.round(disc.y + disc.height / 2 - (marker.y + marker.height / 2))).toBe(18);

  // Before the backend has sent minutes, none are made up: the straight-line distance is shown as such.
  await expect(say(page)).toHaveText("Arun is on the way");
  await expect(big(page)).toHaveText("≈ 1.6 km away");
  await expect(card(page).getByRole("link", { name: "Call Arun" })).toHaveAttribute("href", "tel:9876500000");
  await expect(card(page).getByRole("link", { name: "Track live" })).toHaveAttribute("href", "/service-tracking/5502");

  // The step dots, the technician row and the wide button are gone.
  await expect(card(page).locator(".rq-h-steps, .rq-h-tech, .rq-h-btn")).toHaveCount(0);
  await expect(card(page).getByText("Open live tracking")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shot(page, "compact-waiting-for-minutes");
  expect(seen.errors).toEqual([]);
});

test("shows the minutes and arrival time, and moves the technician along the trip line as they get closer", async ({ page }) => {
  const { send, seen } = await openHome(page);
  // The disc is centred on the left edge of its holder, so that edge is where the technician is drawn.
  const riderLeft = () => rider(page).evaluate((el) => el.getBoundingClientRect().left);
  const railRight = async () => (await trip(page).locator(".rq-ht-rail").boundingBox())!;

  // Ten minutes away: about half way along the line.
  await expect.poll(async () => { send("tracking:location:v1", fix({}, 10)); return big(page).textContent(); }).toBe("10 min");
  await expect(say(page)).toHaveText("Arun is on the way · 3.2 km");
  await expect(page.getByTestId("home-request-side")).toHaveText(/^Arrives by \d{1,2}:\d{2} (am|pm)$/);
  await expect(trip(page)).toHaveAttribute("data-progress", "0.49");
  await expect(trip(page).locator(".rq-ht-flow")).toBeVisible();
  await expect(trip(page).locator(".rq-ht-hazard")).toBeVisible();
  await expect(rider(page).locator(".rq-symbol").first()).toHaveText("two_wheeler");
  const rail = await railRight();
  await expect.poll(async () => Math.round(((await riderLeft()) - rail.x) / rail.width * 100)).toBe(49);
  await shot(page, "compact-on-the-way");

  // Two minutes away: most of the way there, and further right than before.
  const before = await riderLeft();
  await expect.poll(async () => { send("tracking:location:v1", fix({ lng: 76.9531 }, 2)); return big(page).textContent(); }).toBe("2 min");
  await expect(trip(page)).toHaveAttribute("data-progress", "0.83");
  await expect.poll(async () => Math.round(((await riderLeft()) - rail.x) / rail.width * 100)).toBe(83);
  expect(await riderLeft()).toBeGreaterThan(before + 40);
  // The solid part of the line ends under the technician.
  const done = (await trip(page).locator(".rq-ht-done").boundingBox())!;
  expect(Math.round(done.width / rail.width * 100)).toBe(83);

  // The map above shows the same technician, moved, and says the position is live.
  await expect(page.getByTestId("home-request-map-chip")).toHaveText(/Live|Updating/);
  expect(seen.errors).toEqual([]);
});

test("searches the line while a technician is being found", async ({ page }) => {
  await openHome(page, withStatus("pending", { technician: null }));

  await expect(say(page)).toHaveText(/^Request sent · \d{1,2}:\d{2} (am|pm)$/);
  await expect(big(page)).toHaveText("Finding a technician");
  await expect(trip(page)).toHaveAttribute("data-phase", "search");
  await expect(trip(page).locator(".rq-ht-seek")).toBeVisible();
  await expect(trip(page).locator(".rq-ht-hazard")).toBeVisible();
  await expect(rider(page)).toHaveCount(0);
  await expect(card(page).getByRole("link", { name: /^Call/ })).toHaveCount(0);
  await expect(card(page).getByRole("link", { name: "Track live" })).toBeVisible();
  // On the map: the customer's spot alone, and nothing called live.
  await expect(map(page).locator('[data-tracking-place="customer"] .tracking-place-marker__dot')).toBeVisible();
  await expect(technician(page)).toHaveCount(0);
  await expect(page.getByTestId("home-request-map-chip")).toHaveCount(0);
  await shot(page, "compact-finding");
});

test("puts the technician at the start of the line once assigned", async ({ page }) => {
  const { send } = await openHome(page, withStatus("accepted"));

  await expect(say(page)).toHaveText("Arun accepted · ≈ 1.6 km away");
  await expect(big(page)).toHaveText("Getting ready to leave");
  await expect(trip(page)).toHaveAttribute("data-progress", "0.00");
  await expect(rider(page)).toBeVisible();
  await expect(trip(page).locator(".rq-ht-flow")).toHaveCount(0);

  await expect.poll(async () => { send("tracking:location:v1", fix({ lat: 11.0268, lng: 76.9458 }, 8)); return big(page).textContent(); }).toBe("8 min away");
  await expect(say(page)).toHaveText("Arun accepted · 2.6 km away");
  // Still at the start: they have not set off.
  await expect(trip(page)).toHaveAttribute("data-progress", "0.00");
  await shot(page, "compact-assigned");
});

test("ticks the technician off at the vehicle on arrival", async ({ page }) => {
  await openHome(page, withStatus("arrived"));

  await expect(say(page)).toHaveText("Arun has arrived");
  await expect(big(page)).toHaveText("At your location");
  await expect(trip(page)).toHaveAttribute("data-progress", "1.00");
  await expect(page.getByTestId("home-request-trip-arrived")).toBeVisible();
  // Help has reached the vehicle: its hazard light is off.
  await expect(trip(page).locator(".rq-ht-hazard")).toHaveCount(0);
  const vehicle = (await trip(page).locator(".rq-ht-veh").boundingBox())!;
  const disc = (await rider(page).locator(".rq-ht-disc").boundingBox())!;
  expect(Math.abs(disc.x + disc.width / 2 - vehicle.x)).toBeLessThanOrEqual(4);
  await shot(page, "compact-arrived");
});

test("shows the spanner and a running timer while the work is done", async ({ page }) => {
  await openHome(page, withStatus("in-progress", { started_at: new Date(Date.now() - 4 * 60_000 - 12_000).toISOString() }));

  await expect(say(page)).toHaveText("Work in progress");
  await expect(big(page)).toHaveText(/^04:1\d$/);
  await expect(page.getByTestId("home-request-side")).toHaveText(/^since \d{1,2}:\d{2} (am|pm)$/);
  await expect(rider(page).locator(".rq-ht-disc")).toHaveClass(/is-work/);
  await expect(rider(page).locator(".rq-symbol").first()).toHaveText("build");
  const first = await big(page).textContent();
  await expect.poll(async () => big(page).textContent(), { timeout: 5_000 }).not.toBe(first);
  await shot(page, "compact-working");
});

test("brings the card up to date as soon as the status changes", async ({ page }) => {
  const world = await openHome(page);
  await expect(say(page)).toHaveText("Arun is on the way");

  world.state.request = withStatus("arrived");
  world.send("job:status_update", { requestId: "5502", status: "arrived" });

  // Well inside the list's own 15-second refresh.
  await expect(say(page)).toHaveText("Arun has arrived", { timeout: 6_000 });
  await expect(page.getByTestId("home-request-trip-arrived")).toBeVisible();
});

test("opens live tracking when the map is tapped, and the map itself cannot be dragged", async ({ page }) => {
  await openHome(page);
  await expect(map(page)).toHaveAttribute("data-map", "live");
  await expect(technician(page)).toBeVisible();

  // Whatever is touched on the map, the touch lands on the cover, not on the map under it.
  const area = (await map(page).boundingBox())!;
  for (const [fx, fy] of [[0.5, 0.5], [0.15, 0.8], [0.85, 0.3]]) {
    const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className ?? "", [area.x + area.width * fx, area.y + area.height * fy]);
    expect(hit).toBe("rq-h-map-open");
  }
  // A swipe across it scrolls the page as anywhere else; nothing is sent to the map.
  await page.mouse.move(area.x + 60, area.y + 40);
  await page.mouse.down();
  await page.mouse.move(area.x + 200, area.y + 60, { steps: 6 });
  await page.mouse.up();
  await expect(page).toHaveURL(/\/$/);

  await map(page).click();
  await expect(page).toHaveURL(/\/service-tracking\/5502$/);
});

test("opens live tracking from Track live", async ({ page }) => {
  await openHome(page);
  await card(page).getByRole("link", { name: "Track live" }).click();
  await expect(page).toHaveURL(/\/service-tracking\/5502$/);
});

test("keeps the drawn map when the request has no location", async ({ page }) => {
  await openHome(page, request({ location_lat: null, location_lng: null }));

  await expect(map(page)).toHaveAttribute("data-map", "drawn");
  await expect(map(page).locator(".rq-h-map-canvas")).toBeVisible();
  await expect(map(page).locator("[data-fake-map]")).toHaveCount(0);
  await expect(map(page).getByText("Live")).toBeVisible();
  // The rest of the card works as usual.
  await expect(say(page)).toHaveText("Arun is coming to you");
  await expect(big(page)).toHaveText("On the way");
  await expect(card(page).getByRole("link", { name: "Track live" })).toBeVisible();
});

test("falls back to the drawn map when the real map cannot load", async ({ page }) => {
  const { seen } = await openHome(page, request(), { mapWorks: false });

  await expect(map(page)).toHaveAttribute("data-map", "drawn");
  await expect(map(page).locator(".rq-h-map-canvas")).toBeVisible();
  await expect(map(page).getByText("Map is temporarily unavailable")).toHaveCount(0);
  await expect(say(page)).toHaveText("Arun is on the way");
  await expect(card(page).getByRole("link", { name: "Track live" })).toBeVisible();
  expect((await card(page).boundingBox())!.height).toBeLessThanOrEqual(230);
  await shot(page, "compact-drawn-fallback");
  expect(seen.errors).toEqual([]);
});

test("fits a narrow phone without cutting the time or the buttons", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 640 });
  const { send } = await openHome(page);
  await expect.poll(async () => { send("tracking:location:v1", fix({}, 95)); return big(page).textContent(); }).toBe("1 hr 35 min");

  const inside = async (name: string | RegExp) => {
    const box = (await card(page).getByRole("link", { name }).boundingBox())!;
    const frame = (await card(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(frame.x);
    expect(box.x + box.width).toBeLessThanOrEqual(frame.x + frame.width);
  };
  await inside("Call Arun");
  await inside("Track live");
  const time = (await big(page).boundingBox())!;
  const call = (await card(page).getByRole("link", { name: "Call Arun" }).boundingBox())!;
  expect(time.x + time.width).toBeLessThanOrEqual(call.x);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shot(page, "compact-narrow-phone");
});
