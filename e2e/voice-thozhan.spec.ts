import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// ResQNow-Thozhan: the customer talks, the request form fills itself, and the form sends it as always.
// The microphone and the phone's voice are stand-ins (below), so the tests hear exactly what they say.

const fakeMappls = readFileSync(new URL("./fixtures/fakeMapplsSdk.js", import.meta.url), "utf8").replace(
  "export const searchMapplsPlaces = () => Promise.resolve([]);",
  `const PLACES = [
    { id: "P1", placeId: "P1", name: "Gandhipuram Bus Stand", label: "Gandhipuram Bus Stand, Coimbatore", address: "Gandhipuram Bus Stand, Coimbatore", lat: 11.0183, lng: 76.9725, provider: "mappls", category: "TRANSPORT" },
  ];
  export const searchMapplsPlaces = (query) => Promise.resolve(PLACES.filter((p) => p.label.toLowerCase().includes(String(query).toLowerCase().split(" ")[0])));`,
);
const SHOTS = process.env.VOICE_SHOTS_DIR;
const HOME = { latitude: 11.0168, longitude: 76.9558 };
const GARAGE = [
  { id: 7, type: "bike", make: "Honda", model: "Activa 6G", license_plate: "TN37AB1234", status: "ready", created_at: "2026-01-01T00:00:00Z" },
  { id: 8, type: "car", make: "Hyundai", model: "i20", license_plate: "TN37CK4521", status: "ready", created_at: "2026-01-01T00:00:00Z" },
];

type Options = { enabled?: boolean; ai?: boolean; heard?: string[]; noMic?: boolean; aiReply?: Record<string, unknown> };

async function openVoice(page: Page, path: string, { enabled = true, ai = false, heard = [], noMic = false, aiReply = {} }: Options = {}) {
  const posts: Array<{ path: string; body: Record<string, unknown> }> = [];
  const errors: string[] = [];
  let sentRequest: Record<string, unknown> | null = null;
  page.on("pageerror", (error) => errors.push(error.message));

  await page.addInitScript(({ heard, noMic }) => {
    localStorage.setItem("resqnow_user_token", "e2e-customer-token");
    const w = window as unknown as Record<string, unknown>;
    w.__heard = heard;
    w.__spoken = [];
    // The microphone: each tap hears the next phrase, half of it first as the words come in.
    class FakeRecognition {
      lang = ""; continuous = false; interimResults = true; maxAlternatives = 1;
      onresult: ((e: unknown) => void) | null = null; onerror: ((e: unknown) => void) | null = null; onend: (() => void) | null = null;
      start() {
        const langs = (w.__langs as string[] | undefined) ?? [];
        langs.push(this.lang);
        w.__langs = langs;
        const phrase = (w.__heard as string[]).shift();
        setTimeout(() => {
          if (!phrase) { this.onerror?.({ error: "no-speech" }); this.onend?.(); return; }
          const words = phrase.split(" ");
          this.onresult?.({ results: { length: 1, 0: { isFinal: false, 0: { transcript: words.slice(0, Math.ceil(words.length / 2)).join(" ") } } } });
          setTimeout(() => { this.onresult?.({ results: { length: 1, 0: { isFinal: true, 0: { transcript: phrase } } } }); this.onend?.(); }, 350);
        }, 250);
      }
      stop() {}
      abort() {}
    }
    if (noMic) { delete w.SpeechRecognition; delete w.webkitSpeechRecognition; }
    else { w.SpeechRecognition = FakeRecognition; w.webkitSpeechRecognition = FakeRecognition; }
    // The phone's voice: note what was said, and finish straight away.
    window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => { (w.__spoken as string[]).push(u.text); setTimeout(() => u.onend?.(new Event("end") as SpeechSynthesisEvent), 30); };
    window.speechSynthesis.cancel = () => {};
  }, { heard, noMic });

  await page.route(/\/src\/lib\/mapProvider\/mapplsSdk\.ts(\?.*)?$/, (route) => route.fulfill({ contentType: "application/javascript", body: fakeMappls }));
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    const json = () => { try { return JSON.parse(request.postData() || "{}"); } catch { return {}; } };

    if (url.pathname === "/api/auth/me") return reply(200, { id: 41, name: "Asha", email: "asha@example.test", phone: "9876543210", isVerified: true });
    if (url.pathname === "/api/voice/status") return reply(200, { enabled, ai: enabled && ai });
    if (url.pathname === "/api/voice/understand" && method === "POST") { posts.push({ path: url.pathname, body: json() }); return reply(200, { result: aiReply }); }
    if (url.pathname === "/api/vehicles" && method === "GET") return reply(200, GARAGE);
    if (url.pathname === "/api/vehicles" && method === "POST") return reply(201, { id: 99 });
    if (url.pathname === "/api/public/vehicle-photo") return reply(200, { photo: null });
    if (url.pathname === "/api/public/reverse-geocode") return reply(200, { display_name: "21, Race Course Road, Coimbatore", address: { suburb: "Race Course", road: "Race Course Road", city: "Coimbatore" } });
    if (url.pathname === "/api/public/service-prices") {
      return reply(200, { vehicle: url.searchParams.get("vehicle"), currency: "INR", services: [
        { service: "flat-tire", startingPrice: 99, technicians: 3 }, { service: "towing", startingPrice: 599, technicians: 2 }, { service: "winching", startingPrice: 999, technicians: 1 },
      ] });
    }
    if (url.pathname === "/api/public/route") return reply(404, {});
    if (url.pathname === "/api/pricing/towing-estimate") return reply(404, {});
    if (url.pathname === "/api/service-requests" && method === "POST") {
      sentRequest = json();
      posts.push({ path: url.pathname, body: sentRequest! });
      return reply(201, { id: 5601 });
    }
    if (url.pathname === "/api/service-requests/5601" && method === "GET" && sentRequest) {
      return reply(200, { ...sentRequest, id: 5601, _id: "5601", user_id: 41, status: "pending", payment_status: "pending", technician: null, created_at: new Date().toISOString() });
    }
    if (url.pathname === "/api/technicians/nearby") return reply(200, []);
    return reply(404, {});
  });

  await page.goto(path);
  return { posts, errors };
}

