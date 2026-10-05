import { readFileSync } from "node:fs";
import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";

const fakeMappls = readFileSync(new URL("./fixtures/fakeMapplsSdk.js", import.meta.url), "utf8");
const SHOTS = process.env.TRACKING_SHOTS_DIR;

const CUSTOMER_SPOT = { lat: 11.0168, lng: 76.9558 };
const DROP_SPOT = { lat: 11.0401, lng: 76.9903 };

type TrackedRequest = Record<string, unknown> & { status: string; payment_status: string };

/** A lockout request for a pickup truck, with Arun on the way: what the backend returns for it. */
const request = (overrides: Record<string, unknown> = {}): TrackedRequest => ({
  id: 5502,
  _id: "5502",
  user_id: 41,
  status: "en-route",
  payment_status: "pending",
  service_type: "lockout",
  vehicle_type: "commercial",
  vehicle_model: "Tata Yodha",
  address: "Bharathi Nagar, Ward 41, North Zone, Coimbatore 641001",
  location_lat: CUSTOMER_SPOT.lat,
  location_lng: CUSTOMER_SPOT.lng,
  created_at: new Date(Date.now() - 10 * 60_000).toISOString(),
  isTowing: false,
  price_locked: true,
  amount: 100,
  baseAmount: 100,
  platformFee: 10,
  razorpayFee: 0,
  finalAmount: 110,
  technician: {
    id: 7,
    name: "Arun Kumar",
    phone: "9876500000",
    rating: 4.8,
    completedJobs: 38,
    avatar_url: null,
    location: { lat: 11.0268, lng: 76.9458 },
  },
  ...overrides,
});

/** Stands in for the backend's socket server: acknowledges joins and sends events to every socket. */
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

async function openTracking(page: Page, initial: TrackedRequest = request()) {
  const state = {
    request: initial,
    /** What the server says to a cancellation; "late" is the technician setting off first. */
    cancelAnswer: "ok" as "ok" | "late",
    /** The status the request has moved to by the time a late cancellation is refused. */
    statusAfterLate: "en-route",
  };
  const seen = { cancels: [] as Array<Record<string, unknown>>, fetches: 0, quotes: 0, errors: [] as string[] };
  page.on("pageerror", (error) => seen.errors.push(error.message));

  // A signed-in customer: the test token only ever reaches the mocked API below.
  await page.addInitScript(() => localStorage.setItem("resqnow_user_token", "e2e-customer-token"));
  await page.route(/\/src\/lib\/mapProvider\/mapplsSdk\.ts(\?.*)?$/, (route) => route.fulfill({ contentType: "application/javascript", body: fakeMappls }));
  const socket = await fakeSocket(page);
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const call = route.request();
    const url = new URL(call.url());
    const method = call.method();
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const json = () => { try { return JSON.parse(call.postData() || "{}"); } catch { return {}; } };

    if (url.pathname === "/api/auth/me") return reply(200, { id: 41, name: "Asha", email: "asha@example.test", phone: "9876543210", isVerified: true });
    if (url.pathname === "/api/payments/config") return reply(200, { currency: "INR" });
    if (url.pathname === "/api/service-requests/5502" && method === "GET") { seen.fetches += 1; return reply(200, state.request); }
    if (url.pathname === "/api/service-requests/5502/cancel" && method === "PATCH") {
      seen.cancels.push(json());
      if (state.cancelAnswer === "late") {
        state.request = { ...state.request, status: state.statusAfterLate };
        return reply(409, { error: "This request can no longer be cancelled. Cancelling closes once your technician is on the way.", code: "CANCEL_NOT_ALLOWED" });
      }
      state.request = { ...state.request, status: "cancelled", technician: null };
      return reply(200, { success: true, request: state.request });
    }
    if (url.pathname === "/api/payments/quote" && method === "POST") {
      seen.quotes += 1;
      const online = json().paymentMode !== "cash";
      return reply(200, { success: true, breakdown: { currency: "INR", payment_mode: online ? "upi" : "cash", base_amount: 100, platform_fee_percent: 0.1, original_platform_fee: 10, discount_amount: 0, platform_fee: 10, razorpay_fee: online ? 2 : 0, final_amount: online ? 112 : 110 }, coupon: { active: false } });
    }
    return reply(404, {});
  });

  await page.goto("/request-service-tracking/5502");
  await expect(page.getByTestId("tracking-card")).toBeVisible();
  return { state, seen, socket };
}

