import type { mappls } from "mappls-web-maps";
import type { MapplsRuntime } from "./types";
import { MapProviderError } from "./types";

// Keep this contract tied to the installed package, not a hand-written SDK API.
type MapplsSdk = Pick<mappls, "initialize" | "Map" | "Marker" | "Polyline" | "Circle" | "removeLayer">;
type LoaderDependencies = {
  readKey: () => string | undefined;
  createSdk: () => Promise<{ sdk: MapplsSdk }>;
  timeoutMs?: number;
};

export function createMapplsSdkLoader({
  readKey,
  createSdk,
  timeoutMs = 15_000,
}: LoaderDependencies) {
  let initialization: Promise<MapplsRuntime> | null = null;
  return () => {
    if (initialization) return initialization;
    const key = readKey()?.trim();
    if (!key) {
      return Promise.reject(new MapProviderError("missing_key", "VITE_MAPPLS_MAP_SDK_KEY is not configured."));
    }

    initialization = createSdk().then(({ sdk }) => new Promise<MapplsRuntime>((resolve, reject) => {
      const previousScripts = new Set(document.querySelectorAll("script"));
      const isSdkScript = (element: EventTarget | null): element is HTMLScriptElement => {
        if (!(element instanceof HTMLScriptElement)) return false;
        try {
          const url = new URL(element.src);
          return url.hostname === "sdk.mappls.com" && url.pathname === "/map/sdk/web"
            && url.searchParams.get("access_token") === key && !previousScripts.has(element);
        } catch { return false; }
      };
      let settled = false;
      const cleanup = () => {
        clearTimeout(timer);
        document.removeEventListener("error", onScriptError, true);
      };
      const fail = (message: string) => {
        if (settled) return;
        settled = true;
        cleanup();
        document.querySelectorAll("script").forEach((script) => {
          if (isSdkScript(script)) {
            script.onload = null;
            script.remove();
          }
        });
        reject(new MapProviderError("sdk_load_failed", message));
      };
      const onScriptError = (event: Event) => {
        if (isSdkScript(event.target)) {
          fail("Mappls rejected or could not load the Web SDK. Check the key's domain/IP whitelist and Web SDK allocation.");
        }
      };
      const timer = setTimeout(() => fail("Mappls SDK loading timed out. Check browser connectivity and Mappls authorization."), timeoutMs);
      document.addEventListener("error", onScriptError, true);
      try {
        // 3.8.1 uses initialize() then uppercase Map(). No plugins are needed
        // for rendering; requesting even [''] loads a second, unnecessary SDK.
        sdk.initialize(key, { map: true, version: "3.0" }, () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(sdk);
        });
      } catch {
        fail("Mappls SDK initialization failed.");
      }
    })).catch((error: unknown) => {
      initialization = null;
      if (error instanceof MapProviderError) throw error;
      throw new MapProviderError("sdk_load_failed", "Mappls SDK could not be loaded.");
    });
    return initialization;
  };
}

const defaultLoader = createMapplsSdkLoader({
  readKey: () => import.meta.env.VITE_MAPPLS_MAP_SDK_KEY,
  createSdk: async () => {
    const { mappls } = await import("mappls-web-maps");
    return { sdk: new mappls() };
  },
});
export const initializeMapplsSdk = () => defaultLoader();