// Lets entrance animations finish before a screenshot, but never waits longer than three seconds.
const settled = (page: Page) => page.evaluate(() => Promise.race([
  Promise.all(document.getAnimations()
    .filter((animation) => animation.effect?.getComputedTiming().iterations !== Infinity)
    .map((animation) => animation.finished.catch(() => undefined))),
  new Promise((resolve) => setTimeout(resolve, 3000)),
]));
const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  await settled(page);
  await page.screenshot({ path: `${SHOTS}/${test.info().project.name}-${name}.png` });
};
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const thozhan = (page: Page) => page.locator(".vt-say").last();
const reply = (page: Page, name: string | RegExp) => page.locator(".vt-rep").filter({ hasText: name }).first();
const typeToThozhan = async (page: Page, text: string) => {
  await page.getByRole("button", { name: "Type instead" }).click();
  await page.getByLabel("Type to ResQNow-Thozhan").fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
};

async function slide(page: Page) {
  const knob = page.locator(".rqf-knob");
  const track = page.locator(".rqf-slide");
  const from = (await knob.boundingBox())!;
  const to = (await track.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width - 10, from.y + from.height / 2, { steps: 12 });
  await page.mouse.up();
}

test.use({ geolocation: HOME, permissions: ["geolocation"] });
test.describe.configure({ timeout: 150_000 });

