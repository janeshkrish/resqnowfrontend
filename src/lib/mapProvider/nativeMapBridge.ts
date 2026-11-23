import { Capacitor, registerPlugin } from '@capacitor/core';
import type { NativeMapErrorCode, NativeMapPlugin } from './nativeMapTypes';

const plugin = registerPlugin<NativeMapPlugin>('ResqnowMappls');
const codes = new Set<NativeMapErrorCode>(['PLATFORM_UNAVAILABLE', 'PLUGIN_UNAVAILABLE', 'AUTH_CONFIG',
  'CERTIFICATE', 'LICENSE', 'SDK_INIT', 'STYLE_LOAD', 'RENDER', 'TIMEOUT', 'INVALID_ARGUMENT',
  'STALE_HANDLE', 'NOT_READY', 'LIMIT', 'UNSUPPORTED', 'UNTRUSTED_ORIGIN', 'CANCELLED', 'SEARCH_FAILED', 'SEARCH_COORDINATES']);

export class NativeMapError extends Error {
  constructor(public readonly code: NativeMapErrorCode) {
    super(`Native map operation failed (${code}).`);
    this.name = 'NativeMapError';
  }
}
function unavailable(): NativeMapErrorCode | undefined {
  if (Capacitor.getPlatform() !== 'android') return 'PLATFORM_UNAVAILABLE';
  if (!Capacitor.isPluginAvailable('ResqnowMappls')) return 'PLUGIN_UNAVAILABLE';
}
async function invoke<T>(action: () => Promise<T>): Promise<T> {
  const code = unavailable();
  if (code) throw new NativeMapError(code);
  try { return await action(); }
  catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    throw new NativeMapError(codes.has(code as NativeMapErrorCode) ? code as NativeMapErrorCode : 'SDK_INIT');
  }
}
/** Infrastructure only. No web implementation or Android fallback is registered. */
export const nativeMapBridge: NativeMapPlugin = {
  async getAvailability() {
    const code = unavailable();
    return code ? { available: false, code } : invoke(() => plugin.getAvailability());
  },
  create: options => invoke(() => plugin.create(options)),
  destroy: options => invoke(() => plugin.destroy(options)),
  setViewport: options => invoke(() => plugin.setViewport(options)),
  setOverlays: options => invoke(() => plugin.setOverlays(options)),
  updatePositions: options => invoke(() => plugin.updatePositions(options)),
  setCamera: options => invoke(() => plugin.setCamera(options)),
  setVisibility: options => invoke(() => plugin.setVisibility(options)),
  searchPlaces: options => invoke(() => plugin.searchPlaces(options)),
  cancelSearch: options => invoke(() => plugin.cancelSearch(options)),
  addListener: (event, listener) => invoke(() => plugin.addListener(event, listener)),
};
