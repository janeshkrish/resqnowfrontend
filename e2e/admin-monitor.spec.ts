import { readFileSync } from "node:fs";
import { expect, test, type Page, type WebSocketRoute } from "@playwright/test";

// The admin Requests monitor, Watch list, Replay and the technician record. Every number on
// screen comes from the mocked admin API below, and live changes arrive over the fake socket.

const fakeMappls = readFileSync(new URL("./fixtures/fakeMapplsSdk.js", import.meta.url), "utf8");
const ADMIN_TOKEN = ["e30", Buffer.from(JSON.stringify({ role: "admin", type: "admin", email: "ops@resqnow.test" })).toString("base64url"), "e2e"].join(".");
const SHOTS = process.env.ADMIN_SHOTS_DIR;

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();
const MIN = 60_000;

function liveRequest(over: Record<string, unknown>) {
  return {
    id: 0, createdAt: iso(-10 * MIN), updatedAt: iso(-MIN), status: "on-the-way", phase: "on_the_way", steps: { done: 1, now: 1 },
    serviceType: "truck-lockout", vehicleType: "truck", vehicleModel: "Tata Yodha",
    customer: { id: 41, name: "Asha Raman", phoneMasked: "+91 98••• ••210" },
    technician: { id: 7, name: "Arun Kumar", rating: 4.8, serviceType: "mechanic" },
    address: "Bharathi Nagar, Coimbatore", location: { lat: 11.0268, lng: 76.9458 }, drop: null,
    fare: 110, paymentMethod: "cash", paymentStatus: "pending",
    acceptedAt: iso(-8 * MIN), promisedAt: iso(6 * MIN), promiseSource: "accepted", arrivedAt: null, workStartedAt: null, completedAt: null,
    search: { sent: 2, declined: 1, expired: 0, pending: 0, accepted: 1, startedAt: iso(-10 * MIN) },
    alerts: [],
    live: { lat: 11.02, lng: 76.95, heading: 90, speedKmh: 24, lastSeenAt: iso(-8_000), gpsStale: false, etaSeconds: 360, etaCalculatedAt: iso(-20_000), trafficAware: true, distanceKm: 2.4, distanceSource: "route" },
    ...over,
  };
}

