import { apiFetch } from "@/lib/api";
import type { AiResult } from "./engine";

/** `voice`: the server has a natural, human-sounding voice for ResQNow-Thozhan (else the phone's own is used). */
export type VoiceStatus = { enabled: boolean; ai: boolean; voice: boolean };

export const VOICE_STATUS_KEY = ["voice", "status"] as const;

/** Whether ResQNow-Thozhan is on for this customer (and its AI step), from the server. */
export async function fetchVoiceStatus(): Promise<VoiceStatus> {
  try {
    const res = await apiFetch("/api/voice/status");
    if (!res.ok) return { enabled: false, ai: false, voice: false };
    const data = await res.json().catch(() => ({}));
    return { enabled: Boolean(data?.enabled), ai: Boolean(data?.ai), voice: Boolean(data?.voice) };
  } catch {
    return { enabled: false, ai: false, voice: false };
  }
}

/** The AI step, for a sentence the app couldn't fully read. Resolves to null on any failure, so the conversation carries on. */
export async function askVoiceAi(payload: Record<string, unknown>, signal?: AbortSignal): Promise<AiResult | null> {
  try {
    const res = await apiFetch("/api/voice/understand", { method: "POST", body: JSON.stringify(payload), signal });
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
    const res = await apiFetch("/api/voice/speak", { method: "POST", body: JSON.stringify({ text, lang }), signal });
    if (!res.ok) return null;
    const audio = await res.blob();
    return audio.size > 0 ? audio : null;
  } catch {
    return null;
  }
}
