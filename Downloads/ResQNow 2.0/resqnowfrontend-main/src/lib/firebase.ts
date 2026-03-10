import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
} from "firebase/messaging";

const FCM_SW_SCOPE = "/firebase-cloud-messaging-push-scope";
const FCM_SW_PATH = "/firebase-messaging-sw.js";

const firebaseConfig = {
  apiKey: String(import.meta.env.VITE_FIREBASE_API_KEY || "").trim(),
  authDomain: String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "").trim(),
  projectId: String(import.meta.env.VITE_FIREBASE_PROJECT_ID || "").trim(),
  storageBucket: String(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "").trim(),
  messagingSenderId: String(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "").trim(),
  appId: String(import.meta.env.VITE_FIREBASE_APP_ID || "").trim(),
};

const hasFirebaseConfig = [
  firebaseConfig.apiKey,
  firebaseConfig.projectId,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
].every((value) => Boolean(value));

function createFirebaseApp() {
  if (!hasFirebaseConfig) return null;
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

async function getMessagingInstance(): Promise<Messaging | null> {
  if (typeof window === "undefined" || !hasFirebaseConfig) return null;
  const supported = await isSupported().catch(() => false);
  if (!supported) return null;

  const app = createFirebaseApp();
  if (!app) return null;
  return getMessaging(app);
}

function buildMessagingServiceWorkerUrl() {
  const params = new URLSearchParams({
    apiKey: firebaseConfig.apiKey,
    authDomain: firebaseConfig.authDomain,
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
  });
  return `${FCM_SW_PATH}?${params.toString()}`;
}

export async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !navigator || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register(buildMessagingServiceWorkerUrl(), {
      scope: FCM_SW_SCOPE,
      type: "module",
    });
  } catch (error) {
    console.error("[FCM] Failed to register messaging service worker:", error);
    return null;
  }
}

export async function requestForToken() {
  const messaging = await getMessagingInstance();
  if (!messaging) return null;

  const vapidKey = String(import.meta.env.VITE_FIREBASE_VAPID_KEY || "").trim();
  if (!vapidKey) {
    console.warn("[FCM] Missing VAPID key. Token generation skipped.");
    return null;
  }

  const serviceWorkerRegistration = await registerFcmServiceWorker();
  if (!serviceWorkerRegistration) return null;

  try {
    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    });
    return token || null;
  } catch (error) {
    console.error("[FCM] Failed to get token:", error);
    return null;
  }
}

export async function subscribeToForegroundMessages(
  onPayload: (payload: MessagePayload) => void
) {
  const messaging = await getMessagingInstance();
  if (!messaging) return () => { };
  return onMessage(messaging, onPayload);
}

export { hasFirebaseConfig };
