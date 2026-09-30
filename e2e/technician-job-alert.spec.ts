import { expect, test, type Locator, type Page, type WebSocketRoute } from "@playwright/test";

// A job offer as resqnowbackend/services/dispatchQueueService.js sends it on the socket.
const offer = {
  id: "6101",
  requestId: "6101",
  jobId: "6101",
  isTowing: false,
  customerName: "Asha",
  serviceType: "flat-tyre",
  vehicleType: "car",
  location: { lat: 11.0168, lng: 76.9558, address: "21, Race Course Road, Coimbatore" },
  address: "21, Race Course Road, Coimbatore",
  distance: "2.4 km",
  eta: "8 min",
  amount: 350,
  technicianEstimatedEarning: 350,
  landmark: "Opposite the petrol bunk",
};

// What resqnowbackend/services/notificationService.js pushes for the same offer.
const offerPush = {
  event: "job_offer",
  type: "EMERGENCY_JOB",
  requestId: "6101",
  jobId: "6101",
  serviceType: "flat-tyre",
  customerName: "Asha",
  locationDistance: "2.4 km",
  priceAmount: "350",
  deepLinkPath: "/job/6101",
};

// Speaks just enough Engine.IO v4 / Socket.IO v5 to stand in for the backend's socket
// server: every socket that joins `technician_<id>` gets what is sent to that room.
async function fakeSocketServer(page: Page) {
  const members = new Map<WebSocketRoute, Set<string>>();
  await page.routeWebSocket(/\/socket\.io\//, (ws) => {
    const rooms = new Set<string>();
    members.set(ws, rooms);
    ws.send(`0${JSON.stringify({ sid: `e2e-${members.size}`, upgrades: [], pingInterval: 25000, pingTimeout: 20000, maxPayload: 1e6 })}`);
    ws.onClose(() => members.delete(ws));
    ws.onMessage((message) => {
      const text = String(message);
      if (text === "2") return ws.send("3");
      if (text.startsWith("40")) return ws.send(`40${JSON.stringify({ sid: `e2e-socket-${members.size}` })}`);
      const match = /^42(\d*)(\[.*\])$/.exec(text);
      if (!match) return;
      const [event, arg] = JSON.parse(match[2]);
      if (event === "join_technician_room") {
        rooms.add(`technician_${arg}`);
        if (match[1]) ws.send(`43${match[1]}${JSON.stringify([{ ok: true }])}`);
      }
    });
  });
  const inRoom = () => [...members].filter(([, rooms]) => rooms.has("technician_7")).map(([ws]) => ws);
  return {
    /**
     * Waits until the page's sockets have settled in the technician's room: the app's socket,
     * plus the dashboard's own one there. The app reconnects once the profile has loaded.
     */
    joined: async (sockets = 1) => {
      let steadySince = 0;
      await expect
        .poll(() => {
          if (inRoom().length !== sockets || members.size !== sockets) return (steadySince = 0, false);
          steadySince ||= Date.now();
          return Date.now() - steadySince >= 1000;
        }, { intervals: [100] })
        .toBe(true);
    },
    send: (event: string, data: unknown) => inRoom().forEach((ws) => ws.send(`42${JSON.stringify([event, data])}`)),
  };
}

type Call = { method: string; path: string; body: unknown };

async function signInTechnician(page: Page, options: { onJob?: boolean } = {}) {
  const errors: string[] = [];
  const calls: Call[] = [];
  let accepted = false;
  page.on("pageerror", (error) => errors.push(error.message));
  // A signed-in technician: the test token only ever reaches the mocked API below.
  await page.addInitScript(() => localStorage.setItem("resqnow_technician_token", "e2e-technician-token"));
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const reply = (status: number, body: unknown) =>
      route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (request.method() !== "GET") calls.push({ method: request.method(), path, body: request.postDataJSON() });

    if (path === "/api/technicians/me") {
      return reply(200, {
        id: 7, name: "Arun Kumar", email: "arun@example.test", phone: "9876500000", status: "approved",
        verification_status: "verified", is_active: true, is_available: true, service_type: "mechanic",
        specialties: ["flat-tyre"], vehicle_types: ["car", "bike"],
      });
    }
    if (path === "/api/technicians/me/active-job" || path === "/api/technician/active-job/7") {
      if (accepted) return reply(200, { id: "6101", requestId: "6101", status: "accepted", serviceType: "flat-tyre", customerName: "Asha", address: offer.address, amount: 350 });
      if (options.onJob) return reply(200, { id: "5900", requestId: "5900", status: "arrived", serviceType: "battery", customerName: "Ravi", address: "Gandhipuram" });
      return reply(200, null);
    }
    if (path === "/api/service-requests/6101/technician-offer") {
      return reply(200, { available: true, request: { ...offer, status: "pending", offer_status: "pending" } });
    }
    if (path === "/api/jobs/accept") {
      accepted = true;
      return reply(200, { success: true, request: { id: "6101", status: "accepted" } });
    }
    if (path === "/api/service-requests/6101/technician-status") return reply(200, { success: true, status: "rejected" });
    if (path === "/api/technicians/requests" || path === "/api/technicians/me/notifications") return reply(200, []);
    return reply(404, {});
  });
  return { errors, calls };
}

