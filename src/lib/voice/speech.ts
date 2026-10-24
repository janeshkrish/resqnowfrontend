/**
 * Listening and speaking for ResQNow-Thozhan, with nothing the customer says recorded or uploaded:
 * the Android app uses the phone's own recogniser (the VoiceThozhan plugin in the app), the website
 * uses Chrome's, and where neither exists the customer types. Thozhan speaks in a natural,
 * human-sounding voice from the server when it has one, else with the phone's own voice.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { fetchVoiceAudio } from "./api";
import type { Lang } from "./lexicon";

type NativeVoice = {
  available(options: { lang: string }): Promise<{ listen: boolean; speak: boolean }>;
  listen(options: { lang: string }): Promise<void>;
  stop(): Promise<void>;
  speak(options: { text: string; lang: string }): Promise<void>;
  silence(): Promise<void>;
  addListener(event: "partial" | "final" | "error" | "end", listener: (data: { text?: string; error?: string }) => void): Promise<PluginListenerHandle>;
};

const NativeVoice = registerPlugin<NativeVoice>("VoiceThozhan");
const isNative = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

/**
 * Tanglish and English are heard in Indian English, which writes Tanglish words in English letters
 * ("ennoda bike puncture"), the way the word lists expect; the Tamil recogniser would write them in
 * Tamil script and drop the English words. Tamil is heard in Tamil.
 */
export const recogniserLang = (lang: Lang) => (lang === "ta" ? "ta-IN" : "en-IN");
/** Tanglish is read from its Tamil-script form (talk.ts), so Tamil and Tanglish both use a Tamil voice. */
export const voiceLang = (lang: Lang) => (lang === "en" ? "en-IN" : "ta-IN");

type WebRecognition = {
  lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
const webRecognition = (): (new () => WebRecognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export type ListenHandlers = { onPartial: (text: string) => void; onFinal: (text: string) => void; onError: (code: string) => void; onEnd: () => void };
export type Listening = { stop: () => void };

/** Whether this device can listen at all; when it can't, the screen opens on typing. */
export async function canListen(lang: Lang): Promise<boolean> {
  if (isNative()) {
    try { return (await NativeVoice.available({ lang: recogniserLang(lang) })).listen; } catch { return false; }
  }
  return Boolean(webRecognition());
}

/** Starts listening; words arrive as they are said. A language the browser can't hear falls back to the other one once. */
export async function listen(lang: Lang, handlers: ListenHandlers): Promise<Listening> {
  return listenIn(recogniserLang(lang), handlers, true);
}

async function listenIn(code: string, handlers: ListenHandlers, canRetry: boolean): Promise<Listening> {
  const other = code === "ta-IN" ? "en-IN" : "ta-IN";
  if (isNative()) {
    let retrying = false;
    let retried: Listening | null = null;
    const subs = await Promise.all([
      NativeVoice.addListener("partial", (d) => handlers.onPartial(d.text ?? "")),
      NativeVoice.addListener("final", (d) => handlers.onFinal(d.text ?? "")),
      NativeVoice.addListener("error", (d) => {
        if (d.error === "language" && canRetry) { retrying = true; return; }
        handlers.onError(d.error ?? "error");
      }),
      NativeVoice.addListener("end", () => {
        subs.forEach((s) => s.remove());
        // The phone can't hear this language: try the other one once the recogniser has stopped.
        if (retrying) { void listenIn(other, handlers, false).then((next) => { retried = next; }); return; }
        handlers.onEnd();
      }),
    ]);
    try {
      await NativeVoice.listen({ lang: code });
    } catch (error) {
      subs.forEach((s) => s.remove());
      // The plugin rejects with a short code ("permission", "unavailable"); the message is for people.
      handlers.onError((error as { code?: string })?.code || "unavailable");
      handlers.onEnd();
    }
    return { stop: () => { if (retried) retried.stop(); else void NativeVoice.stop(); } };
  }
  const Recognition = webRecognition();
  if (!Recognition) {
    handlers.onError("unavailable");
    handlers.onEnd();
    return { stop: () => {} };
  }
  const rec = new Recognition();
  rec.lang = code;
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let final = "";
  let retrying = false;
  let retried: Listening | null = null;
  rec.onresult = (event) => {
    let interim = "";
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) final = `${final} ${result[0].transcript}`.trim(); else interim += result[0].transcript;
    }
    handlers.onPartial(`${final} ${interim}`.trim());
  };
  rec.onerror = (event) => {
    if (event.error === "language-not-supported" && canRetry) {
      retrying = true;
      void listenIn(other, handlers, false).then((next) => { retried = next; });
      return;
    }
    handlers.onError(event.error);
  };
  rec.onend = () => {
    if (retrying) return;
    // Chrome sometimes ends without marking anything final; the hook then uses the last words it showed.
    if (final) handlers.onFinal(final);
    handlers.onEnd();
  };
  try { rec.start(); } catch { handlers.onError("busy"); handlers.onEnd(); }
  return { stop: () => { if (retried) retried.stop(); else try { rec.stop(); } catch { /* already stopped */ } } };
}

