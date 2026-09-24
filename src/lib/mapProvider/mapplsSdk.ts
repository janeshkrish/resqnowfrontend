import type { mappls, mappls_plugin } from "mappls-web-maps";
import type { MapplsRuntime } from "./types";
import { MapProviderError } from "./types";

// Keep this contract tied to the installed package, not a hand-written SDK API.
type MapplsSdk = Pick<mappls, "initialize" | "Map" | "Marker" | "Polyline" | "Circle" | "removeLayer">;
type LoaderDependencies = {
  readKey: () => string | undefined;
  createSdk: () => Promise<{ sdk: MapplsSdk }>;
  timeoutMs?: number;
};

type MapplsPlacesPlugin = Pick<mappls_plugin, "search">;
export type MapplsTrackingPlugin = Pick<mappls_plugin, "tracking">;
type PlacesLoaderDependencies = {
  readKey: () => string | undefined;
  createSdk: () => Promise<{
    sdk: Pick<mappls, "initialize">;
    plugin: MapplsPlacesPlugin;
  }>;
  timeoutMs?: number;
};

type TrackingLoaderDependencies = {
  readKey: () => string | undefined;
  createSdk: () => Promise<{
    sdk: Pick<mappls, "initialize">;
    plugin: MapplsTrackingPlugin;
  }>;
  timeoutMs?: number;
};

export type MapplsPlaceSearchResult = {
  id: string;
  placeId: string;
  label: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  provider: "mappls";
  category: string | null;
};

type MapplsPlaceSearchOptions = {
  limit?: number;
  location?: { lat: number; lng: number } | null;
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

export function createMapplsPlacesLoader({
  readKey,
  createSdk,
  timeoutMs = 15_000,
}: PlacesLoaderDependencies) {
  let initialization: Promise<MapplsPlacesPlugin> | null = null;
  return () => {
    if (initialization) return initialization;
    const key = readKey()?.trim();
    if (!key) {
      return Promise.reject(new MapProviderError("missing_key", "VITE_MAPPLS_MAP_SDK_KEY is not configured."));
    }

    initialization = createSdk().then(({ sdk, plugin }) => new Promise<MapplsPlacesPlugin>((resolve, reject) => {
      const previousScripts = new Set(document.querySelectorAll("script"));
      const isPluginScript = (element: EventTarget | null): element is HTMLScriptElement => {
        if (!(element instanceof HTMLScriptElement)) return false;
        try {
          const url = new URL(element.src);
          return url.hostname === "sdk.mappls.com" && url.pathname === "/map/sdk/plugins"
            && url.searchParams.get("access_token") === key && !previousScripts.has(element);
        } catch {
          return false;
        }
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
          if (isPluginScript(script)) {
            script.onload = null;
            script.remove();
          }
        });
        reject(new MapProviderError("sdk_load_failed", message));
      };
      const onScriptError = (event: Event) => {
        if (isPluginScript(event.target)) {
          fail("Mappls Places could not load. Check the key's domain whitelist and Places allocation.");
        }
      };
      const timer = setTimeout(() => fail("Mappls Places loading timed out."), timeoutMs);
      document.addEventListener("error", onScriptError, true);
      try {
        sdk.initialize(key, { map: false, plugins: ["search"], version: "3.0" }, () => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve(plugin);
        });
      } catch {
        fail("Mappls Places initialization failed.");
      }
    })).catch((error: unknown) => {
      initialization = null;
      if (error instanceof MapProviderError) throw error;
      throw new MapProviderError("sdk_load_failed", "Mappls Places could not be loaded.");
    });
    return initialization;
  };
}

export function createMapplsTrackingLoader({
  readKey,
  createSdk,
  timeoutMs = 15_000,
}: TrackingLoaderDependencies) {
  let initialization: Promise<MapplsTrackingPlugin> | null = null;
  return () => {
    if (initialization) return initialization;
    const key = readKey()?.trim();
    if (!key) {
      return Promise.reject(new MapProviderError("missing_key", "VITE_MAPPLS_MAP_SDK_KEY is not configured."));
    }

    initialization = createSdk().then(({ sdk, plugin }) => new Promise<MapplsTrackingPlugin>((resolve, reject) => {
      let settled = false;
      const finish = (operation: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        operation();
      };
      const timer = setTimeout(
        () => finish(() => reject(new MapProviderError("sdk_load_failed", "Mappls tracking plugin loading timed out."))),
        timeoutMs,
      );
      try {
        // This loads only the tracking plugin. The live Mappls map has already
        // been created by initializeMapplsSdk(), so the plugin receives map:false.
        sdk.initialize(key, { map: false, plugins: ["tracking"], version: "3.0" }, () => {
          finish(() => resolve(plugin));
        });
      } catch {
        finish(() => reject(new MapProviderError("sdk_load_failed", "Mappls tracking plugin initialization failed.")));
      }
    })).catch((error: unknown) => {
      initialization = null;
      if (error instanceof MapProviderError) throw error;
      throw new MapProviderError("sdk_load_failed", "Mappls tracking plugin could not be loaded.");
    });
    return initialization;
  };
}

