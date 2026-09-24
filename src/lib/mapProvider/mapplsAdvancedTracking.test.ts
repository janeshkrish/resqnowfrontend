import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mappls_plugin } from "mappls-web-maps";

import {
  MAPPLS_ADVANCED_TRACKING_INIT_TIMEOUT_MS,
  MAPPLS_ADVANCED_TRACKING_MIN_INTERVAL_MS,
  createMapplsAdvancedTrackingAdapter,
  type MapplsAdvancedTrackingPoint,
} from "./mapplsAdvancedTracking";

const map = {
  on: vi.fn(),
  off: vi.fn(),
  fitBounds: vi.fn(),
  jumpTo: vi.fn(),
  resize: vi.fn(),
  remove: vi.fn(),
};

const start = { lat: 12.9716, lng: 77.5946 };
const destination = { lat: 12.9352, lng: 77.6245 };

describe("Mappls advanced tracking adapter", () => {
  it("initializes a no-camera, no-route plugin renderer from the existing technician position", () => {
    const controller = {
      trackingCall: vi.fn(),
      settrackfit: vi.fn(),
      setLineVisible: vi.fn(),
      setCcpVisible: vi.fn(),
      removeCurveLine: vi.fn(),
    };
    const plugin = {
      tracking: vi.fn((_options, onReady) => {
        onReady(controller);
        return controller;
      }),
    };
    const onReady = vi.fn();
    const adapter = createMapplsAdvancedTrackingAdapter({
      map,
      destination,
      plugin,
      onReady,
    });

    adapter.initialize({ ...start, speed: 8, heading: 92, recordedAtMs: 1_000 });

    expect(onReady).toHaveBeenCalledOnce();
    expect(plugin.tracking).toHaveBeenCalledWith(
      expect.objectContaining({
        map,
        start: { geoposition: "12.9716,77.5946" },
        end: { geoposition: "12.9352,77.6245" },
        fitBounds: false,
        connector: false,
        connectorVisible: false,
        curveLine: false,
        start_icon: false,
        end_icon: false,
        strokeOpacity: 0,
      }),
      expect.any(Function),
      expect.any(Function),
    );
    expect(controller.settrackfit).toHaveBeenCalledWith(false);
    expect(controller.setLineVisible).toHaveBeenCalledWith(false);
  });

  it("delivers the existing live coordinate to the plugin at most once every three seconds", () => {
    let now = 0;
    const controller = {
      trackingCall: vi.fn(),
      settrackfit: vi.fn(),
      setLineVisible: vi.fn(),
      setCcpVisible: vi.fn(),
      removeCurveLine: vi.fn(),
    };
    const plugin = {
      tracking: vi.fn((_options, onReady) => onReady(controller)),
    };
    const adapter = createMapplsAdvancedTrackingAdapter({
      map,
      destination,
      plugin,
      now: () => now,
    });
    adapter.initialize(start);

    expect(adapter.update({ lat: 12.972, lng: 77.595, heading: 359 })).toBe(true);
    now = MAPPLS_ADVANCED_TRACKING_MIN_INTERVAL_MS - 1;
    expect(adapter.update({ lat: 12.973, lng: 77.596, heading: 0 })).toBe(false);
    now = MAPPLS_ADVANCED_TRACKING_MIN_INTERVAL_MS;
    expect(adapter.update({ lat: 12.974, lng: 77.597, heading: null })).toBe(true);

    expect(controller.trackingCall).toHaveBeenCalledTimes(2);
    expect(controller.trackingCall).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        location: [77.595, 12.972],
        heading: true,
        mapCenter: false,
        fitBounds: false,
        reRoute: false,
        polylineRefresh: false,
      }),
    );
    expect(controller.trackingCall).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        location: [77.597, 12.974],
        heading: false,
      }),
    );
  });

  it("hides all plugin-owned visual state when the customer map unmounts", () => {
    const controller = {
      trackingCall: vi.fn(),
      settrackfit: vi.fn(),
      setLineVisible: vi.fn(),
      setCcpVisible: vi.fn(),
      removeCurveLine: vi.fn(),
    };
    const plugin = {
      tracking: vi.fn((_options, onReady) => onReady(controller)),
    };
    const adapter = createMapplsAdvancedTrackingAdapter({ map, destination, plugin });
    adapter.initialize(start);

    adapter.dispose();

    expect(controller.setCcpVisible).toHaveBeenCalledWith(false);
    expect(controller.setLineVisible).toHaveBeenCalledWith(false);
    expect(controller.removeCurveLine).toHaveBeenCalledOnce();
  });

  it("reports initialization failure without becoming active", () => {
    const onFailure = vi.fn();
    const plugin = {
      tracking: vi.fn((_options, _onReady, onFailureCallback) => {
        onFailureCallback(new Error("plugin unavailable"));
      }),
    };
    const adapter = createMapplsAdvancedTrackingAdapter({
      map,
      destination,
      plugin,
      onFailure,
    });

    adapter.initialize(start);

    expect(adapter.isActive()).toBe(false);
    expect(adapter.update({ lat: 12.972, lng: 77.595 })).toBe(false);
    expect(onFailure).toHaveBeenCalledWith(expect.any(Error));
  });

  it("returns to fallback when an accepted plugin update later rejects", async () => {
    const onFailure = vi.fn();
    const controller = {
      trackingCall: vi.fn(() => Promise.reject(new Error("update unavailable"))),
      settrackfit: vi.fn(),
      setLineVisible: vi.fn(),
      setCcpVisible: vi.fn(),
      removeCurveLine: vi.fn(),
    };
    const plugin = {
      tracking: vi.fn((_options, onReady) => onReady(controller)),
    };
    const adapter = createMapplsAdvancedTrackingAdapter({
      map,
      destination,
      plugin,
      onFailure,
    });
    adapter.initialize(start);

    expect(adapter.update({ lat: 12.972, lng: 77.595 })).toBe(true);
    await Promise.resolve();

    expect(adapter.isActive()).toBe(false);
    expect(onFailure).toHaveBeenCalledWith(expect.any(Error));
    expect(controller.setCcpVisible).toHaveBeenCalledWith(false);
  });
});

