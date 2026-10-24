import { afterEach, describe, expect, it } from "vitest";
import { explainMicError, pickVoice, recogniserLang, voiceLang } from "./speech";
import { placeChip, reactChip, serviceChip, spokenText, vehicleChip, type Line } from "./talk";

const TAMIL = /[஀-௿]/;
const voice = (lang: string, name = lang) => ({ lang, name }) as SpeechSynthesisVoice;

describe("ResQNow-Thozhan's ears and voice", () => {
  it("hears Tanglish and English in Indian English, Tamil in Tamil", () => {
    // Indian English writes "bike puncture aayiduchu" in English letters, as the word lists expect.
    expect(recogniserLang("tg")).toBe("en-IN");
    expect(recogniserLang("en")).toBe("en-IN");
    expect(recogniserLang("ta")).toBe("ta-IN");
  });

  it("speaks Tanglish and Tamil with a Tamil voice, English with an Indian English one", () => {
    expect(voiceLang("tg")).toBe("ta-IN");
    expect(voiceLang("ta")).toBe("ta-IN");
    expect(voiceLang("en")).toBe("en-IN");
  });

  it("picks a voice of the line's own language, or none", () => {
    const voices = [voice("en-US"), voice("en-IN"), voice("ta_IN", "Tamil")];
    expect(pickVoice(voices, "ta-IN")?.name).toBe("Tamil");
    expect(pickVoice(voices, "en-IN")?.lang).toBe("en-IN");
    expect(pickVoice([voice("en-US")], "en-IN")?.lang).toBe("en-US");
    // No Tamil voice: stay quiet rather than let an English voice read Tamil.
    expect(pickVoice([voice("en-US"), voice("en-IN")], "ta-IN")).toBeNull();
  });

  it("prefers the phone's natural-sounding voices over robotic ones", () => {
    const voices = [
      voice("ta-IN", "Microsoft Valluvar - Tamil (India)"),
      voice("ta-IN", "Google தமிழ்"),
      voice("ta-IN", "Microsoft Pallavi Online (Natural) - Tamil (India)"),
    ];
    expect(pickVoice(voices, "ta-IN")?.name).toBe("Microsoft Pallavi Online (Natural) - Tamil (India)");
    expect(pickVoice(voices.slice(0, 2), "ta-IN")?.name).toBe("Google தமிழ்");
  });
});

describe("what ResQNow-Thozhan reads aloud", () => {
  const understood: Line = {
    kind: "line", key: "understood",
    chips: { react: reactChip("flat-tire", "tg"), svc: serviceChip("flat-tire", "tg"), veh: vehicleChip("bike", "tg", "Splendor+") },
  };

  it("reads a Tanglish line in Tamil script, keeping the vehicle's own name", () => {
    const text = spokenText(understood, "tg");
    expect(text).toMatch(TAMIL);
    expect(text).toContain("Splendor plus");
    expect(text).not.toMatch(/\[\[|pannitten|Note/);
  });

  it("reads Tanglish questions, places and acknowledgements in Tamil script", () => {
    expect(spokenText({ kind: "question", service: "flat-tire", id: "tyre", ack: 1 }, "tg")).toMatch(TAMIL);
    const place = spokenText({ kind: "line", key: "askLocation", chips: { place: placeChip("Gandhipuram") } }, "tg");
    expect(place).toMatch(TAMIL);
    expect(place).toContain("Gandhipuram");
  });

  it("stays quiet for a Tanglish line with no Tamil-script reading", () => {
    expect(spokenText({ kind: "text", text: { en: "Hi", tg: "Hi da", ta: "வணக்கம்" } }, "tg")).toBe("");
  });

  it("reads English and Tamil lines as written", () => {
    expect(spokenText(understood, "en")).not.toMatch(TAMIL);
    expect(spokenText({ ...understood, chips: { react: reactChip("flat-tire", "ta"), svc: serviceChip("flat-tire", "ta"), veh: vehicleChip("bike", "ta") } }, "ta")).toMatch(TAMIL);
  });
});

describe("why the microphone didn't work", () => {
  const original = Object.getOwnPropertyDescriptor(navigator, "mediaDevices");
  const microphone = (result: "ok" | string) => Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: async () => {
        if (result === "ok") return { getTracks: () => [{ stop: () => {} }] };
        throw Object.assign(new Error(result), { name: result });
      },
    },
  });
  afterEach(() => {
    if (original) Object.defineProperty(navigator, "mediaDevices", original);
    else delete (navigator as { mediaDevices?: unknown }).mediaDevices;
  });

  it("names each failure the way the customer can fix it", async () => {
    expect(await explainMicError("network")).toBe("offline");
    expect(await explainMicError("audio-capture")).toBe("nomic");
    expect(await explainMicError("language-not-supported")).toBe("unsupported");
    expect(await explainMicError("unavailable")).toBe("unsupported");
    expect(await explainMicError("no-speech")).toBe("unheard");
    expect(await explainMicError("aborted")).toBe("unheard");
  });

  it("tells a blocked microphone from a browser that won't listen", async () => {
    microphone("NotAllowedError");
    expect(await explainMicError("not-allowed")).toBe("blocked");
    microphone("NotFoundError");
    expect(await explainMicError("not-allowed")).toBe("nomic");
    // The microphone works, so it's the browser's speech service that refused.
    microphone("ok");
    expect(await explainMicError("service-not-allowed")).toBe("unsupported");
  });
});
