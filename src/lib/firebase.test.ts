import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("Firebase phone configuration", () => {
  it("allows phone authentication without a push messaging sender ID", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_FIREBASE_API_KEY", "fixture-api-key");
    vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "fixture.firebaseapp.com");
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "fixture");
    vi.stubEnv("VITE_FIREBASE_APP_ID", "fixture-app");
    vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "");
    const firebase = await import("./firebase");
    expect(firebase.hasFirebaseAuthConfig).toBe(true);
    expect(firebase.hasFirebaseConfig).toBe(false);
    expect(firebase.createFirebaseApp()).not.toBeNull();
  });

  it("rejects phone configuration without an auth domain", async () => {
    vi.resetModules();
    vi.stubEnv("VITE_FIREBASE_API_KEY", "fixture-api-key");
    vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "");
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "fixture");
    vi.stubEnv("VITE_FIREBASE_APP_ID", "fixture-app");
    vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "123");
    const firebase = await import("./firebase");
    expect(firebase.hasFirebaseAuthConfig).toBe(false);
    expect(firebase.hasFirebaseConfig).toBe(true);
  });
});
