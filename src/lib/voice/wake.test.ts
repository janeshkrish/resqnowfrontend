import { afterEach, describe, expect, it, vi } from "vitest";
import { listensHere, onWakeWordChange, setWakeWord, to16k, wakeWordOn } from "./wake";

describe("“Hey ResQNow”", () => {
  afterEach(() => localStorage.clear());

  it("is off until the customer turns it on, and tells listeners when it changes", () => {
    expect(wakeWordOn()).toBe(false);
    const seen = vi.fn();
    const stop = onWakeWordChange(seen);
    setWakeWord(true);
    expect(wakeWordOn()).toBe(true);
    expect(seen).toHaveBeenLastCalledWith(true);
    setWakeWord(false);
    expect(seen).toHaveBeenLastCalledWith(false);
    stop();
    setWakeWord(true);
    expect(seen).toHaveBeenCalledTimes(2);
  });

  it("listens on the customer's pages only", () => {
    for (const path of ["/", "/services", "/my-requests", "/request-service/flat-tire/bike", "/request-service-tracking/12", "/settings"]) {
      expect(listensHere(path), path).toBe(true);
    }
    // Thozhan is listening already; sign-in pages and the technician and admin apps are not the customer's.
    for (const path of ["/thozhan", "/login", "/register", "/otp-verify", "/technician/dashboard", "/admin", "/admin/requests"]) {
      expect(listensHere(path), path).toBe(false);
    }
  });

  it("turns microphone audio into the 16 kHz the listener hears", () => {
    const at48k = Float32Array.from({ length: 4800 }, (_, i) => (i % 3 === 0 ? 0.3 : 0));
    const out = to16k(at48k, 48000);
    expect(out.length).toBe(1600);
    expect(out[0]).toBeCloseTo(0.1);
    const same = new Float32Array([0.1, 0.2]);
    expect(Array.from(to16k(same, 16000))).toEqual([expect.closeTo(0.1), expect.closeTo(0.2)]);
    expect(to16k(new Float32Array(441), 44100).length).toBe(160);
  });
});
