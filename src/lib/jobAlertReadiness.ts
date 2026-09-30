import { Capacitor, registerPlugin } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { apiFetch } from "@/lib/api";
import { requestForToken } from "@/lib/firebase";

/** Something on this phone or browser that would keep a job alert from reaching the technician. */
export type JobAlertIssue = "notifications_off" | "notifications_blocked" | "full_screen_off" | "battery_restricted";

type NativeJobAlertStatus = {
  notificationsEnabled: boolean;
  fullScreenAllowed: boolean;
  ignoringBatteryOptimizations: boolean;
};

// android/app/src/main/java/com/resqnow1/app/JobAlertsPlugin.java
type JobAlertsPlugin = {
  getStatus(): Promise<NativeJobAlertStatus>;
  openSettings(options: { target: "notifications" | "fullScreen" | "battery" }): Promise<void>;
};

let plugin: JobAlertsPlugin | null = null;
// Registered lazily so web builds and tests never touch the native bridge.
const getPlugin = () => (plugin ??= registerPlugin<JobAlertsPlugin>("JobAlerts"));

export async function checkJobAlerts(): Promise<JobAlertIssue[]> {
  if (Capacitor.isNativePlatform()) {
    try {
      const status = await getPlugin().getStatus();
      const issues: JobAlertIssue[] = [];
      if (!status.notificationsEnabled) issues.push("notifications_off");
      if (!status.fullScreenAllowed) issues.push("full_screen_off");
      if (!status.ignoringBatteryOptimizations) issues.push("battery_restricted");
      return issues;
    } catch {
      return []; // An app build from before the JobAlerts plugin.
    }
  }
  if (typeof window === "undefined" || !("Notification" in window)) return [];
  if (Notification.permission === "denied") return ["notifications_blocked"];
  if (Notification.permission === "default") return ["notifications_off"];
  return [];
}

async function registerPushToken(token: string) {
  await apiFetch("/api/notifications/register-token", {
    method: "POST",
    technician: true,
    body: JSON.stringify({ token }),
  });
}

/** Fixes the issue, or opens the settings screen where the technician can. */
export async function fixJobAlertIssue(issue: JobAlertIssue) {
  if (Capacitor.isNativePlatform()) {
    if (issue !== "notifications_off") {
      await getPlugin().openSettings({ target: issue === "full_screen_off" ? "fullScreen" : "battery" });
      return;
    }
    const permission = await PushNotifications.requestPermissions().catch(() => null);
    if (permission?.receive === "granted") {
      // useFCM only registers when permission was there at sign-in, so send the token here.
      const listener = await PushNotifications.addListener("registration", (token) => {
        void listener.remove();
        if (token.value) void registerPushToken(token.value).catch(() => {});
      });
      await PushNotifications.register().catch(() => {});
      const status = await getPlugin().getStatus().catch(() => null);
      if (!status || status.notificationsEnabled) return;
    }
    // Refused before, or the job alert channel itself is off: only settings can change it.
    await getPlugin().openSettings({ target: "notifications" });
    return;
  }

  if (issue !== "notifications_off" || !("Notification" in window)) return;
  if ((await Notification.requestPermission()) !== "granted") return;
  const token = await requestForToken();
  if (token) await registerPushToken(token);
}
