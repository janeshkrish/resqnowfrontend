import { expect, test, type Page } from "@playwright/test";

// Customer log in with a mobile number. The page runs the real Firebase SDK; the test stands
// in for Google (the reCAPTCHA script and Firebase's Identity Toolkit) and for our own API,
// so no SMS is sent and no keys are needed. The Firebase project comes from playwright.config.ts.

const SHOTS = process.env.LOGIN_SHOTS_DIR;
const RIGHT_CODE = "482913";
const PHONE = "+919876543210";
const ACCOUNT = { id: 41, name: "Asha Raman", email: "", phone: PHONE, isVerified: true, role: "user" };

type Json = Record<string, unknown>;
type Options = {
  /** What our server says to a verified number: a known customer, or one it has not seen. */
  known?: boolean;
  /** Our server is down for the first phone-login call. */
  serverDownOnce?: boolean;
  /** Firebase refuses to send the SMS. */
  sendError?: string;
  path?: string;
  clock?: boolean;
};

const b64 = (value: Json) => Buffer.from(JSON.stringify(value)).toString("base64url");

/** A Firebase ID token as the SDK reads it (the signature is only checked by our server). */
function firebaseIdToken() {
  const now = Math.floor(Date.now() / 1000);
  return [
    b64({ alg: "RS256", typ: "JWT" }),
    b64({
      iss: "https://securetoken.google.com/resqnow-e2e",
      aud: "resqnow-e2e",
      auth_time: now,
      user_id: "fb-uid-1",
      sub: "fb-uid-1",
      iat: now,
      exp: now + 3600,
      phone_number: PHONE,
      firebase: { identities: { phone: [PHONE] }, sign_in_provider: "phone" },
    }),
    "e2e-signature",
  ].join(".");
}