test("the owner's script: a bike puncture said aloud, every form answer asked, sent as the form sends it", async ({ page }) => {
  const { posts, errors } = await openVoice(page, "/thozhan", { heard: ["Ennoda bike puncture aayiduchu"] });

  await expect(page.locator(".vt-hi")).toContainText("ResQNow-Thozhan");
  await expect(page.locator(".vt-try button")).toHaveCount(4);
  expect(await noSideScroll(page)).toBe(true);
  await shot(page, "hello");

  await page.locator(".vt-mic").click();
  await expect(page.locator(".vt-you").first()).toContainText("Ennoda bike puncture aayiduchu");
  await expect(page.locator(".vt-you .uw.is-key").first()).toBeVisible();
  // Thozhan reacts, reads back what it heard, then asks about the saved bike.
  await expect(page.locator(".vt-thread")).toContainText("Aiyo, puncture-aa!");
  await expect(thozhan(page)).toContainText("thaana?");
  await shot(page, "garage");
  await reply(page, "Honda Activa 6G").click();

  // The saved "Activa 6G" isn't a catalog name, so (like the form) Thozhan asks its type.
  await reply(page, "Scooter").click();
  await expect(thozhan(page)).toContainText("tubeless");
  await reply(page, /^Tubeless$/).click();
  await expect(thozhan(page)).toContainText("Endha tyre");
  await reply(page, "Back tyre").click();
  await expect(reply(page, "Back tyre")).toHaveClass(/is-on/);
  await shot(page, "pick-tyre");
  await reply(page, "Avlo dhaan").click();
  await reply(page, "Only flat").click();

  // Where: the device's location, named the way the form names it.
  await expect(page.locator(".vt-place")).toContainText("Race Course");
  await expect(page.locator(".vt-tok").nth(2)).toContainText("Tubeless · Back tyre · Only flat");
  await shot(page, "location");
  await reply(page, "Aamaa, inga dhaan").click();
  await expect(thozhan(page)).toContainText("landmark");
  await typeToThozhan(page, "Opposite the bus stop");

  // The request form opens on its Confirm step, already filled in.
  await expect(page).toHaveURL(/\/request-service\/flat-tire\/bike$/, { timeout: 20_000 });
  await expect(page.getByText("Bike · Step 3 of 3")).toBeVisible();
  await expect(page.locator(".rqf-sum-chip")).toHaveText(["Tubeless", "Back tyre", "Only flat"]);
  await expect(page.getByText(/Activa 6G/).first()).toBeVisible();
  await shot(page, "confirm");
  expect(errors).toEqual([]);
  await slide(page);

  await expect(page).toHaveURL(/\/request-service-tracking\/5601$/);
  const request = posts.find((entry) => entry.path === "/api/service-requests")!.body;
  expect(request).toMatchObject({
    service_type: "bike-flat-tire",
    vehicle_type: "bike",
    vehicle_brand: "Honda",
    vehicle_model: "Honda Activa 6G",
    vehicle_subtype: "scooter",
    contact_phone: "9876543210",
    location_lat: HOME.latitude,
    location_lng: HOME.longitude,
    details: {
      answers: [
        { id: "tyretype", value: "tubeless", label: "Tubeless" },
        { id: "tyre", value: ["rear"], label: "Back tyre" },
        { id: "damage", value: "flat", label: "Only flat" },
      ].map((a) => expect.objectContaining(a)),
      landmark: "Opposite the bus stop",
      note: "Ennoda bike puncture aayiduchu",
      channel: "voice",
    },
  });
  // It listened in Tamil (which writes English words too) and spoke every line aloud.
  expect(await page.evaluate(() => (window as unknown as { __langs: string[] }).__langs)).toEqual(["ta-IN"]);
  expect((await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).length).toBeGreaterThan(5);
});

test("answers already in the first sentence aren't asked again; a warning from the form is said; the map opens on request", async ({ page }) => {
  const { errors } = await openVoice(page, "/thozhan");
  await typeToThozhan(page, "My car puncture, front left, tubeless");

  await expect(page.locator(".vt-thread")).toContainText("Oh no, a puncture!");
  await reply(page, "Hyundai i20").click();
  // The i20 is in the catalog: its size fills in, so the next question is the four-wheeler one.
  await expect(thozhan(page)).toContainText("stepney");
  await reply(page, "No, repair it").click();
  await reply(page, "Torn or cut").click();
  await expect(page.locator(".vt-thread")).toContainText("A torn tyre can’t be repaired");
  await shot(page, "callout");
  await reply(page, "Pick on the map").click();

  await expect(page).toHaveURL(/\/request-service\/flat-tire\/car$/, { timeout: 20_000 });
  await expect(page.getByText("Car · Step 2 of 3")).toBeVisible();
  await page.locator(".rqf-cta").click();
  await expect(page.getByText("Car · Step 3 of 3")).toBeVisible();
  await expect(page.locator(".rqf-sum-chip")).toHaveText(["Tubeless", "Front left tyre", "Repair it", "Torn or cut"]);
  expect(errors).toEqual([]);
});

