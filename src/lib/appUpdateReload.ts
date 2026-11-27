// Moves the website onto a newly deployed version without interrupting anyone.
//
// The service worker (vite-plugin-pwa, autoUpdate + skipWaiting + clientsClaim)
// installs a new version in the background and takes control of the page, but
// the page keeps running the old JavaScript until it reloads. This decides when
// that reload happens:
//   - new version arrives within the first seconds of opening the site: reload now;
//   - later, while someone is using the page (a request form, live tracking):
//     wait until the tab is in the background, then reload;
//   - tab already in the background: reload now.
// A tab left open checks for a new version when the person returns to it, at
// most every 30 minutes. The very first install never reloads, and two reloads
// within 30 seconds are refused so a broken deploy cannot cause a reload loop.

const RELOAD_MARK = 'resqnow:app-update-reload-at';

export interface AppUpdateReloadOptions {
  serviceWorker?: ServiceWorkerContainer;
  document?: Document;
  storage?: Pick<Storage, 'getItem' | 'setItem'>;
  reload?: () => void;
  now?: () => number;
  /** How long after opening the page an update may reload immediately. */
  openingWindowMs?: number;
  /** Minimum time between update checks when a tab becomes visible again. */
  checkIntervalMs?: number;
  /** Two reloads closer together than this are refused. */
  loopGuardMs?: number;
}

function defaultStorage(): Pick<Storage, 'getItem' | 'setItem'> | undefined {
  try { return window.sessionStorage; } catch { return undefined; }
}

export function startAppUpdateReload(options: AppUpdateReloadOptions = {}): () => void {
  const hasBrowser = typeof navigator !== 'undefined' && typeof document !== 'undefined';
  const container = 'serviceWorker' in options
    ? options.serviceWorker
    : (hasBrowser && 'serviceWorker' in navigator ? navigator.serviceWorker : undefined);
  const doc = options.document ?? (hasBrowser ? document : undefined);
  if (!container || !doc) return () => {};

  const storage = options.storage ?? defaultStorage();
  const reloadPage = options.reload ?? (() => window.location.reload());
  const now = options.now ?? (() => Date.now());
  const openingWindowMs = options.openingWindowMs ?? 10_000;
  const checkIntervalMs = options.checkIntervalMs ?? 30 * 60_000;
  const loopGuardMs = options.loopGuardMs ?? 30_000;

  const openedAt = now();
  let lastCheckAt = openedAt;
  let hadController = Boolean(container.controller);
  let reloadWhenHidden = false;

  const reload = () => {
    reloadWhenHidden = false;
    try {
      const last = Number(storage?.getItem(RELOAD_MARK) || 0);
      if (last && now() - last < loopGuardMs) return;
      storage?.setItem(RELOAD_MARK, String(now()));
    } catch {
      // Storage unavailable (private mode): still reload; the loop guard is best-effort.
    }
    reloadPage();
  };

  const onControllerChange = () => {
    // First install: the page was not controlled before, so it already runs the latest code.
    if (!hadController) { hadController = Boolean(container.controller); return; }
    if (now() - openedAt <= openingWindowMs || doc.visibilityState === 'hidden') reload();
    else reloadWhenHidden = true;
  };

  const onVisibilityChange = () => {
    if (doc.visibilityState === 'hidden') {
      if (reloadWhenHidden) reload();
      return;
    }
    if (now() - lastCheckAt < checkIntervalMs) return;
    lastCheckAt = now();
    Promise.resolve()
      .then(() => container.getRegistration())
      .then((registration) => registration?.update())
      .catch(() => { /* offline or not registered yet: the next return will try again */ });
  };

  container.addEventListener('controllerchange', onControllerChange);
  doc.addEventListener('visibilitychange', onVisibilityChange);
  return () => {
    container.removeEventListener('controllerchange', onControllerChange);
    doc.removeEventListener('visibilitychange', onVisibilityChange);
  };
}
