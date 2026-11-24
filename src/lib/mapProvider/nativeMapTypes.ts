import type { PluginListenerHandle } from '@capacitor/core';
import type { MapCameraSpec, MapCircleSpec, MapPoint, MapPolylineSpec } from './types';

export type NativeMapErrorCode = 'DISABLED' | 'PLATFORM_UNAVAILABLE' | 'PLUGIN_UNAVAILABLE' | 'AUTH_CONFIG' |
  'CERTIFICATE' | 'LICENSE' | 'SDK_INIT' | 'STYLE_LOAD' | 'RENDER' | 'TIMEOUT' |
  'INVALID_ARGUMENT' | 'STALE_HANDLE' | 'NOT_READY' | 'LIMIT' | 'UNSUPPORTED' | 'UNTRUSTED_ORIGIN' |
  'CANCELLED' | 'SEARCH_FAILED' | 'SEARCH_COORDINATES';
export type NativeMapOwner = { mapId: string; generation: number };
/** All rectangles use layout CSS pixels (getBoundingClientRect), not device pixels. */
export type NativeMapRect = { left: number; top: number; width: number; height: number };
export type NativeMapViewport = NativeMapOwner & {
  layoutRevision: number; frame: NativeMapRect; clip: NativeMapRect;
  visualViewport: { width: number; height: number; offsetLeft: number; offsetTop: number; scale: number };
  excludedRects: NativeMapRect[]; cornerRadius: number; visible: boolean; interactive: boolean;
  stackOrder?: number;
};
export type NativeMapMarker = {
  id: string; position: MapPoint;
  visual: {
    kind: 'user' | 'technician' | 'pickup' | 'drop' | 'sos' | 'shop' | 'ev' | 'fuel' | 'dot';
    vehicle?: 'bike' | 'tow'; label?: string; selected?: boolean; color?: string;
    accessibleLabel: string; iconKey?: string;
  };
  draggable?: boolean; heading?: number;
  zIndex?: number; anchor?: 'center' | 'bottom'; offset?: [number, number]; width?: number; height?: number;
};
export type NativeMapScene = NativeMapOwner & {
  revision: number; markers: NativeMapMarker[]; polylines: MapPolylineSpec[]; circles: MapCircleSpec[];
};
export type NativeMapAvailability = {
  available: boolean; code?: NativeMapErrorCode; sdkVersion?: string;
  /** A configured SDK is not proof that Mappls accepted its license. Ready is per-map. */
  authentication?: 'missing' | 'unverified';
  capabilities?: { nativeSearch: boolean; markers: boolean; polylines: boolean; circles: boolean };
};
export type NativeMapEvent = NativeMapOwner & { eventSequence: number } & (
  { type: 'ready'; capabilities: { markers: boolean; polylines: boolean; circles: boolean } } |
  { type: 'error'; code: NativeMapErrorCode; message: string; retryable: boolean } |
  { type: 'mapClick' | 'mapLongClick'; position: MapPoint } |
  { type: 'markerClick'; markerId: string } |
  { type: 'markerDragEnd'; markerId: string; position: MapPoint } |
  { type: 'interaction'; reason: 'gesture' } |
  { type: 'cameraIdle'; center: MapPoint; zoom: number; bearing: number; pitch: number; cameraRevision: number }
);
export interface NativeMapPlugin {
  getAvailability(): Promise<NativeMapAvailability>;
  create(options: NativeMapOwner & { ariaLabel: string; initialCamera?: MapCameraSpec }): Promise<NativeMapOwner>;
  destroy(options: NativeMapOwner): Promise<void>;
  setViewport(options: NativeMapViewport): Promise<void>;
  setOverlays(options: NativeMapScene): Promise<void>;
  updatePositions(options: NativeMapOwner & { frameSequence: number; points: { id: string; position: MapPoint; heading?: number }[] }): Promise<void>;
  setCamera(options: NativeMapOwner & { camera: MapCameraSpec }): Promise<void>;
  setVisibility(options: NativeMapOwner & { visible: boolean; interactive: boolean }): Promise<void>;
  searchPlaces(options: { requestId: string; query: string; limit?: number; bias?: MapPoint }): Promise<{
    requestId: string; results: import('./mapplsSdk').MapplsPlaceSearchResult[];
  }>;
  cancelSearch(options: { requestId: string }): Promise<void>;
  addListener(event: 'mapEvent', listener: (event: NativeMapEvent) => void): Promise<PluginListenerHandle>;
}
