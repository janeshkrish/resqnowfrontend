import { expect, test, type Page } from "@playwright/test";

const SHOTS = process.env.GARAGE_SHOTS_DIR;

type Vehicle = { id: number; type: string; make: string; model: string; license_plate: string | null; status: string; created_at: string };

const startingGarage = (): Vehicle[] => [
  { id: 1, type: "car", make: "Tata Motors", model: "Nexon", license_plate: "KA 01 AB 1234", status: "ready", created_at: "2026-09-01T10:00:00Z" },
  { id: 2, type: "bike", make: "Honda Motorcycles", model: "Activa 125", license_plate: "KA 05 HX 7781", status: "ready", created_at: "2026-08-01T10:00:00Z" },
  { id: 3, type: "car", make: "Maruti Suzuki", model: "Swift", license_plate: null, status: "maintenance", created_at: "2026-07-01T10:00:00Z" },
];

// The customer's past requests: two finished ones and a cancelled one for the Nexon, none for the others.
const pastRequests = () => [
  { id: 71, service_type: "battery", vehicle_type: "car", vehicle_model: "Tata Motors Nexon", status: "completed", payment_status: "completed", created_at: "2026-09-19T08:00:00Z" },
  { id: 64, service_type: "flat-tire", vehicle_type: "car", vehicle_model: "Tata Motors Nexon", status: "completed", payment_status: "completed", created_at: "2026-09-02T08:00:00Z" },
  { id: 60, service_type: "towing", vehicle_type: "car", vehicle_model: "Tata Motors Nexon", status: "cancelled", created_at: "2026-09-25T08:00:00Z" },
  { id: 58, service_type: "fuel", vehicle_type: "car", vehicle_model: "Hyundai i20", status: "completed", payment_status: "completed", created_at: "2026-09-28T08:00:00Z" },
];

