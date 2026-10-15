import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, ready, shot } from "./fixtures/adminPortal";

// Admin sign in: a signed-out visit goes to the sign-in page; a wrong password is refused; the right one opens Today.

test("sign in to the admin portal", async ({ page }, info) => {
  const { w, errors } = await openPortal(page, "/admin/today", { signedOut: true });
  await expect(page).toHaveURL(/\/admin\/login$/);
  await ready(page);
  const form = page.getByRole("form", { name: "Admin sign in" });
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(form).toContainText("Write your work email and password.");
  await form.getByLabel("Work email").fill("ops@resqnow.test");
  await form.getByLabel("Password", { exact: true }).fill("wrong-password");
  await form.getByRole("button", { name: "Show the password" }).click();
  await expect(form.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(form).toContainText("Invalid email or password.");
  await shot(page, "login", info.project.name);
  expect(await noSideScroll(page)).toBe(true);

  await form.getByLabel("Password", { exact: true }).fill("right-password");
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/today$/);
  await expect(page.getByRole("heading", { name: "Today", level: 1 })).toBeVisible();
  expect(w.calls.filter((call) => call.path === "/api/admin/login")).toHaveLength(2);
  expect(errors).toEqual([]);
});
