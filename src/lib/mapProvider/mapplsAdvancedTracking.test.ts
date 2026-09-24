import { describe, expect, it, vi } from "vitest";

import {
  MAPPLS_ADVANCED_TRACKING_MIN_INTERVAL_MS,
  createMapplsAdvancedTrackingAdapter,
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
