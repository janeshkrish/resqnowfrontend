import { expect, test, type Locator, type Page } from "@playwright/test";

import { TECHNICIAN, fakeSocketServer, openInAndroidApp, slideToAccept, stripValue } from "./fixtures/technicianPortal";

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
      return reply(200, TECHNICIAN);
    }
    if (path === "/api/technicians/me/active-job" || path === "/api/technician/active-job/7") {
      if (accepted) return reply(200, { id: "6101", requestId: "6101", status: "accepted", serviceType: "flat-tyre", customerName: "Asha", address: offer.address, amount: 350 });
      if (options.onJob) return reply(200, { id: "5900", requestId: "5900", status: "arrived", serviceType: "battery", customerName: "Ravi", address: "Gandhipuram" });
      return reply(200, null);
    }
    if (path === "/api/service-requests/6101/technician-offer") {
      // The offer lookup measures the distance itself and carries no travel time (routes/service_requests.js).
      return reply(200, { available: true, request: { ...offer, eta: undefined, distance: 2.4, locationDistance: "2.4 km", status: "pending", offer_status: "pending" } });
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
    await expect(card.getByRole("heading", { name: /flat tyre/i })).toBeVisible();
    // Every figure on the card is the offer's own: nothing is filled in by the page.
    await expect(stripValue(card, "You earn")).toHaveText("₹350");
    await expect(stripValue(card, "Distance")).toHaveText("2.4 km");
    await expect(stripValue(card, "Reach in")).toHaveText("8 min");
    await expect(card.getByTestId("job-location")).toContainText("21, Race Course Road, Coimbatore");
    await expect(card.getByTestId("job-location")).toContainText("Opposite the petrol bunk");
    await expect(card.getByRole("timer")).toContainText("sec");
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
    await expect(stripValue(card, "You earn")).toHaveText("₹350");
    await expect(page.getByRole("dialog")).toHaveCount(1);
    if (process.env.REQUEST_SHOTS_DIR) await page.screenshot({ path: `${process.env.REQUEST_SHOTS_DIR}/${test.info().project.name}-job-alert-history.png` });

    // Rejecting hands the job to the next technician straight away.
    await card.getByRole("button", { name: "Reject" }).click();
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
    await expect(card).toContainText("Offer closed");
    await expect(card).toContainText("This job has already been taken by another technician.");
    await card.getByRole("button", { name: "Dismiss" }).click();
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
    await expect(card.getByTestId("job-location")).toContainText("Opposite the petrol bunk");
    // The lookup carries no travel time, so the card shows a dash instead of inventing one.
    await expect(stripValue(card, "Reach in")).toHaveText("—");

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
