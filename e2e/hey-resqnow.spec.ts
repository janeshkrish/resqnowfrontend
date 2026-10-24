import { expect, test } from "@playwright/test";
import { badge, micCalls, micLive, microphone, openApp } from "./heyResQNowHelpers";

// Saying "Hey ResQNow" (the fake microphone plays "Hey rescue now" on a loop).
test.use(microphone("hey-resqnow.wav"));
test.describe.configure({ timeout: 120_000 });

test("saying “Hey ResQNow” on the home screen opens Thozhan, which starts listening straight away", async ({ page }) => {
  const { errors, spotterFiles } = await openApp(page, "/", { heard: ["Ennoda bike puncture aayiduchu"] });
  await expect(badge(page)).toHaveAttribute("aria-label", "Listening for Hey ResQNow", { timeout: 30_000 });
  await expect(page).toHaveURL(/\/thozhan\?wake=1$/, { timeout: 30_000 });
  // Thozhan listened by itself and heard the customer, with no tap.
  await expect(page.locator(".vt-thread")).toContainText("Aiyo, puncture-aa!");
  // "Hey ResQNow" let go of the microphone when Thozhan opened.
  expect(await micLive(page)).toBe(0);
  await expect(badge(page)).toHaveCount(0);
  expect(spotterFiles).toEqual(expect.arrayContaining(["/hey-resqnow/worker.js", "/hey-resqnow/sherpa-onnx-wasm-kws-main.wasm", "/hey-resqnow/sherpa-onnx-wasm-kws-main.data"]));
  expect(errors).toEqual([]);
});

test("is off until turned on in Account, and asks for the microphone there", async ({ page }) => {
  const { errors, spotterFiles } = await openApp(page, "/settings", { heyOn: false });
  const row = page.getByRole("button", { name: /Hey ResQNow/ });
  await expect(row).toContainText("Off");
  // Off: nothing listens and nothing is downloaded.
  await page.waitForTimeout(1500);
  expect(await micCalls(page)).toBe(0);
  expect(spotterFiles).toEqual([]);
  await expect(badge(page)).toHaveCount(0);

  await row.click();
  await expect(page).toHaveURL(/tab=voice/);
  await expect(page.getByText("It listens only while ResQNow is open on your screen")).toBeVisible();
  const toggle = page.getByRole("switch", { name: /Say “Hey ResQNow”/ });
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  expect(await page.evaluate(() => localStorage.getItem("resqnow_hey_resqnow"))).toBe("1");
  // Now it listens, and the clip on the microphone opens Thozhan.
  await expect(page).toHaveURL(/\/thozhan\?wake=1$/, { timeout: 30_000 });
  expect(errors).toEqual([]);
});
