import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, portalWorld, shot } from "./fixtures/adminPortal";

// Applications: who is waiting, the checks on each application, their prices next to the city usual, and the decision.

test("check an application, ask for documents, approve it, then reject the next with a reason", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/applications");
  const list = page.getByTestId("applications-page");
  const seg = list.getByRole("radiogroup", { name: "Applications" });
  await expect(seg.getByRole("radio", { name: /Waiting · 2/ })).toBeChecked();
  await expect(seg).toContainText("Approved · 1");
  await expect(seg).toContainText("Rejected · 1");
  await expect(list.getByRole("button", { name: "MK Tyre Works" })).toContainText("Ready to decide");
  await expect(list.getByRole("button", { name: "QuickFix Auto" })).toContainText("0 of 3 checks done");

  const app = page.getByTestId("application");
  await expect(app).toContainText("Mani Kandan · MK Tyre Works");
  await expect(app).toContainText("•••• •••• 1234");
  await expect(app).toContainText("2 of 4 added");
  await expect(app).toContainText("in the app, at sign-up");
  await expect(app).toContainText("07:00 to 22:00, every day");
  await expect(app.locator(".pp-mini").filter({ hasText: "SUV" }).filter({ hasText: "Base Charge" })).toContainText("₹800");
  await expect(app.locator(".pp-mini .ap-warn")).toHaveText(["₹950"]);
  await expect(app).toContainText("1 price is more than 15% above");
  await shot(page, "applications", info.project.name);
  expect(await noSideScroll(page)).toBe(true);

  await app.getByRole("button", { name: "Reject" }).click();
  await expect(app).toContainText("Write the reason first. It is sent to the applicant.");

  await app.getByRole("button", { name: "Ask for documents" }).click();
  const ask = page.getByTestId("ask-dialog");
  await expect(ask.getByLabel("Message")).toHaveValue(/shop photos \(2 missing\)/);
  await expect(ask.getByRole("link", { name: "Open WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/919876543210\?text=/);
  await ask.getByRole("button", { name: "Close" }).click();

  await app.getByRole("button", { name: "Approve" }).click();
  await expect(page).toHaveURL(/\/admin\/applications\/91$/);
  expect(w.calls.find((call) => call.path === "/api/technicians/90/approve")?.body).toMatchObject({ reason: "Documents checked" });
  await expect(seg).toContainText("Waiting · 1");

  await expect(app).toContainText("Joseph D · QuickFix Auto");
  await expect(app.locator(".pp-check")).toContainText("missing");
  await expect(app.locator(".pp-check")).toContainText("no pin");
  await app.getByLabel("Note for the record").fill("Could not verify the shop address.");
  await app.getByRole("button", { name: "Reject" }).click();
  await expect.poll(() => w.calls.find((call) => call.path === "/api/technicians/91/reject")?.body).toMatchObject({ reason: "Could not verify the shop address." });
  await expect(page.getByText("Nobody is waiting")).toBeVisible();

  await seg.getByRole("radio", { name: /Approved/ }).click();
  await expect(list.getByRole("button", { name: "MK Tyre Works" })).toBeVisible();
  await list.getByRole("button", { name: "Squad Recovery" }).click();
  await expect(app.getByRole("link", { name: "Open their record" })).toHaveAttribute("href", "/admin/technicians/42?tab=profile");
  expect(errors).toEqual([]);
});

test("applications keep UUIDs for decisions, pricing, and audit history", async ({ page }) => {
  const approveId = "10000000-0000-4000-8000-000000000001";
  const rejectId = "10000000-0000-4000-8000-000000000002";
  const serviceId = "10000000-0000-4000-8000-000000000003";
  const categoryId = "10000000-0000-4000-8000-000000000004";
  const subtypeId = "10000000-0000-4000-8000-000000000005";
  const technicianPath = (id: string) => `/api/technicians/${id}`;
  const world = portalWorld();
  world.applicants = world.applicants.map((row) => ({ ...row, id: row.id === "90" ? approveId : row.id === "91" ? rejectId : row.id }));
  const auditReads = new Set<string>();
  const { w, errors } = await openPortal(page, `/admin/applications/${approveId}`, {
    world,
    extra: async ({ path, method, reply }) => {
      if (path === "/api/technicians/pricing-template") {
        await reply(200, {
          services: [{ ...world.template.services[1], id: serviceId }],
          categories: [{ ...world.template.categories[1], id: categoryId }],
          subcategories: [{ id: subtypeId, vehicle_category_id: categoryId, subcategory_name: "Sedan" }],
          pricingFields: [{ ...world.template.pricingFields[5], service_id: serviceId }],
        });
      } else if (path === `${technicianPath(approveId)}/service-pricing`) {
        await reply(200, [{ ...world.pricing[0], service_id: serviceId, vehicle_category_id: categoryId, vehicle_subcategory_id: subtypeId }]);
      } else if (path === `${technicianPath(rejectId)}/service-pricing`) {
        await reply(200, []);
      } else if ([approveId, rejectId].some((id) => path === `${technicianPath(id)}/approval-audit`)) {
        auditReads.add(path);
        await reply(200, []);
      } else if (method === "PATCH" && (path === `${technicianPath(approveId)}/approve` || path === `${technicianPath(rejectId)}/reject`)) {
        const approved = path.endsWith("/approve");
        const id = approved ? approveId : rejectId;
        world.applicants = world.applicants.map((row) => row.id === id ? {
          ...row, status: approved ? "approved" : "rejected", verification_status: approved ? "verified" : "rejected",
        } : row);
        await reply(200, { success: true });
      } else {
        return false;
      }
      return true;
    },
  });

  const app = page.getByTestId("application");
  await expect(app.getByText("₹700", { exact: true })).toBeVisible();
  await expect.poll(() => auditReads.has(`${technicianPath(approveId)}/approval-audit`)).toBe(true);
  await app.getByRole("button", { name: "Approve" }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/applications/${rejectId}$`));
  expect(w.calls.find((call) => call.path === `${technicianPath(approveId)}/approve`)).toMatchObject({ method: "PATCH", body: { reason: "Documents checked" } });

  await app.getByLabel("Note for the record").fill("Please verify the shop address.");
  await app.getByRole("button", { name: "Reject" }).click();
  await expect(page.getByText("Nobody is waiting")).toBeVisible();
  expect(w.calls.find((call) => call.path === `${technicianPath(rejectId)}/reject`)).toMatchObject({ method: "PATCH", body: { reason: "Please verify the shop address." } });
  expect(errors).toEqual([]);
});