/** The technician's position reaching the customer, with the backend's ETA attached. */
const fix = (overrides: Record<string, unknown> = {}) => {
  const now = new Date().toISOString();
  return {
    requestId: "5502",
    technicianId: 7,
    lat: 11.0251,
    lng: 76.9481,
    sequenceId: 12,
    recordedAt: now,
    receivedAt: now,
    eta: {
      requestId: "5502",
      etaSeconds: 300,
      distanceMeters: 1600,
      trafficAware: true,
      provider: "mappls",
      calculatedAt: now,
      destinationLat: CUSTOMER_SPOT.lat,
      destinationLng: CUSTOMER_SPOT.lng,
    },
    ...overrides,
  };
};

const isPhone = () => test.info().project.name === "phone";
const technicianMarker = (page: Page) => page.locator('[data-tracking-marker="technician"]');
const placeLabel = (page: Page, kind: "customer" | "drop") => page.locator(`[data-tracking-place="${kind}"] .tracking-place-marker__label`);
const card = (page: Page) => page.getByTestId("tracking-card");
const sheet = (page: Page) => page.getByTestId("tracking-sheet");
const cancelButton = (page: Page) => page.getByRole("button", { name: "Cancel request" });
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  // Let the app's opening splash and any sheet that is still rising finish first.
  await expect(page.getByText("Your Roadside Assistance Partner")).toHaveCount(0);
  await page.evaluate(() => Promise.all(
    document.getAnimations()
      .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => undefined)),
  ));
  await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` });
};

/** How much of the sheet shows above the bottom edge of the screen, once it has stopped moving. */
async function showing(page: Page) {
  const height = page.viewportSize()!.height;
  let last = -1;
  await expect.poll(async () => {
    const now = Math.round(height - (await sheet(page).boundingBox())!.y);
    const steady = now === last;
    last = now;
    return steady;
  }, { intervals: [150] }).toBe(true);
  return last;
}

/** Drags the card by its handle the way a thumb would. */
async function dragHandle(page: Page, dy: number) {
  const box = (await page.locator(".lt-grab").boundingBox())!;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + dy, { steps: 10 });
  await page.mouse.up();
}

/** On a phone the details sit behind the card; beside the map on a wide screen they are always open. */
async function openDetails(page: Page) {
  if (!isPhone()) return;
  await page.getByTestId("tracking-request").click();
  await expect(sheet(page)).toHaveAttribute("data-size", "expanded");
}

test.describe("technician on the way", () => {
  test("shows minutes left, the arrival time, who is coming and the fare", async ({ page }) => {
    const { socket, seen } = await openTracking(page);

    // Before the backend has sent an ETA nothing is guessed.
    await expect(card(page).locator(".lt-say")).toHaveText("Arun is on the way");
    await expect(page.getByTestId("tracking-big")).toHaveText("On the way");
    await expect(technicianMarker(page).locator(".tracking-tech-marker__badge")).toBeVisible();
    await expect(technicianMarker(page).locator(".tracking-tech-marker__eta")).toHaveCount(0);

    await expect.poll(async () => { socket.send("tracking:location:v1", fix()); return page.getByTestId("tracking-big").textContent(); }).toBe("5 min");
    await expect(card(page).locator(".lt-side")).toHaveText(/^Arrives by \d{1,2}:\d{2} (am|pm)$/);
    await expect(card(page).locator(".lt-sub")).toHaveText("1.6 km away · live traffic");
    socket.send("tracking:location:v1", fix({ sequenceId: 13 }));
    await expect(page.getByTestId("tracking-freshness")).toHaveText("Live");

    const who = page.getByTestId("tracking-technician");
    await expect(who).toContainText("Arun Kumar");
    await expect(who).toContainText("4.8 · 38 jobs · Verified");
    await expect(who.getByRole("link", { name: "Call Arun" })).toHaveAttribute("href", "tel:9876500000");
    await expect(who.getByRole("link", { name: "Message Arun" })).toHaveAttribute("href", "sms:9876500000");

    const row = page.getByTestId("tracking-request");
    await expect(row).toContainText("Lockout");
    await expect(row).toContainText("Tata Yodha · Commercial");
    await expect(row).toContainText("₹110");

    const steps = card(page).getByRole("list", { name: "Progress" }).getByRole("listitem");
    await expect(steps).toHaveText(["Found", "On the way", "At vehicle", "Done"]);
    await expect(steps.nth(1)).toHaveAttribute("aria-current", "step");

    // On the map: the technician's bike in a disc with the minutes over it, and the customer's own spot.
    const marker = technicianMarker(page);
    await expect(marker.locator(".tracking-tech-marker__eta")).toHaveText("5 min");
    await expect(marker.locator(".tracking-tech-marker__badge .rq-symbol")).toHaveText("two_wheeler");
    await expect(marker).not.toHaveClass(/is-stale/);
    await expect(placeLabel(page, "customer")).toHaveText("You");
    await expect(page.locator(".tracking-live-map")).not.toContainText("Technician");
    // The disc is a 44px circle whose middle is the map point: 18px below the middle of the marker's box.
    const placed = await marker.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const disc = el.querySelector(".tracking-tech-marker__badge")!.getBoundingClientRect();
      return {
        width: Math.round(disc.width),
        height: Math.round(disc.height),
        right: Math.round(disc.x + disc.width / 2 - (box.x + box.width / 2)),
        down: Math.round(disc.y + disc.height / 2 - (box.y + box.height / 2)),
      };
    });
    expect(placed).toEqual({ width: 44, height: 44, right: 0, down: 18 });
    const spot = (await page.locator('[data-tracking-place="customer"]').boundingBox())!;
    const dot = (await page.locator('[data-tracking-place="customer"] .tracking-place-marker__dot').boundingBox())!;
    expect(Math.round(dot.x + dot.width / 2 - (spot.x + spot.width / 2))).toBe(0);
    expect(Math.round(dot.y + dot.height / 2 - (spot.y + spot.height / 2))).toBe(18);
    await shot(page, "on-the-way");

    await openDetails(page);
    const details = page.getByTestId("tracking-details");
    await expect(details).toContainText("Help is coming to");
    await expect(details).toContainText("Bharathi Nagar, Ward 41, North Zone, Coimbatore 641001");
    const bill = page.getByTestId("tracking-bill");
    await expect(bill).toContainText("Technician charge₹100.00");
    await expect(bill).toContainText("Platform fee₹10.00");
    await expect(bill).toContainText("Total₹110.00");
    await expect(bill).toContainText("Price locked. You pay after the work is done.");
    await expect(details).toContainText(/Request #5502 · sent at \d{1,2}:\d{2} (am|pm)/);
    await shot(page, "details");

    expect(await noSideScroll(page)).toBe(true);
    expect(seen.errors).toEqual([]);
  });

  test("says when the technician's position is old and lets the customer refresh", async ({ page }) => {
    const { socket, seen } = await openTracking(page);
    const old = new Date(Date.now() - 12_000).toISOString();
    await expect.poll(async () => { socket.send("tracking:location:v1", fix({ recordedAt: old, receivedAt: old })); return page.getByTestId("tracking-freshness").textContent(); }).toBe("Delayed");

    const notice = card(page).getByRole("status");
    await expect(notice).toContainText("Location is delayed. Showing where Arun was last seen.");
    await expect(technicianMarker(page)).toHaveClass(/is-stale/);
    await shot(page, "delayed");
    const before = seen.fetches;
    await notice.getByRole("button", { name: "Refresh" }).click();
    await expect.poll(() => seen.fetches).toBeGreaterThan(before);
    await expect(card(page)).toBeVisible();
  });

  test("opens safety and help", async ({ page }) => {
    await openTracking(page);
    // On a phone SOS floats over the map; on a wide screen the site header has its own SOS,
    // so this request's help is opened from the details.
    if (isPhone()) await page.getByRole("button", { name: "Open safety and help" }).click();
    else await page.getByTestId("tracking-details").getByRole("button", { name: "Safety and emergency help" }).click();

    const help = page.getByRole("dialog", { name: "Safety and help" });
    await expect(help.getByRole("link", { name: "Open emergency assistance" })).toHaveAttribute("href", "/emergency");
    await expect(help.getByRole("link", { name: "Contact ResQNow support" })).toHaveAttribute("href", "/contact");
    await expect(help.getByRole("button", { name: "Share live tracking" })).toBeVisible();
    await shot(page, "sos");
    await page.keyboard.press("Escape");
    await expect(help).toBeHidden();
  });
});

test.describe("the card changes size on a phone", () => {
  test.beforeEach(() => { test.skip(!isPhone(), "On a wide screen the card sits beside the map and does not move."); });

  test("shrinks to a strip for the map, comes back, and opens for details", async ({ page }) => {
    const { socket, seen } = await openTracking(page);
    await expect.poll(async () => { socket.send("tracking:location:v1", fix()); return page.getByTestId("tracking-big").textContent(); }).toBe("5 min");
    const screen = page.viewportSize()!.height;

    // As it opens: the whole card, ending exactly on the bottom edge.
    await expect(sheet(page)).toHaveAttribute("data-size", "half");
    const cardHeight = await showing(page);
    const peek = (await page.locator(".lt-peek").boundingBox())!;
    expect(Math.abs(peek.y + peek.height - screen)).toBeLessThanOrEqual(2);
    const mapBefore = (await page.locator(".lt-mapwrap").boundingBox())!.height;

    // Dragged down: a strip with the time and Call; the map takes the room.
    await dragHandle(page, 150);
    await expect(sheet(page)).toHaveAttribute("data-size", "collapsed");
    const stripHeight = await showing(page);
    expect(stripHeight).toBeGreaterThan(90);
    expect(stripHeight).toBeLessThan(150);
    expect(stripHeight).toBeLessThan(cardHeight - 120);
    const strip = page.locator(".lt-mini");
    await expect(strip).toHaveCSS("opacity", "1");
    await expect(strip.locator(".lt-mini-big")).toHaveText("5 min");
    await expect(strip.locator(".lt-mini-side")).toHaveText(/^Arrives by /);
    await expect(strip.locator(".lt-mini-sub")).toHaveText("Arun is on the way · 1.6 km away");
    await expect(strip.getByRole("link", { name: "Call Arun" })).toHaveAttribute("href", "tel:9876500000");
    await expect(page.locator(".lt-peek")).toHaveCSS("opacity", "0");
    expect((await page.locator(".lt-mapwrap").boundingBox())!.height).toBeGreaterThan(mapBefore + 120);
    await shot(page, "map-view");

    // A tap on the strip brings the card back.
    await strip.getByRole("button", { name: "Show the full card" }).click();
    await expect(sheet(page)).toHaveAttribute("data-size", "half");
    expect(await showing(page)).toBe(cardHeight);
    await expect(page.locator(".lt-peek")).toHaveCSS("opacity", "1");

    // Dragged up: details, stopping under Back and SOS.
    await dragHandle(page, -260);
    await expect(sheet(page)).toHaveAttribute("data-size", "expanded");
    const openHeight = await showing(page);
    expect(openHeight).toBeGreaterThan(cardHeight + 150);
    const sos = (await page.getByRole("button", { name: "Open safety and help" }).boundingBox())!;
    expect(screen - openHeight).toBeGreaterThanOrEqual(Math.round(sos.y + sos.height));
    await expect(page.getByTestId("tracking-bill")).toBeVisible();

    // The handle steps back down, and a small nudge does not change the size.
    await page.locator(".lt-grab").click();
    await expect(sheet(page)).toHaveAttribute("data-size", "half");
    expect(await showing(page)).toBe(cardHeight);
    await dragHandle(page, 12);
    await expect(sheet(page)).toHaveAttribute("data-size", "half");
    expect(await showing(page)).toBe(cardHeight);
    expect(seen.errors).toEqual([]);
  });

  test("keeps Pay in the strip when payment is due", async ({ page }) => {
    await openTracking(page, request({ status: "payment_pending" }));
    await expect(page.getByTestId("tracking-big")).toHaveText("₹112.00");
    await showing(page);
    await dragHandle(page, 320);
    await expect(sheet(page)).toHaveAttribute("data-size", "collapsed");

    const strip = page.locator(".lt-mini");
    await expect(strip.locator(".lt-mini-big")).toHaveText("₹112.00");
    await expect(strip.locator(".lt-mini-side")).toHaveText("to pay");
    await shot(page, "map-view-pay");
    await strip.getByRole("button", { name: "Pay" }).click();
    await expect(page.getByRole("dialog", { name: "Confirm Your Payment" })).toBeVisible();
  });

  test("fits the payment card on a small phone", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openTracking(page, request({ status: "payment_pending" }));
    await showing(page);
    for (const name of [/^Pay ₹112\.00 online$/, "Pay cash to Arun"]) {
      const box = (await page.getByRole("button", { name }).boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(640);
    }
    expect(await noSideScroll(page)).toBe(true);
    await shot(page, "small-phone-pay");
  });
});

test.describe("cancelling", () => {
  test("is on the card while a technician is being found", async ({ page }) => {
    const { seen } = await openTracking(page, request({ status: "pending", technician: null }));
    await expect(page.getByTestId("tracking-big")).toHaveText("Finding a technician");
    await expect(card(page).locator(".lt-say")).toHaveText(/^Request sent · /);
    await shot(page, "searching");

    await card(page).getByRole("button", { name: "Cancel request" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel this request?" });
    await expect(dialog).toContainText("We are still finding a technician for you.");
    const confirm = dialog.getByRole("button", { name: "Cancel request" });
    await expect(confirm).toBeDisabled();
    await shot(page, "cancel-dialog");

    // Keeping the request is the easy way out.
    await dialog.getByRole("button", { name: "Keep my request" }).click();
    await expect(dialog).toBeHidden();
    expect(seen.cancels).toEqual([]);

    await card(page).getByRole("button", { name: "Cancel request" }).click();
    await dialog.getByRole("button", { name: "Taking too long" }).click();
    await expect(dialog.getByRole("button", { name: "Taking too long" })).toHaveAttribute("aria-pressed", "true");
    await confirm.click();

    await expect(page.getByTestId("tracking-big")).toHaveText("Request cancelled");
    expect(seen.cancels).toEqual([{ reason: "Taking too long" }]);
    await expect(cancelButton(page)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Back to home" }).last()).toBeVisible();
    await shot(page, "cancelled");
    expect(seen.errors).toEqual([]);
  });

  test("is in the details after a technician accepts, until they set off", async ({ page }) => {
    const { seen } = await openTracking(page, request({ status: "accepted" }));
    await expect(card(page).locator(".lt-say")).toHaveText("Arun accepted your request");
    await expect(card(page).getByRole("button", { name: "Cancel request" })).toHaveCount(0);

    await openDetails(page);
    await page.getByTestId("tracking-details").getByRole("button", { name: "Cancel request" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel this request?" });
    await expect(dialog).toContainText("Arun has accepted and is getting ready. You can cancel until they set off.");

    // "Another reason" needs the reason itself.
    await dialog.getByRole("button", { name: "Another reason" }).click();
    const confirm = dialog.getByRole("button", { name: "Cancel request" });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel("Tell us why").fill("  My friend is bringing a spare key  ");
    await confirm.click();

    await expect(page.getByTestId("tracking-big")).toHaveText("Request cancelled");
    expect(seen.cancels).toEqual([{ reason: "My friend is bringing a spare key" }]);
  });

  for (const [status, towing] of [["en-route", false], ["arrived", false], ["in-progress", false], ["en_route_pickup", true], ["enroute_drop", true]] as const) {
    test(`is closed once the request is ${status}`, async ({ page }) => {
      const { seen } = await openTracking(page, request(towing
        ? { status, isTowing: true, service_type: "towing", vehicle_type: "car", vehicle_model: "Maruti Suzuki Swift", drop_address: "Ganapathy workshop, Sathy Road", drop_latitude: DROP_SPOT.lat, drop_longitude: DROP_SPOT.lng, route_distance_km: 4.2 }
        : { status }));
      await expect(cancelButton(page)).toHaveCount(0);

      await openDetails(page);
      await expect(cancelButton(page)).toHaveCount(0);
      await expect(page.getByTestId("tracking-cancel-closed")).toHaveText("Cancelling closed when your technician set off. If something is wrong, contact support.");
      await expect(page.getByTestId("tracking-details").getByRole("link", { name: "Contact ResQNow support" })).toHaveAttribute("href", "/contact");
      expect(seen.cancels).toEqual([]);
    });
  }

  test("is refused when the technician sets off just before the tap", async ({ page }) => {
    const world = await openTracking(page, request({ status: "accepted" }));
    await openDetails(page);
    await page.getByTestId("tracking-details").getByRole("button", { name: "Cancel request" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel this request?" });
    await dialog.getByRole("button", { name: "Found other help" }).click();

    world.state.cancelAnswer = "late";
    await dialog.getByRole("button", { name: "Cancel request" }).click();

    await expect(page.getByText("This request can no longer be cancelled. Cancelling closes once your technician is on the way.")).toBeVisible();
    await expect(dialog).toBeHidden();
    await expect(card(page).locator(".lt-say")).toHaveText("Arun is on the way");
    await expect(cancelButton(page)).toHaveCount(0);
    expect(world.seen.cancels).toEqual([{ reason: "Found other help" }]);
  });

  test("closes the question when the technician sets off while it is open", async ({ page }) => {
    const world = await openTracking(page, request({ status: "accepted" }));
    await openDetails(page);
    await page.getByTestId("tracking-details").getByRole("button", { name: "Cancel request" }).click();
    const dialog = page.getByRole("dialog", { name: "Cancel this request?" });
    await expect(dialog).toBeVisible();

    world.state.request = { ...world.state.request, status: "en-route" };
    world.socket.send("job:status_update", { requestId: "5502", status: "en-route" });

    await expect(dialog).toBeHidden();
    await expect(card(page).locator(".lt-say")).toHaveText("Arun is on the way");
    await expect(cancelButton(page)).toHaveCount(0);
    expect(world.seen.cancels).toEqual([]);
  });
});

test.describe("after the work", () => {
  test("asks for payment online or in cash", async ({ page }) => {
    const { seen } = await openTracking(page, request({ status: "payment_pending" }));
    await expect(card(page).locator(".lt-say")).toHaveText("Work finished");
    await expect(page.getByTestId("tracking-big")).toHaveText("₹112.00");
    await expect(card(page).locator(".lt-side")).toHaveText("to pay");
    await expect(card(page).locator(".lt-sub")).toHaveText("Pay online, or give cash to Arun.");
    await expect(cancelButton(page)).toHaveCount(0);
    await shot(page, "pay");

    const pay = page.getByTestId("tracking-pay");
    await pay.getByRole("button", { name: "Pay ₹112.00 online" }).click();
    const online = page.getByRole("dialog", { name: "Confirm Your Payment" });
    await expect(online).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(online).toBeHidden();

    await pay.getByRole("button", { name: "Pay cash to Arun" }).click();
    await expect(page.getByRole("dialog", { name: "Cash Payment Summary" })).toBeVisible();
    expect(seen.quotes).toBeGreaterThan(0);
    expect(seen.errors).toEqual([]);
  });

  test("asks for a rating once paid, and goes home", async ({ page }) => {
    await openTracking(page, request({ status: "paid", payment_status: "completed" }));
    await expect(page.getByTestId("tracking-big")).toHaveText("How was Arun?");
    await expect(card(page).locator(".lt-say")).toHaveText("Payment received · ₹110.00");
    // This screen needs an answer: it stays one size and has nothing to drag.
    await expect(page.locator("button.lt-grab")).toHaveCount(0);
    await expect(page.locator(".lt-mini")).toHaveCount(0);
    await expect(page.getByTestId("tracking-details")).toHaveCount(0);
    await shot(page, "rate");

    const rating = page.getByTestId("tracking-rating");
    await rating.getByRole("button", { name: "Send rating" }).click();
    await expect(page.getByText("Please rate the service quality")).toBeVisible();
    await expect(page).toHaveURL(/request-service-tracking\/5502$/);

    await rating.getByRole("button", { name: "4 stars" }).click();
    await expect(rating.getByRole("button", { name: "4 stars" })).toHaveAttribute("aria-pressed", "true");
    await expect(rating.getByRole("button", { name: "5 stars" })).toHaveAttribute("aria-pressed", "false");
    await rating.getByLabel("Anything to add? (optional)").fill("Quick and careful");
    await rating.getByRole("button", { name: "Send rating" }).click();
    await expect(page.getByText("Thank you for your feedback")).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe("the map", () => {
  type MapCalls = {
    fits: Array<{ bounds?: [[number, number], [number, number]]; jump?: { center: [number, number]; zoom: number } }>;
    eases: Array<{ center: [number, number]; zoom: number }>;
  };
  /** Everything the camera has been told to do, as the stand-in map recorded it. */
  const mapCalls = (page: Page) => page.evaluate(() => {
    const calls = (window as unknown as { __fakeMappls: MapCalls }).__fakeMappls;
    return { fits: calls.fits, eases: calls.eases };
  });
  /** The frames drawn around two points: [[west, south], [east, north]]. */
  const frames = async (page: Page) => (await mapCalls(page)).fits.flatMap((call) => (call.bounds ? [call.bounds] : []));
  const followMoves = async (page: Page) => (await mapCalls(page)).eases;
  // Arun starts at 11.0268, 76.9458 and the customer is at 11.0168, 76.9558.
  const BOTH_ENDS = [[76.9458, CUSTOMER_SPOT.lat], [CUSTOMER_SPOT.lng, 11.0268]];
  const assignTechnician = (world: Awaited<ReturnType<typeof openTracking>>) => {
    world.state.request = request({ status: "accepted" });
    world.socket.send("job:status_update", { requestId: "5502", status: "accepted" });
  };

  test("frames the technician and the customer together as the page opens", async ({ page }) => {
    await openTracking(page);
    await expect.poll(async () => (await frames(page)).at(-1)).toEqual(BOTH_ENDS);
  });

  test("frames both when a technician is assigned after the page was opened", async ({ page }) => {
    const world = await openTracking(page, request({ status: "pending", technician: null }));
    // Still searching: the map is centred on the customer alone.
    await expect.poll(async () => (await mapCalls(page)).fits.at(-1)?.jump?.center).toEqual([CUSTOMER_SPOT.lng, CUSTOMER_SPOT.lat]);
    expect(await frames(page)).toEqual([]);

    assignTechnician(world);

    await expect(technicianMarker(page)).toBeVisible();
    await expect.poll(async () => (await frames(page)).at(-1)).toEqual(BOTH_ENDS);
    // Once is enough: the technician moving does not draw the frame again.
    const drawn = (await frames(page)).length;
    world.socket.send("tracking:location:v1", fix());
    await expect(technicianMarker(page).locator(".tracking-tech-marker__eta")).toHaveText("5 min");
    expect((await frames(page)).length).toBe(drawn);
  });

  test("glides the technician between positions and turns the pointer the way they travel", async ({ page }) => {
    const { socket, seen } = await openTracking(page);
    const left = () => page.evaluate(() => document.querySelector('[data-tracking-marker="technician"]')?.getBoundingClientRect().left ?? null);
    await expect(technicianMarker(page)).toBeVisible();
    const opened = (await left())!;
    socket.send("tracking:location:v1", fix({ sequenceId: 30 }));
    // Wait for the marker to come to rest on that position: 0.0023 degrees east of where the
    // page first drew it, which the stand-in map draws as 13.8px.
    await expect.poll(async () => Math.abs((await left())! - (opened + 13.8)), { intervals: [100] }).toBeLessThan(0.3);
    const from = (await left())!;

    // 300 metres due east: 0.0027 degrees, which the stand-in map draws as 16.2px.
    socket.send("tracking:location:v1", fix({ lng: 76.9481 + 0.0027, sequenceId: 31, heading: 90, speed: 12 }));
    const seenAt = await page.evaluate(async () => {
      const positions: number[] = [];
      const started = performance.now();
      while (performance.now() - started < 2200) {
        const marker = document.querySelector('[data-tracking-marker="technician"]');
        if (marker) positions.push(marker.getBoundingClientRect().left);
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return positions;
    });

    const to = from + 16.2;
    expect(Math.abs(seenAt.at(-1)! - to)).toBeLessThan(1);
    // Not one jump: the marker was drawn at several places on the way.
    const onTheWay = new Set(seenAt.filter((x) => x > from + 0.5 && x < to - 0.5).map((x) => x.toFixed(1)));
    expect(onTheWay.size).toBeGreaterThanOrEqual(4);
    // Never backwards, and never past where the technician really is.
    expect(seenAt.every((x, index) => index === 0 || x >= seenAt[index - 1] - 0.05)).toBe(true);
    expect(Math.max(...seenAt)).toBeLessThan(to + 1);

    await expect(technicianMarker(page)).toHaveClass(/has-heading/);
    const pointsTo = await technicianMarker(page).locator(".tracking-tech-marker__vehicle").evaluate((el) => {
      const [a, b] = getComputedStyle(el).transform.replace("matrix(", "").replace(")", "").split(",").map(Number);
      return Math.round((Math.atan2(b, a) * 180) / Math.PI);
    });
    expect(pointsTo).toBeGreaterThanOrEqual(80);
    expect(pointsTo).toBeLessThanOrEqual(100);
    expect(seen.errors).toEqual([]);
  });

  test.describe("on a phone", () => {
    test.beforeEach(() => { test.skip(!isPhone(), "The map beside the card on a wide screen is not moved by the card."); });

    test("leaves the map where the customer put it, until they tap Recentre", async ({ page }) => {
      const world = await openTracking(page, request({ status: "pending", technician: null }));
      await showing(page);
      // The customer touches the map: the card makes room and the map is theirs.
      await page.mouse.click(40, 200);
      await expect(sheet(page)).toHaveAttribute("data-size", "collapsed");

      assignTechnician(world);
      await expect(technicianMarker(page)).toBeVisible();
      await page.waitForTimeout(1000);
      expect(await frames(page)).toEqual([]);
      expect(await followMoves(page)).toEqual([]);

      await page.locator(".lt-mini").getByRole("button", { name: "Show the full card" }).click();
      await expect(sheet(page)).toHaveAttribute("data-size", "half");
      await showing(page);
      expect(await frames(page)).toEqual([]);

      await page.getByTestId("live-tracking-recenter").click();
      await expect.poll(async () => (await frames(page)).at(-1)).toEqual(BOTH_ENDS);
    });

    test("follows the technician in map view, stops when the customer touches the map, and resumes on Recentre", async ({ page }) => {
      const { socket, seen } = await openTracking(page);
      let step = 0;
      /** The technician moves about 130 metres east. */
      const drive = async () => {
        step += 1;
        const lng = 76.9481 + step * 0.0012;
        socket.send("tracking:location:v1", fix({ lng, sequenceId: 40 + step, heading: 90, speed: 12 }));
        await page.waitForTimeout(1500);
        return lng;
      };
      await drive();
      await showing(page);
      expect(await followMoves(page)).toEqual([]);

      // The card is dragged down to the strip: the map now keeps the technician in the middle.
      await dragHandle(page, 150);
      await expect(sheet(page)).toHaveAttribute("data-size", "collapsed");
      await expect.poll(async () => (await followMoves(page)).length).toBeGreaterThan(0);
      const second = await drive();
      const third = await drive();
      const followed = await followMoves(page);
      expect(followed.at(-1)!.zoom).toBe(15);
      expect(Math.abs(followed.at(-1)!.center[0] - third)).toBeLessThan(0.0002);
      expect(followed.some((move) => Math.abs(move.center[0] - second) < 0.0006)).toBe(true);

      // The customer touches the map: following stops, and the map is not pulled anywhere else.
      const framesBefore = (await frames(page)).length;
      await page.mouse.click(40, 200);
      const movesAtTouch = (await followMoves(page)).length;
      await drive();
      await drive();
      expect((await followMoves(page)).length).toBe(movesAtTouch);
      expect((await frames(page)).length).toBe(framesBefore);
      await expect(sheet(page)).toHaveAttribute("data-size", "collapsed");

      // Recentre hands the map back: it follows the technician again.
      await page.getByTestId("live-tracking-recenter").click();
      await expect.poll(async () => (await followMoves(page)).length).toBeGreaterThan(movesAtTouch);
      const resumed = await drive();
      await expect.poll(async () => Math.abs((await followMoves(page)).at(-1)!.center[0] - resumed)).toBeLessThan(0.0002);
      expect(seen.errors).toEqual([]);
    });
  });
});

test("towing shows the pickup, the drop and the tow's own steps", async ({ page }) => {
  const { socket } = await openTracking(page, request({
    status: "enroute_drop", isTowing: true, service_type: "towing", vehicle_type: "car", vehicle_model: "Maruti Suzuki Swift",
    address: "21, Race Course Road, Coimbatore", drop_address: "Ganapathy workshop, Sathy Road",
    drop_latitude: DROP_SPOT.lat, drop_longitude: DROP_SPOT.lng, route_distance_km: 4.2,
    amount: 820, baseAmount: 820, platformFee: 82, finalAmount: 902,
    technician: { id: 7, name: "Selvam R", phone: "9876511111", rating: 4.9, completedJobs: 212, avatar_url: null, location: { lat: 11.03, lng: 76.975 } },
  }));
  await expect(card(page).locator(".lt-say")).toHaveText("Towing to the drop point");

  const toDrop = fix({ eta: { ...fix().eta, etaSeconds: 360, distanceMeters: 1700, destinationLat: DROP_SPOT.lat, destinationLng: DROP_SPOT.lng } });
  await expect.poll(async () => { socket.send("tracking:location:v1", toDrop); return page.getByTestId("tracking-big").textContent(); }).toBe("6 min");
  await expect(card(page).locator(".lt-sub")).toHaveText("1.7 km away · Ganapathy workshop, Sathy Road");
  await expect(card(page).getByRole("list", { name: "Progress" }).getByRole("listitem")).toHaveText(["Found", "To pickup", "Towing", "Done"]);
  await expect(page.getByTestId("tracking-request")).toContainText("₹902");
  await expect(technicianMarker(page).locator(".tracking-tech-marker__badge .rq-symbol")).toHaveText("auto_towing");
  await expect(technicianMarker(page).locator(".tracking-tech-marker__eta")).toHaveText("6 min");
  await expect(placeLabel(page, "customer")).toHaveText("Pickup");
  await expect(placeLabel(page, "drop")).toHaveText("Drop");
  await shot(page, "towing");

  await openDetails(page);
  const details = page.getByTestId("tracking-details");
  await expect(details).toContainText("Towing route");
  await expect(details).toContainText("21, Race Course Road, Coimbatore");
  await expect(details).toContainText("Drop · 4.2 km");
  await expect(details).toContainText("Ganapathy workshop, Sathy Road");
  await shot(page, "towing-details");
});
