import { expect, test } from "@playwright/test";
import { badge, micCalls, micLive, microphone, openApp, setVisibility, shot } from "./heyResQNowHelpers";

// Other words on the microphone ("My bike has a puncture near the bus stand", on a loop) never open Thozhan.
test.use(microphone("not-hey-resqnow.wav"));
test.describe.configure({ timeout: 120_000 });

test("other words don’t open Thozhan, and a hidden app lets go of the microphone", async ({ page }) => {
  const { errors } = await openApp(page, "/");
  await expect(badge(page)).toHaveAttribute("aria-label", "Listening for Hey ResQNow", { timeout: 30_000 });
  expect(await micLive(page)).toBe(1);
  await shot(page, "hey-badge");
  // The clip ("My bike has a puncture near the bus stand") plays twice over.
  await page.waitForTimeout(12_000);
  await expect(page).toHaveURL(/\/$/);

  await setVisibility(page, "hidden");
  await expect(badge(page)).toHaveCount(0);
  await expect.poll(() => micLive(page)).toBe(0);
  await setVisibility(page, "visible");
  await expect(badge(page)).toBeVisible();
  await expect.poll(() => micLive(page)).toBe(1);
  expect(errors).toEqual([]);
});

test("Thozhan's own screen doesn't listen for it, and turning it off stops it", async ({ page }) => {
  await openApp(page, "/thozhan");
  await expect(page.locator(".vt-hi")).toBeVisible();
  await page.waitForTimeout(1500);
  expect(await micCalls(page)).toBe(0);
  await expect(badge(page)).toHaveCount(0);

  await page.goto("/settings?tab=voice");
  await expect(badge(page)).toBeVisible({ timeout: 30_000 });
  await shot(page, "hey-settings");
  const toggle = page.getByRole("switch", { name: /Say “Hey ResQNow”/ });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(badge(page)).toHaveCount(0);
  await expect.poll(() => micLive(page)).toBe(0);
});

test("a blocked microphone says so, and the badge leads to the switch", async ({ page }) => {
  await openApp(page, "/", { micBlocked: true });
  await expect(badge(page)).toHaveAttribute("aria-label", "Hey ResQNow needs the microphone", { timeout: 30_000 });
  await expect(badge(page)).toContainText("Allow mic");
  await shot(page, "hey-blocked");
  await badge(page).click();
  await expect(page).toHaveURL(/\/settings\?tab=voice$/);
});
