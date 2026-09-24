import type { MapplsMap, MapPoint } from "./types";

/**
 * Mappls documents trackingCall() as a low-frequency API. Feeding it the
 * requestAnimationFrame playback stream would create unsupported plugin load,
 * so the adapter intentionally coalesces updates below this boundary.
 */
export const MAPPLS_ADVANCED_TRACKING_MIN_INTERVAL_MS = 3_000;

/**
 * The mappls-web-maps wrapper forwards only tracking(props, callback) and
 * swallows synchronous throws, so a failed plugin never reports back. Without
 * this bound the adapter would wait in its initializing state indefinitely.
 */
export const MAPPLS_ADVANCED_TRACKING_INIT_TIMEOUT_MS = 10_000;

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
  let initTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingPoint: MapplsAdvancedTrackingPoint | null = null;
  let trailingTimer: ReturnType<typeof setTimeout> | null = null;

  const clearInitTimer = () => {
    if (initTimer != null) clearTimeout(initTimer);
    initTimer = null;
  };

  const clearPending = () => {
    if (trailingTimer != null) clearTimeout(trailingTimer);
    trailingTimer = null;
    pendingPoint = null;
  };

  const fail = (reason: unknown, fallback: string) => {
    if (hasFailed || disposed) return;
    hasFailed = true;
    clearInitTimer();
    clearPending();
    if (controller) hidePluginVisuals(controller);
    controller = null;
    onFailure?.(toError(reason, fallback));
  };

  const submit = (point: MapplsAdvancedTrackingPoint, submittedAt: number) => {
    if (!controller) return false;
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
      lastSubmittedAt = submittedAt;
      return true;
    } catch (error) {
      fail(error, "Mappls tracking plugin update failed.");
      return false;
    }
  };

  // Trailing edge of the throttle: the newest point received during a cooldown
  // is delivered once the cooldown ends, so the plugin never rests on a stale
  // position after the technician's updates stop.
  const flushPending = () => {
    trailingTimer = null;
    if (!pendingPoint || !controller || disposed || hasFailed) {
      pendingPoint = null;
      return;
    }
    const currentTime = now();
    if (lastSubmittedAt != null && currentTime - lastSubmittedAt < MAPPLS_ADVANCED_TRACKING_MIN_INTERVAL_MS) {
      trailingTimer = setTimeout(
        flushPending,
        MAPPLS_ADVANCED_TRACKING_MIN_INTERVAL_MS - (currentTime - lastSubmittedAt),
      );
      return;
    }
    const point = pendingPoint;
    pendingPoint = null;
    submit(point, currentTime);
  };

  const activate = (candidate: unknown) => {
    if (!isTrackingController(candidate)) {
      fail(candidate, "Mappls tracking plugin did not return a tracking controller.");
      return;
    }
    // A success that arrives after dispose or after the initialization timeout
    // must not leave plugin visuals beside the restored custom marker.
    if (disposed || hasFailed) {
      hidePluginVisuals(candidate);
      return;
    }
    if (controller) return;
    clearInitTimer();
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
      if (disposed || hasFailed || controller || initTimer != null) return;
      initTimer = setTimeout(() => {
        initTimer = null;
        if (!controller) fail(undefined, "Mappls tracking plugin initialization timed out.");
      }, MAPPLS_ADVANCED_TRACKING_INIT_TIMEOUT_MS);
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
        // Only the newest point is kept; intermediate points are superseded.
        pendingPoint = point;
        if (trailingTimer == null) {
          trailingTimer = setTimeout(
            flushPending,
            MAPPLS_ADVANCED_TRACKING_MIN_INTERVAL_MS - (currentTime - lastSubmittedAt),
          );
        }
        return false;
      }
      clearPending();
      return submit(point, currentTime);
    },

    dispose() {
      disposed = true;
      clearInitTimer();
      clearPending();
      if (controller) hidePluginVisuals(controller);
      controller = null;
      lastSubmittedAt = null;
    },

    isActive() {
      return Boolean(controller) && !disposed && !hasFailed;
    },
  };
}
