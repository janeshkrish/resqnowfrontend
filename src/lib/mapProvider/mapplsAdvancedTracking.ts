import type { MapplsMap, MapPoint } from "./types";

/**
 * Mappls documents trackingCall() as a low-frequency API. Feeding it the
 * requestAnimationFrame playback stream would create unsupported plugin load,
 * so the adapter intentionally coalesces updates below this boundary.
 */
export const MAPPLS_ADVANCED_TRACKING_MIN_INTERVAL_MS = 3_000;

export type MapplsAdvancedTrackingPoint = MapPoint & {
  speed?: number | null;
  heading?: number | null;
  recordedAtMs?: number | null;
};

export type MapplsTrackingController = {
  trackingCall?: (options: Record<string, unknown>) => unknown;
  settrackfit?: (enabled: boolean) => unknown;
  setLineVisible?: (enabled: boolean) => unknown;
  setCcpVisible?: (enabled: boolean) => unknown;
  removeCurveLine?: () => unknown;
};

export type MapplsTrackingPlugin = {
  tracking: (
    options: Record<string, unknown>,
    onSuccess?: (controller: unknown) => void,
    onFailure?: (error: unknown) => void,
  ) => unknown;
};

type AdapterOptions = {
  map: MapplsMap;
  destination: MapPoint;
  plugin: MapplsTrackingPlugin;
  now?: () => number;
  onReady?: () => void;
  onFailure?: (error: Error) => void;
};

export type MapplsAdvancedTrackingAdapter = {
  initialize: (point: MapplsAdvancedTrackingPoint) => void;
  update: (point: MapplsAdvancedTrackingPoint) => boolean;
  dispose: () => void;
  isActive: () => boolean;
};

function toGeoPosition(point: MapPoint) {
  return `${point.lat},${point.lng}`;
}

function toError(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason : new Error(fallback);
}

function isTrackingController(value: unknown): value is MapplsTrackingController {
  return Boolean(value)
    && typeof value === "object"
    && typeof (value as MapplsTrackingController).trackingCall === "function";
}

function isPromiseLike(value: unknown): value is Promise<unknown> {
  return Boolean(value)
    && typeof value === "object"
    && typeof (value as Promise<unknown>).then === "function";
}

function hidePluginVisuals(controller: MapplsTrackingController) {
  try { controller.setCcpVisible?.(false); } catch { /* Mappls teardown continues. */ }
  try { controller.setLineVisible?.(false); } catch { /* Mappls teardown continues. */ }
  try { controller.removeCurveLine?.(); } catch { /* Mappls teardown continues. */ }
}

export function createMapplsAdvancedTrackingAdapter({
  map,
  destination,
  plugin,
  now = () => Date.now(),
  onReady,
  onFailure,
}: AdapterOptions): MapplsAdvancedTrackingAdapter {
  let controller: MapplsTrackingController | null = null;
  let hasFailed = false;
  let disposed = false;
  let lastSubmittedAt: number | null = null;

  const fail = (reason: unknown, fallback: string) => {
    if (hasFailed || disposed) return;
    hasFailed = true;
    if (controller) hidePluginVisuals(controller);
    controller = null;
    onFailure?.(toError(reason, fallback));
  };

  const activate = (candidate: unknown) => {
    if (!isTrackingController(candidate)) {
      fail(candidate, "Mappls tracking plugin did not return a tracking controller.");
      return;
    }
    if (disposed) {
      hidePluginVisuals(candidate);
      return;
    }
    if (hasFailed || controller) return;
    controller = candidate;
    try {
      // The tracking plugin otherwise owns fitBounds by default. The existing
      // LiveTrackingMap camera policy remains the sole camera controller.
      controller.settrackfit?.(false);
      controller.setLineVisible?.(false);
      onReady?.();
    } catch (error) {
      fail(error, "Mappls tracking plugin could not be configured.");
    }
  };

  return {
    initialize(point) {
      if (disposed || hasFailed || controller) return;
      try {
        const returned = plugin.tracking(
          {
            map,
            start: { geoposition: toGeoPosition(point) },
            end: { geoposition: toGeoPosition(destination) },
            fitBounds: false,
            curveLineFitbounds: false,
            connector: false,
            connectorVisible: false,
            curveLine: false,
            start_icon: false,
            end_icon: false,
            strokeOpacity: 0,
          },
          activate,
          (error: unknown) => fail(error, "Mappls tracking plugin initialization failed."),
        );
        // The public SDK examples retain the return value while the API docs
        // expose the controller through the success callback. Supporting both
        // keeps the adapter compatible without using private SDK fields.
        if (isTrackingController(returned)) activate(returned);
      } catch (error) {
        fail(error, "Mappls tracking plugin initialization failed.");
      }
    },

    update(point) {
      if (!controller || disposed || hasFailed) return false;
      const currentTime = now();
      if (
        lastSubmittedAt != null
        && currentTime - lastSubmittedAt < MAPPLS_ADVANCED_TRACKING_MIN_INTERVAL_MS
      ) {
        return false;
      }
      try {
        const trackingResult = controller.trackingCall?.({
          location: [point.lng, point.lat],
          reRoute: false,
          // Mappls accepts a documented boolean toggle here; it does not
          // accept ResQNow's numeric bearing as a public plugin argument.
          heading: point.heading != null && Number.isFinite(Number(point.heading)),
          mapCenter: false,
          fitBounds: false,
          polylineRefresh: false,
          etaRefresh: false,
          delay: MAPPLS_ADVANCED_TRACKING_MIN_INTERVAL_MS,
        });
        if (isPromiseLike(trackingResult)) {
          void trackingResult.catch((error) => fail(error, "Mappls tracking plugin update failed."));
        }
        lastSubmittedAt = currentTime;
        return true;
      } catch (error) {
        fail(error, "Mappls tracking plugin update failed.");
        return false;
      }
    },

    dispose() {
      disposed = true;
      if (controller) hidePluginVisuals(controller);
      controller = null;
      lastSubmittedAt = null;
    },

    isActive() {
      return Boolean(controller) && !disposed && !hasFailed;
    },
  };
}
