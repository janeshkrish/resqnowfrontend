import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// The Mappls stand-in, with place search answering from a small list of real Coimbatore places.
const fakeMappls = readFileSync(new URL("./fixtures/fakeMapplsSdk.js", import.meta.url), "utf8").replace(
  "export const searchMapplsPlaces = () => Promise.resolve([]);",
  `const PLACES = [
    { id: "P1", placeId: "P1", name: "Sri Ranga Motors", label: "Sri Ranga Motors, Avinashi Road, Coimbatore", address: "Sri Ranga Motors, Avinashi Road, Coimbatore", lat: 11.0256, lng: 77.0081, provider: "mappls", category: "GARAGE" },
    { id: "P2", placeId: "P2", name: "RS Puram", label: "RS Puram, Coimbatore", address: "RS Puram, Coimbatore, Tamil Nadu", lat: 11.0086, lng: 76.9504, provider: "mappls", category: "LOCALITY" },
  ];
  export const searchMapplsPlaces = (query) => Promise.resolve(PLACES.filter((p) => p.label.toLowerCase().includes(String(query).toLowerCase())));`,
);
const SHOTS = process.env.REQUEST_SHOTS_DIR;
const HOME = { latitude: 11.0168, longitude: 76.9558 };
const PHOTO = readFileSync(new URL("../public/images/vehicles/car.webp", import.meta.url));

type Vehicle = { id: number; type: string; make: string; model: string; license_plate: string | null; status: string; created_at: string };

const quote = {
  success: true,
  quote: {
    distance_km: 7.4,
    estimated_duration: 21,
    vehicle_subtype: "hatchback",
    tow_truck_type: "wheel-lift",
    final_estimated_price: 1014,
    pricing_breakdown: {
      distance_km: 7.4, base_towing_charge: 599, included_km: 5, per_km_rate: 25, distance_charge: 60, night_charge: 0,
      subtotal_before_factors: 659, vehicle_category: "hatchback", tow_truck_type: "wheel-lift", vehicle_multiplier: 1.05,
      surge_multiplier: 1, tax_percent: 0.18, tax_amount: 125, base_amount: 817, platform_fee: 82, payment_fee: 2, final_estimated_price: 1014,
    },
  },
};

async function openForm(page: Page, path: string, { garage = [] as Vehicle[] } = {}) {
  const posts: Array<{ path: string; body: Record<string, unknown> }> = [];
  const estimates: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // A signed-in customer: the test token only ever reaches the mocked API below.
  await page.addInitScript(() => localStorage.setItem("resqnow_user_token", "e2e-customer-token"));
  await page.route(/\/src\/lib\/mapProvider\/mapplsSdk\.ts(\?.*)?$/, (route) => route.fulfill({ contentType: "application/javascript", body: fakeMappls }));
  await page.route((url) => url.hostname === "upload.wikimedia.org", (route) => route.fulfill({ contentType: "image/webp", body: PHOTO }));
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const json = () => { try { return JSON.parse(request.postData() || "{}"); } catch { return {}; } };

    if (url.pathname === "/api/auth/me") return reply(200, { id: 41, name: "Asha", email: "asha@example.test", phone: "9876543210", isVerified: true });
    if (url.pathname === "/api/vehicles" && method === "GET") return reply(200, garage);
    if (url.pathname === "/api/vehicles" && method === "POST") { posts.push({ path: url.pathname, body: json() }); return reply(201, { id: 99 }); }
    if (url.pathname === "/api/public/vehicle-photo") return reply(200, { photo: null });
    if (url.pathname === "/api/public/service-prices") {
      return reply(200, { vehicle: url.searchParams.get("vehicle"), currency: "INR", services: [
        { service: "flat-tire", startingPrice: 349, technicians: 3 }, { service: "fuel", startingPrice: 299, technicians: 2 },
        { service: "lockout", startingPrice: 399, technicians: 1 }, { service: "towing", startingPrice: 599, technicians: 2 },
      ] });
    }
    if (url.pathname === "/api/public/reverse-geocode") return reply(200, { display_name: "21, Race Course Road, Coimbatore", address: { suburb: "Race Course", road: "Race Course Road", city: "Coimbatore" } });
    if (url.pathname === "/api/public/fuel-prices") {
      return reply(200, { available: true, location: { area: "Coimbatore", state: "Tamil Nadu", scope: "city" }, prices: [
        { fuel: "petrol", label: "Petrol", price: 101.94, unit: "L", change: 0, effectiveDate: "2026-09-27" },
        { fuel: "diesel", label: "Diesel", price: 93.52, unit: "L", change: 0, effectiveDate: "2026-09-27" },
      ] });
    }
    if (url.pathname === "/api/public/fuel-stations") {
      return reply(200, { source: "mappls", radiusMeters: 5000, total: 1, located: 1, stations: [{ id: "F1", name: "Indian Oil", latitude: 11.03, longitude: 76.96, distance: 1800 }] });
    }
    if (url.pathname === "/api/public/route") return reply(404, {});
    if (url.pathname === "/api/pricing/towing-estimate") { estimates.push(json()); return reply(200, quote); }
    if (url.pathname === "/api/upload" && method === "POST") return reply(200, { url: "/api/upload/files/1727-tyre.jpg", filename: "1727-tyre.jpg" });
    if (url.pathname === "/api/service-requests" && method === "POST") { posts.push({ path: url.pathname, body: json() }); return reply(201, { id: 5501 }); }
    return reply(404, {});
  });

  await page.goto(path);
  return { posts, estimates, errors };
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
const cta = (page: Page) => page.locator(".rqf-cta");

