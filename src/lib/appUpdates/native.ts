import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AppUpdater } from './types';
const bridge=registerPlugin<AppUpdater>('AppUpdater');
export function getAppUpdater():AppUpdater|null{
  return import.meta.env.VITE_APP_UPDATES_ENABLED==='true'&&Capacitor.isNativePlatform()&&Capacitor.getPlatform()==='android'&&Capacitor.isPluginAvailable('AppUpdater')?bridge:null;
}