async function openLogin(page: Page, { known = true, serverDownOnce = false, sendError, path = "/login", clock = false }: Options = {}) {
  const errors: string[] = [];
  const google: { path: string; body: Json }[] = [];
  const api: { path: string; body: Json }[] = [];
  const unexpected: string[] = [];
  const idToken = firebaseIdToken();
  let serverDown = serverDownOnce;
  page.on("pageerror", (error) => errors.push(error.message));
  if (clock) await page.clock.install();

  // Google's reCAPTCHA: an invisible check that passes at once.
  await page.route((url) => url.hostname === "www.google.com" && url.pathname.startsWith("/recaptcha/"), async (route) => {
    const onload = new URL(route.request().url()).searchParams.get("onload") || "";
    await route.fulfill({
      contentType: "application/javascript",
      body: `(function () {
        var widgets = [];
        window.grecaptcha = {
          render: function (box, params) { widgets.push(params); return widgets.length - 1; },
          getResponse: function () { return ""; },
          execute: function (id) { setTimeout(function () { widgets[id].callback("e2e-recaptcha-token"); }, 0); },
          reset: function () {}
        };
        if (window[${JSON.stringify(onload)}]) window[${JSON.stringify(onload)}]();
      })();`,
    });
  });

  // Firebase's Identity Toolkit: sends "the SMS" and checks the code.
  await page.route((url) => url.hostname === "identitytoolkit.googleapis.com", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.postData() ? (JSON.parse(request.postData() || "{}") as Json) : {};
    const reply = (status: number, data: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    const fail = (message: string) => reply(400, { error: { code: 400, message, errors: [{ message, domain: "global", reason: "invalid" }] } });
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204 });
    google.push({ path: url.pathname, body });
    if (url.pathname === "/v2/recaptchaConfig") return reply(200, { recaptchaKey: "projects/resqnow-e2e/keys/e2e-site", recaptchaEnforcementState: [] });
    if (url.pathname === "/v1/recaptchaParams") return reply(200, { recaptchaSiteKey: "e2e-site-key" });
    if (url.pathname === "/v1/accounts:sendVerificationCode") {
      if (sendError) return fail(sendError);
      return reply(200, { sessionInfo: `e2e-session-${google.filter((call) => call.path === url.pathname).length}` });
    }
    if (url.pathname === "/v1/accounts:signInWithPhoneNumber") {
      if (body.code !== RIGHT_CODE) return fail("INVALID_CODE");
      return reply(200, { idToken, refreshToken: "e2e-refresh", expiresIn: "3600", localId: "fb-uid-1", isNewUser: !known, phoneNumber: PHONE });
    }
    if (url.pathname === "/v1/accounts:lookup") {
      return reply(200, {
        users: [{
          localId: "fb-uid-1",
          phoneNumber: PHONE,
          providerUserInfo: [{ providerId: "phone", rawId: PHONE, phoneNumber: PHONE }],
          createdAt: "1760400000000",
          lastLoginAt: "1760400000000",
        }],
      });
    }
    unexpected.push(url.pathname);
    return reply(404, { error: { code: 404, message: "NOT_FOUND" } });
  });

  // Our API.
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const body = request.postData() ? (JSON.parse(request.postData() || "{}") as Json) : {};
    const reply = (status: number, data: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (request.method() !== "GET") api.push({ path: url.pathname, body });
    if (url.pathname === "/api/users/phone-login") {
      if (serverDown) {
        serverDown = false;
        return reply(503, { error: "Phone login is not available right now. Please use Google or email." });
      }
      if (body.idToken !== idToken) return reply(401, { error: "We could not confirm your number. Please try again." });
      if (known) return reply(200, { token: "e2e-phone-token", role: "user", isNew: false, user: ACCOUNT });
      if (!body.name) return reply(200, { needsName: true, phone: PHONE });
      return reply(201, { token: "e2e-phone-token", role: "user", isNew: true, user: { ...ACCOUNT, id: 501, name: body.name } });
    }
    if (url.pathname === "/api/users/login") {
      if (body.password !== "right-password") return reply(401, { error: "Invalid email or password." });
      return reply(200, { token: "e2e-email-token", role: "user", user: { id: 41, name: "Asha Raman", email: body.email, isVerified: true, role: "user" } });
    }
    if (url.pathname === "/api/auth/google/url") return reply(200, { url: "https://accounts.e2e.test/o/oauth2/auth?state=web" });
    if (url.pathname === "/api/auth/me") return reply(401, { error: "Unauthorized" });
    return reply(404, {});
  });

  await page.route((url) => url.hostname === "accounts.e2e.test", (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Google</title><h1>Choose an account</h1>" })
  );

  await page.goto(path);
  await expect(page.getByTestId("customer-login")).toBeVisible();
  // The app's launch splash covers every page for a moment; wait until the log in page is on top.
  await expect
    .poll(() => page.evaluate(() => !!document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest(".lg")))
    .toBe(true);
  return { errors, google, api, unexpected, idToken };
}

