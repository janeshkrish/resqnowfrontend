import { expect, test, type Page } from "@playwright/test";
import { noSideScroll, openPortal, shot } from "./fixtures/adminPortal";

// Add technician and Edit technician: the app sign-up's steps, fields, checks and saved body, in the admin portal.

const form = (page: Page) => page.getByTestId("technician-form");
const next = (page: Page) => form(page).getByRole("button", { name: "Continue" }).click();

test("add a technician: every step checks like the app sign-up, and the saved body has the sign-up's shape", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/technicians/new");
  const f = form(page);
  await expect(page.getByRole("heading", { name: "Add technician", level: 1 })).toBeVisible();
  await expect(f).toContainText("STEP 01 / 08");

  // 1 · Personal
  await next(page);
  await expect(f.getByText("Name required", { exact: true })).toBeVisible();
  await expect(f.getByText("Shop Name required", { exact: true })).toBeVisible();
  await expect(f.getByText(/Place the shop.s pin/)).toBeVisible();
  await f.getByLabel("Owner's name").fill("Prakash V");
  await f.getByLabel("Shop name").fill("PV Towing & Tyres");
  await f.getByLabel("Mobile number").fill("9843122760");
  await f.getByLabel("Email address").fill("pv.towing@example.com");
  await next(page);
  await expect(f.getByText("A password is required when you enter an email")).toBeVisible();
  await f.getByLabel(/^Password/).fill("partner123");
  await f.getByLabel(/^Confirm password/).fill("partner123");
  await f.getByLabel("Find the shop").fill("Singanallur");
  await f.getByRole("option", { name: /Singanallur/ }).click();
  const found = f.getByTestId("pin-found");
  await expect(found).toContainText("10.9989, 77.027");
  await expect(found).toContainText("Singanallur");
  await expect(found).toContainText("641005");
  await expect(f.getByLabel("State")).toHaveValue("Tamil Nadu");
  await expect(f.getByLabel("Full address")).toHaveValue("12/4, Trichy Road, Singanallur, Coimbatore");
  await f.getByLabel("Experience (years)").fill("12");
  await f.getByLabel("Range (km)").fill("15");
  await shot(page, "add-tech-personal", info.project.name);
  await next(page);

  // 2 · Services
  await expect(f).toContainText("What do they work on?");
  await next(page);
  await expect(f.getByText("Select at least one service")).toBeVisible();
  await f.getByRole("button", { name: "Car", exact: true }).click();
  await f.getByRole("button", { name: "Towing", exact: true }).click();
  await f.getByRole("button", { name: "Flat tyre", exact: true }).click();
  await next(page);
  await expect(f.getByText("Select at least one tow truck type")).toBeVisible();
  await f.getByRole("button", { name: "Flatbed Trucks" }).click();
  await next(page);

  // 3 · Verify
  await next(page);
  await expect(f.getByText("12 digits required")).toBeVisible();
  await f.getByLabel("Aadhaar number").fill("5821 6604 3317");
  await expect(f.getByLabel("Aadhaar number")).toHaveValue("582166043317");
  await f.getByLabel("Upload Shop front").setInputFiles({ name: "front.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await expect.poll(() => w.calls.some((call) => call.path === "/api/upload")).toBe(true);
  await expect(f.getByRole("button", { name: "Remove Shop front" })).toBeVisible();
  await next(page);

  // 4 · Operations
  await next(page);
  await expect(f.getByText("Choose working hours or 24/7 availability").first()).toBeVisible();
  await f.getByLabel("Available 24 × 7").check({ force: true });
  await f.getByLabel("Preferred language").selectOption("Tamil");
  await next(page);

  // 5 · Pricing
  const prices = f.getByTestId("pricing-step");
  await next(page);
  await expect(prices).toContainText("Choose a car subtype and set its Towing prices.");
  await prices.getByRole("row", { name: "Sedan" }).locator(".ap-check").click();
  await expect(prices.getByLabel("Takes Sedan")).toBeChecked();
  await prices.getByLabel("Sedan Base Charge").fill("900");
  await prices.getByLabel("Sedan Free Distance").fill("5");
  await prices.getByLabel("Sedan Cost Per KM").fill("40");
  await expect(prices.getByRole("row", { name: "Sedan" })).toContainText("usual ₹650");
  await expect(prices.locator(".ad-cell.is-high")).toHaveCount(1);
  await prices.getByRole("tab", { name: /Flat tyre/ }).click();
  await prices.getByRole("row", { name: "Hatchback" }).locator(".ap-check").click();
  await expect(prices.getByLabel("Takes Hatchback")).toBeChecked();
  for (const [field, value] of [["Visit Charge", "200"], ["Free Distance", "3"], ["Cost Per KM", "15"], ["Tube Tyre Price", "220"]]) await prices.getByLabel(`Hatchback ${field}`).fill(value);
  await next(page);
  await expect(prices).toContainText("Enter a valid tubeless tyre price for Hatchback.");
  await prices.getByLabel("Hatchback Tubeless Tyre Price").fill("280");
  await expect(prices.getByRole("tab", { name: /Towing/ })).toContainText("Car 1 type");
  await shot(page, "add-tech-pricing", info.project.name);
  await next(page);

  // 6 · Banking, 7 · Preview
  await f.getByLabel("UPI ID").fill("prakashv@okicici");
  await next(page);
  const preview = f.getByTestId("technician-preview");
  await expect(preview).toContainText("PV Towing & Tyres");
  await expect(preview).toContainText("Set (hidden)");
  await expect(preview).toContainText("Flatbed Trucks");
  await expect(preview).toContainText("Car: Sedan");
  await expect(preview).toContainText("Car: Hatchback");
  await expect(preview).toContainText("24 × 7");
  await shot(page, "add-tech-preview", info.project.name);
  await next(page);

  // 8 · Finish
  await expect(f).toContainText("Add Prakash V to ResQNow");
  await expect(f).toContainText("2 price sets · 1 of 4 photos · Aadhaar given");
  await f.getByRole("button", { name: "Add technician" }).click();
  await expect(f.getByText("Confirm the details and the Terms.")).toBeVisible();
  await f.getByLabel("The details are correct and they agree to the Terms").check({ force: true });
  await f.getByLabel("They have read and agreed to the Technician Agreement").check({ force: true });
  await f.getByText("Approve now").click();
  await shot(page, "add-tech-finish", info.project.name);
  await f.getByRole("button", { name: "Add technician" }).click();
  await expect(page).toHaveURL(/\/admin\/technicians\/77\?tab=profile$/);

  const body = w.calls.find((call) => call.path === "/api/technicians/create")?.body as Record<string, unknown> & { dynamic_pricing_config: unknown[]; pricing_config: { service_domain: string }[]; service_costs: unknown };
  expect(body).toMatchObject({
    status: "approved", proprietor_name: "Prakash V", name: "PV Towing & Tyres", phone: "9843122760", whatsapp_number: "9843122760", email: "pv.towing@example.com", password: "partner123",
    address: "12/4, Trichy Road, Singanallur, Coimbatore", latitude: 10.9989, longitude: 77.027, locality: "Singanallur", region: "Coimbatore", district: "Coimbatore", state: "Tamil Nadu",
    serviceAreaRange: "15", experience: "12", specialties: ["towing", "flat-tire"], vehicle_types: { car: true }, towing_fleet_types: ["flatbed"], service_type: "towing",
    aadhaar_number: "582166043317", documents: { garage_front: "/uploads/technicians/shop-front.jpg" },
    working_hours: { is_24x7: true, opening_time: "", closing_time: "", weekly_off: "None" }, app_readiness: { preferred_language: "Tamil" },
    payment_details: { modes: { cash: true }, upi_id: "prakashv@okicici" }, consent: { agreed: true }, technician_agreement_accepted: true, pricing: {},
  });
  expect(body.dynamic_pricing_config).toEqual([
    { service_id: 3, vehicle_category_id: 2, vehicle_subcategory_id: 6, pricing_json: { service_domain: "towing", vehicle_type: "car", vehicle_subtype: "sedan", vehicle_subtype_label: "Sedan", base_charge: 900, free_distance: 5, cost_per_km: 40 } },
    { service_id: 1, vehicle_category_id: 2, vehicle_subcategory_id: 5, pricing_json: { service_domain: "flat-tire", vehicle_type: "car", vehicle_subtype: "hatchback", vehicle_subtype_label: "Hatchback", visit_charge: 200, free_distance: 3, cost_per_km: 15, tube_tyre_price: 220, tubeless_tyre_price: 280 } },
  ]);
  const towing = body.pricing_config.find((entry: { service_domain: string }) => entry.service_domain === "towing");
  expect(towing).toMatchObject({ vehicle_categories: ["car"], towing_fleet_types: ["flatbed"], towing_vehicle_pricing: { car: { selected_subcategories: ["sedan"], base_charge: 900, extra_km_charge: 40 } } });
  expect(body.service_costs).toEqual(body.pricing_config);
  expect(errors).toEqual([]);
});

test("edit a technician: loads the saved record, keeps the same rules, and saves the same body", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/technicians/42/edit");
  const f = form(page);
  await expect(page.getByRole("heading", { name: "Edit technician", level: 1 })).toBeVisible();
  await expect(f.getByLabel("Owner's name")).toHaveValue("Selvam Rajendran");
  await expect(f.getByLabel("New password")).toHaveAttribute("placeholder", "Leave blank to keep");
  await expect(f.getByTestId("pin-found")).toContainText("11.07, 76.94");
  expect(await noSideScroll(page)).toBe(true);

  await f.getByRole("button", { name: /Preview/ }).first().click();
  await f.getByRole("button", { name: "Save changes" }).click();
  await expect(f).toContainText("Choose a bike subtype and set its Towing prices.");
  await f.getByRole("button", { name: /Services/ }).first().click();
  await f.getByRole("button", { name: "Bike", exact: true }).click();
  await f.getByRole("button", { name: "Winching", exact: true }).click();
  await f.getByRole("button", { name: /Preview/ }).first().click();
  await expect(f.getByTestId("technician-preview")).toContainText("Car: Sedan, SUV");
  await shot(page, "edit-tech-preview", info.project.name);
  await f.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/admin\/technicians\/42\?tab=profile$/);
  const body = w.calls.find((call) => call.method === "PUT" && call.path === "/api/technicians/42/profile")?.body as Record<string, unknown> & { dynamic_pricing_config: unknown[] };
  expect(body).toMatchObject({ name: "Squad Recovery", email: "selvam@example.test", password: "", specialties: ["towing"], vehicle_types: { car: true }, towing_fleet_types: ["flatbed", "wheel-lift"], aadhaar_number: "123456784410" });
  expect(body.dynamic_pricing_config).toHaveLength(2);
  expect(errors).toEqual([]);
});

