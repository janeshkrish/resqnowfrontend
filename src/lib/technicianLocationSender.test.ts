import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  MAX_PENDING_LOCATION_AGE_MS,
  MOVING_SEND_INTERVAL_MS,
  PENDING_RETRY_INTERVAL_MS,
  REST_RESPONSE_TIMEOUT_MS,
  SOCKET_ACK_TIMEOUT_MS,
  STATIONARY_SEND_INTERVAL_MS,
  createTechnicianLocationSender,
  type TrackingAcknowledgement,
  type TrackingLocationV1Payload,
} from "./technicianLocationSender";

// ~1.11 m of latitude per 0.00001 degrees.
const METERS_PER_DEGREE = 111_195;
const START = { lat: 12.9716, lng: 77.5946 };

let sequence = 0;
const fix = (
  northMeters: number,
  overrides: Partial<TrackingLocationV1Payload> = {},
): TrackingLocationV1Payload => {
  sequence += 1;
  return {
    version: 1,
    technicianId: "tech-1",
    jobId: "job-1",
    lat: START.lat + northMeters / METERS_PER_DEGREE,
    lng: START.lng,
    speed: 8.5,
    heading: 12,
    accuracy: 5,
    recordedAt: new Date(Date.now()).toISOString(),
    sequenceId: Date.now() * 1000 + sequence,
    ...overrides,
  };
};

type RestCall = {
  payload: TrackingLocationV1Payload;
  resolve: (value: { ok: boolean; status?: number; code?: string }) => void;
  reject: (error: Error) => void;
};

const createTransport = ({ connected = true, autoAck = true } = {}) => {
  const state = { connected, autoAck };
  const socketSends: Array<{ payload: TrackingLocationV1Payload; at: number; ack: (value: TrackingAcknowledgement) => void }> = [];
  const restCalls: RestCall[] = [];
  const transport = {
    isSocketConnected: () => state.connected,
    emitSocket: vi.fn((payload: TrackingLocationV1Payload, ack: (value: TrackingAcknowledgement) => void) => {
      socketSends.push({ payload, at: Date.now(), ack });
      if (state.autoAck) ack({ ok: true });
    }),
    sendRest: vi.fn((payload: TrackingLocationV1Payload) =>
      new Promise<{ ok: boolean; status?: number; code?: string }>((resolve, reject) => {
        restCalls.push({ payload, resolve, reject });
      })),
  };
  return { state, socketSends, restCalls, transport };
};

const flushPromises = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-25T10:00:00.000Z"));
  sequence = 0;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("adaptive technician location sending", () => {
  it("sends a moving technician's newest fix roughly every 2.5 seconds", () => {
    const { socketSends, transport } = createTransport();
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });

    // 10 m/s for 12 s, one GPS fix per second.
    for (let second = 0; second <= 12; second += 1) {
      if (second > 0) vi.advanceTimersByTime(1_000);
      sender.handleFix(fix(second * 10));
    }

    const sendTimes = socketSends.map((send) => send.at - socketSends[0].at);
    expect(sendTimes).toEqual([0, 2_500, 5_000, 7_500, 10_000]);
    const gaps = sendTimes.slice(1).map((time, index) => time - sendTimes[index]);
    gaps.forEach((gap) => {
      expect(gap).toBeGreaterThanOrEqual(MOVING_SEND_INTERVAL_MS);
      expect(gap).toBeLessThanOrEqual(3_000);
    });
  });

  it("sends a stationary technician only on the heartbeat cadence", () => {
    const { socketSends, transport } = createTransport();
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });

    // GPS jitter of up to 4 m around one spot, one fix per second for 30 s.
    for (let second = 0; second <= 30; second += 1) {
      if (second > 0) vi.advanceTimersByTime(1_000);
      sender.handleFix(fix((second % 3) * 2, { speed: 0 }));
    }

    const sendTimes = socketSends.map((send) => send.at - socketSends[0].at);
    expect(sendTimes).toEqual([0, STATIONARY_SEND_INTERVAL_MS, STATIONARY_SEND_INTERVAL_MS * 2]);
  });

  it("sends as soon as movement exceeds the distance threshold after the moving interval", () => {
    const { socketSends, transport } = createTransport();
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });
    sender.handleFix(fix(0, { speed: 0 }));

    vi.advanceTimersByTime(4_000);
    const moved = fix(15);
    sender.handleFix(moved);

    expect(socketSends).toHaveLength(2);
    expect(socketSends[1].payload).toBe(moved);
  });

  it("does not transmit movement below the distance or accuracy threshold before the heartbeat", () => {
    const { socketSends, transport } = createTransport();
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });
    sender.handleFix(fix(0, { speed: 0 }));

    vi.advanceTimersByTime(4_000);
    sender.handleFix(fix(6, { speed: 0 }));
    vi.advanceTimersByTime(1_000);
    // 15 m of apparent movement inside a 25 m accuracy radius is still jitter.
    sender.handleFix(fix(15, { speed: 0, accuracy: 25 }));

    expect(socketSends).toHaveLength(1);
    vi.advanceTimersByTime(STATIONARY_SEND_INTERVAL_MS - 5_000);
    expect(socketSends).toHaveLength(2);
  });

  it("keeps sequence ids strictly increasing and never sends an older fix", () => {
    const { socketSends, transport } = createTransport();
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });
    const first = fix(0);
    sender.handleFix(first);
    vi.advanceTimersByTime(3_000);
    const newer = fix(40);
    const older = { ...fix(80), sequenceId: first.sequenceId - 1 };
    sender.handleFix(older);
    sender.handleFix(newer);

    const sequenceIds = socketSends.map((send) => send.payload.sequenceId);
    expect(sequenceIds).toEqual([first.sequenceId, newer.sequenceId]);
    expect(sequenceIds[1]).toBeGreaterThan(sequenceIds[0]);
  });

  it("delivers the raw fix unchanged: coordinates, timestamp, heading, speed and accuracy", () => {
    const { socketSends, transport } = createTransport();
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });
    const original = fix(0, { speed: 11.2, heading: 271.5, accuracy: 7.4 });
    const snapshot = { ...original };

    sender.handleFix(original);

    expect(socketSends[0].payload).toBe(original);
    expect(socketSends[0].payload).toEqual(snapshot);
  });

  it("stops every timer and ignores fixes once disposed", () => {
    const { socketSends, transport } = createTransport();
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });
    sender.handleFix(fix(0, { speed: 0 }));
    vi.advanceTimersByTime(1_000);
    sender.handleFix(fix(2, { speed: 0 }));
    expect(vi.getTimerCount()).toBe(1);

    sender.dispose();

    expect(vi.getTimerCount()).toBe(0);
    sender.handleFix(fix(200));
    vi.advanceTimersByTime(STATIONARY_SEND_INTERVAL_MS * 3);
    expect(socketSends).toHaveLength(1);
    expect(sender.hasPending()).toBe(false);
  });
});

