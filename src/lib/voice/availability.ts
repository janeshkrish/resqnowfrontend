import type { VoiceStatus } from "./api";

/** Every automatic capture entry must honor both the native build gate and server switches. */
export function wakeEnabledForStatus(status: Pick<VoiceStatus, "enabled" | "wake" | "recognition"> | undefined): boolean {
  const buildAllowsWake = import.meta.env.VITE_NATIVE_BUILD !== "true" || import.meta.env.VITE_NATIVE_WAKE_ENABLED === "true";
  return buildAllowsWake && status?.enabled === true && status.wake !== false && status.recognition !== false;
}