function world() {
  const live = {
    generatedAt: iso(0),
    kpis: { live: 3, finding: 1, needsAttention: 1, acceptSecondsToday: 34, arrivalMinutesToday: 12, arrivalsMeasuredToday: 9, completedToday: 46 },
    requests: [
      liveRequest({ id: 5502 }),
      liveRequest({
        id: 5499, serviceType: "bike-flat-tire", vehicleModel: "Honda Activa", customer: { id: 52, name: "Priya M", phoneMasked: "+91 97••• ••118" },
        technician: { id: 9, name: "Ravi N", rating: 4.6, serviceType: "mechanic" }, promisedAt: iso(-3 * MIN),
        alerts: [{ code: "movement_stationary", text: "Technician appears stationary for too long while the job is active.", level: "medium", since: iso(-5 * MIN), etaMinutes: 9 }],
        live: { lat: 11.0, lng: 76.93, heading: 0, speedKmh: 0, lastSeenAt: iso(-12_000), gpsStale: false, etaSeconds: null, etaCalculatedAt: null, trafficAware: false, distanceKm: 3.2, distanceSource: "straight" },
      }),
      liveRequest({
        id: 5503, status: "pending", phase: "finding", steps: { done: 0, now: 0 }, serviceType: "car-battery", vehicleModel: "Hyundai i20",
        customer: { id: 60, name: "Deepak V", phoneMasked: null }, technician: null, acceptedAt: null, promisedAt: null, live: null,
        search: { sent: 3, declined: 1, expired: 0, pending: 2, accepted: 0, startedAt: iso(-48_000) }, createdAt: iso(-48_000),
      }),
    ],
  };
  const detail5502 = {
    ...live.requests[0],
    customer: { ...live.requests[0].customer, phone: "9876543210", requestNumber: 3 },
    technician: { ...(live.requests[0].technician as object), phone: "9443300507", phoneMasked: "+91 94••• ••507", jobsCompleted: 38 },
    bill: { total: 110, base: 100, platformFee: 10, paymentMethod: "cash", paymentStatus: "pending" },
    cancellationReason: null,
    timeline: [
      { at: iso(-6 * MIN), kind: "set_off", title: "Set off", description: null, actorType: "technician", actorId: "7", meta: {}, source: "timeline" },
      { at: iso(-8 * MIN), kind: "accepted", title: "Accepted", description: null, actorType: "technician", actorId: "7", meta: { promisedAt: iso(6 * MIN) }, source: "timeline" },
      { at: iso(-9 * MIN), kind: "offer", title: "Offered to Ravi N", description: null, actorType: "system", actorId: null, meta: { result: "rejected", technicianId: 9 }, source: "offers" },
      { at: iso(-10 * MIN), kind: "created", title: "Request sent", description: null, actorType: "user", actorId: "41", meta: {}, source: "timeline" },
    ],
    offers: [
      { technicianId: 9, name: "Ravi N", result: "rejected", sentAt: iso(-9 * MIN) },
      { technicianId: 7, name: "Arun Kumar", result: "accepted", sentAt: iso(-8.5 * MIN) },
    ],
    trail: [],
  };
  const detail5499 = {
    ...live.requests[1],
    customer: { ...live.requests[1].customer, phone: "9700000118", requestNumber: 1 },
    technician: { ...(live.requests[1].technician as object), phone: "9443300111", phoneMasked: "+91 94••• ••111", jobsCompleted: 112 },
    bill: { total: 350, base: 318, platformFee: 32, paymentMethod: "online", paymentStatus: "pending" },
    cancellationReason: null,
    timeline: [{ at: iso(-5 * MIN), kind: "alert", title: "Technician appears stationary", description: null, actorType: "system", actorId: null, meta: { code: "movement_stationary" }, source: "alerts" }],
    offers: [{ technicianId: 9, name: "Ravi N", result: "accepted", sentAt: iso(-18 * MIN) }],
    trail: [],
  };
  const replay5488 = {
    ...detail5502, id: 5488, status: "paid", phase: "done", steps: { done: 4, now: -1 }, arrivedAt: iso(-60 * MIN), completedAt: iso(-45 * MIN), workStartedAt: iso(-58 * MIN),
    timeline: [
      { at: iso(-45 * MIN), kind: "paid", title: "Paid", description: null, actorType: "user", actorId: "41", meta: {}, source: "timeline" },
      { at: iso(-60 * MIN), kind: "arrived", title: "Arrived", description: null, actorType: "technician", actorId: "7", meta: {}, source: "timeline" },
      { at: iso(-70 * MIN), kind: "accepted", title: "Accepted", description: null, actorType: "technician", actorId: "7", meta: {}, source: "timeline" },
    ],
    trail: [
      { lat: 11.0, lng: 76.92, at: iso(-70 * MIN), speedKmh: 0 },
      { lat: 11.01, lng: 76.93, at: iso(-66 * MIN), speedKmh: 22 },
      { lat: 11.02, lng: 76.94, at: iso(-62 * MIN), speedKmh: 25 },
      { lat: 11.0268, lng: 76.9458, at: iso(-60 * MIN), speedKmh: 0 },
    ],
    summary: { promisedAt: iso(-61 * MIN), arrivedAt: iso(-60 * MIN), lateMinutes: 1, distanceKm: 3.1, workMinutes: 13, rating: 5, ratingComment: "Quick" },
  };
  const record = {
    technician: { id: 42, name: "Selvam R", phone: "9443300507", phoneMasked: "+91 94••• ••507", serviceType: "car-towing", status: "approved", onDuty: true, available: false, currentRequestId: 5502, place: "Coimbatore", joinedAt: "2026-03-03T06:00:00.000Z", lastSeenAt: iso(-MIN) },
    kpis: {
      jobsCompleted: 207, jobsThisWeek: 19, jobsLastWeek: 17, offers: { sent: 248, accepted: 214, declined: 21, expired: 13, pending: 0 }, acceptanceRate: 214 / 248,
      removedByAdmin: 2, customerCancelledAfterAccepting: 3, onTimeRate: 0.92, arrivalsJudged: 25, averageMinutesToArrive: 11, arrivalsMeasured: 25,
      rating: 4.85, ratingCount: 164, lowRatings: 2, earnedThisMonth: 48600, earnedTotal: 412800, duesOwed: 0,
    },
    weekly: Array.from({ length: 12 }, (_, i) => ({ weekStart: new Date(Date.now() - (11 - i) * 7 * 86_400_000).toISOString(), jobs: [11, 13, 12, 15, 14, 16, 15, 17, 16, 18, 17, 19][i] })),
    flags: [{ kind: "late", title: "2 late arrivals this week", text: "#5466 by 7 min, #5431 by 9 min", tab: "reliability" }],
    reliability: {
      offers: { sent: 248, accepted: 214, declined: 21, expired: 13, pending: 0 },
      removedByAdmin: [{ requestId: 5311, at: iso(-10 * 86_400_000) }, { requestId: 5207, at: iso(-17 * 86_400_000) }],
      customerCancelled: [{ requestId: 5420, at: iso(-2 * 86_400_000), reason: "Found help nearby", serviceType: "car-towing" }],
      arrivals: { onTime: 23, late1to5: 1, late6to10: 1, lateOver10: 0 }, arrivalsJudged: 25,
      late: [{ requestId: 5466, serviceType: "car-winching", promisedAt: iso(-127 * MIN), arrivedAt: iso(-120 * MIN), lateMinutes: 7 }],
      alerts: [{ code: "arrival_delay", label: "ETA past the deadline", count: 4 }, { code: "start_delay", label: "Not moving after accepting", count: 3 }, { code: "gps_inactive", label: "GPS stopped updating", count: 2 }, { code: "movement_stationary", label: "Stopped on the way", count: 1 }],
      alertsSince: iso(-90 * 86_400_000),
    },
    reviews: { average: 4.85, count: 164, distribution: [{ stars: 5, count: 148 }, { stars: 4, count: 11 }, { stars: 3, count: 3 }, { stars: 2, count: 1 }, { stars: 1, count: 1 }] },
  };
  return { live, detail5502, detail5499, replay5488, record, calls: [] as string[], recordLoads: 0, notes: [] as string[] };
}

