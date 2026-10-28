import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PluginListenerHandle } from '@capacitor/core';
import { useFCM } from './useFCM';

const native = vi.hoisted(() => ({
  requestPermissions: vi.fn(), register: vi.fn(), addListener: vi.fn(), removeAllListeners: vi.fn(async () => {}),
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: native }));
vi.mock('@/lib/firebase', () => ({ requestForToken: vi.fn(), showSystemNotification: vi.fn(), subscribeToForegroundMessages: vi.fn() }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/lib/appNavigation', () => ({ navigateWithinApp: vi.fn() }));

describe('native push listener ownership', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    native.requestPermissions.mockResolvedValue({ receive: 'granted' });
    native.register.mockResolvedValue(undefined);
  });
  afterEach(() => { vi.useRealTimers(); });

  it('removes resolved Capacitor handles on logout instead of invoking remove on a promise', async () => {
    const remove = vi.fn(async () => {});
    native.addListener.mockImplementation(async () => ({ remove }));
    const hook = renderHook(() => useFCM({ isUserAuthenticated: true, isTechnicianAuthenticated: false }));
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(native.addListener).toHaveBeenCalledTimes(4);
    expect(() => hook.unmount()).not.toThrow();
    await act(async () => {});
    expect(remove).toHaveBeenCalledTimes(4);
  });

  it('removes each handle that resolves after the effect has already been cleaned up', async () => {
    const pending: Array<(handle: PluginListenerHandle) => void> = [];
    const remove = vi.fn(async () => {});
    native.addListener.mockImplementation(() => new Promise<PluginListenerHandle>(resolve => pending.push(resolve)));
    const hook = renderHook(() => useFCM({ isUserAuthenticated: false, isTechnicianAuthenticated: true }));
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(pending).toHaveLength(4);
    expect(() => hook.unmount()).not.toThrow();
    await act(async () => { pending.forEach(resolve => resolve({ remove })); });
    expect(remove).toHaveBeenCalledTimes(4);
  });

  it('does not register native push while both roles are signed out', async () => {
    const hook = renderHook(() => useFCM({ isUserAuthenticated: false, isTechnicianAuthenticated: false }));
    await act(async () => { await vi.advanceTimersByTimeAsync(100); });
    expect(native.requestPermissions).not.toHaveBeenCalled();
    expect(native.addListener).not.toHaveBeenCalled();
    hook.unmount();
  });
});
