import { expect, test, type Page } from "@playwright/test";

const SHOTS = process.env.PAGES_SHOTS_DIR;

type Vehicle = { id: number; type: string; make: string; model: string; license_plate: string | null; status: string; created_at: string };

const garage = (): Vehicle[] => [
  { id: 1, type: "car", make: "Tata Motors", model: "Nexon", license_plate: "KA 01 AB 1234", status: "ready", created_at: "2026-09-01T10:00:00Z" },
  { id: 2, type: "bike", make: "Honda Motorcycles", model: "Activa 125", license_plate: "KA 05 HX 7781", status: "ready", created_at: "2026-08-01T10:00:00Z" },
  { id: 3, type: "car", make: "Maruti Suzuki", model: "Swift", license_plate: null, status: "maintenance", created_at: "2026-07-01T10:00:00Z" },
];

// The lowest price technicians charge for each service, by kind of vehicle.
const PRICES: Record<string, Record<string, number>> = {
  car: { towing: 599, "flat-tire": 349, battery: 399, mechanical: 499, fuel: 299, lockout: 399, winching: 599 },
  bike: { towing: 399, "flat-tire": 99, battery: 199, mechanical: 499, fuel: 99, lockout: 199, winching: 399 },
  commercial: { towing: 2499, "flat-tire": 999, battery: 899, mechanical: 1499, fuel: 499, lockout: 699, winching: 1999 },
  ev: { towing: 699, "ev-charging": 299, "flat-tire": 299, battery: 499, mechanical: 399, lockout: 399, winching: 699 },
};

type Options = { signedIn?: boolean; vehicles?: Vehicle[]; prices?: boolean; location?: boolean };

async function openGetHelp(page: Page, { signedIn = true, vehicles = garage(), prices = true, location = true }: Options = {}) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (location) {
    await page.context().grantPermissions(["geolocation"]);
    await page.context().setGeolocation({ latitude: 11.0168, longitude: 76.9558 });
  }
  // A signed-in customer: the test token only ever reaches the mocked API below.
  if (signedIn) await page.addInitScript(() => localStorage.setItem("resqnow_user_token", "e2e-customer-token"));
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const url = new URL(route.request().url());
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/api/auth/me") return signedIn ? reply(200, { id: 41, name: "Asha", email: "asha@example.test", isVerified: true }) : reply(401, {});
    if (url.pathname === "/api/vehicles") return reply(200, vehicles);
    if (url.pathname === "/api/public/reverse-geocode") {
      return reply(200, { display_name: "12, Avinashi Road, Peelamedu, Coimbatore", address: { suburb: "Peelamedu", house_number: "12", road: "Avinashi Road", city: "Coimbatore", postcode: "641004" } });
    }
    if (url.pathname === "/api/public/service-prices") {
      if (!prices) return reply(500, {});
      const vehicle = url.searchParams.get("vehicle") || "car";
      return reply(200, { vehicle, currency: "INR", services: Object.entries(PRICES[vehicle] ?? {}).map(([service, startingPrice]) => ({ service, startingPrice, technicians: 3 })) });
    }
    if (url.pathname === "/api/users/me/settings") return reply(200, {});
    if (url.pathname === "/api/service-requests") return reply(200, []);
    return reply(404, {});
  });
  await page.goto("/services");
  return { errors };
}

