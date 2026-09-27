import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

const fakeMappls = readFileSync(new URL("./fixtures/fakeMapplsSdk.js", import.meta.url), "utf8");
const HOME = { latitude: 11.0168, longitude: 76.9558 };
// 1x1 grey PNG for technician profile photos.
const PHOTO = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN88OBBPQAIFgNRS5mDwQAAAABJRU5ErkJggg==", "base64");

const technicians = [
  {
    id: "t1", name: "Arun Kumar", service_type: "towing", specialties: ["towing", "flat_tyre"], vehicle_types: ["car", "bike"],
    distance: 1.4, rating: 4.9, jobs_completed: 212, latitude: 11.02, longitude: 76.95, profile_photo: "/uploads/arun.jpg",
  },
  { id: "t2", name: "Priya Motors", service_type: "battery", distance: 2.6, rating: 4.7, jobs_completed: 88, latitude: 11.03, longitude: 76.94 },
];

const evStations = [
  {
    id: "EVA001", name: "Tata Power EZ Charge", brand: "tatapower", address: "Race Course Road, Coimbatore",
    latitude: 11.0228, longitude: 76.9648, distance: 1200, isOpen: true, openingHours: ["06:00-22:00"],
    chargingTypes: ["AC", "DC"], connectorTypes: ["CCS2", "Type 2"], chargingPower: 60, chargingSlots: 4,
    phone: "9876500000", availability: { status: "unknown" },
  },
  { id: "EVA002", name: "Green Plug Point", address: "Avinashi Road", latitude: 11.028, longitude: 76.93, distance: 2300, availability: { status: "unknown" } },
];

const pumps = [
  { id: "F1", name: "Indian Oil - Sri Balaji Fuels", brand: "indianoil", address: "Trichy Road, Coimbatore", latitude: 11.0301, longitude: 76.9601, distance: 800, isOpen: true, stationTypes: ["petrol"] },
  { id: "F2", name: "Nayara Energy CNG", brand: "nayara", address: "Ukkadam, Coimbatore", latitude: 11.0251, longitude: 76.9411, distance: 1900, stationTypes: ["cng"] },
];

const fuelPrices = {
  available: true,
  location: { area: "Coimbatore", state: "Tamil Nadu", scope: "city" },
  prices: [
    { fuel: "petrol", label: "Petrol", price: 101.94, unit: "L", change: 0.14, effectiveDate: "2026-09-27" },
    { fuel: "diesel", label: "Diesel", price: 93.52, unit: "L", change: -0.06, effectiveDate: "2026-09-27" },
    { fuel: "cng", label: "CNG", price: 86.5, unit: "kg", change: 0, effectiveDate: "2026-09-27" },
  ],
};

type Reply = { status?: number; body: unknown };
type Overrides = Partial<Record<"ev" | "fuel", (radius: string) => Reply>>;
const stations = (list: unknown[]) => ({ source: "mappls", radiusMeters: 5000, stations: list, total: list.length, located: list.length });

async function openRadar(page: Page, path = "/map", overrides: Overrides = {}) {
  const requests: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.route(/\/src\/lib\/mapProvider\/mapplsSdk\.ts(\?.*)?$/, (route) =>
    route.fulfill({ contentType: "application/javascript", body: fakeMappls }));
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const url = new URL(route.request().url());
    requests.push(`${url.pathname}${url.search}`);
    const radius = url.searchParams.get("radius") ?? "";
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname.startsWith("/uploads/")) return route.fulfill({ contentType: "image/png", body: PHOTO });
    if (url.pathname === "/api/technicians/nearby") return reply(200, technicians);
    if (url.pathname === "/api/public/reverse-geocode") return reply(200, { address: { suburb: "Race Course", road: "Race Course Road", city: "Coimbatore" } });
    if (url.pathname === "/api/public/fuel-prices") return reply(200, fuelPrices);
    if (url.pathname === "/api/public/ev-stations") {
      const custom = overrides.ev?.(radius);
      return reply(custom?.status ?? 200, custom?.body ?? stations(evStations));
    }
    if (url.pathname === "/api/public/fuel-stations") {
      const custom = overrides.fuel?.(radius);
      return reply(custom?.status ?? 200, custom?.body ?? stations(pumps));
    }
    return reply(404, {});
  });

  await page.goto(path);
  return { requests, errors };
}

