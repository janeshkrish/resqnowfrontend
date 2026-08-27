import { afterEach, describe, expect, it, vi } from "vitest";

import { createMapplsSdkLoader } from "./mapplsSdk";

describe("Mappls SDK loader", () => {
  afterEach(() => vi.restoreAllMocks());

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
});
