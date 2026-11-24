import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const native = vi.hoisted(() => ({
  platform: 'android', installed: true,
  getAvailability: vi.fn(), create: vi.fn(), destroy: vi.fn(), addListener: vi.fn(), searchPlaces: vi.fn(), cancelSearch: vi.fn(),
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { getPlatform: () => native.platform, isPluginAvailable: () => native.installed },
  registerPlugin: () => native,
}));
import { nativeMapBridge, NativeMapError } from './nativeMapBridge';

describe('native Mappls bridge', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('blocks map and search native operations in an explicitly map-disabled APK', async () => {
    vi.stubEnv('VITE_NATIVE_MAPPLS_ENABLED', 'false');
    expect(await nativeMapBridge.getAvailability()).toMatchObject({available: false, code: 'DISABLED'});
    await expect(nativeMapBridge.create({mapId: 'map', generation: 1, ariaLabel: 'Map'})).rejects.toMatchObject({code: 'DISABLED'});
    await expect(nativeMapBridge.searchPlaces({requestId: 'query', query: 'Garage', limit: 3})).rejects.toMatchObject({code: 'DISABLED'});
    expect(native.getAvailability).not.toHaveBeenCalled(); expect(native.create).not.toHaveBeenCalled(); expect(native.searchPlaces).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks(); native.platform = 'android'; native.installed = true;
    native.getAvailability.mockResolvedValue({ available: true, sdkVersion: '9.0.4', authentication: 'unverified' });
  });
  it('never invokes native code on the website', async () => {
    native.platform = 'web';
    expect(await nativeMapBridge.getAvailability()).toMatchObject({ available: false, code: 'PLATFORM_UNAVAILABLE' });
    await expect(nativeMapBridge.create({ mapId: 'map', generation: 1, ariaLabel: 'Map' })).rejects.toMatchObject({ code: 'PLATFORM_UNAVAILABLE' });
    expect(native.create).not.toHaveBeenCalled();
  });
  it('reports a missing plugin explicitly', async () => {
    native.installed = false;
    expect(await nativeMapBridge.getAvailability()).toMatchObject({ code: 'PLUGIN_UNAVAILABLE' });
  });
  it('preserves authentication errors without falling back to web', async () => {
    native.create.mockRejectedValue({ code: 'AUTH_CONFIG', message: 'Missing configuration' });
    await expect(nativeMapBridge.create({ mapId: 'map', generation: 1, ariaLabel: 'Map' })).rejects.toBeInstanceOf(NativeMapError);
    await expect(nativeMapBridge.create({ mapId: 'map', generation: 1, ariaLabel: 'Map' })).rejects.toMatchObject({ code: 'AUTH_CONFIG' });
  });
  it('redacts unexpected native error messages', async () => {
    native.create.mockRejectedValue(new Error('private SDK URL'));
    await expect(nativeMapBridge.create({ mapId: 'map', generation: 1, ariaLabel: 'Map' })).rejects.toMatchObject({ code: 'SDK_INIT', message: 'Native map operation failed (SDK_INIT).' });
  });
  it('does not mistake configuration presence for license validation', async () => {
    expect(await nativeMapBridge.getAvailability()).toMatchObject({ authentication: 'unverified' });
  });
  it('preserves native search ownership and cancellation errors', async () => {
    native.searchPlaces.mockRejectedValue({ code: 'CANCELLED' });
    await expect(nativeMapBridge.searchPlaces({ requestId: 'query-1', query: 'Garage' })).rejects.toMatchObject({ code: 'CANCELLED' });
    native.cancelSearch.mockResolvedValue(undefined);
    await nativeMapBridge.cancelSearch({ requestId: 'query-1' });
    expect(native.cancelSearch).toHaveBeenCalledWith({ requestId: 'query-1' });
  });
});
