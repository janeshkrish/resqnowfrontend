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
};

const loadOptions = {
  map: true,
  version: "3.0",
  libraries: [""],
  plugins: [""],
} as const;

export function createMapplsSdkLoader({ readKey, createSdk }: LoaderDependencies) {
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
            try {
              sdk.initialize(key, loadOptions, () => resolve(sdk));
            } catch (error) {
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
