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

type Spotter = { worker: Worker; ready: Promise<void> };
let spotter: Spotter | null = null;
let heardCallback: (() => void) | null = null;

/** The spotter runs in its own worker, kept between pauses so turning back to the app is instant. */
function startSpotter(): Spotter {
  if (spotter) return spotter;
  const worker = new Worker(`${WAKE_FILES}worker.js`);
  const ready = new Promise<void>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<{ type: string; message?: string }>) => {
      if (event.data.type === "ready") resolve();
      else if (event.data.type === "heard") heardCallback?.();
      else if (event.data.type === "error") reject(new Error(event.data.message || "The listener could not start"));
    };
    worker.onerror = () => reject(new Error("The listener could not load"));
  });
  spotter = { worker, ready };
  ready.catch(() => { stopSpotter(); });
  return spotter;
}

/** Turned off: the worker and its model go too. */
export function stopSpotter() {
  spotter?.worker.terminate();
  spotter = null;
}

export type WakeListening = { stop: () => void };

type AudioFrame = { numberOfFrames: number; sampleRate: number; copyTo(dest: Float32Array, options: { planeIndex: number; format: string }): void; close(): void };
type TrackProcessor = new (init: { track: MediaStreamTrack }) => { readable: ReadableStream<AudioFrame> };

/**
 * Hands the microphone's audio over in 16 kHz pieces of about a tenth of a second. Chrome (and the
 * Android app's WebView) reads the track directly, which needs no tap first; other browsers go
 * through an AudioContext, which some only start after the customer touches the page.
 */
function captureAudio(mic: MediaStream, onSamples: (samples: Float32Array) => void): () => void {
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
  if (Processor && track) {
    const reader = new Processor({ track }).readable.getReader();
    let running = true;
    void (async () => {
      while (running) {
        const { value, done } = await reader.read().catch(() => ({ value: undefined, done: true }));
        if (done || !value) break;
        const raw = new Float32Array(value.numberOfFrames);
        value.copyTo(raw, { planeIndex: 0, format: "f32-planar" });
        const rate = value.sampleRate;
        value.close();
        collect(to16k(raw, rate));
      }
    })();
    return () => { running = false; void reader.cancel().catch(() => {}); };
  }

  const audio = new AudioContext();
  const source = audio.createMediaStreamSource(mic);
  const tap = audio.createScriptProcessor(4096, 1, 1);
  const quiet = audio.createGain();
  quiet.gain.value = 0;
  tap.onaudioprocess = (event) => collect(to16k(event.inputBuffer.getChannelData(0), audio.sampleRate));
  source.connect(tap);
  tap.connect(quiet);
  quiet.connect(audio.destination);
  const wake = () => { if (audio.state === "suspended") void audio.resume().catch(() => {}); };
  wake();
  window.addEventListener("pointerdown", wake);
  return () => {
    window.removeEventListener("pointerdown", wake);
    tap.onaudioprocess = null;
    try { source.disconnect(); tap.disconnect(); quiet.disconnect(); } catch { /* already apart */ }
    void audio.close().catch(() => {});
  };
}

/**
 * Listens for "Hey ResQNow" until stopped. Rejects when the microphone is refused or the listener
 * can't load; `onHeard` runs once per phrase.
 */
export async function listenForWakeWord(onHeard: () => void): Promise<WakeListening> {
  const { worker, ready } = startSpotter();
  const mic = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  const stopMic = () => mic.getTracks().forEach((track) => track.stop());
  try {
    await ready;
  } catch (error) {
    stopMic();
    throw error;
  }
  let lastHeard = 0;
  heardCallback = () => {
    // One phrase, one opening: the spotter can fire twice on a long "Heyyy ResQNow".
    if (Date.now() - lastHeard < 3000) return;
    lastHeard = Date.now();
    onHeard();
  };
  const stopCapture = captureAudio(mic, (samples) => worker.postMessage({ type: "audio", samples }, [samples.buffer]));
  return {
    stop: () => {
      stopCapture();
      heardCallback = null;
      worker.postMessage({ type: "reset" });
      stopMic();
    },
  };
}
