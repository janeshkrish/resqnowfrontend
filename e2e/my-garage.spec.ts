import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// Stands in for the Wikipedia photo, so no network is needed.
const PHOTO = readFileSync(new URL("../public/images/vehicles/car.webp", import.meta.url));
const PHOTO_URL = "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/Nexon.jpg/960px-Nexon.jpg";
const SHOTS = process.env.GARAGE_SHOTS_DIR;

type Vehicle = { id: number; type: string; make: string; model: string; license_plate: string | null; status: string; created_at: string };

const startingGarage = (): Vehicle[] => [
  { id: 1, type: "car", make: "Tata Motors", model: "Nexon", license_plate: "KA 01 AB 1234", status: "ready", created_at: "2026-09-01T10:00:00Z" },
  { id: 2, type: "bike", make: "Honda Motorcycles", model: "Activa 125", license_plate: "KA 05 HX 7781", status: "ready", created_at: "2026-08-01T10:00:00Z" },
  { id: 3, type: "car", make: "Maruti Suzuki", model: "Swift", license_plate: null, status: "maintenance", created_at: "2026-07-01T10:00:00Z" },
];

async function openGarage(page: Page, path: string, garage: Vehicle[] = startingGarage()) {
  const calls: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  // A signed-in customer: the test token only ever reaches the mocked API below.
  await page.addInitScript(() => localStorage.setItem("resqnow_user_token", "e2e-customer-token"));
  await page.route((url) => url.hostname === "upload.wikimedia.org", (route) => route.fulfill({ contentType: "image/webp", body: PHOTO }));
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (method !== "GET") calls.push(`${method} ${url.pathname} ${request.postData() ?? ""}`.trim());

    if (url.pathname === "/api/auth/me") return reply(200, { id: 41, name: "Asha", email: "asha@example.test", isVerified: true });
    if (url.pathname === "/api/public/vehicle-photo") {
      const model = url.searchParams.get("model");
      return reply(200, {
        photo: model === "Nexon"
          ? { url: PHOTO_URL, width: 960, height: 640, article: "Tata Nexon", credit: { author: "Jane Doe", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Nexon.jpg" } }
          : null,
      });
    }
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
  return { calls, errors };
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

test("shows the garage with the model's photo, changes status and removes a vehicle", async ({ page, isMobile }) => {
  const { calls, errors } = await openGarage(page, "/my-garage");

  const hero = page.getByRole("article", { name: "Tata Nexon" });
  await expect(hero).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your vehicles" })).toBeVisible();
  const photo = hero.getByRole("img", { name: "Tata Nexon" });
  await expect(photo).toHaveAttribute("src", PHOTO_URL);
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  expect(await noSideScroll(page)).toBe(true);
  if (isMobile) {
    await expect(page.getByAltText("ResQNow Logo")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /account/i })).toHaveAttribute("aria-current", "page");
  }
  await shot(page, "list");

  await page.getByRole("button", { name: "Maruti Swift, In service" }).click();
  const sheet = page.getByRole("dialog", { name: "Swift" });
  await expect(sheet).toBeVisible();
  await shot(page, "sheet");
  // The whole sheet fits on screen, down to Remove.
  await expect(sheet.getByRole("button", { name: /remove from garage/i })).toBeInViewport({ ratio: 1 });
  await sheet.getByRole("radio", { name: "Not in use" }).click();
  await expect(sheet.getByRole("radio", { name: "Not in use" })).toHaveAttribute("aria-checked", "true");
  await expect.poll(() => calls).toContain('PATCH /api/vehicles/3/status {"status":"inactive"}');

  await sheet.getByRole("button", { name: /remove from garage/i }).click();
  const confirm = page.getByRole("alertdialog", { name: "Remove Maruti Swift?" });
  await expect(confirm).toBeVisible();
  await shot(page, "remove");
  await confirm.getByRole("button", { name: "Remove" }).click();
  await expect(page.getByText("Maruti Swift removed")).toBeVisible();
  await expect(page.getByRole("button", { name: /Maruti Swift/ })).toHaveCount(0);
  expect(calls).toContain("DELETE /api/vehicles/3");

  // The page still responds after both overlays closed.
  await page.getByRole("button", { name: "Honda Activa 125, Ready" }).click();
  await expect(page.getByRole("dialog", { name: "Activa 125" })).toBeVisible();
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
  await expect(page.getByRole("article", { name: "Tata Nexon" })).toBeVisible();
  await expect(page).toHaveURL(/\/my-garage$/);
  expect(calls).toContain('POST /api/vehicles {"type":"car","make":"Tata Motors","model":"Nexon","license_plate":"KA 01 AB 1234"}');
  expect(errors).toEqual([]);
});

test("Get help opens the request form with the vehicle filled in", async ({ page }) => {
  await openGarage(page, "/my-garage");
  await page.getByRole("article", { name: "Tata Nexon" }).getByRole("button", { name: "Get help for this car" }).click();

  await expect(page).toHaveURL(/\/request-service\/emergency\/car\?vehicle=1$/);
  // The garage quick-select shows the vehicle, and the model box is filled in.
  await expect(page.getByRole("combobox").filter({ hasText: "Nexon • KA 01 AB 1234" })).toBeVisible();
  await expect(page.getByRole("combobox").filter({ hasText: /^Nexon$/ })).toBeVisible();
});

test("Settings → My Garage opens the garage", async ({ page, isMobile }) => {
  await openGarage(page, "/settings?tab=garage");
  if (isMobile) {
    // Phones get the full garage page.
    await expect(page).toHaveURL(/\/my-garage$/);
  } else {
    await expect(page).toHaveURL(/\/settings\?tab=garage$/);
  }
  await expect(page.getByRole("article", { name: "Tata Nexon" })).toBeVisible();
  await shot(page, "settings");
});
