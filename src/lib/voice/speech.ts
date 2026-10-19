/**
 * Listening and speaking for ResQNow-Thozhan, with nothing recorded or uploaded: the Android app
 * uses the phone's own recogniser and voice (the VoiceThozhan plugin in the app), the website uses
 * Chrome's, and where neither exists the customer types.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
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

/** Tamil and Tanglish are heard in Tamil (it writes English words too); English in Indian English. */
export const recogniserLang = (lang: Lang) => (lang === "en" ? "en-IN" : "ta-IN");
/** Tanglish is written in English letters, so an Indian English voice reads it best. */
const voiceLang = (lang: Lang) => (lang === "ta" ? "ta-IN" : "en-IN");

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

/** Starts listening; words arrive as they are said. */
export async function listen(lang: Lang, handlers: ListenHandlers): Promise<Listening> {
  if (isNative()) {
    const subs = await Promise.all([
      NativeVoice.addListener("partial", (d) => handlers.onPartial(d.text ?? "")),
      NativeVoice.addListener("final", (d) => handlers.onFinal(d.text ?? "")),
      NativeVoice.addListener("error", (d) => handlers.onError(d.error ?? "error")),
      NativeVoice.addListener("end", () => { subs.forEach((s) => s.remove()); handlers.onEnd(); }),
    ]);
    try {
      await NativeVoice.listen({ lang: recogniserLang(lang) });
    } catch (error) {
      subs.forEach((s) => s.remove());
      handlers.onError(error instanceof Error ? error.message : "unavailable");
      handlers.onEnd();
    }
    return { stop: () => { void NativeVoice.stop(); } };
  }
  const Recognition = webRecognition();
  if (!Recognition) {
    handlers.onError("unavailable");
    handlers.onEnd();
    return { stop: () => {} };
  }
  const rec = new Recognition();
  rec.lang = recogniserLang(lang);
  rec.continuous = false;
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  let final = "";
  rec.onresult = (event) => {
    let interim = "";
    for (let i = 0; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) final = `${final} ${result[0].transcript}`.trim(); else interim += result[0].transcript;
    }
    handlers.onPartial(`${final} ${interim}`.trim());
  };
  rec.onerror = (event) => handlers.onError(event.error);
  rec.onend = () => { if (final) handlers.onFinal(final); handlers.onEnd(); };
  try { rec.start(); } catch { handlers.onError("busy"); handlers.onEnd(); }
  return { stop: () => { try { rec.stop(); } catch { /* already stopped */ } } };
}

/** Says a line aloud with the phone's own voice; resolves when done (or at once when it can't). */
export async function speak(text: string, lang: Lang): Promise<void> {
  if (!text) return;
  if (isNative()) {
    try { await NativeVoice.speak({ text, lang: voiceLang(lang) }); } catch { /* no voice installed: the words are on screen */ }
    return;
  }
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  await new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = voiceLang(lang);
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang === utterance.lang);
    if (voice) utterance.voice = voice;
    utterance.rate = 1.02;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    window.setTimeout(resolve, 12000);
  });
}

export function silence() {
  if (isNative()) { void NativeVoice.silence().catch(() => {}); return; }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
}