/**
 * Stands in for the Android app's native side: Capacitor's bridge, with the push
 * notification, app, splash screen, location and JobAlerts plugins.
 */
async function openInAndroidApp(page: Page, jobAlerts = { notificationsEnabled: true, fullScreenAllowed: true, ignoringBatteryOptimizations: true }) {
  await page.addInitScript((status) => {
    const plugins: Record<string, string[]> = {
      App: ["addListener", "removeListener", "removeAllListeners", "getLaunchUrl", "getState", "getInfo"],
      SplashScreen: ["show", "hide"],
      PushNotifications: ["requestPermissions", "checkPermissions", "register", "unregister", "addListener", "removeListener", "removeAllListeners", "getDeliveredNotifications", "createChannel"],
      Geolocation: ["getCurrentPosition", "watchPosition", "clearWatch", "checkPermissions", "requestPermissions"],
      JobAlerts: ["getStatus", "openSettings"],
      TechnicianTracking: ["start", "stop", "addListener", "removeListener"],
    };
    const callbacks = new Set(["addListener", "watchPosition"]);
    const listeners: Record<string, Array<(data: unknown) => void>> = {};
    const calls: Array<{ plugin: string; method: string; options: unknown }> = [];
    let nextId = 1;
    const answers: Record<string, unknown> = {
      "PushNotifications.requestPermissions": { receive: "granted" },
      "PushNotifications.checkPermissions": { receive: "granted" },
      "Geolocation.checkPermissions": { location: "granted", coarseLocation: "granted" },
      "Geolocation.requestPermissions": { location: "granted", coarseLocation: "granted" },
      "Geolocation.getCurrentPosition": { coords: { latitude: 11.01, longitude: 76.95, accuracy: 10 }, timestamp: Date.now() },
      "App.getState": { isActive: true },
      "JobAlerts.getStatus": status,
    };
    Object.assign(window, {
      androidBridge: { postMessage() {} },
      Capacitor: {
        PluginHeaders: Object.entries(plugins).map(([name, methods]) => ({
          name,
          methods: methods.map((method) => ({ name: method, rtype: callbacks.has(method) ? "callback" : "promise" })),
        })),
        nativePromise: async (plugin: string, method: string, options: unknown) => {
          calls.push({ plugin, method, options });
          return answers[`${plugin}.${method}`] ?? {};
        },
        nativeCallback: (plugin: string, method: string, options: { eventName?: string }, callback: (data: unknown) => void) => {
          calls.push({ plugin, method, options });
          if (method === "addListener") (listeners[`${plugin}.${options?.eventName}`] ??= []).push(callback);
          return String(nextId++);
        },
      },
      __android: {
        calls,
        /** A push that reached MyFirebaseMessagingService with the app on screen. */
        push: (data: Record<string, string>) =>
          (listeners["PushNotifications.pushNotificationReceived"] || []).forEach((cb) => cb({ id: "push-1", data })),
        pushListeners: () => (listeners["PushNotifications.pushNotificationReceived"] || []).length,
      },
    });
  }, jobAlerts);
}

/** The browser's notification permission; the prompt answers with `window.__notificationAnswer`. */
async function fakeNotificationPermission(page: Page, initial: NotificationPermission) {
  await page.addInitScript((start) => {
    let state: NotificationPermission = start;
    Object.defineProperty(Notification, "permission", { configurable: true, get: () => state });
    Notification.requestPermission = async () => {
      const answer = (window as unknown as { __notificationAnswer?: NotificationPermission }).__notificationAnswer;
      if (answer) state = answer;
      return state;
    };
  }, initial);
}

/** The page is on screen and the app listens for pushes, as when a technician has it open. */
async function pushReady(page: Page, pageContent: Locator) {
  await expect(pageContent).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __android: { pushListeners(): number } }).__android.pushListeners()))
    .toBeGreaterThan(0);
}

