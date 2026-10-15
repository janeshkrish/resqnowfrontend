import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, shot } from "./fixtures/adminPortal";

// Audit log: every admin change in words, with who, when, on what, and why.

test("the audit log in words, by group and search, with links to what was changed", async ({ page }, info) => {
  const { errors } = await openPortal(page, "/admin/audit");
  const audit = page.getByTestId("audit");
  await expect(audit.getByRole("row", { name: "Changed the fare by ops@resqnow.test" })).toContainText("fare ₹780 · A part was needed; the customer agreed");
  await expect(audit.getByRole("row", { name: "Assigned a technician by kavya@resqnow.test" })).toContainText("technician #12");
  await expect(audit.getByRole("row", { name: "Messaged technicians by ops@resqnow.test" })).toContainText("3 technicians");
  await expect(audit.getByRole("link", { name: "#5474" })).toHaveAttribute("href", "/admin/requests/5474");
  await expect(audit.getByRole("link", { name: "Complaint C-1031" })).toHaveAttribute("href", "/admin/complaints/1031");
  await shot(page, "audit", info.project.name);
  expect(await noSideScroll(page)).toBe(true);

  await page.getByRole("navigation", { name: "Audit log" }).getByRole("button", { name: /^Messages/ }).click();
  await expect(audit.getByRole("row")).toHaveCount(3);
  await page.getByRole("navigation", { name: "Audit log" }).getByRole("button", { name: /^Everything/ }).click();
  await page.getByRole("searchbox").fill("flyover");
  await expect(audit.getByRole("row")).toHaveCount(2);
  await expect(audit).toContainText("“Ukkadam flyover closed until noon”");
  expect(errors).toEqual([]);
});
