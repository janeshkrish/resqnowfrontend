import { readFileSync } from "node:fs";
import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";

const fakeMappls = readFileSync(new URL("./fixtures/fakeMapplsSdk.js", import.meta.url), "utf8");
const SHOTS = process.env.FINDING_SHOTS_DIR;

const CUSTOMER_SPOT = { lat: 11.0168, lng: 76.9558 };
const DROP_SPOT = { lat: 11.0401, lng: 76.9903 };

type Json = Record<string, unknown>;

/** A request that has just been sent and has no technician yet, as the backend returns it. */
const pending = (overrides: Json = {}): Json => ({
  id: 5502,
  _id: "5502",
  user_id: 41,
  status: "pending",
  payment_status: "pending",
  // The request form saves the kind of vehicle in front of the service.
  service_type: "commercial-lockout",
  vehicle_type: "commercial",
  vehicle_model: "Tata Yodha",
  address: "Bharathi Nagar, Ward 41, North Zone, Coimbatore 641001",
  location_lat: CUSTOMER_SPOT.lat,
  location_lng: CUSTOMER_SPOT.lng,
  created_at: new Date(Date.now() - 4_000).toISOString(),
  isTowing: false,
  price_locked: true,
  amount: 100,
  baseAmount: 100,
  platformFee: 10,
  razorpayFee: 0,
  finalAmount: 110,
  technician: null,
  ...overrides,
});

const ARUN = { id: 7, name: "Arun Kumar", phone: "9876500000", rating: 4.8, completedJobs: 38, avatar_url: null, location: { lat: 11.0268, lng: 76.9458 } };

/** What /api/technicians/nearby answers: two who can take the job, one who is busy, one with no position. */
const NEARBY = [
  { id: "21", name: "Selvam", latitude: 11.0201, longitude: 76.9601, distance: 0.6, is_available: true },
  { id: "22", name: "Mani", latitude: 11.0122, longitude: 76.9502, distance: 0.8, is_available: true },
  { id: "23", name: "Ravi", latitude: 11.0189, longitude: 76.9512, distance: 0.5, is_available: false },
  { id: "24", name: "Karthik", latitude: null, longitude: null, distance: 0, is_available: true },
];

async function fakeSocket(page: Page) {
  const sockets = new Set<WebSocketRoute>();
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
  return { send: (event: string, data: unknown) => sockets.forEach((ws) => ws.send(`42${JSON.stringify([event, data])}`)) };
}

type Options = { request?: Json; fromTheSlide?: boolean; nearby?: unknown; nearbyStatus?: number };

async function openSearch(page: Page, { request = pending(), fromTheSlide = false, nearby = NEARBY, nearbyStatus = 200 }: Options = {}) {
  const state = { request };
  const seen = { nearby: [] as string[], cancels: 0, errors: [] as string[] };
  page.on("pageerror", (error) => seen.errors.push(error.message));

  // A signed-in customer: the test token only ever reaches the mocked API below.
  await page.addInitScript(() => localStorage.setItem("resqnow_user_token", "e2e-customer-token"));
  // The page itself notes when the request-sent moment appeared, began to open, and was gone.
  await page.addInitScript(() => {
    const marks: Record<string, number> = {};
    (window as unknown as { __sentMarks: Record<string, number> }).__sentMarks = marks;
    const look = () => {
      const overlay = document.querySelector('[data-testid="request-sent"]');
      if (overlay && marks.shown == null) marks.shown = performance.now();
      if (overlay?.getAttribute("data-stage") === "opening" && marks.opening == null) marks.opening = performance.now();
      if (!overlay && marks.shown != null && marks.gone == null) marks.gone = performance.now();
    };
    new MutationObserver(look).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-stage"] });
  });
  if (fromTheSlide) {
    // The request form opens this page with a note that the request was just sent; the browser keeps that note
    // with the page, across a reload as well.
    await page.addInitScript(() => history.replaceState({ usr: { requestSent: true }, key: "e2e-sent", idx: 0 }, ""));
  }
  await page.route(/\/src\/lib\/mapProvider\/mapplsSdk\.ts(\?.*)?$/, (route) => route.fulfill({ contentType: "application/javascript", body: fakeMappls }));
  const socket = await fakeSocket(page);
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const call = route.request();
    const url = new URL(call.url());
    const method = call.method();
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (url.pathname === "/api/auth/me") return reply(200, { id: 41, name: "Asha", email: "asha@example.test", phone: "9876543210", isVerified: true });
    if (url.pathname === "/api/payments/config") return reply(200, { currency: "INR" });
    if (url.pathname === "/api/service-requests/5502" && method === "GET") return reply(200, state.request);
    if (url.pathname === "/api/service-requests/5502/cancel" && method === "PATCH") {
      seen.cancels += 1;
      state.request = { ...state.request, status: "cancelled" };
      return reply(200, { success: true, request: state.request });
    }
    if (url.pathname === "/api/technicians/nearby") {
      seen.nearby.push(url.search);
      return reply(nearbyStatus, nearbyStatus === 200 ? nearby : { error: "down" });
    }
    return reply(404, {});
  });

  await page.goto("/request-service-tracking/5502");
  const accept = () => {
    state.request = { ...state.request, status: "accepted", technician: ARUN };
    socket.send("job:status_update", { requestId: "5502", status: "accepted" });
  };
  return { state, seen, socket, accept };
}

