import type { PluginListenerHandle } from '@capacitor/core';
export interface AndroidRelease {
  schemaVersion:number; channel:string; applicationId:string; versionCode:number; versionName:string;
  minSdk:number; targetSdk:number; sizeBytes:number; sha256:string; signingCertificateSha256:string;
  apkUrl:string; sourceCommit:string; publishedAt:string;
}
export type ReleaseOffer={state:'disabled'}|{state:'ready';release:AndroidRelease};
export type UpdatePhase='idle'|'queued'|'downloading'|'verifying'|'ready'|'permission-required'|'installing'|'failed'|'cancelled';
export interface UpdateSnapshot {phase:UpdatePhase;enabled:boolean;installedVersionCode:number;installedVersionName?:string;sdkVersion:number;release?:AndroidRelease;bytesDownloaded:number;errorCode?:string}
export interface AppUpdater {
  getState():Promise<UpdateSnapshot>;
  scheduleDownload(options:{release:AndroidRelease;allowMetered:boolean}):Promise<UpdateSnapshot>;
  cancelDownload():Promise<UpdateSnapshot>;
  cancelInstallPreparation():Promise<void>;
  requestInstall():Promise<UpdateSnapshot>;
  openInstallPermissionSettings():Promise<void>;
  addListener(event:'updateStateChange',callback:(state:UpdateSnapshot)=>void):Promise<PluginListenerHandle>;
}
