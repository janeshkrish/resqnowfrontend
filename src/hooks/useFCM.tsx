import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";
import { requestForToken, subscribeToForegroundMessages } from "../lib/firebase";

type UseFcmOptions = {
  isUserAuthenticated: boolean;
  isTechnicianAuthenticated: boolean;
};

const DEFAULT_NOTIFICATION_TITLE = "\uD83D\uDEA8 New Job Alert";

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
  if (value.includes("tow")) return "\uD83D\uDEFB";
  if (value.includes("flat") || value.includes("tyre") || value.includes("tire")) return "\uD83D\uDEDE";
  if (value.includes("battery") || value.includes("jump")) return "\uD83D\uDD0B";
  if (value.includes("fuel")) return "\u26FD";
  if (value.includes("lock")) return "\uD83D\uDD10";
  return "\uD83E\uDDF0";
}

function buildForegroundMessage(payload: any) {
  const data = payload?.data || {};
  const title = payload?.notification?.title || DEFAULT_NOTIFICATION_TITLE;
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
    payload?.notification?.body ||
    `\uD83D\uDCCD ${serviceEmoji} ${serviceType} \u2022 ${locationDistance}\n\uD83D\uDC64 Customer: ${customerName}\n\uD83D\uDCB0 \u20B9${priceAmount}`;

  return { title, body, deepLinkPath, jobId };
}

export const useFCM = ({ isUserAuthenticated, isTechnicianAuthenticated }: UseFcmOptions) => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const shouldEnableFcm = useMemo(
    () => Boolean(isUserAuthenticated || isTechnicianAuthenticated),
    [isUserAuthenticated, isTechnicianAuthenticated]
  );

  useEffect(() => {
    if (!shouldEnableFcm || typeof window === "undefined" || !("Notification" in window)) return;

    let cancelled = false;

    const initFCM = async () => {
      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
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
      } catch (error) {
        console.error("[FCM] Failed to register token with backend:", error);
      }
    };

    void initFCM();

    return () => {
      cancelled = true;
    };
  }, [shouldEnableFcm, isTechnicianAuthenticated]);

  useEffect(() => {
    if (!shouldEnableFcm || typeof window === "undefined") return;
    let unsubscribe = () => {};

    const attachListener = async () => {
      unsubscribe = await subscribeToForegroundMessages((payload) => {
        const message = buildForegroundMessage(payload);

        toast(message.title, {
          description: message.body.replace(/\n/g, " "),
        });

        if (Notification.permission === "granted") {
          const notification = new Notification(message.title, {
            body: message.body,
            icon: "/icons/icon-192x192.png",
            badge: "/icons/icon-192x192.png",
            requireInteraction: true,
            vibrate: [200, 100, 200],
            tag: message.jobId ? `job-${message.jobId}` : `job-${Date.now()}`,
            data: { deepLinkPath: message.deepLinkPath },
          });
          notification.onclick = () => {
            window.focus();
            window.location.assign(message.deepLinkPath);
            notification.close();
          };
        }
      });
    };

    void attachListener();

    return () => {
      unsubscribe();
    };
  }, [shouldEnableFcm]);

  return { fcmToken };
};
