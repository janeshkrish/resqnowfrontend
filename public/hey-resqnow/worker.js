/*
 * "Hey ResQNow" listener (src/lib/voice/wake.ts). The page sends the microphone's audio here at
 * 16 kHz and detector.js scores it with ResQNow's own wake-word model (hey-resqnow.bin), run by
 * onnxruntime-web (MIT). Nothing leaves the device.
 */
/* global ort, createWakeDetector, importScripts */

// Tuned on real recordings of customers saying "Hey ResQNow" and hours of Tamil and English talk.
var THRESHOLD = 0.95;
var CONFIRM = 0.5;

var detector = null;
var session = null;
var queue = Promise.resolve();

function here(file) {
  return new URL(file, self.location.href).href;
}

try {
  importScripts("ort.wasm.min.js", "detector.js");
  // One thread: the page is not cross-origin isolated, so no shared memory for worker threads.
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmPaths = { mjs: here("ort-wasm.js"), wasm: here("ort-wasm.wasm") };
  createWakeDetector(ort, {
    mel: here("melspectrogram.onnx"),
    embedding: here("embedding_model.onnx"),
    classifier: here("hey-resqnow.bin"),
  }, { threshold: THRESHOLD, confirm: CONFIRM }).then(function (made) {
    detector = made;
    self.postMessage({ type: "ready" });
  }, function (error) {
    self.postMessage({ type: "error", message: String((error && error.message) || error) });
  });
} catch (error) {
  self.postMessage({ type: "error", message: String((error && error.message) || error) });
}

self.onmessage = function (event) {
  var data = event.data || {};
  if (!detector) return;
  if (data.type === "reset") {
    queue = queue.then(function () { detector.reset(); });
    return;
  }
  if (data.type !== "audio") return;
  // Audio is scored in the order it arrived; each piece is acknowledged once it has been heard.
  queue = queue.then(function () {
    // Never combine the previous microphone session's audio with new audio.
    if (session !== data.session) {
      detector.reset();
      session = data.session;
    }
    return detector.accept(data.samples).then(function (score) {
      if (score != null) self.postMessage({ type: "heard", keyword: "HEY_RESQNOW", score: score, session: data.session });
      self.postMessage({ type: "processed", session: data.session });
    });
  }).catch(function (error) {
    self.postMessage({ type: "error", message: String((error && error.message) || error) });
  });
};
