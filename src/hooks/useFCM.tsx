import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";
import { requestForToken, subscribeToForegroundMessages } from "../lib/firebase";
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from "@capacitor/push-notifications";
import { Capacitor } from "@capacitor/core";
import { navigateWithinApp } from "@/lib/appNavigation";

type UseFcmOptions = {
  isUserAuthenticated: boolean;
  isTechnicianAuthenticated: boolean;
};

const DEFAULT_NOTIFICATION_TITLE = "🚨 New Job Alert";

function toDistanceText(value: unknown) {
  const raw = String(value || "").trim();
  if (!raw) return "Nearby";
  return /km|m|away$/i.test(raw) ? raw : `${raw} away`;
}

function toAmountText(value: unknown) {
  const amount = Number(value);
  if (Number.isFinite(amount)) return amount.toFixed(0);
  return String(value || "0");
}

function resolveServiceEmoji(serviceType: string) {
  const value = String(serviceType || "").toLowerCase();
  if (value.includes("tow")) return "🛻";
  if (value.includes("flat") || value.includes("tyre") || value.includes("tire")) return "🛞";
  if (value.includes("battery") || value.includes("jump")) return "🔋";
  if (value.includes("fuel")) return "⛽";
  if (value.includes("lock")) return "🔐";
  return "🧰";
}

function buildForegroundMessage(payload: any) {
  const data = payload?.data || {};
  const title = payload?.notification?.title || payload?.title || DEFAULT_NOTIFICATION_TITLE;
  const bodyText = payload?.notification?.body || payload?.body || "";
  const jobId = String(data.jobId || data.requestId || "").trim();
  const deepLinkPath =
    String(data.deepLinkPath || "").trim() ||
    (jobId ? `/job/${encodeURIComponent(jobId)}` : "/technician/dashboard");

  const serviceType = String(data.serviceType || "Roadside Assistance");
  const customerName = String(data.customerName || "Customer");
  const locationDistance = toDistanceText(data.locationDistance || data.distance);
  const priceAmount = toAmountText(data.priceAmount || data.amount);
  const serviceEmoji = resolveServiceEmoji(serviceType);
  const body =
    bodyText ||
    `📍 ${serviceEmoji} ${serviceType} • ${locationDistance}\n👤 Customer: ${customerName}\n💰 ₹${priceAmount}`;

  return { title, body, deepLinkPath, jobId };
}