async function openGarage(page: Page, path: string, garage: Vehicle[] = startingGarage()) {
  const calls: string[] = [];
  const asked: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => asked.push(request.url()));

  // A signed-in customer: the test token only ever reaches the mocked API below.
  await page.addInitScript(() => localStorage.setItem("resqnow_user_token", "e2e-customer-token"));
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (method !== "GET") calls.push(`${method} ${url.pathname} ${request.postData() ?? ""}`.trim());

    if (url.pathname === "/api/auth/me") return reply(200, { id: 41, name: "Asha", email: "asha@example.test", isVerified: true });
    if (url.pathname === "/api/service-requests" && method === "GET") return reply(200, pastRequests());
    if (url.pathname === "/api/vehicles" && method === "GET") return reply(200, garage);
    if (url.pathname === "/api/vehicles" && method === "POST") {
      const body = JSON.parse(request.postData() || "{}");
      const id = 10 + garage.length;
      garage = [{ id, status: "ready", created_at: new Date().toISOString(), ...body }, ...garage];
      return reply(201, { id });
    }
    const status = url.pathname.match(/^\/api\/vehicles\/(\d+)\/status$/);
    if (status && method === "PATCH") {
      const next = JSON.parse(request.postData() || "{}").status;
      garage = garage.map((v) => (v.id === Number(status[1]) ? { ...v, status: next } : v));
      return reply(200, { ok: true });
    }
    const one = url.pathname.match(/^\/api\/vehicles\/(\d+)$/);
    if (one && method === "DELETE") {
      garage = garage.filter((v) => v.id !== Number(one[1]));
      return reply(200, { ok: true });
    }
    if (url.pathname === "/api/users/me/settings") return reply(200, {});
    return reply(404, {});
  });

  await page.goto(path);
  return { calls, asked, errors };
}

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const settled = (page: Page) => page.evaluate(() => Promise.all(
  document.getAnimations()
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => undefined)),
));
const shot = async (page: Page, name: string) => {
  await settled(page);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png`, fullPage: false });
};
const onShow = (page: Page, name: string) => page.getByRole("article", { name });
/** Where the vehicle in the bay stands, as a share of the bay's width (0.5 is the middle). */
const carPlace = (page: Page) => page.evaluate(() => {
  const bay = document.querySelector(".rqg-bay")!.getBoundingClientRect();
  const car = document.querySelector(".rqg-bay-car.is-in")!.getBoundingClientRect();
  return (car.left + car.width / 2 - bay.left) / bay.width;
});

test("shows the newest vehicle in the bay with what the app knows about it", async ({ page, isMobile }) => {
  const { asked, errors } = await openGarage(page, "/my-garage");

  const bay = onShow(page, "Tata Nexon, Ready");
  await expect(bay).toBeVisible();
  await expect(page.getByRole("heading", { name: "My garage" })).toBeVisible();
  await expect(page.getByText("3 vehicles · 2 cars, 1 bike")).toBeVisible();
  await expect(bay.getByRole("heading", { name: "Nexon" })).toBeVisible();
  await expect(bay.getByText("Small SUV")).toBeVisible();
  await expect(bay.getByLabel("Number plate KA 01 AB 1234")).toBeVisible();
  await expect(bay.getByText("1 / 3")).toBeVisible();
  // Saved in September 2026; helped twice (the cancelled request and another model's do not count).
  await expect(bay.getByText("Sep 2026")).toBeVisible();
  await expect(bay.getByText("2 times", { exact: true })).toBeAttached();
  await expect(bay.getByText("Battery · 19 Sep")).toBeVisible();

  // The app's own studio picture, and no photo is looked up anywhere.
  const art = bay.locator(".rqg-bay-car.is-in img");
  await expect(art).toHaveAttribute("src", "/images/vehicles/car.webp");
  await expect.poll(() => art.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(asked.filter((url) => /vehicle-photo|wikimedia|wikipedia/.test(url))).toEqual([]);

  // Once it has driven in, the vehicle stands in the middle of the bay, side-on, and stays there.
  await settled(page);
  expect(Math.abs((await carPlace(page)) - 0.5)).toBeLessThan(0.03);
  const turned = await art.evaluate((img) => getComputedStyle(img).transform);
  expect(turned === "none" || /^matrix\(1, 0, 0, 1, 0, -?[0-9.]+\)$/.test(turned)).toBe(true);

  expect(await noSideScroll(page)).toBe(true);
  if (isMobile) {
    await expect(page.getByAltText("ResQNow Logo")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /account/i })).toHaveAttribute("aria-current", "page");
    // The whole garage fits one screen.
    await expect(page.getByRole("tab", { name: "Maruti Swift, In service" })).toBeInViewport({ ratio: 1 });
  }
  await shot(page, "bay");
  expect(errors).toEqual([]);
});

test("tapping or swiping puts another vehicle on show", async ({ page }) => {
  const { errors } = await openGarage(page, "/my-garage");
  await expect(onShow(page, "Tata Nexon, Ready")).toBeVisible();
  await settled(page);

  // A bike: its own picture, kind and button, and no history.
  await page.getByRole("tab", { name: "Honda Activa 125, Ready" }).click();
  const bike = onShow(page, "Honda Activa 125, Ready");
  await expect(bike).toBeVisible();
  await expect(page.getByRole("tab", { name: "Honda Activa 125, Ready" })).toHaveAttribute("aria-selected", "true");
  await expect(bike.locator(".rqg-bay-car.is-in img")).toHaveAttribute("src", "/images/vehicles/bike.webp");
  // The car that was there drives off as the bike drives in.
  await expect(bike.locator(".rqg-bay-car.is-out img")).toHaveAttribute("src", "/images/vehicles/car.webp");
  await expect(bike.getByText("Scooter")).toBeVisible();
  await expect(bike.getByText("Not yet")).toBeVisible();
  await expect(bike.getByText("None yet")).toBeVisible();
  await expect(bike.getByRole("button", { name: "Get help for this bike" })).toBeVisible();
  await settled(page);
  expect(Math.abs((await carPlace(page)) - 0.5)).toBeLessThan(0.03);
  await shot(page, "bike");

  // Swiping the bay to the left shows the next one; to the right goes back.
  const box = (await page.locator(".rqg-bay").boundingBox())!;
  const y = box.y + box.height / 2;
  const swipe = async (from: number, to: number) => {
    await page.mouse.move(box.x + box.width * from, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * to, y, { steps: 6 });
    await page.mouse.up();
  };
  await swipe(0.75, 0.25);
  const swift = onShow(page, "Maruti Swift, In service");
  await expect(swift).toBeVisible();
  // In service: no plate saved, up on the lift, the platform stopped.
  await expect(swift.locator(".rqg-bay.is-maintenance .rqg-bay-lift")).toBeVisible();
  await expect(swift.getByText("3 / 3")).toBeVisible();
  await expect(swift.getByLabel(/Number plate/)).toHaveCount(0);
  await shot(page, "in-service");
  // Nothing further that way.
  await swipe(0.75, 0.25);
  await expect(swift).toBeVisible();
  await swipe(0.25, 0.75);
  await expect(onShow(page, "Honda Activa 125, Ready")).toBeVisible();
  expect(errors).toEqual([]);
});

test("changes a vehicle's status and removes it from its sheet", async ({ page }) => {
  const { calls, errors } = await openGarage(page, "/my-garage");
  await page.getByRole("tab", { name: "Maruti Swift, In service" }).click();
  await onShow(page, "Maruti Swift, In service").getByRole("button", { name: "More for Swift" }).click();

  const sheet = page.getByRole("dialog", { name: "Swift" });
  await expect(sheet).toBeVisible();
  await expect(sheet.locator(".rqg-photo img")).toHaveAttribute("src", "/images/vehicles/car.webp");
  await shot(page, "sheet");
  // The whole sheet fits on screen, down to Remove.
  await expect(sheet.getByRole("button", { name: /remove from garage/i })).toBeInViewport({ ratio: 1 });
  await sheet.getByRole("radio", { name: "Not in use" }).click();
  await expect(sheet.getByRole("radio", { name: "Not in use" })).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => calls).toContain('PATCH /api/vehicles/3/status {"status":"inactive"}');
  // The bay behind follows: greyed, not in use.
  await expect(page.locator(".rqg-bay.is-inactive")).toBeAttached();

  await sheet.getByRole("button", { name: /remove from garage/i }).click();
  const confirm = page.getByRole("alertdialog", { name: "Remove Maruti Swift?" });
  await expect(confirm).toBeVisible();
  await shot(page, "remove");
  await confirm.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Maruti Swift removed")).toBeVisible();
  await expect(page.getByRole("tab", { name: /Maruti Swift/ })).toHaveCount(0);
  expect(calls).toContain("DELETE /api/vehicles/3");
  // The newest vehicle is back on show, and the page still responds.
  await expect(onShow(page, "Tata Nexon, Ready")).toBeVisible();
  await expect(page.getByText("2 vehicles · 1 car, 1 bike")).toBeVisible();
  await onShow(page, "Tata Nexon, Ready").getByRole("button", { name: "More for Nexon" }).click();
  await expect(page.getByRole("dialog", { name: "Nexon" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("adds a vehicle from the home screen's Add vehicle link", async ({ page }) => {
  const { calls, errors } = await openGarage(page, "/my-garage/add", []);

  await expect(page.getByRole("heading", { name: "What do you drive?" })).toBeVisible();
  await shot(page, "add-type");
  await page.getByRole("button", { name: /^Car:/ }).click();
  await page.getByRole("searchbox", { name: "Search car brands" }).fill("tata");
  await page.getByRole("button", { name: "Tata Motors" }).click();
  await page.getByRole("radio", { name: "Nexon", exact: true }).click();
  const plate = page.getByLabel("Registration number");
  await plate.fill("ka01ab1234");
  await plate.blur();
  await expect(plate).toHaveValue("KA 01 AB 1234");
  await shot(page, "add-plate");
  await page.getByRole("button", { name: "Save vehicle" }).click();

  await expect(page.getByText("Tata Nexon saved to your garage")).toBeVisible();
  const bay = onShow(page, "Tata Nexon, Ready");
  await expect(bay).toBeVisible();
  // Saved just now, and the only vehicle: no count on the bay and no row of vehicles under it.
  await expect(bay.getByText("Today")).toBeVisible();
  await expect(page.getByText("1 vehicle", { exact: true })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Your vehicles" })).toHaveCount(0);
  await expect(page).toHaveURL(/\/my-garage$/);
  expect(calls).toContain('POST /api/vehicles {"type":"car","make":"Tata Motors","model":"Nexon","license_plate":"KA 01 AB 1234"}');
  expect(errors).toEqual([]);
});

test("Get help opens the request form with the vehicle filled in", async ({ page }) => {
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 11.0168, longitude: 76.9558 });
  await openGarage(page, "/my-garage");
  await onShow(page, "Tata Nexon, Ready").getByRole("button", { name: "Get help for this car" }).click();

  await expect(page).toHaveURL(/\/request-service\/emergency\/car\?vehicle=1$/);
  await expect(page.getByRole("heading", { name: "Emergency help" })).toBeVisible();
  // SOS asks about people first; the car is already picked on the last step.
  await page.getByRole("radio", { name: "No one is hurt" }).click();
  await page.locator(".rqf-cta").click();
  await expect(page.getByText("Car · Step 2 of 3")).toBeVisible();
  await expect(page.getByLabel("Help comes to")).not.toHaveValue("");
  await page.locator(".rqf-cta").click();
  await expect(page.getByRole("radio", { name: /Tata Nexon/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Tata Nexon · Small SUV")).toBeVisible();
});
