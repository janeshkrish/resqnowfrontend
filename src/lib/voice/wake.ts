/**
 * "Hey ResQNow": while the app is open, the phone listens for the phrase and opens ResQNow-Thozhan.
 * The listening runs on the phone (an open-source keyword spotter, sherpa-onnx, in public/hey-resqnow);
 * no sound leaves the device. It is off until the customer turns it on in Account.
 */

const KEY = "resqnow_hey_resqnow";
const CHANGED = "resqnow:hey-resqnow";
/** The spotter and its model, about 15 MB, fetched only once the customer turns this on. */
export const WAKE_FILES = "/hey-resqnow/";

export function wakeWordOn(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setWakeWord(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "1" : "0");
  } catch {
    // Private browsing: it stays on for this visit only.
  }
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: on }));
}

/** Calls back when the switch changes, here or in another tab. */
export function onWakeWordChange(callback: (on: boolean) => void) {
  const changed = () => callback(wakeWordOn());
  window.addEventListener(CHANGED, changed);
  window.addEventListener("storage", changed);
  return () => {
    window.removeEventListener(CHANGED, changed);
    window.removeEventListener("storage", changed);
  };
}

/**
 * The customer's pages listen. Thozhan's own screen doesn't (it is listening already), nor do the
 * sign-in pages or the technician and admin apps.
 */
export function listensHere(path: string): boolean {
  return !/^\/(thozhan|technician|admin|login|register|otp-verify|confirm-email|auth)(\/|$)/.test(path);
}

/** Microphone audio, any rate, to the 16 kHz the spotter hears: an average over each output sample's span. */
export function to16k(input: Float32Array, rate: number): Float32Array {
  if (rate === 16000) return input.slice();
  const ratio = rate / 16000;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const from = Math.floor(i * ratio);
    const to = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = from; j < to; j++) sum += input[j];
    out[i] = to > from ? sum / (to - from) : input[from] ?? 0;
  }
  return out;
}

type Spotter = { worker: Worker; ready: Promise<void>; dispose: () => void };
type Session = { id: number; controller: AbortController; heard: () => void; processed: () => void };
let spotter: Spotter | null = null;
let activeSession: Session | null = null;
let listeningGeneration = 0;
const stoppedListening = new DOMException("Wake-word listening was stopped", "AbortError");
const startupTimeout = 30_000;
const frameTimeout = 6_000;

/** The spotter runs in its own worker, kept between pauses so turning back to the app is instant. */
function startSpotter(): Spotter {
  if (spotter) return spotter;
  // The service worker caches script URLs. This version speaks the frame-acknowledgement protocol.
  const worker = new Worker(`${WAKE_FILES}worker.js?v=2`);
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => {
    rejectReady = reject;
    worker.onmessage = ({ data }: MessageEvent<{ type: string; session?: number; message?: string }>) => {
      if (spotter?.worker !== worker) return;
      if (data.type === "ready") resolve();
      else if (data.type === "error") fail(new Error(data.message || "The listener failed"));
      else if (activeSession && (data.session === undefined || activeSession.id === data.session)) {
        if (data.type === "heard") activeSession.heard();
        else if (data.type === "processed") activeSession.processed();
      }
    };
  });
  const dispose = () => {
    if (spotter?.worker !== worker) return;
    spotter = null;
    worker.onmessage = worker.onerror = worker.onmessageerror = null;
    worker.terminate();
    rejectReady(stoppedListening);
  };
  function fail(error: Error) {
    if (spotter?.worker !== worker) return;
    rejectReady(error);
    dispose();
    activeSession?.controller.abort(error);
  }
  worker.onerror = worker.onmessageerror = () => fail(new Error("The listener stopped responding"));
  spotter = { worker, ready, dispose };
  return spotter;
}

/** Turned off: the worker and its model go too. */
export function stopSpotter() {
  spotter?.dispose();
  activeSession?.controller.abort(stoppedListening);
}

export type WakeListening = { stop: () => void };

type AudioFrame = { numberOfFrames: number; sampleRate: number; copyTo(dest: Float32Array, options: { planeIndex: number; format: string }): void; close(): void };
type TrackProcessor = new (init: { track: MediaStreamTrack }) => { readable: ReadableStream<AudioFrame> };

/**
 * Hands the microphone's audio over in 16 kHz pieces of about a tenth of a second. Chrome (and the
 * Android app's WebView) reads the track directly, which needs no tap first; other browsers go
 * through an AudioContext, which some only start after the customer touches the page.
 */
