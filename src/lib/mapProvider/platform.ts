import { Capacitor } from '@capacitor/core';

/** Capacitor's runtime identity, never user-agent/mobile-browser detection. */
export function usesNativeMap(): boolean { return Capacitor.getPlatform() === 'android'; }
