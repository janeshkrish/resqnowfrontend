import { describe, expect, it } from "vitest";

import {
  LiveTrackingPlaybackController,
  deriveTrackingFreshness,
  type TrackingPlaybackPoint,
} from "./liveTrackingPlayback";

const point = (overrides: Partial<TrackingPlaybackPoint> = {}): TrackingPlaybackPoint => ({
  lat: 12.9716,
  lng: 77.5946,
  speed: 10,
  heading: 90,
  accuracy: 8,
  recordedAtMs: 0,
  sequenceId: 1,
  ...overrides,
});

describe("LiveTrackingPlaybackController", () => {
  it("plays adjacent authoritative points as one continuous linear segment", () => {
    const playback = new LiveTrackingPlaybackController();
    playback.push(point(), 0);
    playback.push(point({ lng: 77.5947, recordedAtMs: 1_000, sequenceId: 2 }), 1_000);

    playback.frame(1_250);
    const halfway = playback.frame(1_750);

    expect(halfway.position?.lng).toBeCloseTo(77.59465, 5);
    expect(halfway.isPredicting).toBe(false);
  });

  it("queues rapid points instead of restarting the active segment", () => {
    const playback = new LiveTrackingPlaybackController();
    playback.push(point(), 0);
    playback.push(point({ lng: 77.59465, recordedAtMs: 500, sequenceId: 2 }), 500);
    playback.push(point({ lng: 77.5947, recordedAtMs: 1_000, sequenceId: 3 }), 1_000);

    playback.frame(750);
    const beforeSecondTarget = playback.frame(1_050);
    const afterSecondTarget = playback.frame(1_400);

    expect(beforeSecondTarget.position?.lng).toBeGreaterThan(77.5946);
    expect(afterSecondTarget.position?.lng).toBeGreaterThan(beforeSecondTarget.position!.lng);
  });

  it("holds the confirmed point when the interpolation buffer is empty and prediction is unavailable", () => {
    const playback = new LiveTrackingPlaybackController();
    playback.push(point({ speed: null, heading: null }), 0);

    const frame = playback.frame(5_000);

    expect(frame.position).toMatchObject({ lat: 12.9716, lng: 77.5946 });
    expect(frame.isPredicting).toBe(false);
  });

  it("predicts only briefly from reliable speed, heading, and accuracy", () => {
    const playback = new LiveTrackingPlaybackController();
    playback.push(point(), 0);

    const frame = playback.frame(2_400);

    expect(frame.isPredicting).toBe(true);
    expect(frame.position?.lng).toBeGreaterThan(77.5946);
  });

  it("stops prediction at its strict horizon", () => {
    const playback = new LiveTrackingPlaybackController();
    playback.push(point(), 0);

    const lastPredicted = playback.frame(6_300);
    const afterTimeout = playback.frame(7_000);

    expect(lastPredicted.isPredicting).toBe(true);
    expect(afterTimeout.isPredicting).toBe(false);
    expect(afterTimeout.position).toEqual(lastPredicted.position);
  });

  it("does not predict through a known Socket.IO disconnect", () => {
    const playback = new LiveTrackingPlaybackController();
    playback.push(point(), 0);

    const frame = playback.frame(2_400, false);

    expect(frame.isPredicting).toBe(false);
    expect(frame.freshness).toBe("RECONNECTING");
  });

  it("smoothly reconciles an authoritative fix received during prediction", () => {
    const playback = new LiveTrackingPlaybackController();
    playback.push(point(), 0);
    const predicted = playback.frame(2_400).position;
    playback.push(point({ lng: 77.5948, recordedAtMs: 2_000, sequenceId: 2 }), 2_400);

    playback.frame(2_650);
    const corrected = playback.frame(3_150);

    expect(corrected.position?.lng).toBeGreaterThan(predicted!.lng);
    expect(corrected.position?.lng).toBeLessThan(77.5948);
  });

  it("takes the shortest heading path across north", () => {
    const playback = new LiveTrackingPlaybackController();
    playback.push(point({ heading: 359 }), 0);
    playback.push(point({ lng: 77.5947, heading: 1, recordedAtMs: 1_000, sequenceId: 2 }), 1_000);

    playback.frame(1_250);
    const frame = playback.frame(1_750);

    expect(frame.bearing).toBeCloseTo(0, 0);
  });

  it("does not rotate the vehicle when the authoritative point is stationary", () => {
    const playback = new LiveTrackingPlaybackController();
    playback.push(point({ heading: 90, speed: 10 }), 0);
    playback.push(point({ heading: 180, speed: 0, lng: 77.5946, recordedAtMs: 1_000, sequenceId: 2 }), 1_000);

    playback.frame(1_250);
    const frame = playback.frame(2_300);

    expect(frame.bearing).toBe(90);
  });

  it("rebases a suspicious large jump without animating a cross-map segment", () => {
    const playback = new LiveTrackingPlaybackController();
    playback.push(point(), 0);
    playback.push(point({ lat: 13.8, lng: 78.5, recordedAtMs: 1_000, sequenceId: 2 }), 1_000);

    expect(playback.frame(1_100).isRepositioning).toBe(true);
    const rebased = playback.frame(1_400);

    expect(rebased.isRepositioning).toBe(false);
    expect(rebased.position).toMatchObject({ lat: 13.8, lng: 78.5 });
  });
});

describe("deriveTrackingFreshness", () => {
  it("reports live, updating, delayed, offline, and reconnecting states honestly", () => {
    expect(deriveTrackingFreshness(0, 2_000, true)).toBe("LIVE");
    expect(deriveTrackingFreshness(0, 5_000, true)).toBe("UPDATING");
    expect(deriveTrackingFreshness(0, 12_000, true)).toBe("DELAYED");
    expect(deriveTrackingFreshness(0, 25_000, true)).toBe("OFFLINE");
    expect(deriveTrackingFreshness(0, 500, false)).toBe("RECONNECTING");
  });
});
