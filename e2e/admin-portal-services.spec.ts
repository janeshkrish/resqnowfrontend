import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, shot } from "./fixtures/adminPortal";

// Services and prices: the price setup technicians fill in, with the city's prices, turning a service on or off,
// and adding or removing a price field.

test("services with technicians and their prices; turn one on; add and remove a price field", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/services");
  const table = page.getByTestId("services");
  await expect(table.getByRole("row", { name: "Towing Services" })).toContainText("₹400–₹950");
  await expect(table.getByRole("row", { name: "Towing Services" })).toContainText("412");
  await expect(table.getByRole("switch", { name: "Technicians can offer Winching Services" })).toHaveAttribute("aria-checked", "false");
  await shot(page, "services", info.project.name);
  expect(await noSideScroll(page)).toBe(true);

  await table.getByRole("switch", { name: "Technicians can offer Winching Services" }).click();
  await expect.poll(() => w.calls.find((call) => call.path === "/api/admin/services/8" && call.method === "PUT")?.body).toMatchObject({ service_name: "Winching Services", active: true });
  await expect(table.getByRole("switch", { name: "Technicians can offer Winching Services" })).toHaveAttribute("aria-checked", "true");

  await table.getByRole("row", { name: "Towing Services" }).click();
  const side = page.getByTestId("service-side");
  await expect(side).toContainText("Base Charge");
  await expect(side).toContainText("free_distance");
  await side.getByLabel("Add a price field").fill("Night charge");
  await expect(side).toContainText("Saved as night_charge");
  await side.getByRole("button", { name: "Add field" }).click();
  await expect(side).toContainText("Night charge");
  expect(w.calls.find((call) => call.path === "/api/admin/pricing-fields" && call.method === "POST")?.body).toMatchObject({ service_id: 3, field_key: "night_charge", field_label: "Night charge", required: true, field_type: "Number" });
  await side.getByRole("button", { name: "Remove Free Distance" }).click();
  await expect(side).not.toContainText("free_distance");

  await page.getByRole("button", { name: /^Sub-types/ }).click();
  await expect(page.getByTestId("setup-car-sub-types")).toContainText("Hatchback");
  await page.getByRole("button", { name: /^Tow trucks/ }).click();
  await expect(page.getByTestId("setup-tow-trucks")).toContainText("Flatbed Trucks");
  expect(errors).toEqual([]);
});
