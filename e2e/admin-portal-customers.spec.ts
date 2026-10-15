import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, shot } from "./fixtures/adminPortal";

// Customers: the list, one customer's record with their live request, requests, payments, vehicles and notes,
// and adding, editing and deleting an account.

test("the list, then one customer: live request, requests, payments, vehicles and a new note", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/customers");
  await expect(page.getByText("8,214 customers · 312 joined in the last 30 days")).toBeVisible();
  const table = page.getByTestId("customers-table");
  const asha = table.getByRole("row", { name: "Asha Raman" });
  await expect(asha).toContainText("Live now · #5502");
  await expect(asha).toContainText("Smart Care");
  await expect(asha).toContainText("₹1,010");
  await expect(table.getByRole("row", { name: "Harish B" })).toContainText("Cancelled 4 times");
  await expect(table.getByRole("row", { name: "Ramesh K" })).toContainText("Never");
  await shot(page, "customers", info.project.name);
  expect(await noSideScroll(page)).toBe(true);
  await page.getByRole("navigation", { name: "Customers" }).getByRole("button", { name: /^Live now/ }).click();
  await expect(table.getByRole("row", { name: "Harish B" })).toHaveCount(0);

  await table.getByRole("row", { name: "Asha Raman" }).click();
  await expect(page).toHaveURL(/\/admin\/customers\/41$/);
  const record = page.getByTestId("customer-page");
  await expect(record).toContainText("signs in with a phone code");
  await expect(record).toContainText("On a live request now: #5502");
  await expect(record.getByTestId("customer-requests")).toContainText("Vijay P · 5 ★");
  await expect(record.getByTestId("customer-payments")).toContainText("pay_Q2kfA19xVb07");
  await expect(record).toContainText("TN 38 CM 4471");
  await expect(record.getByRole("link", { name: "Call" })).toHaveAttribute("href", "tel:9876500210");
  const notes = record.getByTestId("customer-notes");
  await notes.getByRole("textbox", { name: "New note" }).fill("Asked for a GST invoice.");
  await notes.getByRole("button", { name: "Save note" }).click();
  await expect(notes).toContainText("Asked for a GST invoice.");
  expect(w.calls.find((call) => call.path === "/api/admin/portal/customers/41/notes")?.body).toMatchObject({ note: "Asked for a GST invoice." });
  await shot(page, "customer", info.project.name);
  expect(await noSideScroll(page)).toBe(true);

  await record.getByTestId("customer-requests").getByRole("row", { name: "Request 5318" }).click();
  await expect(page.getByTestId("request-panel")).toBeVisible();
  expect(errors).toEqual([]);
});

test("add a customer, edit one, and deleting is refused during a live request", async ({ page }) => {
  const { w, errors } = await openPortal(page, "/admin/customers");
  await page.getByRole("button", { name: "Add customer" }).click();
  const add = page.getByTestId("add-customer");
  await add.getByLabel("Full name *").fill("Lakshmi Narayanan");
  await add.getByLabel("Email *").fill("lakshmi.n@example.test");
  await add.getByLabel("Password *", { exact: true }).fill("short");
  await add.getByRole("button", { name: "Create customer" }).click();
  await expect(add).toContainText("Use a password of 8 or more characters.");
  await add.getByLabel("Password *", { exact: true }).fill("welcome123");
  await add.getByLabel("Confirm password *").fill("welcome123");
  await add.getByRole("button", { name: "Create customer" }).click();
  await expect(page).toHaveURL(/\/admin\/customers\/99$/);
  expect(w.calls.find((call) => call.path === "/api/admin/users" && call.method === "POST")?.body).toEqual({ name: "Lakshmi Narayanan", email: "lakshmi.n@example.test", password: "welcome123" });

  await page.goto("/admin/customers/41");
  await page.getByTestId("customer-page").getByRole("button", { name: "Edit" }).click();
  const edit = page.getByTestId("edit-customer");
  await expect(edit).toContainText("Not possible during a live request: they are on #5502 now.");
  await expect(edit.getByRole("button", { name: "Delete" })).toBeDisabled();
  await edit.getByLabel("Full name *").fill("Asha R");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toHaveCount(0);
  expect(w.calls.find((call) => call.path === "/api/admin/users/41" && call.method === "PUT")?.body).toEqual({ name: "Asha R" });
  await expect(page.getByTestId("customer-page")).toContainText("Asha R");
  expect(errors).toEqual([]);
});
