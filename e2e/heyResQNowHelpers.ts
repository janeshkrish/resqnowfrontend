import { fileURLToPath } from "node:url";
import { test, type Page } from "@playwright/test";

// For the "Hey ResQNow" tests: the real on-device spotter (public/hey-resqnow) listens to Chrome's fake
// microphone, which plays a recorded clip on a loop ("Hey rescue now" in an Indian English voice, or other words).

const clip = (name: string) => fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));
export const microphone = (file: string) => ({
  launchOptions: { args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${clip(file)}`] },
  permissions: ["microphone", "geolocation"],
  geolocation: { latitude: 11.0168, longitude: 76.9558 },
});

export type Options = { heyOn?: boolean; heard?: string[]; micBlocked?: boolean };

export async function openApp(page: Page, path: string, { heyOn = true, heard = [], micBlocked = false }: Options = {}) {
  const errors: string[] = [];
  const spotterFiles: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (request.url().includes("/hey-resqnow/")) spotterFiles.push(new URL(request.url()).pathname); });

  await page.addInitScript(({ heyOn, heard, micBlocked }) => {
    localStorage.setItem("resqnow_user_token", "e2e-customer-token");
    if (heyOn) localStorage.setItem("resqnow_hey_resqnow", "1");
    const w = window as unknown as Record<string, unknown>;
    // Every microphone the page opens, to check it lets go when it should.
    const streams: MediaStream[] = [];
    w.__micCalls = 0;
    w.__micLive = () => streams.flatMap((s) => s.getTracks()).filter((t) => t.readyState === "live").length;
    const open = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      (w.__micCalls as number)++;
      if (micBlocked) throw new DOMException("Permission denied", "NotAllowedError");
      const stream = await open(constraints);
      streams.push(stream);
      return stream;
    };
    // Thozhan's own listening (the browser's speech recogniser) hears these phrases in turn.
    w.__heard = heard;
    class FakeRecognition {
      lang = ""; continuous = false; interimResults = true; maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null; onerror: ((e: unknown) => void) | null = null; onend: (() => void) | null = null;
      start() {
        const phrase = (w.__heard as string[]).shift();
        setTimeout(() => {
          if (!phrase) { this.onerror?.({ error: "no-speech" }); this.onend?.(); return; }
          this.onresult?.({ results: { length: 1, 0: { isFinal: true, 0: { transcript: phrase } } } });
          this.onend?.();
        }, 300);
      }
      stop() {}
      abort() {}
    }
    w.SpeechRecognition = FakeRecognition;
    w.webkitSpeechRecognition = FakeRecognition;
    window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => { setTimeout(() => u.onend?.(new Event("end") as SpeechSynthesisEvent), 30); };
    window.speechSynthesis.cancel = () => {};
  }, { heyOn, heard, micBlocked });

  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/api/auth/me") return reply(200, { id: 41, name: "Asha", email: "asha@example.test", phone: "9876543210", isVerified: true });
    if (url.pathname === "/api/voice/status") return reply(200, { enabled: true, ai: false, voice: false });
    if (url.pathname === "/api/vehicles") return reply(200, []);
    if (url.pathname === "/api/service-requests") return reply(200, []);
    if (url.pathname === "/api/users/me/settings") return reply(200, {});
    if (url.pathname === "/api/public/reverse-geocode") return reply(200, { display_name: "Race Course Road, Coimbatore", address: { road: "Race Course Road", city: "Coimbatore" } });
    return reply(404, {});
  });

  await page.goto(path);
  return { errors, spotterFiles };
}

export const badge = (page: Page) => page.locator(".hey-badge");
export const micLive = (page: Page) => page.evaluate(() => (window as unknown as { __micLive: () => number }).__micLive());
export const micCalls = (page: Page) => page.evaluate(() => (window as unknown as { __micCalls: number }).__micCalls);
export const setVisibility = (page: Page, state: "hidden" | "visible") => page.evaluate((next) => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => next });
  document.dispatchEvent(new Event("visibilitychange"));
}, state);

/** A screenshot for review, only when VOICE_SHOTS_DIR is set. */
export const shot = async (page: Page, name: string) => {
  if (!process.env.VOICE_SHOTS_DIR) return;
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${process.env.VOICE_SHOTS_DIR}/${test.info().project.name}-${name}.png` });
};
