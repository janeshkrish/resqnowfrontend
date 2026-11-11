import { apiFetch } from "@/lib/api";
import type { AiResult } from "./engine";

/** `voice`: the server has a natural, human-sounding voice for ResQNow-Thozhan (else the phone's own is used). */
export type VoiceStatus = { enabled: boolean; ai: boolean; voice: boolean; wake?: boolean; recognition?: boolean };

export const VOICE_STATUS_KEY = ["voice", "status"] as const;

/** Whether ResQNow-Thozhan is on for this customer (and its AI step), from the server. */
export async function fetchVoiceStatus(): Promise<VoiceStatus> {
  const res = await apiFetch("/api/voice/status", { signal: AbortSignal.timeout(5000) });
  if (res.status === 401 || res.status === 403) {
    return { enabled: false, ai: false, voice: false };
  }
  if (!res.ok) throw new Error("Voice settings are temporarily unavailable.");
  const data = await res.json();
  if (typeof data?.enabled !== "boolean") throw new Error("Invalid voice settings.");
  return { enabled: data.enabled, ai: data.ai === true, voice: data.voice === true, wake: data.wake !== false, recognition: data.recognition !== false };
}

/** The AI step, for a sentence the app couldn't fully read. Resolves to null on any failure, so the conversation carries on. */
export async function askVoiceAi(payload: Record<string, unknown>, signal?: AbortSignal): Promise<AiResult | null> {
  try {
    const res = await apiFetch("/api/voice/understand", { method: "POST", body: JSON.stringify(payload), signal: signal ?? AbortSignal.timeout(5500) });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.result && typeof data.result === "object" ? (data.result as AiResult) : null;
  } catch {
    return null;
  }
}

/** A line in the natural voice, as audio; null on any failure, and the phone's own voice reads it instead. */
export async function fetchVoiceAudio(text: string, lang: string, signal?: AbortSignal): Promise<Blob | null> {
  try {
    const res = await apiFetch("/api/voice/speak", { method: "POST", body: JSON.stringify({ text, lang }), signal: signal ?? AbortSignal.timeout(7500) });
    if (!res.ok) return null;
    const audio = await res.blob();
    return audio.size > 0 ? audio : null;
  } catch {
    return null;
  }
}
