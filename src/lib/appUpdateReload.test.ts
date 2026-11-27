import { describe, expect, it, vi } from 'vitest';
import { startAppUpdateReload } from './appUpdateReload';

// A fake browser: a service worker container whose controller can change,
// a document whose visibility can change, a clock, and session storage.
function setup({ controller = { id: 'v1' } as object | null, now = 0 } = {}) {
  const clock = { now };
  const swListeners: Record<string, Array<() => void>> = {};
  const docListeners: Record<string, Array<() => void>> = {};
  const update = vi.fn(async () => {});
  const container = {
    controller,
    addEventListener: (type: string, fn: () => void) => { (swListeners[type] ||= []).push(fn); },
    removeEventListener: (type: string, fn: () => void) => { swListeners[type] = (swListeners[type] || []).filter((f) => f !== fn); },
    getRegistration: vi.fn(async () => ({ update })),
  };
  const doc = {
    visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (type: string, fn: () => void) => { (docListeners[type] ||= []).push(fn); },
    removeEventListener: (type: string, fn: () => void) => { docListeners[type] = (docListeners[type] || []).filter((f) => f !== fn); },
  };
  const store = new Map<string, string>();
  const storage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
  };
  const reload = vi.fn();
  const stop = startAppUpdateReload({
    serviceWorker: container as unknown as ServiceWorkerContainer,
    document: doc as unknown as Document,
    storage,
    reload,
    now: () => clock.now,
  });
  const newVersionTakesOver = () => {
    container.controller = { id: `v${Math.random()}` };
    (swListeners.controllerchange || []).forEach((fn) => fn());
  };
  const setVisibility = (state: DocumentVisibilityState) => {
    doc.visibilityState = state;
    (docListeners.visibilitychange || []).forEach((fn) => fn());
  };
  return { clock, reload, update, container, store, stop, newVersionTakesOver, setVisibility };
}

describe('automatic reload when a new website version is deployed', () => {
  it('reloads straight away when the new version arrives while the page is just opening', () => {
    const t = setup();
    t.clock.now = 4_000;
    t.newVersionTakesOver();
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads on the very first install, when there was no previous version', () => {
    const t = setup({ controller: null });
    t.newVersionTakesOver();
    t.setVisibility('hidden');
    expect(t.reload).not.toHaveBeenCalled();
  });

  it('does not interrupt someone using the page: waits until the tab is in the background', () => {
    const t = setup();
    t.clock.now = 60_000;
    t.newVersionTakesOver();
    expect(t.reload).not.toHaveBeenCalled();
    t.setVisibility('visible');
    expect(t.reload).not.toHaveBeenCalled();
    t.setVisibility('hidden');
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it('reloads at once if the new version arrives while the tab is already in the background', () => {
    const t = setup();
    t.clock.now = 60_000;
    t.setVisibility('hidden');
    t.newVersionTakesOver();
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it('after the first install, a later deploy in the same visit is picked up', () => {
    const t = setup({ controller: null });
    t.newVersionTakesOver();
    t.clock.now = 60_000;
    t.newVersionTakesOver();
    t.setVisibility('hidden');
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it('never reloads twice in a row (no reload loops)', () => {
    const t = setup();
    t.clock.now = 1_000;
    t.newVersionTakesOver();
    expect(t.reload).toHaveBeenCalledTimes(1);
    // The reloaded page starts again with the same session storage and sees another takeover.
    const again = setup();
    for (const [k, v] of t.store) again.store.set(k, v);
    again.clock.now = 5_000;
    again.newVersionTakesOver();
    expect(again.reload).not.toHaveBeenCalled();
  });

  it('checks for a new version when someone returns to a tab left open, at most every 30 minutes', async () => {
    const t = setup();
    t.clock.now = 10 * 60_000;
    t.setVisibility('hidden');
    t.setVisibility('visible');
    await Promise.resolve();
    expect(t.update).not.toHaveBeenCalled();
    t.clock.now = 31 * 60_000;
    t.setVisibility('hidden');
    t.setVisibility('visible');
    await vi.waitFor(() => expect(t.update).toHaveBeenCalledTimes(1));
    t.clock.now = 40 * 60_000;
    t.setVisibility('hidden');
    t.setVisibility('visible');
    await Promise.resolve();
    expect(t.update).toHaveBeenCalledTimes(1);
  });

  it('stops listening when stopped', () => {
    const t = setup();
    t.stop();
    t.clock.now = 1_000;
    t.newVersionTakesOver();
    expect(t.reload).not.toHaveBeenCalled();
  });

  it('does nothing in browsers without service workers', () => {
    expect(() => startAppUpdateReload({ serviceWorker: undefined })).not.toThrow();
  });
});
