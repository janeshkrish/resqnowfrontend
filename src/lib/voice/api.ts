import { apiFetch } from "@/lib/api";
import type { AiResult } from "./engine";

export type VoiceStatus = { enabled: boolean; ai: boolean };

export const VOICE_STATUS_KEY = ["voice", "status"] as const;

/** Whether ResQNow-Thozhan is on for this customer (and its AI step), from the server. */
export async function fetchVoiceStatus(): Promise<VoiceStatus> {
  try {
    const res = await apiFetch("/api/voice/status");
    if (!res.ok) return { enabled: false, ai: false };
    const data = await res.json().catch(() => ({}));
    return { enabled: Boolean(data?.enabled), ai: Boolean(data?.ai) };
  } catch {
    return { enabled: false, ai: false };
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
