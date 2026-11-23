import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyDraft } from "@/lib/voice/engine";
import VoiceThozhanPage from "./VoiceThozhanPage";

const { handsFree, toggleMic, stopCapture, status } = vi.hoisted(() => ({
  handsFree: vi.fn(), toggleMic: vi.fn(), stopCapture: vi.fn(),
  status: { enabled: true, ai: false, voice: false, wake: true, recognition: true },
}));
vi.mock("@/hooks/useVoiceEnabled", () => ({ useVoiceStatus: () => ({ data: status }) }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }) }));
vi.mock("@/components/voice/Thozhan", () => ({ default: () => null }));
vi.mock("@/components/voice/VoiceWave", () => ({ default: () => null }));
vi.mock("@/hooks/useVoiceThozhan", () => ({ useVoiceThozhan: () => ({
  draft: emptyDraft(), turns: [], phase: "convo", step: null, lang: "en", langPref: "en", picks: [], place: null,
  status: "idle", busy: false, mood: "idle", reviewText: "", trouble: null,
  startHandsFree: handsFree, toggleMic, stopCapture,
}) }));

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(status, { enabled: true, ai: false, voice: false, wake: true, recognition: true });
  vi.stubEnv("VITE_NATIVE_BUILD", "true");
  vi.stubEnv("VITE_NATIVE_WAKE_ENABLED", "false");
});
afterEach(() => vi.unstubAllEnvs());

async function openWakeLink() {
  await act(async () => { render(<MemoryRouter initialEntries={["/thozhan?wake=1"]}><VoiceThozhanPage /></MemoryRouter>); });
}

it("a restored wake link cannot start native capture while automatic wake is disabled; tapping the mic still works", async () => {
  await openWakeLink();
  expect(handsFree).not.toHaveBeenCalled();
  const mic = screen.getAllByRole("button", { name: "Talk to ResQNow-Thozhan" })[0];
  expect(mic).toBeEnabled();
  fireEvent.click(mic);
  expect(toggleMic).toHaveBeenCalledTimes(1);
});

it("keeps automatic wake handoff on the website when the server permits it", async () => {
  vi.stubEnv("VITE_NATIVE_BUILD", "false");
  await openWakeLink();
  expect(handsFree).toHaveBeenCalledTimes(1);
});

it.each(["wake", "recognition"] as const)("never overrides the server %s kill switch", async (field) => {
  vi.stubEnv("VITE_NATIVE_WAKE_ENABLED", "true");
  status[field] = false;
  await openWakeLink();
  expect(handsFree).not.toHaveBeenCalled();
});