/** Why listening failed, in words the customer can act on: blocked, no microphone, offline, unsupported, or nothing heard. */
export type MicProblem = "blocked" | "nomic" | "offline" | "unsupported" | "unheard";

export async function explainMicError(code: string): Promise<MicProblem> {
  if (code === "network") return "offline";
  if (code === "audio-capture" || code === "audio") return "nomic";
  if (code === "unavailable" || code === "language" || code === "language-not-supported" || code === "client") return "unsupported";
  if (code === "not-allowed" || code === "service-not-allowed" || code === "permission") {
    // Blocked microphone, or a browser that won't run speech recognition? Asking for the microphone tells them apart.
    if (isNative() || !navigator.mediaDevices?.getUserMedia) return "blocked";
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return "unsupported";
    } catch (error) {
      const name = (error as { name?: string })?.name;
      return name === "NotFoundError" || name === "OverconstrainedError" ? "nomic" : "blocked";
    }
  }
  return "unheard";
}

/** The browser's voices, which some browsers load a moment after the page. */
async function browserVoices(): Promise<SpeechSynthesisVoice[]> {
  const now = window.speechSynthesis.getVoices();
  if (now.length) return now;
  await new Promise<void>((resolve) => {
    const done = () => { window.speechSynthesis.removeEventListener?.("voiceschanged", done); resolve(); };
    window.speechSynthesis.addEventListener?.("voiceschanged", done);
    setTimeout(done, 1200);
  });
  return window.speechSynthesis.getVoices();
}

/** Natural (neural) voices first: Edge's "Natural" and "Online" ones, then Google's, then the rest. */
const voiceQuality = (v: SpeechSynthesisVoice) => (/natural|neural/i.test(v.name) ? 3 : /online/i.test(v.name) ? 2 : /google/i.test(v.name) ? 1 : 0);

/** The phone's best voice for the language: the exact one (ta-IN, en-IN), else any of that language; none means stay quiet. */
export function pickVoice(voices: SpeechSynthesisVoice[], code: string): SpeechSynthesisVoice | null {
  const wanted = code.toLowerCase().replace("_", "-");
  const base = wanted.split("-")[0];
  const norm = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-");
  const best = (list: SpeechSynthesisVoice[]) => list.reduce<SpeechSynthesisVoice | null>((top, v) => (!top || voiceQuality(v) > voiceQuality(top) ? v : top), null);
  return best(voices.filter((v) => norm(v) === wanted)) ?? best(voices.filter((v) => norm(v).split("-")[0] === base));
}

