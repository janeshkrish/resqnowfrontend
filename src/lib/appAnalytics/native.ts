import {Capacitor,registerPlugin} from '@capacitor/core';
import type {NativeIdentity,NativeInstallation} from './types';
export const ANALYTICS_POLICY_VERSION='2026-10-27';
export const ANALYTICS_CONSENT_EVENT='resqnow:app-analytics-consent';
interface Plugin extends NativeInstallation {setConsent(options:{granted:boolean;policyVersion:string}):Promise<NativeIdentity>}
const plugin=registerPlugin<Plugin>('AppInstallation');
export const getNativeInstallation=():Plugin|null=>Capacitor.isNativePlatform()&&Capacitor.isPluginAvailable('AppInstallation')?plugin:null;
