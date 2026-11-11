import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ReadableStream } from "node:stream/web";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setWakeWord, stopSpotter } from "@/lib/voice/wake";
import HeyResQNow from "./HeyResQNow";

const { useWakeEnabled } = vi.hoisted(() => ({ useWakeEnabled: vi.fn() }));
vi.mock("@/hooks/useVoiceEnabled", () => ({ useVoiceEnabled: () => true, useWakeEnabled }));

class WorkerDouble {
  static current: WorkerDouble;
  onmessage?: (event: { data: { type: string; session?: number } }) => void;
  onerror?: () => void;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { WorkerDouble.current = this; }
  emit(type: string, session?: number) { this.onmessage?.({ data: { type, session } }); }
}

const track = Object.assign(new EventTarget(), { stop: vi.fn(), readyState: "live" });
const stream = { getAudioTracks: () => [track], getTracks: () => [track] };
const getUserMedia = vi.fn();
type Frame = { numberOfFrames: number; sampleRate: number; copyTo: () => void; close: () => void };
let input: ReadableStreamDefaultController<Frame>;

function Route({ observeRoute }: { observeRoute?: (path: string) => void }) {
  const { pathname, search } = useLocation();
  observeRoute?.(pathname + search);
  return <HeyResQNow />;
}
function open(observeRoute?: (path: string) => void) {
  render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Route observeRoute={observeRoute} /></MemoryRouter>);
}
const ready = () => act(async () => { WorkerDouble.current.emit("ready"); });
async function frame() {
  await act(async () => { input.enqueue({ numberOfFrames: 1600, sampleRate: 16000, copyTo() {}, close() {} }); });
  const message = WorkerDouble.current.postMessage.mock.calls.find(([data]) => data.type === "audio")?.[0];
  expect(message?.samples).toHaveLength(1600);
  return message.session as number;
}
async function listening() {
  await ready();
  const session = await frame();
  await act(async () => { WorkerDouble.current.emit("processed", session); });
  expect(screen.getByRole("link", { name: "Listening for Hey ResQNow" })).toBeVisible();
}
function hide() {
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
  fireEvent(document, new Event("visibilitychange"));
}
function fallback() {
  expect(screen.queryByRole("link", { name: "Listening for Hey ResQNow" })).toBeNull();
  expect(screen.getByRole("link", { name: /open thozhan/i })).toHaveAttribute("href", "/thozhan");
}

describe("foreground wake badge", () => {
  beforeEach(() => {
    useWakeEnabled.mockReturnValue(true);
    setWakeWord(true);
    track.stop.mockClear();
    getUserMedia.mockReset().mockResolvedValue(stream);
    vi.stubGlobal("Worker", WorkerDouble);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    vi.stubGlobal("MediaStreamTrackProcessor", class {
      readable = new ReadableStream<Frame>({ start(controller) { input = controller as typeof input; } });
    });
  });

  it("keeps the microphone off when the server disables wake for this customer", async () => {
    useWakeEnabled.mockReturnValue(false);
    open();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("offers manual opening if the browser aborts microphone startup", async () => {
    getUserMedia.mockRejectedValue(new DOMException("Device unavailable", "AbortError"));
    open();
    await ready();
    fallback();
  });
  afterEach(() => {
    cleanup();
    stopSpotter();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("waits for the spotter to process real microphone samples before showing listening", async () => {
    open();
    await ready();
    expect(screen.queryByRole("link", { name: "Listening for Hey ResQNow" })).toBeNull();
    const session = await frame();
    expect(screen.queryByRole("link", { name: "Listening for Hey ResQNow" })).toBeNull();
    await act(async () => { WorkerDouble.current.emit("processed", session); });
    expect(screen.getByRole("link", { name: "Listening for Hey ResQNow" })).toBeVisible();
  });

  it.each(["reader ended", "reader failed", "track ended", "worker failed", "decoder failed"])("offers manual opening and releases capture when the %s", async (failure) => {
    open();
    await listening();
    await act(async () => {
      if (failure === "reader ended") input.close();
      if (failure === "reader failed") input.error(new Error("device lost"));
      if (failure === "track ended") track.dispatchEvent(new Event("ended"));
      if (failure === "worker failed") WorkerDouble.current.onerror?.();
      if (failure === "decoder failed") WorkerDouble.current.emit("error");
    });
    fallback();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("releases a silent capture session if frames stop arriving", async () => {
    vi.useFakeTimers();
    open();
    await listening();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    fallback();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("gives a manual path if the decoder stops responding despite fresh audio", async () => {
    vi.useFakeTimers();
    open();
    await listening();
    for (let seconds = 0; seconds < 10 && !track.stop.mock.calls.length; seconds++) {
      await frame();
      await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    }
    fallback();
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("bounds model startup and releases a granted microphone", async () => {
    vi.useFakeTimers();
    open();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    fallback();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(WorkerDouble.current.terminate).toHaveBeenCalledOnce();
  });

  it("times out an unanswered permission prompt and releases a later grant", async () => {
    vi.useFakeTimers();
    let grant!: (value: typeof stream) => void;
    getUserMedia.mockReturnValue(new Promise(resolve => { grant = resolve; }));
    open();
    await ready();
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    fallback();
    await act(async () => { grant(stream); });
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it("offers manual opening when an AudioContext stays suspended", async () => {
    vi.useFakeTimers();
    const close = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("MediaStreamTrackProcessor", undefined);
    vi.stubGlobal("AudioContext", class extends EventTarget {
      state = "suspended";
      close = close;
      resume = () => new Promise(() => {});
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      createScriptProcessor() { return { connect() {}, disconnect() {} }; }
      createGain() { return { connect() {}, disconnect() {}, gain: { value: 1 } }; }
    });
    open();
    await ready();
    expect(screen.queryByRole("link", { name: "Listening for Hey ResQNow" })).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    fallback();
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("releases a late microphone grant after hiding while the worker is still loading", async () => {
    let grant!: (value: typeof stream) => void;
    getUserMedia.mockReturnValue(new Promise(resolve => { grant = resolve; }));
    open();
    hide();
    await act(async () => { grant(stream); });
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("link", { name: "Listening for Hey ResQNow" })).toBeNull();
  });

  it("restarts on a foreground return even when React batches visibility updates", async () => {
    open();
    await listening();
    await act(async () => {
      hide();
      Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
      fireEvent(document, new Event("visibilitychange"));
    });
    expect(getUserMedia).toHaveBeenCalledTimes(2);
  });

  it("releases the microphone before the wake route is rendered", async () => {
    const callsAtWake: number[] = [];
    open(path => { if (path === "/thozhan?wake=1") callsAtWake.push(track.stop.mock.calls.length); });
    await listening();
    await act(async () => { WorkerDouble.current.emit("heard", WorkerDouble.current.postMessage.mock.calls[0][0].session); });
    expect(callsAtWake[0]).toBe(1);
  });
});