const isPhone = () => test.info().project.name === "phone";
const sent = (page: Page) => page.getByTestId("request-sent");
const card = (page: Page) => page.getByTestId("tracking-card");
const customer = (page: Page) => page.locator('[data-tracking-place="customer"]');
const nearbyMarkers = (page: Page) => page.locator('[data-tracking-marker="nearby"]');
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` });
};
/** How long the request-sent moment played before it began to open, and how long the opening took, as the page saw it. */
const sentTimes = (page: Page) =>
  page.evaluate(() => {
    const marks = (window as unknown as { __sentMarks: Record<string, number> }).__sentMarks;
    return { played: marks.opening - marks.shown, opened: marks.gone - marks.opening };
  });
/** Waits for the card to stop moving, the way a thumb would before dragging it. */
async function settled(page: Page) {
  let last = -1;
  await expect.poll(async () => {
    const now = Math.round((await page.getByTestId("tracking-sheet").boundingBox())!.y);
    const steady = now === last;
    last = now;
    return steady;
  }, { intervals: [150] }).toBe(true);
}

test.describe("straight after the slide", () => {
  test("the whole screen says the request was sent, then opens into the search", async ({ page }) => {
    const { seen } = await openSearch(page, { fromTheSlide: true });

    const overlay = sent(page);
    // What was asked for shows as soon as the request has loaded.
    await expect(page.getByTestId("request-sent-card")).toBeVisible();
    // Read in one look, while it is on screen.
    const view = page.viewportSize()!;
    const onScreen = await overlay.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return {
        title: el.querySelector(".rq-rs-title")?.textContent?.replace(/\s+/g, " ").trim(),
        next: el.querySelector(".rq-rs-next")?.textContent,
        status: el.querySelector('[role="status"]')?.textContent?.replace(/\s+/g, " ").trim(),
        card: el.querySelector('[data-testid="request-sent-card"]')?.textContent,
        // Where the request lands, the pins carry the service's own picture.
        pins: Array.from(el.querySelectorAll(".rq-rs-tpin img")).map((img) => img.getAttribute("src")),
        width: Math.round(box.width),
        height: Math.round(box.height),
      };
    });
    expect(onScreen.title).toBe("Request sent");
    expect(onScreen.next).toBe("Finding a locksmith near you");
    expect(onScreen.status).toBe("Request sent. Finding a locksmith near you.");
    expect(onScreen.card).toContain("Lockout");
    expect(onScreen.card).toContain("Tata Yodha");
    expect(onScreen.card).toContain("₹110");
    expect(onScreen.pins).toEqual(Array(3).fill("/images/home/services/lockout.webp"));
    // It covers the whole screen.
    expect({ width: onScreen.width, height: onScreen.height }).toEqual(view);
    expect(await noSideScroll(page)).toBe(true);
    if (SHOTS) {
      await page.waitForTimeout(2000);
      await shot(page, "sent");
    }

    // Then it opens up and is gone, leaving the search.
    await expect(overlay).toHaveCount(0, { timeout: 8000 });
    const times = await sentTimes(page);
    // It plays for 3.4 seconds, then takes under a second to open into the map.
    expect(times.played).toBeGreaterThan(3200);
    expect(times.played).toBeLessThan(4400);
    expect(times.opened).toBeGreaterThan(500);
    expect(times.opened).toBeLessThan(1800);
    await expect(page.locator(".rq-rs-wipe")).toHaveCount(0);
    await expect(page.getByTestId("tracking-big")).toHaveText("Finding a locksmith nearby");
    await expect(customer(page)).toHaveClass(/is-searching/);
    expect(seen.errors).toEqual([]);
  });

  test("plays once: a reload opens straight on the search", async ({ page }) => {
    await openSearch(page, { fromTheSlide: true });
    await expect(sent(page)).toBeVisible();

    await page.reload();
    await expect(page.getByTestId("tracking-big")).toHaveText("Finding a locksmith nearby");
    await expect(sent(page)).toHaveCount(0);
  });

  test("ends early when a technician accepts while it is playing", async ({ page }) => {
    const { accept } = await openSearch(page, { fromTheSlide: true });
    await expect(sent(page)).toBeVisible();
    await expect(page.getByTestId("request-sent-card")).toBeVisible();

    accept();
    await expect(sent(page)).toHaveCount(0, { timeout: 8000 });
    // Left alone it plays for 3.4 seconds before it starts to open; it also never just flashes.
    const times = await sentTimes(page);
    expect(times.played).toBeGreaterThan(1000);
    expect(times.played).toBeLessThan(2800);
    await expect(card(page)).toHaveAttribute("data-phase", "accepted");
    await expect(card(page).locator(".lt-say")).toHaveText("Arun accepted your request");
  });

  test("with motion reduced it shows the words and fades away", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openSearch(page, { fromTheSlide: true });

    const overlay = sent(page);
    await expect(overlay).toBeVisible();
    await expect(overlay).toHaveClass(/is-still/);
    await expect(overlay.getByText("Request sent", { exact: true })).toBeVisible();
    await expect(page.locator(".rq-rs-wipe")).toBeHidden();
    await expect(overlay).toHaveCount(0, { timeout: 4000 });
    await expect(page.getByTestId("tracking-big")).toHaveText("Finding a locksmith nearby");
  });
});

test("opened any other way, the page goes straight to the search", async ({ page }) => {
  await openSearch(page);
  await expect(page.getByTestId("tracking-big")).toHaveText("Finding a locksmith nearby");
  await expect(sent(page)).toHaveCount(0);
});

test.describe("while a technician is being found", () => {
  test("the card says what is being found, where help is going, and keeps Cancel one tap away", async ({ page }) => {
    const { seen } = await openSearch(page);

    await expect(card(page)).toHaveAttribute("data-phase", "search");
    await expect(page.getByTestId("tracking-big")).toHaveText("Finding a locksmith nearby");
    await expect(page.getByTestId("tracking-finding-lines").locator("span")).toHaveText(["Contacting locksmiths near you", "Waiting for one of them to accept"]);
    await expect(card(page).locator(".lt-find-bar")).toBeVisible();

    // On a phone the card says where help is going; on a wide screen the details beside it already do.
    const trip = page.getByTestId("tracking-trip");
    if (isPhone()) {
      await expect(trip.locator(".lt-trip-stop")).toHaveCount(1);
      await expect(trip).toContainText("Your location");
      await expect(trip).toContainText("Bharathi Nagar, Ward 41, North Zone, Coimbatore 641001");
    } else {
      await expect(trip).toHaveCount(0);
      await expect(page.getByTestId("tracking-details")).toContainText("Bharathi Nagar, Ward 41, North Zone, Coimbatore 641001");
    }

    await expect(page.getByTestId("tracking-request")).toContainText("Tata Yodha");
    await expect(page.getByTestId("tracking-request")).toContainText("₹110");
    // The old search card's time line and four steps are not on this one.
    await expect(card(page).locator(".lt-say")).toHaveCount(0);
    await expect(card(page).getByRole("list", { name: "Progress" })).toHaveCount(0);
    expect(await noSideScroll(page)).toBe(true);
    await shot(page, "search");

    await card(page).getByRole("button", { name: "Cancel request" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel this request?" });
    await expect(dialog).toContainText("We are still finding a technician for you.");
    await dialog.getByRole("button", { name: "Taking too long" }).click();
    await dialog.getByRole("button", { name: "Cancel request" }).click();
    await expect(page.getByTestId("tracking-big")).toHaveText("Request cancelled");
    expect(seen.cancels).toBe(1);
    expect(seen.errors).toEqual([]);
  });

  test("the map shows waves around the customer and the technicians nearby who can take the job", async ({ page }) => {
    const { seen, accept } = await openSearch(page);

    await expect(customer(page)).toHaveClass(/is-searching/);
    await expect(customer(page).locator(".tracking-place-marker__zone")).toHaveCount(1);
    await expect(customer(page).locator(".tracking-place-marker__wave")).toHaveCount(3);

    // Asked for this service and this kind of vehicle, around the customer's own spot.
    await expect.poll(() => seen.nearby.length).toBeGreaterThan(0);
    const asked = new URLSearchParams(seen.nearby[0]);
    expect(asked.get("lat")).toBe(String(CUSTOMER_SPOT.lat));
    expect(asked.get("lng")).toBe(String(CUSTOMER_SPOT.lng));
    expect(asked.get("service_type")).toBe("commercial-lockout");
    expect(asked.get("vehicle_type")).toBe("commercial");

    // Two of the four can take it: one is busy and one has no position.
    await expect(nearbyMarkers(page)).toHaveCount(2);
    await expect(nearbyMarkers(page).first().locator(".rq-symbol")).toHaveText("two_wheeler");
    await shot(page, "search-map");

    // Once someone accepts, the search is over: no waves, no bystanders, just the technician coming.
    accept();
    await expect(page.locator('[data-tracking-marker="technician"]')).toBeVisible();
    await expect(nearbyMarkers(page)).toHaveCount(0);
    await expect(customer(page)).not.toHaveClass(/is-searching/);
    await expect(customer(page).locator(".tracking-place-marker__wave")).toHaveCount(0);
    expect(seen.errors).toEqual([]);
  });

  test("the search carries on when the nearby list cannot be loaded", async ({ page }) => {
    const { seen } = await openSearch(page, { nearbyStatus: 500 });
    await expect(page.getByTestId("tracking-big")).toHaveText("Finding a locksmith nearby");
    await expect.poll(() => seen.nearby.length).toBeGreaterThan(0);
    await expect(nearbyMarkers(page)).toHaveCount(0);
    await expect(customer(page)).toHaveClass(/is-searching/);
    expect(seen.errors).toEqual([]);
  });

  test("a tow shows the pickup and the drop, and tow trucks nearby", async ({ page }) => {
    await openSearch(page, {
      request: pending({
        isTowing: true, service_type: "car-towing", vehicle_type: "car", vehicle_model: "Maruti Suzuki Swift",
        address: "21, Race Course Road, Coimbatore", drop_address: "Ganapathy workshop, Sathy Road",
        drop_latitude: DROP_SPOT.lat, drop_longitude: DROP_SPOT.lng, route_distance_km: 4.2,
        amount: 820, baseAmount: 820, platformFee: 82, finalAmount: 902,
      }),
    });

    await expect(page.getByTestId("tracking-big")).toHaveText("Finding a tow truck nearby");
    await expect(page.getByTestId("tracking-finding-lines").locator("span").first()).toHaveText("Contacting tow operators near you");
    if (isPhone()) {
      const stops = page.getByTestId("tracking-trip").locator(".lt-trip-stop");
      await expect(stops).toHaveCount(2);
      await expect(stops.nth(0)).toContainText("Pickup");
      await expect(stops.nth(0)).toContainText("21, Race Course Road, Coimbatore");
      await expect(stops.nth(1)).toContainText("Drop · 4.2 km");
      await expect(stops.nth(1)).toContainText("Ganapathy workshop, Sathy Road");
    } else {
      const details = page.getByTestId("tracking-details");
      await expect(details).toContainText("21, Race Course Road, Coimbatore");
      await expect(details).toContainText("Drop · 4.2 km");
      await expect(details).toContainText("Ganapathy workshop, Sathy Road");
    }
    await expect(page.getByTestId("tracking-request")).toContainText("₹902");
    await expect(nearbyMarkers(page).first().locator(".rq-symbol")).toHaveText("auto_towing");
    await shot(page, "search-towing");
  });

  test("on a phone the strip over the map says the same thing", async ({ page }) => {
    test.skip(!isPhone(), "The card only shrinks to a strip on a phone");
    await openSearch(page);
    await expect(page.getByTestId("tracking-big")).toHaveText("Finding a locksmith nearby");

    await expect(page.getByTestId("tracking-sheet")).toHaveAttribute("data-size", "half");
    await settled(page);
    const box = (await page.locator(".lt-grab").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 150, { steps: 10 });
    await page.mouse.up();
    await expect(page.getByTestId("tracking-sheet")).toHaveAttribute("data-size", "collapsed");
    await expect(page.locator(".lt-mini-big")).toHaveText("Finding a locksmith nearby");
    await expect(page.locator(".lt-mini-sub")).toHaveText("Contacting locksmiths near you");
  });
});

// Every service the request form can send, spelled the way it saves them.
const SERVICES: Array<[string, string, string, string]> = [
  ["car-towing", "car", "Finding a tow truck nearby", "Contacting tow operators near you"],
  ["bike-flat-tire", "bike", "Finding a technician nearby", "Contacting tyre technicians near you"],
  ["car-battery", "car", "Finding a technician nearby", "Contacting battery technicians near you"],
  ["car-mechanical", "car", "Finding a mechanic nearby", "Contacting mechanics near you"],
  ["car-fuel", "car", "Finding fuel nearby", "Contacting fuel partners near you"],
  ["commercial-lockout", "commercial", "Finding a locksmith nearby", "Contacting locksmiths near you"],
  ["car-winching", "car", "Finding a recovery truck", "Contacting recovery crews near you"],
  ["ev-ev-charging", "ev", "Finding a charging van nearby", "Contacting charging vans near you"],
  ["car-emergency", "car", "Finding a technician nearby", "Contacting technicians near you"],
];

for (const [serviceType, vehicleType, title, line] of SERVICES) {
  test(`${serviceType}: ${title}`, async ({ page }) => {
    const { seen } = await openSearch(page, { fromTheSlide: true, request: pending({ service_type: serviceType, vehicle_type: vehicleType }) });

    // The request-sent moment speaks for this service too.
    await expect(sent(page).locator(".rq-rs-next")).toHaveText(`${title.replace(/ nearby$/, "")} near you`);
    const picture = serviceType === "car-emergency" ? null : `/images/home/services/${serviceType.replace(/^(car|bike|commercial|ev)-/, "")}.webp`;
    if (picture) await expect(sent(page).locator(".rq-rs-tpin img").first()).toHaveAttribute("src", picture);
    else await expect(sent(page).locator(".rq-rs-tpin .rq-symbol")).toHaveCount(3);

    await expect(sent(page)).toHaveCount(0, { timeout: 8000 });
    await expect(page.getByTestId("tracking-big")).toHaveText(title);
    await expect(page.getByTestId("tracking-finding-lines").locator("span").first()).toHaveText(line);
    await expect(card(page).getByRole("button", { name: "Cancel request" })).toBeVisible();
    expect(seen.errors).toEqual([]);
  });
}
