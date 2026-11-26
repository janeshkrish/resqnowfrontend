// @vitest-environment node
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { describe, expect, it } from "vitest";

// The shipping listener (public/hey-resqnow/detector.js and its model) run on recorded audio.
const dir = path.resolve(__dirname, "../../../public/hey-resqnow");
const fixtures = path.resolve(__dirname, "../../../e2e/fixtures");
const ort = createRequire(import.meta.url)("onnxruntime-web");
ort.env.wasm.numThreads = 1;
runInThisContext(readFileSync(path.join(dir, "detector.js"), "utf8"));
const g = globalThis as unknown as {
  createWakeDetector: (ort: unknown, files: Record<string, Uint8Array>, options: { threshold: number; confirm: number; onScore?: (s: number) => void }) => Promise<{ accept(samples: Float32Array): Promise<number | null>; reset(): void }>;
  loadClassifier: (bytes: Uint8Array) => { inputs: number; score(x: Float32Array): number };
};

/** 16-bit or float WAV at any rate, as 16 kHz samples. */
function wav16k(file: string): Float32Array {
  const b = readFileSync(path.join(fixtures, file));
  let o = 12, rate = 16000, bits = 16, data: Buffer | null = null;
  while (o < b.length) {
    const id = b.toString("ascii", o, o + 4), n = b.readUInt32LE(o + 4);
    if (id === "fmt ") { rate = b.readUInt32LE(o + 12); bits = b.readUInt16LE(o + 22); }
    if (id === "data") { data = b.subarray(o + 8, o + 8 + n); break; }
    o += 8 + n + (n & 1);
  }
  if (!data || bits !== 16) throw new Error("unexpected wav " + file);
  const raw = new Float32Array(data.length / 2);
  for (let i = 0; i < raw.length; i++) raw[i] = data.readInt16LE(i * 2) / 32768;
  const ratio = rate / 16000;
  const out = new Float32Array(Math.floor(raw.length / ratio));
  for (let i = 0; i < out.length; i++) {
    let sum = 0, n = 0;
    for (let j = Math.floor(i * ratio); j < Math.floor((i + 1) * ratio); j++) { sum += raw[j]; n++; }
    out[i] = sum / n;
  }
  return out;
}

async function listen(file: string) {
  const bytes = (name: string) => new Uint8Array(readFileSync(path.join(dir, name)));
  let best = 0;
  const detector = await g.createWakeDetector(ort, { mel: bytes("melspectrogram.onnx"), embedding: bytes("embedding_model.onnx"), classifier: bytes("hey-resqnow.bin") },
    { threshold: 0.95, confirm: 0.5, onScore: (s) => { best = Math.max(best, s); } });
  // A second of quiet first, then the clip, then quiet, in the 1600-sample pieces the page sends.
  const audio = wav16k(file);
  const all = new Float32Array(16000 + audio.length + 16000);
  all.set(audio, 16000);
  let heard: number | null = null;
  for (let i = 0; i < all.length && heard == null; i += 1600) heard = await detector.accept(all.slice(i, i + 1600));
  return { heard, best };
}

describe("ResQNow's own “Hey ResQNow” model", () => {
  it("is a complete classifier for the listener's 16 × 96 speech features", () => {
    const model = g.loadClassifier(new Uint8Array(readFileSync(path.join(dir, "hey-resqnow.bin"))));
    expect(model.inputs).toBe(16 * 96);
    const score = model.score(new Float32Array(16 * 96));
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
    expect(() => g.loadClassifier(new Uint8Array(16))).toThrow();
  });

  it("hears “Hey ResQNow”", async () => {
    const { heard } = await listen("hey-resqnow.wav");
    expect(heard).toBeGreaterThanOrEqual(0.95);
  }, 60_000);

  it("stays quiet for other speech", async () => {
    const { heard, best } = await listen("not-hey-resqnow.wav");
    expect(heard).toBeNull();
    expect(best).toBeLessThan(0.5);
  }, 60_000);
});