const createController = () => ({
  trackingCall: vi.fn(),
  settrackfit: vi.fn(),
  setLineVisible: vi.fn(),
  setCcpVisible: vi.fn(),
  removeCurveLine: vi.fn(),
});

/**
 * Models the installed mappls-web-maps boundary: tracking(props, callback)
 * with exactly two parameters, so no failure callback ever reaches Mappls.
 */
const createTwoArgumentPlugin = () => {
  const calls: Array<{ props: Record<string, unknown>; callback?: (controller: unknown) => void }> = [];
  return {
    calls,
    plugin: {
      tracking(props: Record<string, unknown>, callback?: (controller: unknown) => void) {
        calls.push({ props, callback });
        return undefined;
      },
    },
  };
};

describe("Mappls advanced tracking initialization timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.mappls;
    vi.restoreAllMocks();
  });

  it("fails over when a two-argument tracking wrapper never answers", () => {
    const { calls, plugin } = createTwoArgumentPlugin();
    const onReady = vi.fn();
    const onFailure = vi.fn();
    const adapter = createMapplsAdvancedTrackingAdapter({ map, destination, plugin, onReady, onFailure });

    adapter.initialize(start);

    expect(plugin.tracking).toHaveLength(2);
    expect(calls).toHaveLength(1);
    vi.advanceTimersByTime(MAPPLS_ADVANCED_TRACKING_INIT_TIMEOUT_MS - 1);
    expect(onFailure).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);

    expect(onFailure).toHaveBeenCalledOnce();
    expect(onFailure.mock.calls[0][0].message).toMatch(/timed out/);
    expect(onReady).not.toHaveBeenCalled();
    expect(adapter.isActive()).toBe(false);
    expect(adapter.update({ lat: 12.972, lng: 77.595 })).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    ["never answers", () => undefined],
    ["throws synchronously", () => { throw new Error("plugin init threw"); }],
  ])("reaches the timeout through the real mappls-web-maps wrapper when Mappls %s", (_case, behaviour) => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const windowTracking = vi.fn(behaviour);
    window.mappls = { tracking: windowTracking };
    const onFailure = vi.fn();
    const adapter = createMapplsAdvancedTrackingAdapter({
      map,
      destination,
      plugin: new mappls_plugin(),
      onFailure,
    });

    adapter.initialize(start);

    // The wrapper drops the adapter's third argument and swallows throws.
    expect(windowTracking).toHaveBeenCalledOnce();
    expect(windowTracking.mock.calls[0]).toHaveLength(2);
    expect(onFailure).not.toHaveBeenCalled();

    vi.advanceTimersByTime(MAPPLS_ADVANCED_TRACKING_INIT_TIMEOUT_MS);

    expect(onFailure).toHaveBeenCalledOnce();
    expect(adapter.isActive()).toBe(false);
  });

  it("clears the timeout and stays active when success arrives first", () => {
    const { calls, plugin } = createTwoArgumentPlugin();
    const controller = createController();
    const onReady = vi.fn();
    const onFailure = vi.fn();
    const adapter = createMapplsAdvancedTrackingAdapter({ map, destination, plugin, onReady, onFailure });
    adapter.initialize(start);

    vi.advanceTimersByTime(MAPPLS_ADVANCED_TRACKING_INIT_TIMEOUT_MS / 2);
    calls[0].callback?.(controller);

    expect(onReady).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(MAPPLS_ADVANCED_TRACKING_INIT_TIMEOUT_MS * 2);
    expect(onFailure).not.toHaveBeenCalled();
    expect(adapter.isActive()).toBe(true);
  });

  it("ignores a late success or failure after the timeout and hides the late plugin", () => {
    const controller = createController();
    let onSuccess: ((controller: unknown) => void) | undefined;
    let onFailureCallback: ((error: unknown) => void) | undefined;
    const plugin = {
      tracking: vi.fn((_options, success, failure) => {
        onSuccess = success;
        onFailureCallback = failure;
      }),
    };
    const onReady = vi.fn();
    const onFailure = vi.fn();
    const adapter = createMapplsAdvancedTrackingAdapter({ map, destination, plugin, onReady, onFailure });
    adapter.initialize(start);
    vi.advanceTimersByTime(MAPPLS_ADVANCED_TRACKING_INIT_TIMEOUT_MS);
    expect(onFailure).toHaveBeenCalledOnce();

    onSuccess?.(controller);
    onFailureCallback?.(new Error("late failure"));

    expect(onReady).not.toHaveBeenCalled();
    expect(onFailure).toHaveBeenCalledOnce();
    expect(adapter.isActive()).toBe(false);
    expect(controller.setCcpVisible).toHaveBeenCalledWith(false);
    expect(adapter.update({ lat: 12.972, lng: 77.595 })).toBe(false);
    expect(controller.trackingCall).not.toHaveBeenCalled();
  });

  it("clears the timeout on dispose so no late transition occurs", () => {
    const { calls, plugin } = createTwoArgumentPlugin();
    const controller = createController();
    const onReady = vi.fn();
    const onFailure = vi.fn();
    const adapter = createMapplsAdvancedTrackingAdapter({ map, destination, plugin, onReady, onFailure });
    adapter.initialize(start);

    adapter.dispose();

    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(MAPPLS_ADVANCED_TRACKING_INIT_TIMEOUT_MS * 2);
    calls[0].callback?.(controller);
    expect(onFailure).not.toHaveBeenCalled();
    expect(onReady).not.toHaveBeenCalled();
    expect(adapter.isActive()).toBe(false);
    expect(controller.setCcpVisible).toHaveBeenCalledWith(false);
  });
});