const toFiniteCoordinate = (value: unknown, min: number, max: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
};

const normalizeMapplsPlace = (value: unknown): MapplsPlaceSearchResult | null => {
  if (!value || typeof value !== "object") return null;
  const place = value as Record<string, unknown>;
  const lat = toFiniteCoordinate(place.latitude ?? place.entryLatitude ?? place.lat, -90, 90);
  const lng = toFiniteCoordinate(place.longitude ?? place.entryLongitude ?? place.lng, -180, 180);
  const name = String(place.placeName ?? place.name ?? "").trim();
  const placeAddress = String(place.placeAddress ?? place.address ?? "").trim();
  const placeId = String(place.eLoc ?? place.eloc ?? place.placeId ?? "").trim();
  if (lat == null || lng == null || (!name && !placeAddress)) return null;
  const address = name && placeAddress && !placeAddress.toLowerCase().startsWith(name.toLowerCase())
    ? `${name}, ${placeAddress}`
    : placeAddress || name;
  return {
    id: placeId || `${lat},${lng}`,
    placeId: placeId || `${lat},${lng}`,
    label: address,
    name: name || address.split(",")[0],
    address,
    lat,
    lng,
    provider: "mappls",
    category: String(place.type ?? place.category ?? "").trim() || null,
  };
};

export function createMapplsPlacesSearch({
  loadPlugin,
  timeoutMs = 10_000,
}: {
  loadPlugin: () => Promise<MapplsPlacesPlugin>;
  timeoutMs?: number;
}) {
  return async (query: string, options: MapplsPlaceSearchOptions = {}): Promise<MapplsPlaceSearchResult[]> => {
    const normalizedQuery = String(query || "").replace(/\s+/g, " ").trim();
    if (normalizedQuery.length < 2) return [];
    const plugin = await loadPlugin();

    return new Promise<MapplsPlaceSearchResult[]>((resolve, reject) => {
      let settled = false;
      const finish = (operation: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        operation();
      };
      const timer = setTimeout(
        () => finish(() => reject(new Error("Mappls location search timed out."))),
        timeoutMs,
      );
      const searchOptions: Record<string, unknown> = {
        async: true,
        bridge: false,
        geolocation: false,
        region: "IND",
      };
      if (options.location && Number.isFinite(options.location.lat) && Number.isFinite(options.location.lng)) {
        searchOptions.location = [options.location.lat, options.location.lng];
      }

      try {
        plugin.search(normalizedQuery, searchOptions, (payload: unknown) => {
          const providerError = payload && typeof payload === "object" && "error" in payload
            ? String((payload as { error?: unknown }).error || "Mappls location search failed.")
            : "";
          if (providerError) {
            finish(() => reject(new Error("Mappls location search failed.")));
            return;
          }
          const rawResults = Array.isArray(payload)
            ? payload
            : payload && typeof payload === "object" && Array.isArray((payload as { suggestedLocations?: unknown[] }).suggestedLocations)
              ? (payload as { suggestedLocations: unknown[] }).suggestedLocations
              : [];
          const limit = Math.max(1, Math.min(8, Number(options.limit) || 6));
          const results = rawResults
            .map(normalizeMapplsPlace)
            .filter((place): place is MapplsPlaceSearchResult => Boolean(place))
            .slice(0, limit);
          finish(() => resolve(results));
        });
      } catch {
        finish(() => reject(new Error("Mappls location search failed.")));
      }
    });
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

const defaultPlacesLoader = createMapplsPlacesLoader({
  readKey: () => import.meta.env.VITE_MAPPLS_MAP_SDK_KEY,
  createSdk: async () => {
    const { mappls, mappls_plugin } = await import("mappls-web-maps");
    return { sdk: new mappls(), plugin: new mappls_plugin() };
  },
});

const defaultTrackingLoader = createMapplsTrackingLoader({
  readKey: () => import.meta.env.VITE_MAPPLS_MAP_SDK_KEY,
  createSdk: async () => {
    const { mappls, mappls_plugin } = await import("mappls-web-maps");
    return { sdk: new mappls(), plugin: new mappls_plugin() };
  },
});

export const initializeMapplsPlaces = () => defaultPlacesLoader();
export const initializeMapplsTracking = () => defaultTrackingLoader();
export const searchMapplsPlaces = createMapplsPlacesSearch({ loadPlugin: initializeMapplsPlaces });
