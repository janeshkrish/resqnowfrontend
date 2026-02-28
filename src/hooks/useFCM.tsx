import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";
import { requestForToken, subscribeToForegroundMessages } from "../lib/firebase";

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
    `📍 ${serviceEmoji} ${serviceType} • ${locationDistance}\n👤 Customer: ${customerName}\n💰 ₹${priceAmount}`;

  return { title, body, deepLinkPath };
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

    initFCM();

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

    attachListener();

    return () => {
      unsubscribe();
    };
  }, [shouldEnableFcm]);

  return { fcmToken };
};
