import type { MapplsRuntime } from "./types";
import { MapProviderError } from "./types";

type InitializableMapplsRuntime = MapplsRuntime & {
  initialize(
    key: string,
    options: Record<string, unknown>,
    onReady: () => void,
  ): void;
};

type LoaderDependencies = {
  readKey: () => string | undefined;
  createSdk: () => Promise<{ sdk: InitializableMapplsRuntime }>;
  timeoutMs?: number;
};

const DEFAULT_LOAD_TIMEOUT_MS = 15_000;

const loadOptions = {
  map: true,
  version: "3.0",
  libraries: [""],
  plugins: [""],
} as const;

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
      .then(
        ({ sdk }) =>
          new Promise<MapplsRuntime>((resolve, reject) => {
            const timeoutId = globalThis.setTimeout(() => {
              reject(
                new MapProviderError(
                  "sdk_load_failed",
                  "Mappls SDK loading timed out. Check the SDK key and allowed browser origins.",
                ),
              );
            }, timeoutMs);
            try {
              sdk.initialize(key, loadOptions, () => {
                globalThis.clearTimeout(timeoutId);
                resolve(sdk);
              });
            } catch (error) {
              globalThis.clearTimeout(timeoutId);
              reject(
                new MapProviderError(
                  "sdk_load_failed",
                  "Mappls SDK initialization failed.",
                  error,
                ),
              );
            }
          }),
      )
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
    return { sdk: new mappls() as InitializableMapplsRuntime };
  },
});

export const initializeMapplsSdk = () => defaultLoader();
