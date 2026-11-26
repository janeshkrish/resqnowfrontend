/*
 * "Hey ResQNow" detector: ResQNow's own wake-word model, run on the phone. Audio (16 kHz) becomes
 * a mel spectrogram, then speech embeddings (Google's speech-embedding model, Apache-2.0, as
 * packaged by openWakeWord), and our classifier scores the last ~2 seconds every 80 ms.
 * Shared by worker.js (the browser) and the tests (Node), so both run exactly this code.
 */
/* exported createWakeDetector */

/**
 * Our classifier, a small network stored in hey-resqnow.bin: "RQW1", the input and hidden sizes,
 * then float32 weights: dense, layer norm, ReLU, dense, layer norm, ReLU, dense, sigmoid.
 */
function loadClassifier(buffer) {
  var bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
  var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) !== "RQW1") throw new Error("Not a Hey ResQNow model");
  var inputs = view.getUint32(4, true);
  var hidden = view.getUint32(8, true);
  var at = 12;
  function take(n) {
    var out = new Float32Array(n);
    for (var i = 0; i < n; i++) out[i] = view.getFloat32(at + i * 4, true);
    at += n * 4;
    return out;
  }
  var w1 = take(hidden * inputs), b1 = take(hidden), g1 = take(hidden), n1 = take(hidden);
  var w2 = take(hidden * hidden), b2 = take(hidden), g2 = take(hidden), n2 = take(hidden);
  var w3 = take(hidden), b3 = take(1);
  if (at !== bytes.byteLength) throw new Error("The Hey ResQNow model is incomplete");

  function dense(w, b, x, size, width) {
    var out = new Float32Array(size);
    for (var o = 0; o < size; o++) {
      var sum = b[o];
      var row = o * width;
      for (var i = 0; i < width; i++) sum += w[row + i] * x[i];
      out[o] = sum;
    }
    return out;
  }
  function normReLU(x, gain, shift) {
    var mean = 0, variance = 0, i;
    for (i = 0; i < x.length; i++) mean += x[i];
    mean /= x.length;
    for (i = 0; i < x.length; i++) variance += (x[i] - mean) * (x[i] - mean);
    var scale = 1 / Math.sqrt(variance / x.length + 1e-5);
    for (i = 0; i < x.length; i++) x[i] = Math.max(0, (x[i] - mean) * scale * gain[i] + shift[i]);
    return x;
  }
  return {
    inputs: inputs,
    score: function (x) {
      var a = normReLU(dense(w1, b1, x, hidden, inputs), g1, n1);
      var c = normReLU(dense(w2, b2, a, hidden, hidden), g2, n2);
      var z = b3[0];
      for (var i = 0; i < hidden; i++) z += w3[i] * c[i];
      return 1 / (1 + Math.exp(-z));
    },
  };
}

// eslint-disable-next-line no-unused-vars
async function createWakeDetector(ort, files, options) {
  var opts = options || {};
  // A score of `threshold` heard, with the moment just before or after it at least `confirm`: one
  // stray spike in ordinary talk is not enough, yet a quickly said phrase still counts.
  var threshold = opts.threshold == null ? 0.95 : opts.threshold;
  var confirm = opts.confirm == null ? 0.5 : opts.confirm;
  var CHUNK = 1280; // 80 ms
  var CONTEXT = 480; // the mel model needs 3 frames of earlier audio
  var MEL_WINDOW = 76;
  var EMB_WINDOW = 16;
  var sessionOptions = { executionProviders: ["wasm"], graphOptimizationLevel: "all" };
  var mel = await ort.InferenceSession.create(files.mel, sessionOptions);
  var emb = await ort.InferenceSession.create(files.embedding, sessionOptions);
  var classifierBytes = typeof files.classifier === "string"
    ? await fetch(files.classifier).then(function (r) { if (!r.ok) throw new Error("Could not load the Hey ResQNow model"); return r.arrayBuffer(); })
    : files.classifier;
  var cls = loadClassifier(classifierBytes);
  if (cls.inputs !== 16 * 96) throw new Error("The Hey ResQNow model does not match the listener");

  var pending = new Float32Array(0);
  var context = new Float32Array(CONTEXT);
  var mels = []; // rows of 32
  var embs = []; // rows of 96
  var previous = 0;
  var peak = null; // a score over the threshold, waiting for the next one to confirm it
  var seed = opts.seed || 12345;
  var dither = opts.dither == null ? 0.0004 : opts.dither;

  function reset() {
    pending = new Float32Array(0);
    context = new Float32Array(CONTEXT);
    mels = [];
    embs = [];
    previous = 0;
    peak = null;
  }

  async function step(chunk) {
    var input = new Float32Array(CONTEXT + CHUNK);
    input.set(context, 0);
    input.set(chunk, CONTEXT);
    context = input.slice(CHUNK);
    // A whisper of noise (about -74 dB): perfectly silent input, as from a muted or virtual microphone,
    // is something the model never heard in training and would otherwise skew the features.
    for (var i = 0; i < input.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      input[i] = (input[i] + (seed / 4294967296 - 0.5) * dither) * 32767;
    }
    var melOut = await mel.run({ input: new ort.Tensor("float32", input, [1, input.length]) });
    var m = melOut[mel.outputNames[0]].data; // [1, 1, frames, 32]
    var frames = m.length / 32;
    for (var f = 0; f < frames; f++) {
      var row = new Float32Array(32);
      for (var k = 0; k < 32; k++) row[k] = m[f * 32 + k] / 10 + 2;
      mels.push(row);
    }
    if (mels.length > MEL_WINDOW) mels.splice(0, mels.length - MEL_WINDOW);
    if (mels.length < MEL_WINDOW) return null;

    var e = new Float32Array(MEL_WINDOW * 32);
    for (var r = 0; r < MEL_WINDOW; r++) e.set(mels[r], r * 32);
    var embOut = await emb.run({ input_1: new ort.Tensor("float32", e, [1, MEL_WINDOW, 32, 1]) });
    embs.push(Float32Array.from(embOut[emb.outputNames[0]].data));
    if (embs.length > EMB_WINDOW) embs.shift();
    if (embs.length < EMB_WINDOW) return null;

    var c = new Float32Array(EMB_WINDOW * 96);
    for (var j = 0; j < EMB_WINDOW; j++) c.set(embs[j], j * 96);
    return cls.score(c);
  }

  /** Takes more audio; resolves with the score when "Hey ResQNow" was heard, else null. */
  async function accept(samples) {
    var joined = new Float32Array(pending.length + samples.length);
    joined.set(pending, 0);
    joined.set(samples, pending.length);
    var offset = 0;
    var heard = null;
    while (joined.length - offset >= CHUNK) {
      var score = await step(joined.subarray(offset, offset + CHUNK));
      offset += CHUNK;
      if (score == null) continue;
      if (opts.onScore) opts.onScore(score);
      if (peak != null && score >= confirm) heard = Math.max(peak, score);
      else if (score >= threshold && previous >= confirm) heard = score;
      peak = score >= threshold ? score : null;
      previous = score;
      if (heard != null) {
        reset();
        return heard;
      }
    }
    pending = joined.slice(offset);
    return heard;
  }

  return { accept: accept, reset: reset };
}

if (typeof module === "object" && module.exports) module.exports = { createWakeDetector: createWakeDetector, loadClassifier: loadClassifier };