const phoneField = (page: Page) => page.getByLabel("Mobile number");
const codeField = (page: Page) => page.getByLabel("6-digit code");
const getCode = (page: Page) => page.getByRole("button", { name: "Get code" });
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-login-${name}.png`, animations: "disabled" });
};
const storedToken = (page: Page) => page.evaluate(() => localStorage.getItem("resqnow_user_token"));

test("A returning customer: the number, the SMS code, and straight in", async ({ page, isMobile }) => {
  const { errors, google, api, unexpected, idToken } = await openLogin(page);

  await expect(page.getByRole("heading", { name: /Roadside help/, level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Log in or sign up" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use email and password" })).toBeVisible();
  const legal = page.locator(".lg-step .lg-legal");
  await expect(legal.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms-of-service");
  await expect(legal.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy-policy");
  await expect(page.getByText("Protected by reCAPTCHA.")).toBeVisible();
  await expect(getCode(page)).toBeDisabled();
  expect(await noSideScroll(page)).toBe(true);

  // The picture sits above the form on a phone and beside it on a wide screen.
  const art = (await page.locator(".lg-art").boundingBox())!;
  const panel = (await page.locator(".lg-panel").boundingBox())!;
  if (isMobile) expect(art.y + art.height).toBeLessThanOrEqual(panel.y + 1);
  else expect(art.x + art.width).toBeLessThanOrEqual(panel.x + 1);
  // Get code is on screen without scrolling.
  const button = (await getCode(page).boundingBox())!;
  expect(button.y + button.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await shot(page, "start");

  await phoneField(page).fill("98765432");
  await expect(getCode(page)).toBeDisabled();
  await phoneField(page).fill("9876543210");
  await expect(phoneField(page)).toHaveValue("98765 43210");
  await expect(getCode(page)).toBeEnabled();
  await shot(page, "number");
  await getCode(page).click();

  await expect(page.getByRole("heading", { name: "Enter the 6-digit code" })).toBeVisible();
  await expect(page.getByText("Sent by SMS to +91 98765 43210")).toBeVisible();
  await expect(page.getByText(/^Resend code in 0:(30|29|28)$/)).toBeVisible();
  await expect(codeField(page)).toBeFocused();
  const sent = google.find((call) => call.path === "/v1/accounts:sendVerificationCode")!;
  expect(sent.body.phoneNumber).toBe(PHONE);
  expect(sent.body.recaptchaToken).toBe("e2e-recaptcha-token");
  await shot(page, "code");

  await codeField(page).pressSequentially("4829");
  await expect(page.locator(".lg-boxes > span")).toHaveText(["4", "8", "2", "9", "", ""]);
  await codeField(page).pressSequentially("13");

  // Six digits check by themselves.
  await expect(page).toHaveURL(/\/$/);
  expect(await storedToken(page)).toBe("e2e-phone-token");
  expect(api.filter((call) => call.path === "/api/users/phone-login")).toEqual([{ path: "/api/users/phone-login", body: { idToken } }]);
  expect(google.find((call) => call.path === "/v1/accounts:signInWithPhoneNumber")!.body).toMatchObject({ code: RIGHT_CODE, sessionInfo: "e2e-session-1" });
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("A new number gives its name once, then is in", async ({ page }) => {
  const { errors, api, idToken } = await openLogin(page, { known: false });

  await phoneField(page).fill("+91 98765 43210");
  await expect(phoneField(page)).toHaveValue("98765 43210");
  await getCode(page).click();
  await codeField(page).fill(RIGHT_CODE);

  await expect(page.getByRole("heading", { name: "What should we call you?" })).toBeVisible();
  await expect(page.getByText("Your technician sees this name. Asked only once.")).toBeVisible();
  await expect(page.locator(".lg-done")).toContainText("Verified");
  const nameField = page.getByLabel("Your name");
  await expect(nameField).toBeFocused();
  expect(await storedToken(page)).toBeNull();
  await shot(page, "name");

  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Please type your name.")).toBeVisible();

  await nameField.fill("  Asha   Raman ");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Welcome to ResQNow, Asha!")).toBeVisible();
  expect(await storedToken(page)).toBe("e2e-phone-token");
  expect(api.filter((call) => call.path === "/api/users/phone-login")).toEqual([
    { path: "/api/users/phone-login", body: { idToken } },
    { path: "/api/users/phone-login", body: { idToken, name: "Asha Raman" } },
  ]);
  expect(errors).toEqual([]);
});

test("A wrong code turns the boxes red; after 30 seconds a new code can be sent; the number can be changed", async ({ page }) => {
  const { errors, google } = await openLogin(page, { clock: true });

  await phoneField(page).fill("9876543210");
  await getCode(page).click();
  await codeField(page).fill("482931");

  await expect(page.getByRole("alert")).toHaveText(/That code is not right\. Check the SMS and try again\./);
  await expect(page.locator(".lg-code")).toHaveClass(/is-bad/);
  expect(await storedToken(page)).toBeNull();
  await shot(page, "wrong-code");

  // Typing again clears the red.
  await codeField(page).fill("48293");
  await expect(page.locator(".lg-code")).not.toHaveClass(/is-bad/);
  await expect(page.getByRole("alert")).toHaveCount(0);

  await expect(page.getByRole("button", { name: "Resend code" })).toHaveCount(0);
  await page.clock.fastForward("00:31");
  await page.getByRole("button", { name: "Resend code" }).click();
  await expect(page.getByText("New code sent")).toBeVisible();
  await expect(page.getByText(/^Resend code in 0:(30|29|28)$/)).toBeVisible();
  await expect(codeField(page)).toHaveValue("");
  expect(google.filter((call) => call.path === "/v1/accounts:sendVerificationCode")).toHaveLength(2);
  await shot(page, "resent");

  await page.getByRole("button", { name: "Change" }).click();
  await expect(page.getByRole("heading", { name: "Log in or sign up" })).toBeVisible();
  await expect(phoneField(page)).toHaveValue("98765 43210");
  await expect(phoneField(page)).toBeFocused();
  // Backspace over the space takes the digit before it.
  await phoneField(page).press("End");
  for (let i = 0; i < 5; i += 1) await phoneField(page).press("Backspace");
  await expect(phoneField(page)).toHaveValue("98765");
  await phoneField(page).press("Backspace");
  await expect(phoneField(page)).toHaveValue("9876");
  await expect(getCode(page)).toBeDisabled();
  expect(errors).toEqual([]);
});

test("Firebase refusing to send says so in plain words and stays on the number", async ({ page }) => {
  const { errors } = await openLogin(page, { sendError: "TOO_MANY_ATTEMPTS_TRY_LATER" });

  await phoneField(page).fill("9876543210");
  await getCode(page).click();
  await expect(page.getByRole("alert")).toHaveText(/Too many tries for now\. Please wait a few minutes and try again\./);
  await expect(page.getByRole("heading", { name: "Log in or sign up" })).toBeVisible();
  await expect(getCode(page)).toBeEnabled();
  expect(errors).toEqual([]);
});

test("If our server fails after a right code, Try again needs no new SMS", async ({ page }) => {
  const { errors, google, api } = await openLogin(page, { serverDownOnce: true });

  await phoneField(page).fill("9876543210");
  await getCode(page).click();
  await codeField(page).fill(RIGHT_CODE);
  await expect(page.getByRole("alert")).toContainText("Phone login is not available right now. Please use Google or email.");
  await expect(page.locator(".lg-code")).not.toHaveClass(/is-bad/);

  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await storedToken(page)).toBe("e2e-phone-token");
  expect(google.filter((call) => call.path === "/v1/accounts:signInWithPhoneNumber")).toHaveLength(1);
  expect(api.filter((call) => call.path === "/api/users/phone-login")).toHaveLength(2);
  expect(errors).toEqual([]);
});

test("Email and password still work, and back to the mobile number", async ({ page }) => {
  const { errors, api } = await openLogin(page);

  await page.getByRole("button", { name: "Use email and password" }).click();
  await expect(page.getByRole("heading", { name: "Log in with email" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeFocused();
  await expect(page.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, "email");

  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(/Please enter a valid email address\./);

  await page.getByLabel("Email address").fill("asha@example.test");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Show password" }).click();
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("type", "text");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText(/Invalid email or password\./);

  await page.getByRole("button", { name: "Use mobile" }).click();
  await expect(page.getByRole("heading", { name: "Log in or sign up" })).toBeVisible();
  await page.getByRole("button", { name: "Use email and password" }).click();
  // What was typed is kept when switching back.
  await expect(page.getByLabel("Email address")).toHaveValue("asha@example.test");
  await page.getByLabel("Password", { exact: true }).fill("right-password");
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect(await storedToken(page)).toBe("e2e-email-token");
  expect(api.filter((call) => call.path === "/api/users/login").at(-1)).toEqual({
    path: "/api/users/login",
    body: { email: "asha@example.test", password: "right-password" },
  });
  expect(errors).toEqual([]);
});

test("Continue with Google goes to Google, and a failed Google login is explained", async ({ page }) => {
  const { errors } = await openLogin(page, { path: "/login?error=google_auth_failed" });

  await expect(page.getByRole("alert")).toHaveText(/Google login did not work\. Please try again\./);
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await expect(page).toHaveURL(/accounts\.e2e\.test\/o\/oauth2\/auth/);
  await expect(page.getByRole("heading", { name: "Choose an account" })).toBeVisible();
  expect(errors).toEqual([]);
});