/* The natural voice: each line is made on the server (Sarvam or Google) and played here. */
let naturalVoice = false;
const clips = new Map<string, Promise<Blob | null>>();
const MAX_CLIPS = 40;
const clipKey = (text: string, lang: Lang) => `${voiceLang(lang)}|${text}`;
const pause = (ms: number) => new Promise<null>((resolve) => setTimeout(() => resolve(null), ms));
let player: HTMLAudioElement | null = null;
let stopPlayer: (() => void) | null = null;
let unlocked = false;
// A moment of silence, played on the customer's first tap so phones (iPhones most of all) let the voice play later.
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";
const audioPlayer = () => (player ??= new Audio());
const canPlay = () => naturalVoice && typeof Audio !== "undefined";

/** Whether the server's natural voice is used (from /api/voice/status). */
export function setNaturalVoice(on: boolean) {
  naturalVoice = on;
  if (!on) clips.clear();
}

/** Starts making a line's audio now, so it is ready when Thozhan says it. */
export function prepareSpeech(text: string, lang: Lang) {
  if (!canPlay() || !text) return;
  const key = clipKey(text, lang);
  if (clips.has(key)) return;
  clips.set(key, fetchVoiceAudio(text, voiceLang(lang)).then((clip) => { if (!clip) clips.delete(key); return clip; }));
  while (clips.size > MAX_CLIPS) clips.delete(clips.keys().next().value as string);
}

/** Waits (up to `ms`) for a prepared line, so the words appear as the voice starts rather than before it. */
export async function speechReady(text: string, lang: Lang, ms: number): Promise<void> {
  const pending = canPlay() && text ? clips.get(clipKey(text, lang)) : undefined;
  if (pending) await Promise.race([pending, pause(ms)]);
}

/** Lets later lines play aloud: call on the customer's tap. */
export function unlockAudio() {
  if (!canPlay() || unlocked) return;
  unlocked = true;
  const audio = audioPlayer();
  audio.src = SILENT_WAV;
  audio.play().then(() => audio.pause(), () => { unlocked = false; });
}

/** Plays a line in the natural voice; false when it can't, and the phone's own voice reads it instead. */
async function playNatural(text: string, lang: Lang): Promise<boolean> {
  prepareSpeech(text, lang);
  const pending = clips.get(clipKey(text, lang));
  const clip = pending ? await Promise.race([pending, pause(8000)]) : null;
  if (!clip) return false;
  const audio = audioPlayer();
  const url = URL.createObjectURL(clip);
  try {
    return await new Promise<boolean>((resolve) => {
      let started = false;
      const finish = (played: boolean) => {
        window.clearTimeout(timer);
        audio.onended = null;
        audio.onerror = null;
        stopPlayer = null;
        resolve(played);
      };
      const timer = window.setTimeout(() => finish(started), 30000);
      audio.onended = () => finish(true);
      audio.onerror = () => finish(started);
      // Silenced (the customer tapped the mic): done, and the phone's voice must not take over.
      stopPlayer = () => { audio.pause(); finish(true); };
      audio.src = url;
      audio.play().then(() => { started = true; }, () => finish(false));
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Says a line aloud with the phone's own voice; resolves when done, or at once when it can't.
 * A line is only spoken by a voice of its own language: rather a quiet screen than English reading Tamil.
 */
export async function speak(text: string, lang: Lang): Promise<void> {
  if (!text) return;
  if (canPlay() && (await playNatural(text, lang))) return;
  if (isNative()) {
    try { await NativeVoice.speak({ text, lang: voiceLang(lang) }); } catch { /* no voice installed: the words are on screen */ }
    return;
  }
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const code = voiceLang(lang);
  const voice = pickVoice(await browserVoices(), code);
  if (!voice) return;
  await new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice.lang || code;
    utterance.voice = voice;
    // A touch slower than the default reads Tamil more clearly.
    utterance.rate = 0.95;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    window.setTimeout(resolve, 12000);
  });
}

export function silence() {
  stopPlayer?.();
  if (isNative()) { void NativeVoice.silence().catch(() => {}); return; }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
