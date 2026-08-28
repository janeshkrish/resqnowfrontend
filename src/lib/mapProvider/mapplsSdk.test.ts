import { afterEach, describe, expect, it, vi } from "vitest";

import { createMapplsSdkLoader } from "./mapplsSdk";

describe("Mappls SDK loader", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("rejects a missing client-safe Map SDK key", async () => {
    const loader = createMapplsSdkLoader({
      readKey: () => "",
      createSdk: vi.fn(),
    });

    await expect(loader()).rejects.toMatchObject({ code: "missing_key" });
  });

  it("deduplicates concurrent SDK initialization", async () => {
    const initialize = vi.fn((_key, _options, done) => done());
    const createSdk = vi.fn(async () => ({
      sdk: {
        initialize,
        Map: vi.fn(),
        Marker: vi.fn(),
        Polyline: vi.fn(),
        Circle: vi.fn(),
        removeLayer: vi.fn(),
      },
    }));
    const loader = createMapplsSdkLoader({
      readKey: () => "public-key",
      createSdk,
    });

    const [first, second] = await Promise.all([loader(), loader()]);

    expect(first).toBe(second);
    expect(createSdk).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it("rejects a stalled SDK load and allows a fresh retry", async () => {
    vi.useFakeTimers();
    const initialize = vi.fn();
    const createSdk = vi.fn(async () => ({
      sdk: {
        initialize,
        Map: vi.fn(),
        Marker: vi.fn(),
        Polyline: vi.fn(),
        Circle: vi.fn(),
        removeLayer: vi.fn(),
      },
    }));
    const loader = createMapplsSdkLoader({
      readKey: () => "public-key",
      createSdk,
      timeoutMs: 1_000,
    });

    const firstAttempt = loader();
    const firstFailure = expect(firstAttempt).rejects.toMatchObject({
      code: "sdk_load_failed",
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await firstFailure;

    const secondAttempt = loader();
    expect(secondAttempt).not.toBe(firstAttempt);
    const secondFailure = expect(secondAttempt).rejects.toMatchObject({
      code: "sdk_load_failed",
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await secondFailure;
    expect(createSdk).toHaveBeenCalledTimes(2);
    expect(initialize).toHaveBeenCalledTimes(2);
  });
});