async function slideToAccept(card: Locator) {
  const handle = card.locator(".cursor-grab").first();
  const track = card.getByText("Slide to Accept").locator("xpath=ancestor::div[contains(@class,'rounded-full')][1]");
  // On a phone the card is a bottom sheet: let it finish sliding in, then bring the control up.
  await handle.scrollIntoViewIfNeeded();
  let from = await handle.boundingBox();
  await expect
    .poll(async () => {
      const now = await handle.boundingBox();
      const settled = Boolean(now && from && now.x === from.x && now.y === from.y);
      from = now;
      return settled;
    }, { intervals: [150] })
    .toBe(true);
  const to = await track.boundingBox();
  if (!from || !to) throw new Error("slide control not found");
  const page = card.page();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  for (let step = 1; step <= 12; step++) {
    await page.mouse.move(from.x + from.width / 2 + ((to.width - from.width) * step) / 12, from.y + from.height / 2);
  }
  await page.mouse.up();
}

test.describe("web app", () => {
  test("dashboard: a new request pops up the request card, and sliding accepts it", async ({ page }) => {
    const socket = await fakeSocketServer(page);
    const { errors, calls } = await signInTechnician(page);
    await page.goto("/technician/dashboard");
    await socket.joined(2);

    // The backend sends each offer twice on the socket: still one card.
    socket.send("JOB_ALERT", offer);
    socket.send("job_offer", offer);

    const card = page.getByRole("dialog");
    await expect(card).toBeVisible();
    await expect(card).toContainText(/flat tyre/i);
    await expect(card).toContainText("Asha");
    await expect(card.getByTestId("job-details")).toContainText("Landmark:Opposite the petrol bunk");
    await expect(page.getByRole("dialog")).toHaveCount(1);

    await slideToAccept(card);
    await expect(page).toHaveURL(/\/technician\/active-job\/6101$/);
    expect(calls).toContainEqual({ method: "POST", path: "/api/jobs/accept", body: { jobId: "6101" } });
    expect(errors).toEqual([]);
  });

  test("other technician pages: a new request pops up the same card (it used to show only on the dashboard)", async ({ page }) => {
    const socket = await fakeSocketServer(page);
    const { errors, calls } = await signInTechnician(page);
    await page.goto("/technician/history");
    await socket.joined();

    socket.send("JOB_ALERT", offer);
    socket.send("job_offer", offer);

    const card = page.getByRole("dialog");
    await expect(card).toBeVisible();
    await expect(card).toContainText(/flat tyre/i);
    await expect(card).toContainText("350");
    await expect(page.getByRole("dialog")).toHaveCount(1);
    if (process.env.REQUEST_SHOTS_DIR) await page.screenshot({ path: `${process.env.REQUEST_SHOTS_DIR}/${test.info().project.name}-job-alert-history.png` });

    // Rejecting hands the job to the next technician straight away.
    await card.getByRole("button", { name: "Reject Offer" }).click();
    await expect(card).toBeHidden();
    await expect.poll(() => calls).toContainEqual({
      method: "PATCH",
      path: "/api/service-requests/6101/technician-status",
      body: { status: "rejected" },
    });
    expect(errors).toEqual([]);
  });

  test("the card says the job is gone when another technician takes it first", async ({ page }) => {
    const socket = await fakeSocketServer(page);
    const { errors } = await signInTechnician(page);
    await page.goto("/technician/earnings");
    await socket.joined();

    socket.send("job_offer", offer);
    const card = page.getByRole("dialog");
    await expect(card).toBeVisible();

    socket.send("job:revoked", { requestId: "6101" });
    await expect(card).toContainText("Offer Closed");
    await expect(card).toContainText("This job has already been taken by another technician.");
    await card.getByRole("button", { name: "Dismiss Alert" }).click();
    await expect(card).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("a technician already on a job does not get new request cards", async ({ page }) => {
    const socket = await fakeSocketServer(page);
    const { errors } = await signInTechnician(page, { onJob: true });
    await page.goto("/technician/history");
    await socket.joined();

    socket.send("job_offer", offer);
    await page.waitForTimeout(2000);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("the dashboard asks the technician to turn on notifications, then gets out of the way", async ({ page }) => {
    // The technician closed the browser's own prompt at sign-in without answering it.
    await fakeNotificationPermission(page, "default");
    const { errors } = await signInTechnician(page);
    await page.goto("/technician/dashboard");

    const banner = page.getByRole("region", { name: "Job alerts" });
    await expect(banner).toContainText("Turn on notifications so new requests reach you when the app is closed or the screen is off.");
    // This time they answer Allow.
    await page.evaluate(() => Object.assign(window, { __notificationAnswer: "granted" }));
    await banner.getByRole("button", { name: "Turn on" }).click();
    await expect(banner).toBeHidden();
    expect(errors).toEqual([]);
  });

  test("the dashboard explains how to unblock notifications when the site is blocked", async ({ page }) => {
    await fakeNotificationPermission(page, "denied");
    const { errors } = await signInTechnician(page);
    await page.goto("/technician/dashboard");

    const banner = page.getByRole("region", { name: "Job alerts" });
    await expect(banner).toContainText("Notifications are blocked for this site. Allow them from the lock icon next to the address, then reload.");
    await expect(banner.getByRole("button", { name: "Turn on" })).toHaveCount(0);
    await banner.getByRole("button", { name: "Later" }).click();
    await expect(banner).toBeHidden();
    expect(errors).toEqual([]);
  });
});

test.describe("Android app", () => {
  test("a new request pops up the request card while the app is open (it used to be skipped)", async ({ page }) => {
    await openInAndroidApp(page);
    const socket = await fakeSocketServer(page);
    const { errors } = await signInTechnician(page);
    await page.goto("/technician/dashboard");
    await socket.joined(2);

    socket.send("JOB_ALERT", offer);
    const card = page.getByRole("dialog");
    await expect(card).toBeVisible();
    await expect(card).toContainText(/flat tyre/i);
    expect(errors).toEqual([]);
  });

  test("a request that arrives as a push notification while the app is open pops up the card", async ({ page }) => {
    await openInAndroidApp(page);
    const { errors } = await signInTechnician(page);
    await page.goto("/technician/dashboard");
    await pushReady(page, page.getByRole("heading", { name: /Arun Kumar/ }));

    // No socket here: the push alone brings the card, with the details read from the backend.
    await page.evaluate((data) => (window as unknown as { __android: { push(d: unknown): void } }).__android.push(data), offerPush);
    const card = page.getByRole("dialog");
    await expect(card).toBeVisible();
    await expect(card).toContainText(/flat tyre/i);
    await expect(card.getByTestId("job-details")).toContainText("Landmark:Opposite the petrol bunk");

    // The same offer pushed again, or closed by a push, does not stack up cards.
    await page.evaluate((data) => (window as unknown as { __android: { push(d: unknown): void } }).__android.push(data), offerPush);
    await expect(page.getByRole("dialog")).toHaveCount(1);
    await page.evaluate(() =>
      (window as unknown as { __android: { push(d: unknown): void } }).__android.push({ event: "job:revoked", type: "JOB_REVOKED", requestId: "6101" }),
    );
    await expect(card).toContainText("This job has already been taken by another technician.");
    expect(errors).toEqual([]);
  });

  test("a pushed request also pops up on the other technician pages", async ({ page }) => {
    await openInAndroidApp(page);
    const { errors } = await signInTechnician(page);
    await page.goto("/technician/profile");
    await pushReady(page, page.getByRole("heading", { name: /Profile/ }).first());

    await page.evaluate((data) => (window as unknown as { __android: { push(d: unknown): void } }).__android.push(data), offerPush);
    const card = page.getByRole("dialog");
    await expect(card).toBeVisible();
    await expect(card).toContainText(/flat tyre/i);
    await expect(page).toHaveURL(/\/technician\/profile$/);
    expect(errors).toEqual([]);
  });

  test("the dashboard points to the phone settings that keep alerts coming with the screen off", async ({ page }) => {
    await openInAndroidApp(page, { notificationsEnabled: true, fullScreenAllowed: false, ignoringBatteryOptimizations: false });
    const { errors } = await signInTechnician(page);
    await page.goto("/technician/dashboard");

    const banner = page.getByRole("region", { name: "Job alerts" });
    await expect(banner).toContainText("Allow full-screen alerts so a new request wakes the screen when the phone is locked.");
    await expect(banner).toContainText("Set ResQNow's battery use to Unrestricted");
    if (process.env.REQUEST_SHOTS_DIR) {
      await page.waitForTimeout(3500); // The app's splash screen (SplashWrapper) plays first.
      await page.screenshot({ path: `${process.env.REQUEST_SHOTS_DIR}/${test.info().project.name}-job-alerts-banner.png` });
    }
    await banner.getByRole("button", { name: "Allow" }).click();
    await banner.getByRole("button", { name: "Open settings" }).click();
    const opened = await page.evaluate(() =>
      (window as unknown as { __android: { calls: Array<{ plugin: string; method: string; options: { target?: string } }> } }).__android.calls
        .filter((call) => call.plugin === "JobAlerts" && call.method === "openSettings")
        .map((call) => call.options.target),
    );
    expect(opened).toEqual(["fullScreen", "battery"]);
    expect(errors).toEqual([]);
  });
});
