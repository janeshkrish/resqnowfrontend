import { afterEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { askVoiceAi, fetchVoiceAudio, fetchVoiceStatus } from "./api";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); vi.resetAllMocks(); vi.useRealTimers(); });
it("keeps a failed capability lookup distinct from a server-disabled feature", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(new Response(null, { status: 503 }));
  await expect(fetchVoiceStatus()).rejects.toThrow();
  vi.mocked(apiFetch).mockResolvedValueOnce(Response.json({ enabled: false, ai: false, voice: false }));
  await expect(fetchVoiceStatus()).resolves.toMatchObject({ enabled: false });
});

it.each([
  ['understanding', (signal: AbortSignal) => askVoiceAi({text:'Help with my vehicle'}, signal), 5500],
  ['speech', (signal: AbortSignal) => fetchVoiceAudio('Which vehicle?', 'en-IN', signal), 7500],
] as const)('keeps the %s deadline when the caller supplies cancellation', async (_name, run, deadline) => {
  vi.useFakeTimers();
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  });
  vi.mocked(apiFetch).mockImplementation((_path, options) => new Promise((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), {once:true});
  }));
  const controller = new AbortController();
  let settled = false;
  const work = run(controller.signal).then(value => {settled = true; return value;});
  try {
    await vi.advanceTimersByTimeAsync(deadline + 1);
    expect(settled).toBe(true);
    await expect(work).resolves.toBeNull();
  } finally {controller.abort();}
});
