import { expect, test } from "@playwright/test";
import { openPortal } from "./fixtures/adminPortal";

// The production Record link uses a migrated UUID, rather than the integers in
// the original portal fixtures. Keep the HTTP boundary and the real UI intact.
const ID = "0896f096-49af-598c-9c58-336d51b12a81";
const catalogId = (kind: string, id: number) => `${kind}0000000-0000-5000-8000-${String(id).padStart(12, "0")}`;
type Extra = NonNullable<NonNullable<Parameters<typeof openPortal>[2]>["extra"]>;

function uuidBackend(reads: string[]): Extra {
  return async ({ path, method, body, reply, w }) => {
    if (method === "GET") reads.push(path);
    let data: unknown;
    if (path === "/api/admin/portal/technicians") data = { ...w.technicians, rows: [{ ...w.technicians.rows[0], id: ID }] };
    else if (path === `/api/admin/monitor/technicians/${ID}/record`) data = { ...w.record, technician: { ...w.record.technician, id: ID } };
    else if (path === `/api/technicians/${ID}`) data = { ...w.profile, id: ID, specialties: ["towing"], vehicle_types: { car: true } };
    else if (path === `/api/admin/monitor/technicians/${ID}/jobs` || path === `/api/admin/monitor/technicians/${ID}/reviews`) data = { data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 1 } };
    else if (path === `/api/technicians/${ID}/approval-audit`) data = [{ action: "approved", reason: "Documents checked", admin_email: "ops@resqnow.test", created_at: "2026-03-03T06:00:00.000Z" }];
    else if (path === `/api/admin-extended/technicians/${ID}/admin-notes`) data = { notes: [] };
    else if (path === `/api/technicians/${ID}/service-pricing`) data = w.pricing.map((row) => ({ ...row, service_id: catalogId("a", row.service_id), vehicle_category_id: catalogId("b", row.vehicle_category_id), vehicle_subcategory_id: row.vehicle_subcategory_id == null ? null : catalogId("c", row.vehicle_subcategory_id) }));
    else if (path === "/api/technicians/pricing-template") data = {
      ...w.template,
      services: w.template.services.map((row) => ({ ...row, id: catalogId("a", row.id) })),
      categories: w.template.categories.map((row) => ({ ...row, id: catalogId("b", row.id) })),
      subcategories: w.template.subcategories.map((row) => ({ ...row, id: catalogId("c", row.id), vehicle_category_id: catalogId("b", row.vehicle_category_id) })),
      pricingFields: w.template.pricingFields.map((row) => ({ ...row, id: catalogId("d", row.id), service_id: catalogId("a", row.service_id) })),
    };
    else if (path === "/api/admin/portal/prices/medians") data = w.medians.map((row) => ({ ...row, serviceId: catalogId("a", row.serviceId) }));
    else if (path === `/api/admin/portal/technicians/${ID}/payouts`) data = w.payouts;
    else if (path === `/api/admin/technician/${ID}/login-activity`) data = w.activity;
    else if (path === `/api/technicians/${ID}/profile` && method === "PUT") {
      w.profile = { ...w.profile, ...(body as Record<string, unknown>) };
      data = { success: true };
    } else return false;
    await reply(200, data);
    return true;
  };
}

test("Record opens a production UUID and all technician tabs retain that ID", async ({ page }) => {
  const reads: string[] = [];
  const { w, errors } = await openPortal(page, "/admin/technicians", { extra: uuidBackend(reads) });
  await page.getByRole("button", { name: "Record", exact: true }).click();
  await expect(page).toHaveURL(`/admin/technicians/${ID}`);
  const record = page.getByTestId("technician-page");
  await expect(record).toContainText("Squad Recovery");
  await expect(record).toContainText("207");
  const tabs = page.getByRole("navigation", { name: "Technician record" });
  for (const [tab, endpoint] of [
    ["Jobs", `/api/admin/monitor/technicians/${ID}/jobs`],
    ["Reviews", `/api/admin/monitor/technicians/${ID}/reviews`],
    ["Profile and documents", `/api/technicians/${ID}/approval-audit`],
    ["Services and prices", `/api/technicians/${ID}/service-pricing`],
    ["Payouts", `/api/admin/portal/technicians/${ID}/payouts`],
    ["Log-in activity", `/api/admin/technician/${ID}/login-activity`],
  ]) {
    await tabs.getByRole("button", { name: new RegExp(`^${tab}`) }).click();
    await expect.poll(() => reads.includes(endpoint)).toBe(true);
    if (tab === "Services and prices") {
      await expect(page.getByTestId("tech-pricing").getByRole("table").first()).toContainText("Sedan");
      await expect(page.getByTestId("tech-pricing").getByRole("table").first()).toContainText("Base Charge");
    }
  }
  await tabs.getByRole("button", { name: "Profile and documents" }).click();
  await expect(page.getByTestId("tech-profile")).toContainText("Selvam Rajendran");
  await page.getByLabel("New note").fill("Checked the production UUID record");
  await page.getByRole("button", { name: "Save note" }).click();
  await expect.poll(() => w.calls.find((call) => call.path === "/api/admin/technician/note")?.body).toEqual({ technicianId: ID, note: "Checked the production UUID record" });
  await expect(page.getByLabel("New note")).toHaveValue("");
  expect(reads.some((path) => path.includes("NaN"))).toBe(false);
  expect(errors).toEqual([]);
});

test("a direct UUID edit link loads and saves prices without changing any catalogue IDs", async ({ page }) => {
  const reads: string[] = [];
  const { w, errors } = await openPortal(page, `/admin/technicians/${ID}/edit`, { extra: uuidBackend(reads) });
  const form = page.getByTestId("technician-form");
  await expect(form.getByLabel("Owner's name")).toHaveValue("Selvam Rajendran");
  await expect(form.getByLabel("Shop name")).toHaveValue("Squad Recovery");
  await form.getByRole("button", { name: /Preview/ }).first().click();
  await expect(form.getByTestId("technician-preview")).toContainText("Car: Sedan, SUV");
  await form.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page).toHaveURL(`/admin/technicians/${ID}?tab=profile`);
  const saved = w.calls.find((call) => call.method === "PUT" && call.path === `/api/technicians/${ID}/profile`)?.body as { dynamic_pricing_config: unknown[] };
  expect(saved.dynamic_pricing_config).toHaveLength(2);
  expect(saved.dynamic_pricing_config[0]).toMatchObject({ service_id: "a0000000-0000-5000-8000-000000000003", vehicle_category_id: "b0000000-0000-5000-8000-000000000002", vehicle_subcategory_id: "c0000000-0000-5000-8000-000000000006" });
  await expect(page.getByTestId("tech-profile")).toContainText("Selvam Rajendran");
  expect(reads).toContain(`/api/technicians/${ID}/service-pricing`);
  expect(errors).toEqual([]);
});

test("an invalid technician link is rejected without requesting a record", async ({ page }) => {
  const reads: string[] = [];
  await openPortal(page, "/admin/technicians/not-a-technician", { extra: uuidBackend(reads) });
  await expect(page.getByText("That technician does not exist", { exact: true })).toBeVisible();
  expect(reads.some((path) => /\/monitor\/technicians\/|\/api\/technicians\/not-a-technician/.test(path))).toBe(false);
});