test("towing: a safety tip on the highway, brand and model asked, then the form's map for the drop point", async ({ page }) => {
  const { errors } = await openVoice(page, "/thozhan", { heard: ["Highway-la lorry breakdown aayiduchu, tow venum"] });
  await page.locator(".vt-mic").click();

  await expect(page.locator(".vt-thread")).toContainText("hazard light");
  await expect(thozhan(page)).toContainText("Brand, model sollunga");
  await shot(page, "brand");
  await reply(page, /^Tata$/).click();
  await reply(page, /^Ace$/).click();
  await expect(thozhan(page)).toContainText("Nagarudhaa?");
  await reply(page, "Yes, it moves").click();
  await reply(page, "Aamaa, inga dhaan").click();
  await expect(thozhan(page)).toContainText("Enga kondu poganum?");
  await typeToThozhan(page, "Gandhipuram bus stand");

  await expect(page).toHaveURL(/\/request-service\/towing\/commercial$/, { timeout: 20_000 });
  await expect(page.getByText("Commercial vehicle · Step 2 of 3")).toBeVisible();
  await expect(page.getByLabel("Take it to")).toHaveValue("Gandhipuram bus stand");
  expect(errors).toEqual([]);
});

test("the AI step fills in what the words alone don't say, and only with the form's own values", async ({ page }) => {
  const { posts } = await openVoice(page, "/thozhan", {
    ai: true,
    aiReply: { service: "towing", family: "car", brand: "Maruti Suzuki", model: "Swift", answers: { why: "breakdown" } },
  });
  await typeToThozhan(page, "Vandi odala, help pannunga");

  await expect(page.locator(".vt-thread")).toContainText("Aiyo, kashtam dhaan.");
  await expect(page.locator(".vt-thread .kc").filter({ hasText: /Swift/ }).first()).toBeVisible();
  // Vehicle, its size and what happened came from the AI step: the next missing answer is whether it moves.
  await expect(thozhan(page)).toContainText("Nagarudhaa?");
  const sent = posts.find((entry) => entry.path === "/api/voice/understand")!.body;
  expect(sent).toMatchObject({ text: "Vandi odala, help pannunga", families: ["bike", "car", "commercial", "ev"] });
  expect((sent.services as Array<{ id: string }>).map((s) => s.id)).toContain("towing");
});

test("voice can be switched off from the server: no card, and the page sends the customer home", async ({ page }) => {
  await openVoice(page, "/thozhan", { enabled: false });
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator(".vt-home-card")).toHaveCount(0);
});

test("the home screen and the request form lead to ResQNow-Thozhan when it's on", async ({ page }, testInfo) => {
  if (testInfo.project.name === "phone") {
    await openVoice(page, "/");
    await expect(page.locator(".vt-home-card")).toBeVisible();
    await shot(page, "home-card");
    await page.locator(".vt-home-card").click();
    await expect(page).toHaveURL(/\/thozhan$/);
  }
  await openVoice(page, "/request-service/battery/car");
  const link = page.getByRole("link", { name: /Prefer to talk\? Tell ResQNow-Thozhan/ });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/thozhan\?service=battery&family=car$/);
});

test("on a phone that can't listen, typing opens instead", async ({ page }) => {
  await openVoice(page, "/thozhan", { noMic: true });
  await page.locator(".vt-mic").click();
  await expect(page.getByLabel("Type to ResQNow-Thozhan")).toBeVisible();
  await expect(page.getByRole("button", { name: "Send", exact: true })).toBeVisible();
});
