import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useVoiceEnabled, useWakeEnabled } from "./useVoiceEnabled";

const { status } = vi.hoisted(() => ({ status: { enabled: true, wake: true, recognition: true } }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 41 } }) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: status }) }));

describe("the native release wake switch", () => {
  beforeEach(() => {
    Object.assign(status, { enabled: true, wake: true, recognition: true });
    vi.stubEnv("VITE_NATIVE_BUILD", "true");
    vi.stubEnv("VITE_NATIVE_WAKE_ENABLED", "false");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("disables automatic wake without disabling manual voice, even when the server enables both", () => {
    expect(renderHook(useWakeEnabled).result.current).toBe(false);
    expect(renderHook(useVoiceEnabled).result.current).toBe(true);
  });

  it.each([undefined, "", "TRUE", "invalid"])("fails closed for an unapproved native wake setting: %s", (value) => {
    vi.stubEnv("VITE_NATIVE_WAKE_ENABLED", value);
    expect(renderHook(useWakeEnabled).result.current).toBe(false);
    expect(renderHook(useVoiceEnabled).result.current).toBe(true);
  });

  it("preserves the existing website wake feature", () => {
    vi.stubEnv("VITE_NATIVE_BUILD", "false");
    expect(renderHook(useWakeEnabled).result.current).toBe(true);
  });

  it("allows explicit diagnostic native opt-in but never overrides the server kill switch", () => {
    vi.stubEnv("VITE_NATIVE_WAKE_ENABLED", "true");
    expect(renderHook(useWakeEnabled).result.current).toBe(true);
    status.wake = false;
    expect(renderHook(useWakeEnabled).result.current).toBe(false);
    status.enabled = false;
    expect(renderHook(useVoiceEnabled).result.current).toBe(false);
  });
});
