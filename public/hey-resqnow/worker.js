/*
 * "Hey ResQNow" listener (src/lib/voice/wake.ts). The page sends the microphone's audio here at
 * 16 kHz; sherpa-onnx's keyword spotter (Apache-2.0, built for the browser with its model packed in
 * sherpa-onnx-wasm-kws-main.data) listens for the phrase. Nothing leaves the device.
 */
/* global createKws, importScripts */

// "Hey / Hi / Hai ResQNow", said "rescue now", as the model's word pieces (U+2581 starts a word).
var W = "\u2581";
var KEYWORDS = [
  W + "HE Y " + W + "RE S C U E " + W + "NOW @HEY_RESQNOW",
  W + "HI " + W + "RE S C U E " + W + "NOW @HEY_RESQNOW",
  W + "HA I " + W + "RE S C U E " + W + "NOW @HEY_RESQNOW",
].join("\n");

var kws = null;
var stream = null;

self.Module = {
  locateFile: function (path) { return path; },
  onRuntimeInitialized: function () {
    try {
      kws = createKws(self.Module, {
        featConfig: { samplingRate: 16000, featureDim: 80 },
        modelConfig: {
          transducer: {
            encoder: "./encoder-epoch-12-avg-2-chunk-16-left-64.onnx",
            decoder: "./decoder-epoch-12-avg-2-chunk-16-left-64.onnx",
            joiner: "./joiner-epoch-12-avg-2-chunk-16-left-64.onnx",
          },
          tokens: "./tokens.txt",
          provider: "cpu",
          modelType: "",
          numThreads: 1,
          debug: 0,
          modelingUnit: "bpe",
          bpeVocab: "",
        },
        maxActivePaths: 4,
        numTrailingBlanks: 1,
        keywordsScore: 2.5,
        keywordsThreshold: 0.08,
        keywords: KEYWORDS,
      });
      stream = kws.createStream();
      self.postMessage({ type: "ready" });
    } catch (error) {
      self.postMessage({ type: "error", message: String((error && error.message) || error) });
    }
  },
};

try {
  importScripts("sherpa-onnx-kws.js", "sherpa-onnx-wasm-kws-main.js");
} catch (error) {
  self.postMessage({ type: "error", message: String((error && error.message) || error) });
}

self.onmessage = function (event) {
  var data = event.data || {};
  if (!kws || !stream) return;
  if (data.type === "reset") {
    kws.reset(stream);
    return;
  }
  if (data.type !== "audio") return;
  stream.acceptWaveform(16000, data.samples);
  while (kws.isReady(stream)) {
    kws.decode(stream);
    var result = kws.getResult(stream);
    if (result && result.keyword) {
      kws.reset(stream);
      self.postMessage({ type: "heard", keyword: result.keyword });
    }
  }
};
