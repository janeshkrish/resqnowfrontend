import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listen, setNaturalVoice, silence, speak } from "./speech";

type NativeEvent = { sessionId?: string; text?: string; error?: string };
const native = vi.hoisted(() => ({
  enabled: false,
  listen: vi.fn(), stop: vi.fn(), addListener: vi.fn(),
  speak: vi.fn(), silence: vi.fn(),
}));
const fetchAudio = vi.hoisted(() => vi.fn());
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => native.enabled, getPlatform: () => "android" },
  registerPlugin: () => native,
}));
vi.mock("./api", () => ({ fetchVoiceAudio: fetchAudio }));

const handlers = () => ({ onReady: vi.fn(), onPartial: vi.fn(), onFinal: vi.fn(), onError: vi.fn(), onEnd: vi.fn() });
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const callbacks = new Map<string, (event: NativeEvent) => void>();
const removed: ReturnType<typeof vi.fn>[] = [];

class BrowserRecognition {
  static all: BrowserRecognition[] = [];
  static failFirstSynchronously = false;
  lang = "";
  onstart?: () => void;
  onerror?: (event: { error: string }) => void;
  onend?: () => void;
  onresult?: (event: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void;
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() { BrowserRecognition.all.push(this); }
  start() {
    if (BrowserRecognition.failFirstSynchronously && BrowserRecognition.all.length === 1) {
      this.onerror?.({ error: "language-not-supported" });
      this.onend?.();
    }
  }
}

beforeEach(() => {
  native.enabled = false;
  native.listen.mockReset().mockResolvedValue(undefined);
  native.stop.mockReset().mockResolvedValue(undefined);
  native.silence.mockReset().mockResolvedValue(undefined);
  native.speak.mockReset().mockResolvedValue(undefined);
  callbacks.clear();
  removed.length = 0;
  native.addListener.mockReset().mockImplementation(async (event, callback) => {
    callbacks.set(event, callback);
    const remove = vi.fn().mockResolvedValue(undefined);
    removed.push(remove);
    return { remove };
  });
  BrowserRecognition.all = [];
  BrowserRecognition.failFirstSynchronously = false;
  vi.stubGlobal("SpeechRecognition", BrowserRecognition);
});
afterEach(() => { silence(); setNaturalVoice(false); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("recognition attempt ownership", () => {
  it("never opens native capture after cancellation during listener registration", async () => {
    native.enabled = true;
    let subscribed!: (value: { remove: ReturnType<typeof vi.fn> }) => void;
    const remove = vi.fn().mockResolvedValue(undefined);
    native.addListener.mockReturnValueOnce(new Promise(resolve => { subscribed = resolve; }));
    const heard = handlers();
    const session = await listen("tg", heard);
    session.abort?.();
    subscribed({ remove });
    await flush();
    expect(native.listen).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledOnce();
    expect(heard.onEnd).toHaveBeenCalledOnce();
  });

  it("keeps stop attached to the replacement when language fallback happens inside start", async () => {
    BrowserRecognition.failFirstSynchronously = true;
    const heard = handlers();
    const session = await listen("en", heard);
    await flush();
    expect(BrowserRecognition.all.map(rec => rec.lang)).toEqual(["en-IN", "ta-IN"]);
    session.stop();
    expect(BrowserRecognition.all[1].stop).toHaveBeenCalledOnce();
    expect(BrowserRecognition.all[0].stop).not.toHaveBeenCalled();
    expect(heard.onEnd).toHaveBeenCalledOnce();
  });

  it("ignores a retired language attempt's repeated end and result events", async () => {
    const heard = handlers();
    const session = await listen("tg", heard);
    const first = BrowserRecognition.all[0];
    const oldEnd = first.onend;
    const oldResult = first.onresult;
    first.onerror?.({ error: "language-not-supported" });
    first.onend?.();
    await flush();
    oldEnd?.();
    oldResult?.({ results: [{ isFinal: true, 0: { transcript: "stale first attempt" } }] });
    expect(BrowserRecognition.all).toHaveLength(2);
    expect(heard.onEnd).not.toHaveBeenCalled();
    expect(heard.onPartial).not.toHaveBeenCalled();
    session.abort?.();
  });

  it("uses only the current native session's readiness and text", async () => {
    native.enabled = true;
    const heard = handlers();
    const session = await listen("ta", heard);
    await flush();
    expect(heard.onReady).not.toHaveBeenCalled();
    callbacks.get("ready")?.({});
    callbacks.get("partial")?.({ sessionId: "previous", text: "old speech" });
    expect(heard.onReady).not.toHaveBeenCalled();
    expect(heard.onPartial).not.toHaveBeenCalled();
    const { sessionId } = native.listen.mock.calls[0][0];
    callbacks.get("ready")?.({ sessionId });
    expect(heard.onReady).toHaveBeenCalledOnce();
    session.abort?.();
    expect(native.stop).toHaveBeenCalledWith({ sessionId, discard: true });
    expect(removed.every(remove => remove.mock.calls.length === 1)).toBe(true);
  });

  it("provides bilingual roadside vocabulary as optional native recognition context", async () => {
    native.enabled = true;
    const session = await listen("tg", handlers());
    await flush();
    expect(native.listen.mock.calls[0][0].phrases).toEqual(expect.arrayContaining([
      "ResQNow", "puncture", "பஞ்சர்", "battery", "பேட்டரி", "petrol", "பெட்ரோல்",
    ]));
    session.abort?.();
  });

  it("does not deliver a final transcript after a native session has failed", async () => {
    native.enabled = true;
    const heard = handlers();
    const session = await listen("en", heard);
    await flush();
    const { sessionId } = native.listen.mock.calls[0][0];
    callbacks.get("error")?.({ sessionId, error: "network" });
    callbacks.get("final")?.({ sessionId, text: "stale result" });
    callbacks.get("end")?.({ sessionId });
    expect(heard.onError).toHaveBeenCalledWith("network");
    expect(heard.onFinal).not.toHaveBeenCalled();
    expect(heard.onEnd).toHaveBeenCalledOnce();
    session.abort?.();
  });
});

describe("speech cancellation", () => {
  it("prevents a delayed server clip from starting after silence", async () => {
    let deliver!: (value: Blob) => void;
    fetchAudio.mockReturnValue(new Promise(resolve => { deliver = resolve; }));
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("Audio", class { play = play; pause() {} });
    vi.stubGlobal("URL", { createObjectURL: vi.fn().mockReturnValue("blob:voice"), revokeObjectURL: vi.fn() });
    setNaturalVoice(true);
    const speaking = speak("எந்த வண்டி?", "ta");
    silence();
    deliver(new Blob(["audio"], { type: "audio/wav" }));
    await flush();
    expect(play).not.toHaveBeenCalled();
    await speaking;
  });

  it("prevents a delayed device voice from starting after silence", async () => {
    const synth = Object.assign(new EventTarget(), {
      getVoices: vi.fn().mockReturnValue([]),
      speak: vi.fn(), cancel: vi.fn(),
    });
    vi.stubGlobal("speechSynthesis", synth);
    vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
    const speaking = speak("Which vehicle?", "en");
    silence();
    synth.getVoices.mockReturnValue([{ lang: "en-IN", name: "English" }]);
    synth.dispatchEvent(new Event("voiceschanged"));
    await flush();
    expect(synth.speak).not.toHaveBeenCalled();
    await speaking;
  });

  it("does not let a canceled browser voice's watchdog interrupt the next turn", async () => {
    vi.useFakeTimers();
    const synth = {
      getVoices: () => [{ lang: "en-IN", name: "English" }],
      speak: vi.fn(), cancel: vi.fn(),
    };
    vi.stubGlobal("speechSynthesis", synth);
    vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
    const first = speak("Which vehicle?", "en");
    await flush();
    await vi.advanceTimersByTimeAsync(4000);
    silence();
    await first;
    const second = speak("Where are you?", "en");
    await flush();
    const cancellations = synth.cancel.mock.calls.length;
    await vi.advanceTimersByTimeAsync(9000);
    expect(synth.cancel).toHaveBeenCalledTimes(cancellations);
    silence();
    await second;
  });
});
