export type MapPoint = { lat: number; lng: number };

export type MapPadding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export interface MapplsLayer {
  remove?: () => void;
  setData?: (data: unknown) => void;
  setOptions?: (options: Record<string, unknown>) => void;
}

export interface MapplsMarker extends MapplsLayer {
  addListener?: (event: string, handler: () => void) => void;
  setPosition?: (position: MapPoint | [number, number]) => void;
  setLngLat?: (position: [number, number]) => void;
}

export interface MapplsMap {
  loaded?: () => boolean;
  on(event: string, handler: () => void): void;
  off(event: string, handler: () => void): void;
  fitBounds(bounds: unknown, options?: Record<string, unknown>): void;
  jumpTo(options: Record<string, unknown>): void;
  resize(): void;
  remove(): void;
}

export interface MapplsRuntime {
  Map(options: { id: string; properties: Record<string, unknown> }): MapplsMap;
  Marker(options: Record<string, unknown>): MapplsMarker;
  Polyline(options: Record<string, unknown>): MapplsLayer;
  Circle(options: Record<string, unknown>): MapplsLayer;
  removeLayer(input: { map: MapplsMap; layer: MapplsLayer }): void;
}

export type MapMarkerSpec = {
  onClick?: () => void;
  id: string;
  position: MapPoint;
  html: string | HTMLElement;
  anchor?: "center" | "bottom";
  zIndex?: number;
  heading?: number | null;
  width?: number;
  height?: number;
  offset?: [number, number];
};

export type MapPolylineSpec = {
  id: string;
  points: MapPoint[];
  color: string;
  width: number;
  opacity: number;
};

export type MapCircleSpec = {
  id: string;
  center: MapPoint;
  radiusMeters: number;
  fillColor: string;
  fillOpacity: number;
};

export type MapCameraSpec =
  | {
      mode: "fit";
      points: MapPoint[];
      padding: MapPadding;
      maxZoom: number;
      revision: number;
    }
  | {
      mode: "follow";
      center: MapPoint;
      zoom: number;
      bearing?: number;
      pitch?: number;
      revision: number;
    };

export type MapProviderErrorCode =
  | "missing_key"
  | "sdk_load_failed"
  | "map_failed";

export class MapProviderError extends Error {
  constructor(
    public readonly code: MapProviderErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "MapProviderError";
  }
}