const sheet = (page: Page) => page.locator(".rqr-sheet");
const card = (page: Page, name: string) => page.getByRole("article", { name });
/** Where the sheet's handle rests once the spring has stopped moving. */
async function restingHandle(page: Page) {
  const handle = page.locator(".rqr-drag");
  let last = -1;
  await expect.poll(async () => {
    const y = Math.round((await handle.boundingBox())?.y ?? -1);
    const still = y === last;
    last = y;
    return still;
  }, { intervals: [150] }).toBe(true);
  const box = (await handle.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + 12 };
}
const imageLoaded = (page: Page, selector: string) =>
  expect.poll(() => page.locator(selector).first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);

test.describe("Live radar", () => {
  test.use({ geolocation: HOME, permissions: ["geolocation"] });

  test("shows technicians near the customer, with photos and no request button", async ({ page, isMobile }) => {
    const { errors } = await openRadar(page);

    await expect(page.locator(".rqr-hdr")).toContainText("Race Course");
    // On phones the ResQNow logo sits in the radar header; larger screens have it in the site header.
    const logo = page.locator(".rqr-hdr").getByRole("img", { name: "ResQNow" });
    if (isMobile) {
      await expect(logo).toBeVisible();
      await imageLoaded(page, ".rqr-hdr__logo");
    } else {
      await expect(logo).toBeHidden();
    }
    await expect(page.getByRole("tab", { name: /technicians/i })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("tab", { name: /technicians/i })).toContainText("2");

    await expect(card(page, "Arun Kumar")).toBeVisible();
    await expect(card(page, "Arun Kumar")).toContainText("212");
    await imageLoaded(page, ".rqr-card .rqr-logo--photo img");
    await expect(card(page, "Priya Motors").locator(".rqr-logo")).toHaveText("PM");
    await expect(page.locator(".rqr-pin")).toHaveCount(2);
    await expect(page.getByRole("button", { name: /request service|book now/i })).toHaveCount(0);
    await expect(page.getByText(/request service/i)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("opens a view-only technician profile", async ({ page }) => {
    await openRadar(page);
    await page.getByRole("button", { name: "Open Arun Kumar's profile" }).click();

    const profile = page.getByRole("region", { name: "Arun Kumar profile" });
    await expect(profile).toContainText("Online now");
    await expect(profile).toContainText("Flat Tyre");
    await expect(profile).toContainText("To get help, tap Get help");
    await expect(profile.getByRole("button", { name: /request|book/i })).toHaveCount(0);
    await profile.getByRole("button", { name: "Close" }).click();
    await expect(card(page, "Arun Kumar")).toBeVisible();
  });

  test("shows EV charging with brand logos, details and Google Maps directions", async ({ page }) => {
    const { requests } = await openRadar(page);
    await page.getByRole("tab", { name: /ev charging/i }).click();
    await expect(page).toHaveURL(/\?layer=ev$/);

    const tata = card(page, "Tata Power EZ Charge");
    await expect(tata).toContainText("Open · 06:00-22:00");
    await expect(tata).toContainText("CCS2");
    await imageLoaded(page, '.rqr-card img[src="/images/brands/tatapower.png"]');
    await expect(tata.getByRole("link", { name: /directions to tata power ez charge/i }))
      .toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=11.0228%2C76.9648");
    await expect(page.locator(".rqr-ppin")).toHaveCount(2);
    expect(requests).toContain("/api/public/ev-stations?lat=11.0168&lng=76.9558&radius=5000");

    await tata.getByRole("button", { name: /open details for tata power ez charge/i }).click();
    const detail = page.getByRole("region", { name: "Tata Power EZ Charge details" });
    await expect(detail).toContainText("Availability unknown");
    await expect(detail).toContainText("60 kW");
    await expect(detail).toContainText("Type 2");
    await expect(detail.getByRole("link", { name: /call tata power/i })).toHaveAttribute("href", "tel:9876500000");
    const directions = detail.getByRole("link", { name: /in google maps/i });
    await expect(directions).toHaveAttribute("href", "https://www.google.com/maps/dir/?api=1&destination=11.0228%2C76.9648");
    await expect(directions).toHaveAttribute("target", "_blank");
  });

  test("shows fuel pumps with brand logos and today's prices", async ({ page }) => {
    await openRadar(page, "/map?layer=fuel");

    const iocl = card(page, "Indian Oil - Sri Balaji Fuels");
    await expect(iocl).toContainText("₹101.94");
    await expect(iocl).toContainText("₹93.52");
    await expect(iocl).not.toContainText("CNG");
    await imageLoaded(page, '.rqr-card img[src="/images/brands/indianoil.png"]');
    await expect(card(page, "Nayara Energy CNG")).toContainText("₹86.50");
    await imageLoaded(page, '.rqr-card img[src="/images/brands/nayara.png"]');
    await expect(page.getByText(/today’s city prices for Coimbatore/)).toBeAttached();
  });

  test("offers a wider search when nothing is nearby, and survives a failed search", async ({ page }) => {
    const { requests } = await openRadar(page, "/map?layer=ev", {
      ev: (radius) => (radius === "10000" ? { body: stations(evStations) } : { body: stations([]) }),
      fuel: () => ({ status: 502, body: { code: "fuel_search_failed" } }),
    });

    await expect(page.getByText("No chargers within 5 km")).toBeVisible();
    await page.getByRole("button", { name: "Search within 10 km" }).click();
    await expect(card(page, "Tata Power EZ Charge")).toBeVisible();
    expect(requests).toContain("/api/public/ev-stations?lat=11.0168&lng=76.9558&radius=10000");

    await page.getByRole("tab", { name: /fuel/i }).click();
    await expect(page.getByRole("alert")).toContainText("Couldn’t load fuel pumps");
    await page.getByRole("tab", { name: /technicians/i }).click();
    await expect(card(page, "Arun Kumar")).toBeVisible();
  });
});

test.describe("Live radar on a phone", () => {
  test.use({ geolocation: HOME, permissions: ["geolocation"] });
  test.beforeEach(({ isMobile }) => test.skip(!isMobile, "The draggable sheet is phone-only"));

  test("pins and cards stay in sync, the map tap shrinks the sheet and the card brings it back", async ({ page }) => {
    await openRadar(page);
    await expect(card(page, "Arun Kumar")).toHaveClass(/is-sel/);
    await expect(sheet(page)).toHaveAttribute("data-snap", "normal");

    await page.locator('.rqr-pin[aria-label="Priya Motors"]').click();
    await expect(card(page, "Priya Motors")).toHaveClass(/is-sel/);
    await expect(card(page, "Arun Kumar")).not.toHaveClass(/is-sel/);
    await expect(page.locator('.rqr-pin.is-sel[aria-label="Priya Motors"]')).toBeVisible();
    // The pin tap reaches the map too; it must not fold the sheet.
    await page.waitForTimeout(400);
    await expect(sheet(page)).toHaveAttribute("data-snap", "normal");

    await page.mouse.click(30, 300);
    await expect(sheet(page)).toHaveAttribute("data-snap", "peek");
    const peek = page.locator(".rqr-peek");
    await expect(peek).toContainText("Priya Motors");
    await expect(page.locator(".rqr-locate")).toBeVisible();

    await peek.click();
    await expect(sheet(page)).toHaveAttribute("data-snap", "normal");
    await expect(card(page, "Priya Motors")).toBeVisible();
  });

  test("the sheet can be dragged open to the full list and back down", async ({ page }) => {
    await openRadar(page);
    await expect(card(page, "Arun Kumar")).toBeVisible();

    const { x, y } = await restingHandle(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y - 150, { steps: 6 });
    await page.mouse.move(x, y - 420, { steps: 6 });
    await page.mouse.up();
    await expect(sheet(page)).toHaveAttribute("data-snap", "full");
    await expect(page.getByText("All technicians")).toBeVisible();

    const top = await restingHandle(page);
    await page.mouse.move(x, top.y);
    await page.mouse.down();
    await page.mouse.move(x, top.y + 200, { steps: 6 });
    await page.mouse.move(x, top.y + 640, { steps: 6 });
    await page.mouse.up();
    await expect(sheet(page)).toHaveAttribute("data-snap", "peek");
  });
});

test.describe("Live radar without location", () => {
  test("asks for location and searches nothing", async ({ page }) => {
    const { requests } = await openRadar(page);
    await expect(page.locator(".rqr-hdr")).toContainText("Location off");
    await expect(page.getByText("See help, charging and fuel near you")).toBeVisible();
    await expect(page.getByRole("button", { name: /turn on location/i })).toBeVisible();
    expect(requests.filter((path) => /nearby|stations/.test(path))).toEqual([]);
  });
});

test.describe("Live radar on a large screen", () => {
  test.use({ geolocation: HOME, permissions: ["geolocation"] });
  test.beforeEach(({ isMobile }) => test.skip(isMobile, "Side panel is for tablets and desktops"));

  test("lists everything in a side panel next to the map", async ({ page }) => {
    await openRadar(page, "/map?layer=ev");
    const panel = page.locator(".rqr-sheet.is-panel");
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("article", { name: "Tata Power EZ Charge" })).toBeVisible();
    await expect(panel.getByRole("article", { name: "Green Plug Point" })).toBeVisible();
    await expect(page.getByRole("button", { name: /resize the panel/i })).toHaveCount(0);
    const box = (await panel.boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(430);
  });
});