export const useFCM = ({ isUserAuthenticated, isTechnicianAuthenticated }: UseFcmOptions) => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const shouldEnableFcm = useMemo(
    () => Boolean(isUserAuthenticated || isTechnicianAuthenticated),
    [isUserAuthenticated, isTechnicianAuthenticated]
  );

  useEffect(() => {
    if (!shouldEnableFcm || typeof window === "undefined") return;

    let cancelled = false;
    let listeners: Array<() => void> = [];

    // run registration async after the current render cycle so that
    // any pending navigation/cleanup from login page has a chance to run
    const startTimeout = setTimeout(() => {
      if (cancelled) return;

      const initNativePush = async () => {
        console.log("[Native Push] init start (shouldEnableFcm=", shouldEnableFcm, ")");
        try {
          // 1. Request permission first and register only on explicit grant.
          const permStatus = await PushNotifications.requestPermissions();
          console.log("[Native Push] permission result:", permStatus);

          if (permStatus.receive !== 'granted' || cancelled) {
            console.warn("[Native Push] permissions not granted, skipping registration");
            return;
          }

          // 2. Register natively with Firebase/APNs.
          // Android channel/sound setup is handled in native code via R.raw.emergency_alarm.
          try {
            await PushNotifications.register();
          } catch (e) {
            console.error("[Native Push] register() threw", e);
          }

          // 3. Registration Listeners (token and refresh)
          const onRegister = PushNotifications.addListener('registration', async (token: Token) => {
            if (cancelled) return;
            console.log("[Native Push] registration event, token=", token.value);
            if (!token.value) {
              console.warn("[Native Push] empty token received, ignoring");
              return;
            }
            setFcmToken(token.value);
            try {
              await apiFetch("/api/notifications/register-token", {
                method: "POST",
                technician: isTechnicianAuthenticated,
                body: JSON.stringify({ token: token.value }),
              });
              console.log("[Native Push] token synced with backend");
            } catch (error) {
              console.error("[Native Push] failed to sync token", error);
            }
          });
          listeners.push(() => onRegister.remove());

          const onRegError = PushNotifications.addListener('registrationError', (error: any) => {
            console.error('[Native Push] registrationError', error);
          });
          listeners.push(() => onRegError.remove());

          // 4. Foreground notifications
          const onPush = PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
            if (cancelled) return;
            const payloadType = String((notification as any)?.data?.type || "").trim().toUpperCase();
            if (payloadType === "EMERGENCY_JOB" || payloadType === "JOB_REVOKED") {
              // Native Android full-screen alert flow handles emergency/revocation UI.
              return;
            }
            const message = buildForegroundMessage(notification);
            toast(message.title, {
              description: message.body.replace(/\n/g, " "),
              duration: 8000,
              action: {
                label: "View Request",
                onClick: () => {
                  try {
                    navigateWithinApp(message.deepLinkPath, { replace: true });
                  } catch (e) {
                    console.error("navigation exception from toast action", e);
                  }
                },
              },
            });
          });
          listeners.push(() => onPush.remove());

          // 5. Background action
          const onAction = PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
            if (cancelled) return;
            const message = buildForegroundMessage(notification.notification);
            if (message.deepLinkPath) {
              try {
                navigateWithinApp(message.deepLinkPath, { replace: true });
              } catch (e) {
                console.error("navigation exception in action performed", e);
              }
            }
          });
          listeners.push(() => onAction.remove());

          console.log("[Native Push] listeners attached", listeners.length);
        } catch (err) {
          console.error("[Native Push Init Error]:", err);
        }
      };

      const initWebFcm = async () => {
        console.log("[Web FCM] init");
        try {
          if (!("Notification" in window)) return;
          const permission =
            Notification.permission === "granted"
              ? "granted"
              : await Notification.requestPermission();
          console.log("[Web FCM] permission result", permission);
          if (permission !== "granted" || cancelled) return;
          const token = await requestForToken();
          if (!token || cancelled) return;
          setFcmToken(token);
          try {
            await apiFetch("/api/notifications/register-token", {
              method: "POST",
              technician: isTechnicianAuthenticated,
              body: JSON.stringify({ token }),
            });
            console.log("[Web FCM] token synced with backend");
          } catch (error) {
            console.error("[Web FCM] failed to sync token", error);
          }
        } catch (err) {
          console.warn("[Web FCM Init Error]:", err);
        }
      };

      if (Capacitor.isNativePlatform()) {
        void initNativePush();
      } else {
        void initWebFcm();
      }
    }, 50);

    return () => {
      cancelled = true;
      clearTimeout(startTimeout);
      listeners.forEach((fn) => fn());
      if (Capacitor.isNativePlatform()) {
        PushNotifications.removeAllListeners().catch(() => {});
      }
    };
  }, [shouldEnableFcm, isTechnicianAuthenticated]);

  useEffect(() => {
    // If we're native, native listeners handle the foreground messages and rendering.
    if (!shouldEnableFcm || typeof window === "undefined" || Capacitor.isNativePlatform()) return;

    let unsubscribe = () => { };

    const attachWebListener = async () => {
      try {
        unsubscribe = await subscribeToForegroundMessages((payload) => {
          const message = buildForegroundMessage(payload);

          toast(message.title, {
            description: message.body.replace(/\n/g, " "),
          });

          if (typeof Notification !== "undefined" && Notification.permission === "granted") {
            const options: any = {
              body: message.body,
              icon: "/icons/icon-192x192.png",
              badge: "/icons/icon-192x192.png",
              requireInteraction: true,
              vibrate: [200, 100, 200],
              tag: message.jobId ? `job-${message.jobId}` : `job-${Date.now()}`,
              data: { deepLinkPath: message.deepLinkPath },
            };
            const notification = new Notification(message.title, options);
            notification.onclick = function () {
              window.focus();
              navigateWithinApp(message.deepLinkPath, { replace: true });
              if (typeof notification.close === "function") notification.close();
            };
          }
        });
      } catch (err) {
        console.warn("Foreground web listener error: ", err);
      }
    };

    void attachWebListener();

    return () => {
      unsubscribe();
    };
  }, [shouldEnableFcm]);

  return { fcmToken };
};