async function slide(page: Page) {
  const knob = page.locator(".rqf-knob");
  const track = page.locator(".rqf-slide");
  const from = (await knob.boundingBox())!;
  const to = (await track.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width - 10, from.y + from.height / 2, { steps: 12 });
  await page.mouse.up();
}

test.use({ geolocation: HOME, permissions: ["geolocation"] });

test("tows a car picked from the brand and model lists, with the fare and a saved vehicle", async ({ page }) => {
  const { posts, estimates, errors } = await openForm(page, "/request-service/towing/car");

  await expect(page.getByRole("heading", { name: "Towing" })).toBeVisible();
  await expect(page.getByText("Car · Step 1 of 3")).toBeVisible();
  // Nothing picked: Continue says what's missing and doesn't move.
  await expect(cta(page)).toHaveText(/Choose your car/);
  await shot(page, "tow-empty");
  await cta(page).click({ force: true });
  await expect(page.getByText("Choose your car").last()).toBeVisible();
  await expect(page.getByText("Car · Step 1 of 3")).toBeVisible();

  await page.getByRole("button", { name: /^Brand/ }).click();
  const brands = page.getByRole("dialog", { name: "Choose the brand" });
  await expect(brands).toBeVisible();
  await shot(page, "tow-brands");
  await brands.getByRole("button", { name: "Maruti" }).first().click();
  const models = page.getByRole("dialog", { name: "Choose the model" });
  await expect(models.getByText("No longer sold")).toBeVisible();
  await expect(models.getByRole("button", { name: /Esteem/ })).toBeVisible();
  await shot(page, "tow-models");
  await models.getByRole("button", { name: /^Swift Hatchback/ }).click();

  // The class fills in from the model and says so.
  await expect(page.getByRole("radio", { name: "Hatchback" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Swift is a hatchback")).toBeVisible();
  await expect(cta(page)).toHaveText(/Choose what happened/);
  await page.getByRole("radio", { name: "Breakdown" }).click();
  await page.getByRole("radio", { name: /Yes, it moves/ }).click();
  await expect(cta(page)).toHaveText(/Continue/);
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, "tow-step1");
  await cta(page).click();

  await expect(page.getByText("Car · Step 2 of 3")).toBeVisible();
  await expect(page.getByLabel("Pick up from")).not.toHaveValue("");
  await page.getByLabel("Take it to").fill("Sri Ranga");
  await page.getByRole("option", { name: /Sri Ranga Motors/ }).click();
  await expect(page.locator(".rqf-fare-id b")).toHaveText("₹1,014");
  await expect(page.locator(".rqf-dock-sum")).toContainText("About ₹1,014 · pay after the drop");
  // The fare was worked out for this car's size and a truck that suits it.
  expect(estimates.at(-1)).toMatchObject({ vehicleType: "car", vehicleSubtype: "hatchback", vehicleBrand: "Maruti Suzuki", canRoll: "yes", vehicleModel: "Maruti Suzuki Swift" });
  await expect(page.getByText(/Wheel-lift truck/)).toBeVisible();
  await page.getByRole("button", { name: "Details" }).click();
  await expect(page.getByText("Hatchback size ×1.05")).toBeVisible();
  await page.getByLabel("Landmark or exact spot").fill("Opposite the petrol bunk");
  await shot(page, "tow-step2");
  await cta(page).click();

  await expect(page.getByText("Car · Step 3 of 3")).toBeVisible();
  await expect(page.getByText("Maruti Swift · Hatchback")).toBeVisible();
  await expect(page.locator(".rqf-sum-chip")).toHaveText(["Breakdown", "Can be pushed"]);
  await expect(page.getByText("Asha · +91 98765 43210")).toBeVisible();
  await page.getByLabel("Number plate (optional)").fill("tn37ab1234");
  await page.getByLabel("Number plate (optional)").blur();
  await expect(page.getByRole("switch", { name: "Save Maruti Swift to My garage" })).toHaveAttribute("aria-checked", "true");
  await shot(page, "tow-step3");
  expect(errors).toEqual([]);
  await slide(page);

  await expect(page).toHaveURL(/\/request-service-tracking\/5501$/);
  const request = posts.find((entry) => entry.path === "/api/service-requests")!.body;
  expect(request).toMatchObject({
    service_type: "car-towing",
    vehicle_type: "car",
    vehicle_brand: "Maruti Suzuki",
    vehicle_model: "Maruti Suzuki Swift",
    vehicle_subtype: "hatchback",
    contact_name: "Asha",
    contact_phone: "9876543210",
    dropAddress: expect.stringContaining("Sri Ranga Motors"),
    finalEstimatedPrice: 1014,
    details: {
      answers: [
        { id: "why", question: "What happened?", value: "breakdown", label: "Breakdown" },
        { id: "roll", question: "Can the vehicle be pushed?", value: "yes", label: "Can be pushed" },
      ],
      landmark: "Opposite the petrol bunk",
      plate: "TN 37 AB 1234",
      urgent: false,
    },
  });
  expect(request.description).toBeNull();
  expect(posts.find((entry) => entry.path === "/api/vehicles")?.body).toEqual({ type: "car", make: "Maruti Suzuki", model: "Swift", license_plate: "TN 37 AB 1234" });
});

test("fixes a bike puncture found by typing an old name, with the back tyre and a photo", async ({ page }) => {
  const { posts, errors } = await openForm(page, "/request-service/flat-tire/bike");

  await page.getByRole("button", { name: "Type your bike’s name" }).click();
  const search = page.getByRole("dialog", { name: "Find your bike" });
  await search.getByRole("searchbox").fill("hero honda");
  await expect(search.getByText("Matching bikes")).toBeVisible();
  await shot(page, "flat-search");
  await search.getByRole("button", { name: /^Hero Honda Splendor No longer sold/ }).click();
  await expect(page.getByRole("radio", { name: "Commuter" })).toHaveAttribute("aria-checked", "true");

  await expect(cta(page)).toHaveText(/Choose the tyre type/);
  await page.getByRole("radio", { name: "Tube tyre" }).click();
  // A bike has no stepney question and the tyres are on the photo.
  await expect(page.getByText("Do you have a stepney")).toHaveCount(0);
  await page.getByRole("button", { name: "Back tyre" }).click();
  await expect(page.getByRole("button", { name: "Back tyre" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("radio", { name: "Torn or cut" }).click();
  await expect(page.getByText("A torn tyre can’t be repaired.")).toBeVisible();
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, "flat-step1");
  await cta(page).click();

  await expect(page.getByText("Bike · Step 2 of 3")).toBeVisible();
  await expect(page.getByLabel("Help comes to")).toHaveValue("21, Race Course Road, Coimbatore");
  await shot(page, "flat-step2");
  await cta(page).click();

  await expect(page.getByText("Bike · Step 3 of 3")).toBeVisible();
  await expect(page.locator(".rqf-sum-chip")).toHaveText(["Tube tyre", "Back tyre", "Torn or cut"]);
  await expect(page.locator(".rqf-sum-price")).toContainText("₹349");
  await page.getByLabel("Anything else?").fill("Nail in the tyre");
  await page.locator('input[type="file"]').setInputFiles({ name: "tyre.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
  await expect(page.locator(".rqf-attach-chip")).toHaveText(/Photo/);
  await shot(page, "flat-step3");
  expect(errors).toEqual([]);
  await slide(page);

  await expect(page).toHaveURL(/\/request-service-tracking\/5501$/);
  const request = posts.find((entry) => entry.path === "/api/service-requests")!.body;
  expect(request).toMatchObject({
    service_type: "bike-flat-tire",
    vehicle_brand: "Hero Honda",
    vehicle_model: "Hero Honda Splendor",
    vehicle_subtype: "commuter-bike",
    address: "21, Race Course Road, Coimbatore",
    details: {
      answers: [
        { id: "tyretype", value: "tube", label: "Tube tyre" },
        { id: "tyre", value: ["rear"], label: "Back tyre" },
        { id: "damage", value: "torn", label: "Torn or cut" },
      ],
      note: "Nail in the tyre",
      attachments: [{ type: "photo", url: "/api/upload/files/1727-tyre.jpg" }],
    },
  });
  // The vehicle went to My garage as a bike.
  expect(posts.find((entry) => entry.path === "/api/vehicles")?.body).toMatchObject({ type: "bike", make: "Hero Honda", model: "Splendor" });
});

test("sends SOS help for the car from My garage in three taps", async ({ page }) => {
  const garage: Vehicle[] = [
    { id: 1, type: "car", make: "Tata Motors", model: "Nexon", license_plate: "KA 01 AB 1234", status: "ready", created_at: "2026-09-01T10:00:00Z" },
    { id: 2, type: "bike", make: "Honda Motorcycles", model: "Activa 125", license_plate: null, status: "ready", created_at: "2026-08-01T10:00:00Z" },
  ];
  const { posts, errors } = await openForm(page, "/request-service/emergency/car?vehicle=1", { garage });

  await expect(page.getByRole("heading", { name: "Emergency help" })).toBeVisible();
  await expect(cta(page)).toHaveText(/Choose is anyone hurt/);
  await page.getByRole("radio", { name: "Yes, someone is" }).click();
  await expect(page.getByRole("link", { name: "Call 108" })).toHaveAttribute("href", "tel:108");
  await expect(page.getByText("Urgent")).toBeVisible();
  await page.getByRole("radio", { name: "No one is hurt" }).click();
  await page.getByRole("radio", { name: /Breakdown/ }).click();
  await shot(page, "sos-step1");
  await cta(page).click();
  await expect(page.getByText("Car · Step 2 of 3")).toBeVisible();
  await expect(page.getByLabel("Help comes to")).toHaveValue("21, Race Course Road, Coimbatore");
  await cta(page).click();

  // The car from "Get help for this car" is already picked; only cars are offered.
  await expect(page.getByRole("radio", { name: /Tata Nexon/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: /Activa/ })).toHaveCount(0);
  await expect(page.getByText("Tata Nexon · Small SUV")).toBeVisible();
  await expect(page.locator(".rqf-sum-price")).toContainText("Nothing now");
  await expect(page.getByRole("button", { name: "Slide to send help" })).toBeVisible();
  await shot(page, "sos-step3");
  expect(errors).toEqual([]);
  // Keyboard users send with Enter on the knob.
  await page.getByRole("button", { name: "Slide to send help" }).focus();
  await page.keyboard.press("Enter");

  await expect(page).toHaveURL(/\/request-service-tracking\/5501$/);
  const request = posts.find((entry) => entry.path === "/api/service-requests")!.body;
  expect(request).toMatchObject({
    service_type: "car-emergency",
    vehicle_brand: "Tata Motors",
    vehicle_model: "Tata Motors Nexon",
    vehicle_subtype: "compact-suv",
    details: { answers: [{ id: "hurt", value: "no" }, { id: "what", value: "breakdown" }], plate: "KA 01 AB 1234", urgent: false },
  });
  // A garage vehicle isn't saved again.
  expect(posts.filter((entry) => entry.path === "/api/vehicles")).toEqual([]);
});

test("marks a lockout with someone inside urgent, and fuel shows today's price and moves CNG to towing", async ({ page }) => {
  await openForm(page, "/request-service/lockout/car");
  await page.getByRole("radio", { name: "Yes" }).click();
  await expect(page.getByRole("link", { name: "Call 112" })).toHaveAttribute("href", "tel:112");
  await expect(page.locator(".rqf-urgent")).toBeVisible();
  // Safety comes before the vehicle.
  await expect(cta(page)).toHaveText(/Choose your car/);
  await shot(page, "lockout-urgent");

  await page.goto("/request-service/fuel/car");
  await page.getByRole("button", { name: "Type your car’s name" }).click();
  await page.getByRole("dialog", { name: "Find your car" }).getByRole("searchbox").fill("opel astra");
  await page.getByRole("dialog").getByRole("button", { name: /Astra/ }).first().click();
  await page.getByRole("radio", { name: /Petrol/ }).click();
  await page.getByRole("radio", { name: "3 litres" }).click();
  await expect(page.locator(".rqf-calc")).toContainText("Petrol 3 L × ₹101.94");
  await expect(page.locator(".rqf-calc")).toContainText("₹306");
  await expect(page.locator(".rqf-dock-sum")).toContainText("About ₹605");
  await shot(page, "fuel-step1");

  await page.getByRole("radio", { name: /CNG/ }).click();
  await expect(page.getByRole("radio", { name: "3 litres" })).toHaveCount(0);
  await page.getByRole("button", { name: "Go to towing" }).click();
  await expect(page).toHaveURL(/\/request-service\/towing\/car$/);
  // The car comes along; the towing questions start fresh.
  await expect(page.getByText("Astra is a sedan")).toBeVisible();
  await expect(cta(page)).toHaveText(/Choose what happened/);
});
