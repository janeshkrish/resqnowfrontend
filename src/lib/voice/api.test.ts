import { afterEach, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { fetchVoiceStatus } from "./api";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
afterEach(() => { vi.resetAllMocks(); });
it("keeps a failed capability lookup distinct from a server-disabled feature", async () => {
  vi.mocked(apiFetch).mockResolvedValueOnce(new Response(null, { status: 503 }));
  await expect(fetchVoiceStatus()).rejects.toThrow();
  vi.mocked(apiFetch).mockResolvedValueOnce(Response.json({ enabled: false, ai: false, voice: false }));
  await expect(fetchVoiceStatus()).resolves.toMatchObject({ enabled: false });
});