describe("Mappls advanced tracking trailing throttle", () => {
  const point = (lat: number): MapplsAdvancedTrackingPoint => ({ lat, lng: 77.59 });
  const submittedLats = (controller: ReturnType<typeof createController>) =>
    controller.trackingCall.mock.calls.map(([options]) => (options.location as number[])[1]);

  const createActiveAdapter = () => {
    const controller = createController();
    const onFailure = vi.fn();
    const adapter = createMapplsAdvancedTrackingAdapter({
      map,
      destination,
      plugin: { tracking: vi.fn((_options, onReady) => onReady(controller)) },
      onFailure,
    });
    adapter.initialize(start);
    return { adapter, controller, onFailure };
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("submits immediately, keeps only the newest pending point, and delivers it when the cooldown ends", () => {
    const { adapter, controller } = createActiveAdapter();

    expect(adapter.update(point(1))).toBe(true);
    expect(submittedLats(controller)).toEqual([1]);

    vi.advanceTimersByTime(1_000);
    expect(adapter.update(point(2))).toBe(false);
    expect(submittedLats(controller)).toEqual([1]);

    vi.advanceTimersByTime(1_000);
    expect(adapter.update(point(3))).toBe(false);
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(999);
    expect(submittedLats(controller)).toEqual([1]);
    vi.advanceTimersByTime(1);
    expect(submittedLats(controller)).toEqual([1, 3]);

    vi.advanceTimersByTime(1_000);
    expect(adapter.update(point(4))).toBe(false);

    // Updates stop after P4; it is still delivered at t=6s.
    vi.advanceTimersByTime(1_999);
    expect(submittedLats(controller)).toEqual([1, 3]);
    vi.advanceTimersByTime(1);
    expect(submittedLats(controller)).toEqual([1, 3, 4]);

    // No pending point remains, so nothing further is sent.
    vi.advanceTimersByTime(30_000);
    expect(submittedLats(controller)).toEqual([1, 3, 4]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("submits only the latest point of each window during rapid updates, three seconds apart", () => {
    const { adapter, controller } = createActiveAdapter();
    const submittedAt: number[] = [];
    controller.trackingCall.mockImplementation(() => {
      submittedAt.push(Date.now());
    });

    for (let t = 0; t <= 9_000; t += 250) {
      if (t > 0) vi.advanceTimersByTime(250);
      adapter.update(point(t));
    }
    vi.advanceTimersByTime(MAPPLS_ADVANCED_TRACKING_MIN_INTERVAL_MS);

    expect(submittedAt).toEqual([0, 3_000, 6_000, 9_000, 12_000]);
    expect(submittedLats(controller)).toEqual([0, 2_750, 5_750, 8_750, 9_000]);
  });

  it("clears the pending timer on dispose and submits nothing afterwards", () => {
    const { adapter, controller } = createActiveAdapter();
    adapter.update(point(1));
    vi.advanceTimersByTime(1_000);
    adapter.update(point(2));
    expect(vi.getTimerCount()).toBe(1);

    adapter.dispose();

    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(MAPPLS_ADVANCED_TRACKING_MIN_INTERVAL_MS * 3);
    expect(submittedLats(controller)).toEqual([1]);
  });

  it("clears the pending timer when the plugin fails", async () => {
    const { adapter, controller, onFailure } = createActiveAdapter();
    let rejectFirst: (error: Error) => void = () => {};
    controller.trackingCall.mockReturnValueOnce(new Promise((_resolve, reject) => { rejectFirst = reject; }));
    adapter.update(point(1));
    vi.advanceTimersByTime(1_000);
    adapter.update(point(2));
    expect(vi.getTimerCount()).toBe(1);

    rejectFirst(new Error("update unavailable"));
    await Promise.resolve();
    await Promise.resolve();

    expect(onFailure).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(MAPPLS_ADVANCED_TRACKING_MIN_INTERVAL_MS * 3);
    expect(submittedLats(controller)).toEqual([1]);
    expect(adapter.update(point(3))).toBe(false);
  });
});