const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-gethelp-${name}.png`, fullPage: false });
};
const tiles = (page: Page) => page.locator(".rq-gh-two a, .rq-gh-three a");
const tileNames = (page: Page) => tiles(page).locator("> b").allInnerTexts();

test("a customer's saved vehicles come first, with prices and links for the one picked", async ({ page, isMobile }) => {
  const { errors } = await openGetHelp(page);

  await expect(page.getByRole("heading", { name: "Get help", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /Help comes to Peelamedu, 12, Avinashi Road/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "SOS, request emergency help" })).toHaveAttribute("href", "/request-service/emergency");

  // The newest saved vehicle is picked; all of them are offered, each with the app's own picture.
  const row = page.getByRole("radiogroup", { name: "Your vehicle" });
  await expect(row.getByRole("radio", { name: "Nexon, KA 01 AB 1234" })).toBeChecked();
  await expect(row.getByRole("radio")).toHaveCount(3);
  await expect(row.getByRole("radio", { name: "Activa 125, KA 05 HX 7781" }).locator("img")).toHaveAttribute("src", "/images/vehicles/bike.webp");
  await expect(row.getByRole("radio", { name: "Swift" })).toContainText("No plate");

  // Seven services for a car (no charging), then "Something else".
  await expect(page.getByText("Lowest prices from our technicians · Nexon")).toBeVisible();
  expect(await tileNames(page)).toEqual(["Towing", "Flat tyre", "Battery", "Mechanic", "Fuel", "Lockout", "Winching", "Something else"]);
  const towing = page.getByRole("link", { name: "Towing for your Nexon, from ₹599" });
  await expect(towing).toHaveAttribute("href", "/request-service/towing/car?vehicle=1");
  await expect(towing.locator("img")).toHaveAttribute("src", "/images/home/services/towing.webp");
  await expect(towing).toContainText("Take it to a garage");
  await expect(page.getByRole("link", { name: "Lockout for your Nexon, from ₹399" })).toHaveAttribute("href", "/request-service/lockout/car?vehicle=1");
  await expect(page.getByRole("link", { name: "Something else: tell us what happened" })).toHaveAttribute("href", "/request-service/other/car?vehicle=1");
  for (const image of await tiles(page).locator("img").all()) {
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  }

  // Coming soon: said plainly, and nothing to tap.
  const soon = page.getByRole("complementary", { name: "AI Vehicle Health, coming soon" });
  await expect(soon).toContainText("Coming soon");
  await expect(soon).toContainText("AI Vehicle Health");
  await expect(soon.locator("a, button")).toHaveCount(0);
  await expect(page.getByText("You see the price before you confirm, and pay only after the work is done.")).toBeAttached();

  expect(await noSideScroll(page)).toBe(true);
  if (isMobile) {
    // The page brings its own heading, and every choice is on the first screen.
    await expect(page.getByAltText("ResQNow Logo")).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Main" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Something else: tell us what happened" }).locator(".rq-gh-tile")).toBeInViewport({ ratio: 1 });
  }
  await shot(page, "garage");

  // A saved bike: its own prices, and its own request links.
  await row.getByRole("radio", { name: "Activa 125, KA 05 HX 7781" }).click();
  await expect(page.getByText("Lowest prices from our technicians · Activa 125")).toBeVisible();
  await expect(page.getByRole("link", { name: "Flat tyre for your Activa 125, from ₹99" })).toHaveAttribute("href", "/request-service/flat-tire/bike?vehicle=2");
  await shot(page, "bike");

  // Tapping a service opens its request form for that vehicle.
  await page.getByRole("link", { name: "Battery for your Activa 125, from ₹199" }).click();
  await expect(page).toHaveURL(/\/request-service\/battery\/bike\?vehicle=2$/);
  expect(errors).toEqual([]);
});

test("another vehicle: the four kinds, each with its own services", async ({ page }) => {
  const { errors } = await openGetHelp(page);
  const row = page.getByRole("radiogroup", { name: "Your vehicle" });
  await row.getByRole("button", { name: "Other" }).click();

  await expect(row.getByRole("radio")).toHaveCount(4);
  await expect(row.getByRole("radio", { name: "Car" })).toBeChecked();
  await expect(page.getByRole("link", { name: "Towing for your car, from ₹599" })).toHaveAttribute("href", "/request-service/towing/car");

  // Electric: charging stands beside towing, and there is no fuel.
  await row.getByRole("radio", { name: "EV" }).click();
  await expect(page.getByText("Lowest prices from our technicians · EV")).toBeVisible();
  expect(await tileNames(page)).toEqual(["Towing", "EV charge", "Flat tyre", "Battery", "Mechanic", "Lockout", "Winching", "Something else"]);
  await expect(page.getByRole("link", { name: "EV charge for your ev, from ₹299" })).toHaveAttribute("href", "/request-service/ev-charging/ev");
  await shot(page, "ev");

  await row.getByRole("radio", { name: "Truck" }).click();
  await expect(page.getByRole("link", { name: "Towing for your truck, from ₹2,499" })).toHaveAttribute("href", "/request-service/towing/commercial");

  // Back to the saved vehicles.
  await row.getByRole("button", { name: "My garage" }).click();
  await expect(row.getByRole("radio", { name: "Nexon, KA 01 AB 1234" })).toBeChecked();
  expect(errors).toEqual([]);
});

test("a visitor who is not signed in picks a kind of vehicle", async ({ page }) => {
  const { errors } = await openGetHelp(page, { signedIn: false });
  const row = page.getByRole("radiogroup", { name: "Your vehicle" });
  await expect(row.getByRole("radio")).toHaveCount(4);
  await expect(row.getByRole("button")).toHaveCount(0);
  await expect(page.getByText("Save your vehicle once")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Flat tyre for your car, from ₹349" })).toHaveAttribute("href", "/request-service/flat-tire/car");
  expect(errors).toEqual([]);
});

test("nothing saved yet, no prices and location off: the page still works", async ({ page }) => {
  const { errors } = await openGetHelp(page, { vehicles: [], prices: false, location: false });

  await expect(page.getByRole("button", { name: /Location is off|Couldn’t find your location/ })).toBeVisible();
  await expect(page.getByText("Save your vehicle once and pick it here in one tap.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Save" })).toHaveAttribute("href", "/my-garage/add");
  // No prices to show: the line about prices goes, the services stay.
  await expect(page.getByRole("link", { name: "Towing for your car" })).toHaveAttribute("href", "/request-service/towing/car");
  await expect(page.getByText("Lowest prices from our technicians")).toHaveCount(0);
  await expect(page.locator(".rq-gh-price b")).toHaveCount(0);
  await shot(page, "bare");
  expect(await noSideScroll(page)).toBe(true);
  expect(errors).toEqual([]);
});
