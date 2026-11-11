import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { listen, speak } from "./speech";
import { useVoiceThozhan } from "@/hooks/useVoiceThozhan";

class Recognizer {
  static instances: Recognizer[] = [];
  static active: Recognizer;
  onstart?: () => void;
  onend?: () => void;
  onerror?: (event: { error: string }) => void;
  onresult?: (event: { results: { isFinal: boolean; 0: { transcript: string; confidence?: number } }[] }) => void;
  constructor() { Recognizer.active = this; Recognizer.instances.push(this); }
  start() {}
  stop() { this.onend?.(); }
  abort() {}
}
const segment = (transcript: string, isFinal = true) => ({ isFinal, 0: { transcript } });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); localStorage.clear(); Recognizer.instances = []; });

describe("customer speech capture", () => {
  it("assembles the current browser result list once and reports real readiness", async () => {
    vi.stubGlobal("SpeechRecognition", Recognizer);
    const ready = vi.fn(), final = vi.fn();
    await listen("tg", { onReady: ready, onFinal: final, onPartial: vi.fn(), onEnd: vi.fn(), onError: vi.fn() });
    const rec = Recognizer.active;
    expect(ready).not.toHaveBeenCalled();
    rec.onstart?.();
    rec.onresult?.({ results: [segment("my bike")] });
    rec.onresult?.({ results: [segment("my bike"), segment("has a puncture")] });
    rec.onend?.();
    expect(final).toHaveBeenCalledWith("my bike has a puncture");
    expect(ready).toHaveBeenCalledOnce();
  });
  it("keeps interrupted partial speech available for correction without updating the request", async () => {
    vi.stubGlobal("SpeechRecognition", Recognizer);
    const hook = renderHook(() => useVoiceThozhan({ garage: [], ai: false, onHandoff: vi.fn() }));
    await act(async () => { await hook.result.current.toggleMic(); });
    await act(async () => {
      const rec = Recognizer.active;
      rec.onresult?.({ results: [segment("my car needs towing", false)] });
      rec.onerror?.({ error: "network" });
      rec.onend?.();
    });
    expect(hook.result.current.draft.service).toBeNull();
    expect(hook.result.current.trouble).toBe("offline");
    expect(hook.result.current.reviewText).toBe("my car needs towing");
    hook.unmount();
  });
  it.each([0, 0.3])("keeps an uncertain final transcript (%s) editable and leaves the request empty", async confidence => {
    vi.stubGlobal("SpeechRecognition", Recognizer);
    const hook = renderHook(() => useVoiceThozhan({ garage: [], ai: false, onHandoff: vi.fn() }));
    await act(async () => { await hook.result.current.toggleMic(); });
    await act(async () => {
      Recognizer.active.onresult?.({ results: [{ isFinal: true, 0: { transcript: "my car needs towing", confidence } }] });
      Recognizer.active.onend?.();
    });
    expect(hook.result.current.draft.service).toBeNull();
    expect(hook.result.current.reviewText).toBe("my car needs towing");
    hook.unmount();
  });
  it("reopens the mic for a hands-free follow-up only after its prompt finishes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("SpeechRecognition", Recognizer);
    const hook = renderHook(() => useVoiceThozhan({ garage: [], ai: false, onHandoff: vi.fn() }));
    await act(async () => { hook.result.current.startHandsFree(); });
    const first = Recognizer.active;
    await act(async () => {
      first.onresult?.({ results: [segment("Ennoda bike puncture aayiduchu")] });
      first.onend?.();
    });
    expect(Recognizer.instances).toHaveLength(1);
    expect(hook.result.current.busy).toBe(true);
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(hook.result.current.draft.service).toBe("flat-tire");
    expect(hook.result.current.busy).toBe(false);
    expect(Recognizer.instances).toHaveLength(2);
    await act(async () => { hook.result.current.stopCapture(); });
    expect(hook.result.current.status).toBe("idle");
    hook.unmount();
  });
  it("uses a persisted Tamil recognition preference before the first utterance", async () => {
    localStorage.setItem("resqnow_thozhan_language", "ta");
    const hook = renderHook(() => useVoiceThozhan({ garage: [], ai: false, onHandoff: vi.fn() }));
    expect(hook.result.current.lang).toBe("ta");
    hook.unmount();
  });
  it("delivers a final result once when a recognizer repeats its end event", async () => {
    vi.stubGlobal("SpeechRecognition", Recognizer);
    const final = vi.fn(), end = vi.fn();
    await listen("en", { onFinal: final, onEnd: end, onPartial: vi.fn(), onError: vi.fn() });
    Recognizer.active.onresult?.({ results: [segment("my bike has a puncture")] });
    Recognizer.active.onend?.();
    Recognizer.active.onend?.();
    expect(final).toHaveBeenCalledOnce();
    expect(end).toHaveBeenCalledOnce();
  });
  it("stops a browser voice that never reports completion before releasing the turn", async () => {
    vi.useFakeTimers();
    let speaking = false;
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => [{ lang: "en-IN", name: "English" }],
      speak: () => { speaking = true; },
      cancel: () => { speaking = false; },
    });
    vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
    const finished = speak("Which vehicle is it?", "en");
    await vi.advanceTimersByTimeAsync(1);
    expect(speaking).toBe(true);
    await vi.advanceTimersByTimeAsync(12000);
    await finished;
    expect(speaking).toBe(false);
  });
});