async function fakeAdminSocket(page: Page) {
  const sockets = new Set<WebSocketRoute>();
  const subscriptions: string[] = [];
  await page.routeWebSocket(/\/socket\.io\//, (ws) => {
    sockets.add(ws);
    ws.send(`0${JSON.stringify({ sid: `e2e-${sockets.size}`, upgrades: [], pingInterval: 25000, pingTimeout: 20000, maxPayload: 1e6 })}`);
    ws.onClose(() => sockets.delete(ws));
    ws.onMessage((message) => {
      const text = String(message);
      if (text === "2") return ws.send("3");
      if (text.startsWith("40")) return ws.send(`40${JSON.stringify({ sid: `e2e-socket-${sockets.size}` })}`);
      const match = /^42(\d+)(\[.*\])$/.exec(text);
      if (!match) return;
      const [event, arg] = JSON.parse(match[2]);
      if (event === "tracking:subscribe:v1") subscriptions.push(String(arg?.requestId));
      ws.send(`43${match[1]}${JSON.stringify([{ ok: true, location: null }])}`);
    });
  });
  return { subscriptions, send: (event: string, data: unknown) => sockets.forEach((ws) => ws.send(`42${JSON.stringify([event, data])}`)) };
}

async function openAdmin(page: Page, path: string) {
  const w = world();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript((token) => {
    localStorage.setItem("resqnow_admin_token", token);
    localStorage.setItem("resqnow_admin_user", JSON.stringify({ id: "admin", name: "Ops", email: "ops@resqnow.test", role: "admin" }));
  }, ADMIN_TOKEN);
  await page.route(/\/src\/lib\/mapProvider\/mapplsSdk\.ts(\?.*)?$/, (route) => route.fulfill({ contentType: "application/javascript", body: fakeMappls }));
  const socket = await fakeAdminSocket(page);
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const call = route.request();
    const url = new URL(call.url());
    const method = call.method();
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (method !== "GET") w.calls.push(`${method} ${url.pathname}`);
    const p = url.pathname;
    if (p === "/api/admin/monitor/live") return reply(200, w.live);
    if (p === "/api/admin/monitor/requests/5502") return reply(200, w.detail5502);
    if (p === "/api/admin/monitor/requests/5499") return reply(200, w.detail5499);
    if (p === "/api/admin/monitor/requests/5488/replay") return reply(200, w.replay5488);
    if (p === "/api/admin/monitor/requests/5502/notes" && method === "POST") {
      const note = String(JSON.parse(call.postData() || "{}").note || "");
      w.notes.push(note);
      w.detail5502 = { ...w.detail5502, timeline: [{ at: iso(0), kind: "admin_note", title: "Note", description: note, actorType: "admin", actorId: "ops@resqnow.test", meta: {}, source: "timeline" }, ...w.detail5502.timeline] };
      return reply(201, { success: true });
    }
    if (p === "/api/admin/monitor/technicians/42/record") { w.recordLoads += 1; return reply(200, w.record); }
    if (p === "/api/admin/monitor/technicians/42/jobs") {
      const all = [
        { id: 5466, createdAt: iso(-140 * MIN), status: "paid", phase: "done", serviceType: "car-winching", customer: "Ganesh P", distanceKm: 3.3, promisedAt: iso(-127 * MIN), arrivedAt: iso(-120 * MIN), lateMinutes: 7, workMinutes: 44, fare: 1100, paymentMethod: "cash", paymentStatus: "paid", rating: 4 },
        { id: 5476, createdAt: iso(-200 * MIN), status: "paid", phase: "done", serviceType: "car-towing", customer: "Nisha V", distanceKm: 4.1, promisedAt: iso(-190 * MIN), arrivedAt: iso(-191 * MIN), lateMinutes: 0, workMinutes: 38, fare: 760, paymentMethod: "online", paymentStatus: "paid", rating: 5 },
      ];
      const term = (url.searchParams.get("search") || "").toLowerCase();
      const data = all.filter((j) => !term || String(j.id).includes(term) || j.customer.toLowerCase().includes(term));
      return reply(200, { data, pagination: { page: 1, limit: 12, total: data.length, totalPages: 1 } });
    }
    if (p === "/api/admin/monitor/technicians/42/reviews") {
      return reply(200, { data: [
        { id: 1, requestId: 5476, rating: 5, comment: "Came before time and handled the car carefully.", createdAt: iso(-180 * MIN), customer: "Nisha V", serviceType: "car-towing" },
        { id: 2, requestId: 5386, rating: 2, comment: "Waited long and the truck was too small.", createdAt: iso(-5 * 86_400_000), customer: "Prakash N", serviceType: "car-towing" },
      ], pagination: { page: 1, limit: 10, total: 2, totalPages: 1 } });
    }
    if (p.startsWith("/api/admin/command-center/actions/") || p.startsWith("/api/admin/requests/")) return reply(200, { success: true });
    return reply(200, {});
  });
  await page.goto(path);
  return { w, socket, errors };
}

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  // The app's launch splash covers every page for a moment after loading.
  await expect.poll(() => page.evaluate(() => !document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest(".fixed.inset-0.z-50"))).toBe(true);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-admin-${name}.png`, animations: "disabled" });
};

test("Live requests: each job's live line, the day's numbers, tabs and search, all from the server", async ({ page }) => {
  const { w, socket, errors } = await openAdmin(page, "/admin/extended/requests");
  const board = page.getByTestId("live-requests");
  await expect(board).toBeVisible();
  await expect(board.locator(".am-kpi").filter({ hasText: "Live now" })).toContainText("3");
  await expect(board.locator(".am-kpi").filter({ hasText: "Time to accept, today" })).toContainText("34");
  await expect(board.locator(".am-kpi").filter({ hasText: "Completed today" })).toContainText("46");

  const arun = page.getByTestId("live-row-5502");
  await expect(arun).toContainText("Lockout");
  await expect(arun).toContainText("Arun Kumar");
  await expect(arun.locator(".am-chip")).toHaveText(/On the way/);
  await expect(arun).toContainText("6 min · arrives");
  await expect(arun).toContainText(/seen \d+ s ago/);

  const ravi = page.getByTestId("live-row-5499");
  await expect(ravi.locator(".am-chip")).toHaveText(/Stopped on the way/);
  await expect(ravi).toHaveClass(/is-risk/);
  await expect(ravi).toContainText("3.2 km away");

  const deepak = page.getByTestId("live-row-5503");
  await expect(deepak).toContainText("Finding a technician");
  await expect(deepak).toContainText("3 offered · 1 declined");

  await expect(board.locator(".am-kpi").filter({ hasText: "Needs attention" })).toContainText("1");
  await shot(page, "requests");

  await page.getByRole("tab", { name: /^Finding/ }).click();
  await expect(page.getByTestId("live-row-5503")).toBeVisible();
  await expect(page.getByTestId("live-row-5502")).toHaveCount(0);
  await page.getByRole("tab", { name: /^All live/ }).click();
  await page.getByLabel("Search requests", { exact: true }).fill("priya");
  await expect(page.getByTestId("live-row-5499")).toBeVisible();
  await expect(page.getByTestId("live-row-5502")).toHaveCount(0);
  await page.getByLabel("Search requests", { exact: true }).fill("");

  // The server moves #5502 on and says so: the row changes without a reload.
  w.live = { ...w.live, requests: w.live.requests.map((r) => (r.id === 5502 ? { ...r, status: "arrived", phase: "arrived", steps: { done: 2, now: 2 }, arrivedAt: iso(-5_000) } : r)) };
  socket.send("admin:request_event", { requestId: 5502, eventType: "arrived", status: "arrived" });
  await expect(page.getByTestId("live-row-5502").locator(".am-chip")).toHaveText(/Arrived/);
  await expect(page.getByTestId("live-row-5502")).toContainText("At the vehicle");

  await expect(page.locator('nav[aria-label="Admin"] a[href="/admin/requests"]')).toHaveCount(1);
  expect(await noSideScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});

test("Monitor: one job on its live map, the live feed moves the ETA, and the timeline takes notes", async ({ page }) => {
  const { w, socket, errors } = await openAdmin(page, "/admin/extended/requests");
  await page.getByTestId("live-row-5502").getByRole("button", { name: "Monitor" }).click();
  const panel = page.getByTestId("request-monitor");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("heading", { name: /#5502 · Lockout/ })).toBeVisible();
  await expect(panel.locator(".am-strip")).toContainText("Arrives");
  await expect(panel.locator(".am-strip")).toContainText("2.4 km");
  await expect(panel.locator(".am-strip")).toContainText(/promised/);
  await expect.poll(() => socket.subscriptions.includes("5502")).toBe(true);

  // The technician's position arrives on the request's own feed, with a newer ETA.
  socket.send("tracking:location:v1", {
    requestId: "5502", technicianId: 7, lat: 11.024, lng: 76.947, sequenceId: 40, recordedAt: iso(0), receivedAt: iso(0),
    eta: { requestId: "5502", etaSeconds: 180, distanceMeters: 900, trafficAware: true, provider: "mappls", calculatedAt: iso(0) },
  });
  await expect(panel.locator(".am-strip")).toContainText("0.9 km");
  // The technician is on the map, labelled with the live ETA.
  await expect(panel.locator("[data-fake-marker]").filter({ hasText: "3 min" })).toBeVisible();
  await expect(panel.locator(".am-strip")).toContainText(/\d+ s ago/);

  const timeline = panel.locator(".am-tl");
  await expect(timeline).toContainText("Set off");
  await expect(timeline).toContainText("Offered to Ravi N");
  await expect(timeline).toContainText("Promised arrival");
  await expect(panel.locator(".am-offers")).toContainText("Declined");
  await expect(panel.getByRole("link", { name: "Arun Kumar", exact: true })).toHaveAttribute("href", "/admin/technicians/7");
  await expect(panel.getByRole("link", { name: "Call Asha Raman" })).toHaveAttribute("href", "tel:9876543210");
  await expect(panel.locator(".am-kv")).toContainText("₹110");
  await shot(page, "monitor");

  await panel.getByRole("button", { name: "Add note" }).click();
  await panel.getByLabel("Note for the timeline").fill("Called Arun, he is at the signal");
  await panel.getByRole("button", { name: "Save note" }).click();
  await expect(timeline).toContainText("Called Arun, he is at the signal");
  expect(w.notes).toEqual(["Called Arun, he is at the signal"]);

  await panel.getByRole("button", { name: "Escalate" }).click();
  await expect.poll(() => w.calls).toContain("POST /api/admin/requests/5502/escalate");
  await expect(page.getByText("Escalated: the search is widened", { exact: true })).toBeVisible();
  // A mouse over the mobile top-centre toast intentionally pauses its expiry.
  // Let the notification finish before trying the Close button underneath it.
  await page.mouse.move(0, 0);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
  await panel.getByRole("button", { name: "Close", exact: true }).click();
  await expect(panel).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("When something goes wrong: the reason in plain words and the next steps", async ({ page }) => {
  const { w, errors } = await openAdmin(page, "/admin/extended/requests");
  await page.getByTestId("live-row-5499").getByRole("button", { name: "Monitor" }).click();
  const panel = page.getByTestId("request-monitor");
  const alert = panel.getByRole("alert");
  await expect(alert).toContainText("Stopped on the way");
  await expect(alert).toContainText("stationary");
  await expect(alert.getByRole("link", { name: "Call Ravi" })).toHaveAttribute("href", "tel:9443300111");
  await shot(page, "monitor-alert");
  await alert.getByRole("button", { name: "Send reminder" }).click();
  await expect.poll(() => w.calls).toContain("POST /api/admin/command-center/actions/remind-technician");
  await alert.getByRole("button", { name: "Reassign" }).click();
  await panel.getByRole("alertdialog").getByRole("button", { name: "Reassign" }).click();
  await expect.poll(() => w.calls).toContain("POST /api/admin/command-center/actions/reassign");
  expect(errors).toEqual([]);
});

test("Watch list: pinned jobs side by side, each on its own live map", async ({ page }) => {
  const { errors } = await openAdmin(page, "/admin/extended/requests");
  await page.getByRole("button", { name: "Pin #5502 to the watch list" }).click();
  await page.getByRole("button", { name: "Pin #5499 to the watch list" }).click();
  await expect(page.getByRole("button", { name: "Unpin #5502" })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/admin/extended/watch");
  await expect(page.getByTestId("watch-card-5502")).toContainText("Arun Kumar → Asha Raman");
  await expect(page.getByTestId("watch-card-5499")).toHaveClass(/is-risk/);
  await expect(page.getByTestId("watch-list")).toContainText("2 of 4 pinned");
  await shot(page, "watch");
  await page.getByRole("button", { name: "Unpin #5499" }).click();
  await expect(page.getByTestId("watch-card-5499")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Replay: a finished job's route, what happened and how long it took", async ({ page }) => {
  const { errors } = await openAdmin(page, "/admin/extended/requests/5488/replay");
  const replay = page.getByTestId("request-replay");
  await expect(replay.getByRole("heading", { name: /#5488 · Lockout · replay/ })).toBeVisible();
  await expect(replay.locator(".am-kpi").filter({ hasText: "Distance driven" })).toContainText("3.1");
  await expect(replay.locator(".am-kpi").filter({ hasText: "Arrived" })).toContainText("+1 min");
  await expect(replay.locator(".am-kpi").filter({ hasText: "Work took" })).toContainText("13");
  await expect(replay.locator(".am-side")).toContainText("Arrived");
  const slider = replay.getByLabel("Replay position");
  await slider.fill("3");
  await expect(replay.locator(".am-replay-at")).not.toBeEmpty();
  await shot(page, "replay");
  expect(errors).toEqual([]);
});

test("Technician record: the numbers, job history, cancellations and delays, and reviews", async ({ page }) => {
  const { w, socket, errors } = await openAdmin(page, "/admin/technicians/42");
  const record = page.getByTestId("technician-page");
  await expect(record.locator(".pp-name")).toContainText("Selvam R");
  await expect(record).toContainText("On duty · on job #5502");
  const kpi = (label: string) => record.locator(".at-kpi").filter({ hasText: label });
  await expect(kpi("Jobs completed")).toContainText("207");
  await expect(kpi("Offers accepted")).toContainText("86%");
  await expect(kpi("Offers accepted")).toContainText("214 of 248");
  await expect(kpi("On-time arrival")).toContainText("92%");
  await expect(kpi("Rating")).toContainText("4.8");
  await expect(kpi("Earned this month")).toContainText("₹48,600");
  await expect(record.locator(".at-bar")).toHaveCount(12);
  await expect(record.locator(".at-flag")).toContainText("2 late arrivals this week");
  await shot(page, "record");

  await record.getByRole("button", { name: /^Jobs/ }).click();
  await expect(record.getByRole("table", { name: "Job history" })).toContainText("Ganesh P");
  await expect(record.getByRole("table", { name: "Job history" })).toContainText("7 late");
  await record.getByLabel("Search jobs").fill("nisha");
  await expect(record.getByRole("table", { name: "Job history" })).not.toContainText("Ganesh P");

  await record.getByRole("button", { name: /^Cancellations and delays/ }).click();
  await expect(record.locator(".at-fun").filter({ hasText: "Let expire" })).toContainText("13");
  await expect(record.locator(".at-fun").filter({ hasText: "Taken off by an admin" })).toContainText("2");
  await expect(record.getByRole("table", { name: "Cancellations" })).toContainText("Found help nearby");
  await expect(record.getByRole("table", { name: "Late arrivals" })).toContainText("7 min");
  await shot(page, "record-reliability");

  await record.getByRole("button", { name: /^Reviews/ }).click();
  await expect(record.locator(".at-score")).toContainText("4.8");
  await expect(record.locator(".at-review.is-low")).toContainText("truck was too small");

  // A request changes somewhere: the record is fetched again, live.
  const before = w.recordLoads;
  socket.send("admin:request_event", { requestId: 5502, eventType: "arrived" });
  await expect.poll(() => w.recordLoads, { timeout: 15_000 }).toBeGreaterThan(before);
  expect(await noSideScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});
