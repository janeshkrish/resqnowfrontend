import {
  lazy,
  type ComponentType,
  type LazyExoticComponent,
} from "react";

const CHUNK_RELOAD_STORAGE_KEY = "resqnow:chunk-reload-path";
const CHUNK_RELOAD_GUARD_MS = 60_000;

const errorText = (error: unknown) => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error || "");
};

export const isChunkLoadFailure = (error: unknown) =>
  /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Failed to load module script/i.test(
    errorText(error),
  );

export const claimChunkReload = (
  error: unknown,
  routePath: string,
  storage: Pick<Storage, "getItem" | "setItem">,
  now = Date.now(),
) => {
  const fingerprint = `${routePath}:${errorText(error)}`;
  const previousValue = storage.getItem(CHUNK_RELOAD_STORAGE_KEY);

  if (previousValue) {
    try {
      const previous = JSON.parse(previousValue) as {
        fingerprint?: string;
        attemptedAt?: number;
      };
      if (
        previous.fingerprint === fingerprint &&
        Number.isFinite(previous.attemptedAt) &&
        now - Number(previous.attemptedAt) < CHUNK_RELOAD_GUARD_MS
      ) {
        return false;
      }
    } catch {
      // Replace invalid or legacy marker values below.
    }
  }

  storage.setItem(
    CHUNK_RELOAD_STORAGE_KEY,
    JSON.stringify({ fingerprint, attemptedAt: now }),
  );
  return true;
};

/**
 * Recovers once when an already-open tab requests a route chunk removed by a
 * newer deployment. A short-lived error fingerprint prevents an infinite
 * reload loop when the failure is unrelated to stale assets.
 */
export const lazyWithReload = <T extends ComponentType>(
  importer: () => Promise<{ default: T }>,
): LazyExoticComponent<T> =>
  lazy(async () => {
    try {
      return await importer();
    } catch (error) {
      if (!isChunkLoadFailure(error) || typeof window === "undefined") {
        throw error;
      }

      const routePath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      let shouldReload = false;

      try {
        shouldReload = claimChunkReload(error, routePath, window.sessionStorage);
      } catch {
        // If storage is unavailable, surface the original error instead of
        // risking an unbounded reload loop.
      }

      if (!shouldReload) {
        throw error;
      }

      window.location.reload();
      return await new Promise<never>(() => undefined);
    }
  });
