import { expect, test } from "@playwright/test";
import { noSideScroll, openPortal, ready, shot } from "./fixtures/adminPortal";

/** An admin token the server signed yesterday: its day is over (resqnowbackend/middleware/auth.js). */
const EXPIRED_TOKEN = ["e30", Buffer.from(JSON.stringify({ role: "admin", type: "admin", email: "ops@resqnow.test", exp: Math.floor(Date.now() / 1000) - 3600 })).toString("base64url"), "e2e"].join(".");

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

test("a sign-in that ran out goes back to the sign-in page, then to the page that was open", async ({ page }) => {
  await page.addInitScript((token) => {
    localStorage.setItem("resqnow_admin_token", token);
    localStorage.setItem("resqnow_admin_user", JSON.stringify({ id: "admin", name: "Admin", email: "ops@resqnow.test", role: "admin" }));
  }, EXPIRED_TOKEN);
  const { w, errors } = await openPortal(page, "/admin/requests", { signedOut: true });

  // Not "Unauthorized" on every card: the sign-in page, saying why.
  await expect(page).toHaveURL(/\/admin\/login$/);
  const form = page.getByRole("form", { name: "Admin sign in" });
  await expect(form.getByRole("status")).toContainText("Your sign-in ended (it lasts a day).");
  await expect(page.getByText("Admin access required")).toHaveCount(0);
  // The old token is gone, so nothing more is sent with it.
  expect(await page.evaluate(() => localStorage.getItem("resqnow_admin_token"))).toBeNull();

  await form.getByLabel("Work email").fill("ops@resqnow.test");
  await form.getByLabel("Password", { exact: true }).fill("right-password");
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/requests$/);
  await expect(page.getByTestId("requests-page").getByRole("row", { name: "Request 5466" })).toBeVisible();
  expect(w.calls.filter((call) => call.path === "/api/admin/login")).toHaveLength(1);
  expect(errors).toEqual([]);
});

test("a sign-in the server refuses while the portal is open sends the admin to sign in again", async ({ page }) => {
  let signedInAgain = false;
  const { errors } = await openPortal(page, "/admin/requests", {
    // The server no longer accepts the sign-in the portal holds, until the admin signs in again.
    extra: ({ path, method, reply }) => {
      if (path === "/api/admin/login" && method === "POST") { signedInAgain = true; return false; }
      if (!signedInAgain && path.startsWith("/api/admin/")) { void reply(401, { error: "Unauthorized" }); return true; }
      return false;
    },
  });

  await expect(page).toHaveURL(/\/admin\/login$/);
  const form = page.getByRole("form", { name: "Admin sign in" });
  await expect(form.getByRole("status")).toContainText("Sign in again to carry on where you were.");
  await expect(page.getByText("Could not load this")).toHaveCount(0);

  await form.getByLabel("Work email").fill("ops@resqnow.test");
  await form.getByLabel("Password", { exact: true }).fill("right-password");
  await form.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/requests$/);
  await expect(page.getByTestId("requests-page").getByRole("row", { name: "Request 5466" })).toBeVisible();
  expect(errors).toEqual([]);
});
