/**
 * Android and browser speech services provide transcription. Their processing and connectivity
 * depend on the installed recognizer. The app retains text for the request and supports typing
 * when recognition is unavailable. Spoken replies use server audio or the device voice.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { fetchVoiceAudio } from "./api";
import type { Lang } from "./lexicon";

type NativeVoice = {
  available(options: { lang: string }): Promise<{ listen: boolean; speak: boolean }>;
  listen(options: { lang: string; sessionId: string }): Promise<void>;
  stop(options: { sessionId: string; discard?: boolean }): Promise<void>;
  speak(options: { text: string; lang: string }): Promise<void>;
  silence(): Promise<void>;
  addListener(event: "ready" | "partial" | "final" | "error" | "end", listener: (data: { text?: string; error?: string; confidence?: number; sessionId?: string }) => void): Promise<PluginListenerHandle>;
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
  onstart: (() => void) | null;
  onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string; confidence?: number } }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
const webRecognition = (): (new () => WebRecognition) | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export type ListenHandlers = { onReady?: () => void; onPartial: (text: string) => void; onFinal: (text: string, confidence?: number) => void; onError: (code: string) => void; onEnd: () => void };
export type Listening = { stop: () => void; abort?: () => void };

/** Whether this device can listen at all; when it can't, the screen opens on typing. */
export async function canListen(lang: Lang): Promise<boolean> {
  if (isNative()) {
    try { return (await NativeVoice.available({ lang: recogniserLang(lang) })).listen; } catch { return false; }
  }
  return Boolean(webRecognition());
}

/** Starts listening; words arrive as they are said. A language the browser can't hear falls back to the other one once. */
export async function listen(lang: Lang, handlers: ListenHandlers): Promise<Listening> {
  let attempt: Listening | null = null;
  let stopped = false;
  let ended = false;
  const finish = () => { if (!ended) { ended = true; handlers.onEnd(); } };
  const start = async (code: string, retry: boolean) => {
    if (stopped || ended) return;
    let unsupported = false;
    const session = await listenIn(code, {
      ...handlers,
      onReady: () => { if (!ended) handlers.onReady?.(); },
      onFinal: (text, score) => {
        if (!ended) {
          if (score === undefined) handlers.onFinal(text);
          else handlers.onFinal(text, score);
        }
      },
      onPartial: text => { if (!ended) handlers.onPartial(text); },
      onError: error => {
        if (ended) return;
        unsupported = retry && (error === "language" || error === "language-not-supported");
        if (!unsupported) handlers.onError(error);
      },
      onEnd: () => {
        if (unsupported && !stopped) {
          void start(code === "en-IN" ? "ta-IN" : "en-IN", false).catch(() => { handlers.onError("unavailable"); finish(); });
        } else finish();
      },
    });
    if (stopped || ended) session.abort?.();
    else attempt = session;
  };
  void start(recogniserLang(lang), true).catch(() => { handlers.onError("unavailable"); finish(); });
  return {
    stop: () => { stopped = true; if (attempt) attempt.stop(); else finish(); },
    abort: () => { stopped = true; attempt?.abort?.(); finish(); },
  };
}

async function listenIn(code: string, handlers: ListenHandlers): Promise<Listening> {
  if (isNative()) {
    const sessionId = crypto.randomUUID();
    let active = true;
    const subs: PluginListenerHandle[] = [];
    const cleanup = () => { active = false; subs.splice(0).forEach(s => { void s.remove(); }); };
    const relevant = (id?: string) => active && (id === undefined || id === sessionId);
    try {
      subs.push(await NativeVoice.addListener("ready", d => { if (relevant(d.sessionId)) handlers.onReady?.(); }));
      subs.push(await NativeVoice.addListener("partial", d => { if (relevant(d.sessionId)) handlers.onPartial(d.text ?? ""); }));
      subs.push(await NativeVoice.addListener("final", d => { if (relevant(d.sessionId)) handlers.onFinal(d.text ?? "", d.confidence); }));
      subs.push(await NativeVoice.addListener("error", d => { if (relevant(d.sessionId)) handlers.onError(d.error ?? "error"); }));
      subs.push(await NativeVoice.addListener("end", d => { if (relevant(d.sessionId)) { cleanup(); handlers.onEnd(); } }));
      void NativeVoice.listen({ lang: code, sessionId }).catch(error => {
        if (active) { cleanup(); handlers.onError(error?.code || "unavailable"); handlers.onEnd(); }
      });
    } catch (error) { cleanup(); throw error; }
    return {
      stop: () => { if (active) void NativeVoice.stop({ sessionId }).catch(() => { cleanup(); handlers.onEnd(); }); },
      abort: () => { if (active) { cleanup(); void NativeVoice.stop({ sessionId, discard: true }).catch(() => {}); } },
    };
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
  let confidence: number | undefined;
  rec.onstart = () => handlers.onReady?.();
  rec.onresult = (event) => {
    const results = Array.from(event.results);
    const complete = results.filter((r) => r.isFinal);
    final = complete.map((r) => r[0].transcript.trim()).join(" ").trim();
    const scores = complete.map((r) => r[0].confidence).filter((score): score is number => score !== undefined && Number.isFinite(score) && score >= 0);
    confidence = scores.length ? Math.min(...scores) : undefined;
    handlers.onPartial(results.map((r) => r[0].transcript.trim()).join(" ").trim());
  };
  rec.onerror = (event) => {
    handlers.onError(event.error);
  };
  rec.onend = () => {
    // Chrome sometimes ends without marking anything final; the hook then uses the last words it showed.
    if (final) {
      if (confidence === undefined) handlers.onFinal(final);
      else handlers.onFinal(final, confidence);
    }
    handlers.onEnd();
  };
  try { rec.start(); } catch { handlers.onError("busy"); handlers.onEnd(); }
  return {
    stop: () => { try { rec.stop(); } catch { /* already stopped */ } },
    abort: () => { rec.onend = null; rec.onerror = null; rec.onresult = null; rec.onstart = null; try { rec.abort(); } catch { /* already stopped */ } },
  };
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
      const timer = window.setTimeout(() => { audio.pause(); finish(started); }, 30000);
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
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        NativeVoice.speak({ text, lang: voiceLang(lang) }),
        new Promise<void>(resolve => {
          timer = setTimeout(() => { void NativeVoice.silence().catch(() => {}); resolve(); }, 12000);
        }),
      ]);
    } catch { /* the words remain on screen */ }
    finally { clearTimeout(timer); }
    return;
  }
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const code = voiceLang(lang);
  const voice = pickVoice(await browserVoices(), code);
  if (!voice) return;
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(() => { window.speechSynthesis.cancel(); finish(); }, 12000);
    const finish = () => { window.clearTimeout(timer); resolve(); };
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voice.lang || code;
    utterance.voice = voice;
    // A touch slower than the default reads Tamil more clearly.
    utterance.rate = 0.95;
    utterance.onend = finish;
    utterance.onerror = finish;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

export function silence() {
  stopPlayer?.();
  if (isNative()) { void NativeVoice.silence().catch(() => {}); return; }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
