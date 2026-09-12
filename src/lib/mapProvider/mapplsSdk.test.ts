import { afterEach, describe, expect, it, vi } from "vitest";
import { mappls } from "mappls-web-maps";
import { createMapplsSdkLoader } from "./mapplsSdk";

const createLoader = (timeoutMs = 1_000) => createMapplsSdkLoader({
  readKey: () => "  public-key  ",
  // Exercise the real installed package, including its script injection.
  createSdk: async () => ({ sdk: new mappls() }),
  timeoutMs,
});
const sdkScript = () => document.querySelector<HTMLScriptElement>('script[src*="sdk.mappls.com/map/sdk/web"]')!;
const begin = async (loader: ReturnType<typeof createLoader>) => {
  const pending = loader();
  await Promise.resolve();
  await Promise.resolve();
  return { pending, script: sdkScript() };
};
describe("Mappls 3.8.1 SDK integration", () => {
  afterEach(() => {
    document.head.querySelectorAll("script").forEach((script) => script.remove());
    delete window.mappls;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  it("rejects a missing key before importing the SDK", async () => {
    const createSdk = vi.fn();
    await expect(createMapplsSdkLoader({ readKey: () => "", createSdk })()).rejects.toMatchObject({ code: "missing_key" });
    expect(createSdk).not.toHaveBeenCalled();
  });
  it("loads one auth2 script and uses the real uppercase Map API", async () => {
    const loader = createLoader();
    const { pending, script } = await begin(loader);
    const concurrent = loader();
    expect(concurrent).toBe(pending);
    const url = new URL(script.src);
    expect(url.origin + url.pathname).toBe("https://sdk.mappls.com/map/sdk/web");
    expect(url.searchParams.get("access_token")).toBe("public-key");
    expect(document.head.querySelectorAll("script")).toHaveLength(1);
    const rawMap = { on: vi.fn(), remove: vi.fn() };
    window.mappls = { Map: vi.fn(() => rawMap) };
    script.dispatchEvent(new Event("load"));
    const runtime = await pending;
    expect(runtime.Map({ id: "map-root", properties: { zoom: 12 } })).toBe(rawMap);
    expect(window.mappls.Map).toHaveBeenCalledWith("map-root", { zoom: 12 });
    expect(document.head.querySelectorAll("script")).toHaveLength(1);
  });
  it("rejects a failed SDK download immediately and retries with a new script", async () => {
    const loader = createLoader();
    const { pending, script } = await begin(loader);
    const failure = expect(pending).rejects.toMatchObject({ code: "sdk_load_failed" });
    script.dispatchEvent(new Event("error"));
    await failure;
    expect(script.isConnected).toBe(false);
    const retry = await begin(loader);
    expect(retry.script).not.toBe(script);
    retry.script.dispatchEvent(new Event("load"));
    await expect(retry.pending).resolves.toBeInstanceOf(mappls);
  });
  it("times out stalled scripts and disconnects their late callbacks", async () => {
    vi.useFakeTimers();
    const { pending, script } = await begin(createLoader());
    const failure = expect(pending).rejects.toMatchObject({ code: "sdk_load_failed" });
    await vi.advanceTimersByTimeAsync(1_000);
    await failure;
    expect(script.onload).toBeNull();
    expect(script.isConnected).toBe(false);
  });
});
