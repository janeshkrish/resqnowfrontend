import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getMessaging, onBackgroundMessage } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-sw.js";

const DEFAULT_TITLE = "\uD83D\uDEA8 New Job Alert";

function parseFirebaseConfigFromUrl() {
  const swUrl = new URL(self.location.href);
  return {
    apiKey: swUrl.searchParams.get("apiKey") || "",
    authDomain: swUrl.searchParams.get("authDomain") || "",
    projectId: swUrl.searchParams.get("projectId") || "",
    storageBucket: swUrl.searchParams.get("storageBucket") || "",
    messagingSenderId: swUrl.searchParams.get("messagingSenderId") || "",
    appId: swUrl.searchParams.get("appId") || "",
  };
}

function hasRequiredFirebaseConfig(config) {
  return Boolean(
    config.apiKey &&
      config.projectId &&
      config.messagingSenderId &&
      config.appId
  );
}

function toDistanceText(value) {
  const raw = String(value || "").trim();
  if (!raw) return "Nearby";
  return /km|m|away$/i.test(raw) ? raw : `${raw} away`;
}

function toCurrencyValue(value) {
  const amount = Number(value);
  if (Number.isFinite(amount)) return amount.toFixed(0);
  return String(value || "0");
}

function resolveServiceEmoji(serviceType) {
  const value = String(serviceType || "").toLowerCase();
  if (value.includes("tow")) return "\uD83D\uDEFB";
  if (value.includes("flat") || value.includes("tyre") || value.includes("tire")) return "\uD83D\uDEDE";
  if (value.includes("battery") || value.includes("jump")) return "\uD83D\uDD0B";
  if (value.includes("fuel")) return "\u26FD";
  if (value.includes("lock")) return "\uD83D\uDD10";
  return "\uD83E\uDDF0";
}

function buildBody(data = {}) {
  const serviceType = String(data.serviceType || "Roadside Assistance");
  const locationDistance = toDistanceText(data.locationDistance || data.distance);
  const customerName = String(data.customerName || "Customer");
  const priceAmount = toCurrencyValue(data.priceAmount || data.amount);
  const serviceEmoji = resolveServiceEmoji(serviceType);

  return [
    `\uD83D\uDCCD ${serviceEmoji} ${serviceType} \u2022 ${locationDistance}`,
    `\uD83D\uDC64 Customer: ${customerName}`,
    `\uD83D\uDCB0 \u20B9${priceAmount}`,
  ].join("\n");
}

function resolveDeepLinkPath(data = {}) {
  const rawPath = String(data.deepLinkPath || "").trim();
  if (rawPath) return rawPath;

  const jobId = String(data.jobId || data.requestId || "").trim();
  if (jobId) return `/job/${encodeURIComponent(jobId)}`;
  return "/technician/dashboard";
}

function buildNotification(payload = {}) {
  const data = payload.data || {};
  const title = payload.notification?.title || DEFAULT_TITLE;
  const body = payload.notification?.body || buildBody(data);

  return {
    title,
    body: String(body),
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-192x192.png",
    tag: data.jobId ? `job-${String(data.jobId)}` : `job-${Date.now()}`,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    data: {
      ...data,
      deepLinkPath: resolveDeepLinkPath(data),
    },
  };
}

const firebaseConfig = parseFirebaseConfigFromUrl();
if (hasRequiredFirebaseConfig(firebaseConfig)) {
  const firebaseApp = initializeApp(firebaseConfig);
  const messaging = getMessaging(firebaseApp);

  onBackgroundMessage(messaging, (payload) => {
    const notification = buildNotification(payload);
    self.registration.showNotification(notification.title, notification);
  });
} else {
  console.warn("[FCM SW] Firebase config missing; background notifications are disabled.");
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const deepLinkPath = resolveDeepLinkPath(event.notification?.data || {});
  const absoluteTargetUrl = new URL(deepLinkPath, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const sameOriginClient = clientList.find((client) => {
        try {
          return new URL(client.url).origin === self.location.origin;
        } catch {
          return false;
        }
      });

      if (sameOriginClient) {
        return sameOriginClient.focus().then(() => sameOriginClient.navigate(absoluteTargetUrl));
      }
      return clients.openWindow(absoluteTargetUrl);
    })
  );
});
