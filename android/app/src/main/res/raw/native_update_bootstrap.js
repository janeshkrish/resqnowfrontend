(async function () {
  // Native injection runs even if a previous APK's worker served an old index.html.
  if (!['http://localhost', 'https://localhost'].includes(location.origin)) return;
  const version = '__NATIVE_VERSION__';
  if (window.__resqnowNativeCode?.version === version) return;
  const status = window.__resqnowNativeCode = { version, phase: 'pending' };
  const key = 'resqnow:native-code-reload';
  try {
    if (sessionStorage.getItem(key) === version) { status.phase = 'done'; return; }
    let changed = false;
    if (navigator.serviceWorker) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        const worker = registration.active || registration.waiting || registration.installing;
        if (worker && worker.scriptURL === `${location.origin}/sw.js`) {
          if (!await registration.unregister()) throw new Error('Could not unregister old code');
          changed = true;
        }
      }
    }
    if (typeof caches !== 'undefined') {
      for (const name of await caches.keys()) {
        if (name.startsWith('workbox-precache-') || ['resqnow-static-cache','resqnow-pages-cache'].includes(name)) {
          await caches.delete(name); changed = true;
        }
      }
    }
    if (changed) { sessionStorage.setItem(key, version); status.phase = 'reloading'; location.reload(); }
    else status.phase = 'done';
  } catch { status.phase = 'failed'; }
})();
