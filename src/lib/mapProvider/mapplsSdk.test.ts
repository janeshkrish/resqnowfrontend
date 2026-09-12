import { afterEach, describe, expect, it, vi } from "vitest";

import { createMapplsSdkLoader } from "./mapplsSdk";

const createRawMap = () => ({
  on: vi.fn(),
  off: vi.fn(),
  fitBounds: vi.fn(),
  jumpTo: vi.fn(),
  resize: vi.fn(),
  remove: vi.fn(),
});

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

  it("deduplicates loading the Mappls SDK runtime", async () => {
    const createSdk = vi.fn(async () => ({
      sdk: {
        map: vi.fn(),
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
  });

  it("creates maps through the Mappls Web SDK with the configured browser key", async () => {
    const map = vi.fn();
    const rawMap = createRawMap();
    const loader = createMapplsSdkLoader({
      readKey: () => "public-key",
      createSdk: async () => ({
        sdk: {
          map: (options, ready) => {
            map(options);
            ready(rawMap);
          },
          Marker: vi.fn(),
          Polyline: vi.fn(),
          Circle: vi.fn(),
          removeLayer: vi.fn(),
        },
      }),
    });

    const runtime = await loader();
    await expect(runtime.Map({ id: "map-root", properties: { zoom: 12 } })).resolves.toBe(rawMap);

    expect(map).toHaveBeenCalledWith({
      id: "map-root",
      key: "public-key",
      properties: { zoom: 12 },
    });
  });

  it("allows a retry when Mappls map creation stalls", async () => {
    vi.useFakeTimers();
    const map = vi.fn();
    const loader = createMapplsSdkLoader({
      readKey: () => "public-key",
      createSdk: async () => ({
        sdk: {
          map,
          Marker: vi.fn(),
          Polyline: vi.fn(),
          Circle: vi.fn(),
          removeLayer: vi.fn(),
        },
      }),
      timeoutMs: 1_000,
    });

    const runtime = await loader();
    const firstAttempt = runtime.Map({ id: "map-root", properties: {} });
    const firstFailure = expect(firstAttempt).rejects.toMatchObject({ code: "sdk_load_failed" });
    await vi.advanceTimersByTimeAsync(1_000);
    await firstFailure;

    const secondAttempt = runtime.Map({ id: "map-root", properties: {} });
    const secondFailure = expect(secondAttempt).rejects.toMatchObject({ code: "sdk_load_failed" });
    await vi.advanceTimersByTimeAsync(1_000);
    await secondFailure;

    expect(map).toHaveBeenCalledTimes(2);
  });
});