test("EV charging asks for the supported connectors, and brands for a brand's own plug, as the app sign-up does", async ({ page }) => {
  const { w, errors } = await openPortal(page, "/admin/technicians/42/edit");
  const f = form(page);
  await expect(f.getByLabel("Owner's name")).toHaveValue("Selvam Rajendran");
  await f.getByRole("button", { name: /Services/ }).first().click();
  for (const name of ["Bike", "Car", "EV", "Towing", "Winching", "EV charging"]) await f.getByRole("button", { name, exact: true }).click();
  await f.getByRole("button", { name: /Pricing/ }).first().click();
  const prices = f.getByTestId("pricing-step");
  await prices.getByRole("row", { name: "Scooter" }).locator(".ap-check").click();
  await prices.getByLabel("Scooter Charging Support Fee").fill("300");
  await prices.getByLabel("Scooter Visit Charge").fill("150");
  await f.getByRole("button", { name: /Preview/ }).first().click();
  await f.getByRole("button", { name: "Save changes" }).click();
  await expect(f).toContainText("Choose at least one supported charging connector for Scooter.");

  await f.getByRole("button", { name: /Pricing/ }).first().click();
  const connectors = prices.getByRole("group", { name: "Connectors for Scooter" });
  await connectors.getByText("CCS2", { exact: true }).click();
  await connectors.getByText("Brand’s own plug", { exact: true }).click();
  await f.getByRole("button", { name: /Preview/ }).first().click();
  await f.getByRole("button", { name: "Save changes" }).click();
  await expect(f).toContainText("Enter the supported EV brands for Scooter.");

  await f.getByRole("button", { name: /Pricing/ }).first().click();
  await connectors.getByLabel("Supported EV brands *").fill("Ather, Ola");
  await f.getByRole("button", { name: /Preview/ }).first().click();
  await f.getByRole("button", { name: "Save changes" }).click();
  await expect(page).toHaveURL(/\/admin\/technicians\/42\?tab=profile$/);
  const body = w.calls.find((call) => call.method === "PUT" && call.path === "/api/technicians/42/profile")?.body as Record<string, unknown> & { dynamic_pricing_config: unknown[]; pricing_config: Record<string, unknown>[] };
  expect(body).toMatchObject({ specialties: ["ev-charging"], vehicle_types: { ev: true } });
  expect(body.dynamic_pricing_config).toEqual([{ service_id: 9, vehicle_category_id: 4, vehicle_subcategory_id: null, pricing_json: {
    service_domain: "ev-charging", vehicle_type: "ev", vehicle_subtype: "scooter", vehicle_subtype_label: "Scooter",
    charging_support_fee: 300, visit_charge: 150, supported_connectors: "ccs2,brand", supported_ev_brands: "Ather, Ola",
  } }]);
  expect(body.pricing_config[0]).toMatchObject({ service_domain: "ev-charging", metadata: { supported_connectors: "ccs2,brand", supported_ev_brands: "ather,ola" } });
  expect(errors).toEqual([]);
});
