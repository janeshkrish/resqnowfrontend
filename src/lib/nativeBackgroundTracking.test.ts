import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const capacitor = vi.hoisted(() => ({
  platform: "android",
  plugin: {
    start: vi.fn(),
    stop: vi.fn(),
    addListener: vi.fn(),
  },
  registerPlugin: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { getPlatform: () => capacitor.platform },
  registerPlugin: (...args: unknown[]) => {
    capacitor.registerPlugin(...args);
    return capacitor.plugin;
  },
}));

import { isNativeBackgroundTrackingEnabled, stopNativeBackgroundTracking } from "./nativeBackgroundTracking";

describe("native background tracking flag", () => {
  beforeEach(() => {
    capacitor.platform = "android";
    capacitor.plugin.stop.mockReset();
    capacitor.registerPlugin.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is off unless the build flag is exactly true", () => {
    expect(isNativeBackgroundTrackingEnabled(undefined)).toBe(false);
    expect(isNativeBackgroundTrackingEnabled("false")).toBe(false);
    expect(isNativeBackgroundTrackingEnabled(" TRUE ")).toBe(true);
  });

  it("only applies to the Android app, never the web app or iOS", () => {
    capacitor.platform = "web";
    expect(isNativeBackgroundTrackingEnabled("true")).toBe(false);
    capacitor.platform = "ios";
    expect(isNativeBackgroundTrackingEnabled("true")).toBe(false);
  });

  it("does not touch the native bridge on logout when the feature is off", async () => {
    vi.stubEnv("VITE_NATIVE_BACKGROUND_TRACKING", "false");

    await stopNativeBackgroundTracking("logout");

    expect(capacitor.registerPlugin).not.toHaveBeenCalled();
    expect(capacitor.plugin.stop).not.toHaveBeenCalled();
  });

  it("stops the native service on logout and tolerates it not running", async () => {
    vi.stubEnv("VITE_NATIVE_BACKGROUND_TRACKING", "true");
    capacitor.plugin.stop.mockRejectedValueOnce(new Error("not running"));

    await expect(stopNativeBackgroundTracking("logout")).resolves.toBeUndefined();

    expect(capacitor.plugin.stop).toHaveBeenCalledWith({ reason: "logout" });
  });
});