function captureAudio(mic: MediaStream, onSamples: (samples: Float32Array) => void, fail: (error: Error) => void): () => void {
  let pending: Float32Array[] = [];
  let count = 0;
  const collect = (samples: Float32Array) => {
    pending.push(samples);
    count += samples.length;
    if (count < 1600) return;
    const joined = new Float32Array(count);
    let at = 0;
    for (const piece of pending) { joined.set(piece, at); at += piece.length; }
    pending = [];
    count = 0;
    onSamples(joined);
  };

  const Processor = (window as unknown as { MediaStreamTrackProcessor?: TrackProcessor }).MediaStreamTrackProcessor;
  const track = mic.getAudioTracks()[0];
  let reader: ReadableStreamDefaultReader<AudioFrame> | undefined;
  if (Processor && track) {
    // Some browsers expose the processor for video tracks only.
    try { reader = new Processor({ track }).readable.getReader(); } catch { /* try Web Audio */ }
  }
  if (reader) {
    const frames = reader;
    let running = true;
    void (async () => {
      while (running) {
        const { value, done } = await frames.read();
        if (done) throw new Error("Microphone input ended");
        try {
          if (!running) return;
          const raw = new Float32Array(value.numberOfFrames);
          value.copyTo(raw, { planeIndex: 0, format: "f32-planar" });
          collect(to16k(raw, value.sampleRate));
        } finally { value.close(); }
      }
    })().catch(error => { if (running) fail(error); });
    return () => { running = false; void frames.cancel().catch(() => {}); };
  }

  const audio = new AudioContext();
  let tap: ScriptProcessorNode | undefined;
  const nodes: AudioNode[] = [];
  const wake = () => { if (audio.state === "suspended") void audio.resume().catch(fail); };
  // A newly created context may need the next tap. A running context that becomes
  // interrupted must drop the active badge and release the microphone.
  let wasRunning = audio.state === "running";
  const stateChanged = () => {
    if (wasRunning && audio.state !== "running") fail(new Error("Microphone audio was interrupted"));
    wasRunning = audio.state === "running";
  };
  const close = () => {
    window.removeEventListener("pointerdown", wake);
    audio.removeEventListener("statechange", stateChanged);
    if (tap) tap.onaudioprocess = null;
    for (const node of nodes) node.disconnect();
    void audio.close().catch(() => {});
  };
  try {
    const source = audio.createMediaStreamSource(mic);
    nodes.push(source);
    tap = audio.createScriptProcessor(4096, 1, 1);
    nodes.push(tap);
    const quiet = audio.createGain();
    nodes.push(quiet);
    quiet.gain.value = 0;
    tap.onaudioprocess = (event) => {
      try { collect(to16k(event.inputBuffer.getChannelData(0), audio.sampleRate)); }
      catch (error) { fail(error as Error); }
    };
    source.connect(tap);
    tap.connect(quiet);
    quiet.connect(audio.destination);
    audio.addEventListener("statechange", stateChanged);
    window.addEventListener("pointerdown", wake);
    wake();
    return close;
  } catch (error) {
    close();
    throw error;
  }
}

/**
 * Listens for "Hey ResQNow" until stopped. Rejects when the microphone is refused or the listener
 * can't load; `onHeard` runs once per phrase.
 */
export async function listenForWakeWord(onHeard: () => void, options: {
  signal?: AbortSignal;
  onListening?: () => void;
  onError?: (error: Error) => void;
} = {}): Promise<WakeListening> {
  if (options.signal?.aborted) throw stoppedListening;
  activeSession?.controller.abort(stoppedListening);
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Microphone access is unavailable");
  const engine = startSpotter();
  const controller = new AbortController();
  const { signal } = controller;
  const id = ++listeningGeneration;
  const stop = () => controller.abort(stoppedListening);
  const fail = (error: Error) => controller.abort(error);
  const trackEnded = () => fail(new Error("The microphone was disconnected"));
  let mic: MediaStream | undefined;
  let stopCapture: (() => void) | undefined;
  let captureStarted = false;
  let sentFrame = false;
  let acknowledged = false;
  let lastFrame = 0;
  let lastProcessed = 0;
  let lastHeard = -Infinity;
  activeSession = {
    id, controller,
    heard() {
      if (!captureStarted || Date.now() - lastHeard < 3000) return;
      lastHeard = Date.now();
      onHeard();
    },
    processed() {
      if (!sentFrame) return;
      lastProcessed = Date.now();
      if (!acknowledged) {
        acknowledged = true;
        options.onListening?.();
      }
    },
  };

  const setupTimer = window.setTimeout(() => {
    engine.dispose();
    fail(new Error("Wake-word startup timed out"));
  }, startupTimeout);
  let frameTimer: number | undefined;
  const stopped = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => {
      const reason = signal.reason as Error;
      if (activeSession?.id === id) activeSession = null;
      window.clearTimeout(setupTimer);
      window.clearInterval(frameTimer);
      options.signal?.removeEventListener("abort", stop);
      for (const track of mic?.getTracks() ?? []) {
        track.removeEventListener?.("ended", trackEnded);
        track.stop();
      }
      stopCapture?.();
      reject(reason);
      if (captureStarted && reason !== stoppedListening) options.onError?.(reason);
    }, { once: true });
  });
  options.signal?.addEventListener("abort", stop, { once: true });

  async function startCapture() {
    const acquire = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (signal.aborted) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      mic = stream;
      const track = mic.getAudioTracks()[0];
      if (!track || track.readyState === "ended") throw new Error("No live microphone is available");
      track.addEventListener?.("ended", trackEnded);
    };
    await Promise.all([engine.ready, acquire()]);
    if (signal.aborted || !mic) throw signal.reason;
    stopCapture = captureAudio(mic, samples => {
      if (signal.aborted) return;
      lastFrame = Date.now();
      sentFrame = true;
      engine.worker.postMessage({ type: "audio", samples, session: id }, [samples.buffer]);
    }, fail);
    captureStarted = true;
    window.clearTimeout(setupTimer);
    lastFrame = lastProcessed = Date.now();
    frameTimer = window.setInterval(() => {
      const now = Date.now();
      if (now - lastFrame >= frameTimeout) fail(new Error("Microphone audio stopped arriving"));
      else if (now - lastProcessed >= frameTimeout) {
        engine.dispose();
        fail(new Error("The wake-word listener stopped processing audio"));
      }
    }, 1000);
  }
  try {
    await Promise.race([startCapture(), stopped]);
    return { stop };
  } catch (error) {
    fail(error as Error);
    throw error;
  }
}