describe("latest-point recovery queue", () => {
  it("sends immediately while the socket is available", () => {
    const { socketSends, restCalls, transport } = createTransport();
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });

    sender.handleFix(fix(0));

    expect(socketSends).toHaveLength(1);
    expect(restCalls).toHaveLength(0);
    expect(sender.hasPending()).toBe(false);
  });

  it("retains the latest point when neither socket nor REST can deliver it", async () => {
    const { restCalls, transport } = createTransport({ connected: false });
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });
    const lost = fix(0);

    sender.handleFix(lost);
    expect(restCalls).toHaveLength(1);
    restCalls[0].reject(new Error("offline"));
    await flushPromises();

    expect(sender.hasPending()).toBe(true);
    vi.advanceTimersByTime(PENDING_RETRY_INTERVAL_MS - 1);
    expect(restCalls).toHaveLength(1);
  });

  it("keeps only the newest of several offline fixes and sends it when the connection returns", async () => {
    const { state, socketSends, restCalls, transport } = createTransport({ connected: false });
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });
    sender.handleFix(fix(0));
    restCalls[0].reject(new Error("offline"));
    await flushPromises();

    const offlineFixes = [1, 2, 3, 4, 5].map((index) => {
      vi.advanceTimersByTime(500);
      const next = fix(index * 30);
      sender.handleFix(next);
      return next;
    });
    expect(restCalls).toHaveLength(1);

    state.connected = true;
    sender.flush("socket_connected");

    expect(socketSends).toHaveLength(1);
    expect(socketSends[0].payload).toBe(offlineFixes[4]);
    // The four superseded intermediate fixes are never replayed.
    vi.advanceTimersByTime(STATIONARY_SEND_INTERVAL_MS * 2);
    const delivered = [...socketSends.map((send) => send.payload), ...restCalls.map((call) => call.payload)];
    offlineFixes.slice(0, 4).forEach((stale) => expect(delivered).not.toContain(stale));
    expect(sender.hasPending()).toBe(false);
  });

  it("retries the newest pending point on its own after the retry interval", async () => {
    const { restCalls, transport } = createTransport({ connected: false });
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });
    sender.handleFix(fix(0));
    restCalls[0].reject(new Error("offline"));
    await flushPromises();
    vi.advanceTimersByTime(1_000);
    const newest = fix(30);
    sender.handleFix(newest);

    vi.advanceTimersByTime(PENDING_RETRY_INTERVAL_MS);

    expect(restCalls).toHaveLength(2);
    expect(restCalls[1].payload).toBe(newest);
    restCalls[1].resolve({ ok: true, status: 200 });
    await flushPromises();
    expect(sender.hasPending()).toBe(false);
  });

  it("drops a pending point instead of replaying it once it is too old for ingestion", async () => {
    const { state, socketSends, restCalls, transport } = createTransport({ connected: false });
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });
    sender.handleFix(fix(0));
    restCalls[0].reject(new Error("offline"));
    await flushPromises();

    for (let elapsed = 0; elapsed <= MAX_PENDING_LOCATION_AGE_MS; elapsed += PENDING_RETRY_INTERVAL_MS) {
      vi.advanceTimersByTime(PENDING_RETRY_INTERVAL_MS);
      restCalls.at(-1)?.reject(new Error("offline"));
      await flushPromises();
    }
    const attempts = restCalls.length;

    state.connected = true;
    sender.flush("socket_connected");
    vi.advanceTimersByTime(60_000);

    expect(sender.hasPending()).toBe(false);
    expect(socketSends).toHaveLength(0);
    expect(restCalls).toHaveLength(attempts);
  });

  it("clears the pending point when the request ends", async () => {
    const { state, socketSends, restCalls, transport } = createTransport({ connected: false });
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });
    sender.handleFix(fix(0));
    restCalls[0].reject(new Error("offline"));
    await flushPromises();

    sender.clearPending("request_ended");

    expect(sender.hasPending()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    state.connected = true;
    sender.flush("socket_connected");
    expect(socketSends).toHaveLength(0);
  });

  it("never lets a pending point from the previous job reach the next job", async () => {
    const first = createTransport({ connected: false });
    const previousJob = createTechnicianLocationSender({ jobId: "job-1", transport: first.transport });
    previousJob.handleFix(fix(0));
    first.restCalls[0].reject(new Error("offline"));
    await flushPromises();
    expect(previousJob.hasPending()).toBe(true);

    // The ActiveJob effect cleanup disposes the old sender before creating the next one.
    previousJob.dispose();
    const second = createTransport();
    const nextJob = createTechnicianLocationSender({ jobId: "job-2", transport: second.transport });
    first.state.connected = true;
    previousJob.flush("socket_connected");
    nextJob.handleFix(fix(50)); // still tagged job-1
    const ownFix = fix(60, { jobId: "job-2" });
    nextJob.handleFix(ownFix);
    vi.advanceTimersByTime(60_000);

    expect(first.socketSends).toHaveLength(0);
    expect(first.restCalls).toHaveLength(1);
    expect(second.socketSends.map((send) => send.payload)).toEqual([ownFix]);
  });

  it("does not resend a fix over REST when ingestion rejects it deterministically", () => {
    const { socketSends, restCalls, transport } = createTransport({ autoAck: false });
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });
    sender.handleFix(fix(0));

    socketSends[0].ack({ ok: false, code: "IMPLAUSIBLE_MOVEMENT" });

    expect(restCalls).toHaveLength(0);
    expect(sender.hasPending()).toBe(false);
  });

  it("falls back to REST when the socket acknowledgement times out or the store is unavailable", async () => {
    const { socketSends, restCalls, transport } = createTransport({ autoAck: false });
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });
    sender.handleFix(fix(0));

    vi.advanceTimersByTime(SOCKET_ACK_TIMEOUT_MS);
    expect(restCalls).toHaveLength(1);
    restCalls[0].resolve({ ok: true, status: 200 });
    await flushPromises();
    // A late acknowledgement for the same fix is ignored.
    socketSends[0].ack({ ok: false, code: "STORE_UNAVAILABLE" });
    expect(restCalls).toHaveLength(1);

    vi.advanceTimersByTime(MOVING_SEND_INTERVAL_MS);
    sender.handleFix(fix(40));
    socketSends[1].ack({ ok: false, code: "STORE_UNAVAILABLE" });
    expect(restCalls).toHaveLength(2);
    expect(restCalls[1].payload).toBe(socketSends[1].payload);
  });

  it("treats a REST request that never answers as retryable instead of stalling", async () => {
    const { state, socketSends, restCalls, transport } = createTransport({ connected: false });
    const sender = createTechnicianLocationSender({ jobId: "job-1", transport });
    sender.handleFix(fix(0));
    vi.advanceTimersByTime(1_000);
    const newest = fix(30);
    sender.handleFix(newest);

    vi.advanceTimersByTime(REST_RESPONSE_TIMEOUT_MS);
    expect(sender.hasPending()).toBe(true);

    state.connected = true;
    sender.flush("socket_connected");
    expect(socketSends.map((send) => send.payload)).toEqual([newest]);
    // The hung request answering late does not disturb the queue.
    restCalls[0].resolve({ ok: true, status: 200 });
    await flushPromises();
    expect(sender.hasPending()).toBe(false);
  });
});
