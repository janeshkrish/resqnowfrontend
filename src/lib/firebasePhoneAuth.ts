import {
  initializeAuth,
  inMemoryPersistence,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signOut,
  type Auth,
  type ConfirmationResult,
  type User,
} from "firebase/auth";

import { createFirebaseApp, hasFirebaseAuthConfig } from "@/lib/firebase";

// Firebase sends the SMS code and checks it. Its session is kept in memory only: once the
// app has its own ResQNow login token, the Firebase side is no longer needed.
// The log in page loads this file on its own, so the rest of the app never downloads it.

let phoneAuth: Auth | null = null;
let verifier: RecaptchaVerifier | null = null;
let verifierBox: HTMLElement | null = null;

function notConfigured() {
  return Object.assign(new Error("Firebase is not configured."), { code: "phone-login/not-configured" });
}

function getPhoneAuth() {
  if (phoneAuth) return phoneAuth;
  if (!hasFirebaseAuthConfig) throw notConfigured();
  const app = createFirebaseApp();
  if (!app) throw notConfigured();
  phoneAuth = initializeAuth(app, { persistence: inMemoryPersistence });
  phoneAuth.languageCode = "en";
  return phoneAuth;
}

/** Forgets the invisible reCAPTCHA, so the next code request starts a fresh one. */
export function resetPhoneVerifier() {
  try {
    verifier?.clear();
  } catch {
    // Already cleared.
  }
  verifier = null;
  if (verifierBox) verifierBox.innerHTML = "";
  verifierBox = null;
}

/** Sends the SMS code to a +91 number. `box` is an empty element on the page for the reCAPTCHA. */
export async function sendPhoneCode(phoneE164: string, box: HTMLElement): Promise<ConfirmationResult> {
  const auth = getPhoneAuth();
  if (!verifier || verifierBox !== box) {
    resetPhoneVerifier();
    verifier = new RecaptchaVerifier(auth, box, { size: "invisible" });
    verifierBox = box;
  }
  try {
    return await signInWithPhoneNumber(auth, phoneE164, verifier);
  } catch (error) {
    resetPhoneVerifier();
    throw error;
  }
}

/** Checks the six digits; the Firebase user it returns gives the ID token for our server. */
export async function confirmPhoneCode(confirmation: ConfirmationResult, code: string): Promise<User> {
  const result = await confirmation.confirm(code);
  return result.user;
}

export async function endFirebasePhoneSession() {
  if (!phoneAuth) return;
  await signOut(phoneAuth).catch(() => undefined);
}
