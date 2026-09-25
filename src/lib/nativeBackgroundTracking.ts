import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";

/** A fix from the Android live tracking service, the single GPS source while it runs. */
export type NativeTrackingFix = {
  jobId?: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp: number;
  sequenceId: number;
};

export type NativeTrackingState =
  | "running"
  | "stopped"
  | "delivery_js"
  | "delivery_native"
  | "location_unavailable"
  | "location_available";

export type NativeTrackingStatus = {
  state: NativeTrackingState;
  reason?: string | null;
  jobId?: string | null;
};

export type NativeTrackingStartOptions = {
  jobId: string;
  technicianId: string;
  /** The existing canonical REST endpoint; the service posts TrackingLocationV1 to it. */
  endpointUrl: string;
  token: string;
  /** Highest sequence id already used, so native ids continue monotonically. */
  sequenceFloor: number;
};

type TechnicianTrackingPlugin = {
  start(options: NativeTrackingStartOptions): Promise<{ started: boolean; alreadyRunning: boolean }>;
  stop(options: { reason: string; jobId?: string }): Promise<void>;
  addListener(eventName: "location", listener: (fix: NativeTrackingFix) => void): Promise<PluginListenerHandle>;
  addListener(eventName: "status", listener: (status: NativeTrackingStatus) => void): Promise<PluginListenerHandle>;
};

let plugin: TechnicianTrackingPlugin | null = null;
// Registered lazily so web builds and tests never touch the native bridge.
const getPlugin = () => {
  if (!plugin) plugin = registerPlugin<TechnicianTrackingPlugin>("TechnicianTracking");
  return plugin;
};

/** Build-time flag, Android app only. The web app keeps its foreground watcher. */
export function isNativeBackgroundTrackingEnabled(
  value: unknown = import.meta.env.VITE_NATIVE_BACKGROUND_TRACKING,
) {
  if (String(value || "").trim().toLowerCase() !== "true") return false;
  return Capacitor.getPlatform?.() === "android";
}

export const nativeBackgroundTracking = {
  start: (options: NativeTrackingStartOptions) => getPlugin().start(options),
  stop: (reason: string, jobId?: string) => getPlugin().stop({ reason, ...(jobId ? { jobId } : {}) }),
  onLocation: (listener: (fix: NativeTrackingFix) => void) => getPlugin().addListener("location", listener),
  onStatus: (listener: (status: NativeTrackingStatus) => void) => getPlugin().addListener("status", listener),
};

/** Safe from anywhere (e.g. logout): a no-op when the feature is off or nothing runs. */
export async function stopNativeBackgroundTracking(reason: string) {
  if (!isNativeBackgroundTrackingEnabled()) return;
  try {
    await nativeBackgroundTracking.stop(reason);
  } catch {
    // Nothing to stop, or the native plugin is unavailable in this build.
  }
}
