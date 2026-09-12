import type { MapplsMap, MapplsRuntime } from "./types";
import { MapProviderError } from "./types";

type MapplsSdk = Omit<MapplsRuntime, "Map"> & {
  map(
    options: { id: string; key: string; properties: Record<string, unknown> },
    onReady: (map: MapplsMap) => void,
  ): void;
};

type LoaderDependencies = {
  readKey: () => string | undefined;
  createSdk: () => Promise<{ sdk: MapplsSdk }>;
  timeoutMs?: number;
};

const DEFAULT_LOAD_TIMEOUT_MS = 15_000;

function createRuntime(sdk: MapplsSdk, key: string, timeoutMs: number): MapplsRuntime {
  return {
    Map: ({ id, properties }) =>
      new Promise<MapplsMap>((resolve, reject) => {
        const timeoutId = globalThis.setTimeout(() => {
          reject(
            new MapProviderError(
              "sdk_load_failed",
              "Mappls map creation timed out. Check the SDK key and allowed browser origins.",
            ),
          );
        }, timeoutMs);
        try {
          sdk.map({ id, key, properties }, (map) => {
            globalThis.clearTimeout(timeoutId);
            if (!map) {
              reject(new MapProviderError("map_failed", "Mappls did not return a map instance."));
              return;
            }
            resolve(map);
          });
        } catch (error) {
          globalThis.clearTimeout(timeoutId);
          reject(new MapProviderError("sdk_load_failed", "Mappls map creation failed.", error));
        }
      }),
    Marker: (options) => sdk.Marker(options),
    Polyline: (options) => sdk.Polyline(options),
    Circle: (options) => sdk.Circle(options),
    removeLayer: (input) => sdk.removeLayer(input),
  };
}

export function createMapplsSdkLoader({
  readKey,
  createSdk,
  timeoutMs = DEFAULT_LOAD_TIMEOUT_MS,
}: LoaderDependencies) {
  let initialization: Promise<MapplsRuntime> | null = null;

  return () => {
    if (initialization) return initialization;

    const key = readKey()?.trim();
    if (!key) {
      return Promise.reject(
        new MapProviderError(
          "missing_key",
          "VITE_MAPPLS_MAP_SDK_KEY is not configured.",
        ),
      );
    }

    initialization = createSdk()
      .then(({ sdk }) => createRuntime(sdk, key, timeoutMs))
      .catch((error: unknown) => {
        initialization = null;
        if (error instanceof MapProviderError) throw error;
        throw new MapProviderError(
          "sdk_load_failed",
          "Mappls SDK could not be loaded.",
          error,
        );
      });

    return initialization;
  };
}

const defaultLoader = createMapplsSdkLoader({
  readKey: () => import.meta.env.VITE_MAPPLS_MAP_SDK_KEY,
  createSdk: async () => {
    const { mappls } = await import("mappls-web-maps");
    return { sdk: new mappls() as MapplsSdk };
  },
});

export const initializeMapplsSdk = () => defaultLoader();