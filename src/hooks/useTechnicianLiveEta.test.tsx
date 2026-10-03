import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api";
import { TECHNICIAN_ETA_POLL_MS, useTechnicianLiveEta } from "./useTechnicianLiveEta";

vi.mock("@/lib/api", () => ({ apiFetch: vi.fn() }));
const api = vi.mocked(apiFetch);

const answer = (body: unknown, ok = true) => ({ ok, json: async () => body }) as unknown as Response;
/** What GET /api/technicians/me/active-job/eta sends when the backend has an ETA. */
const etaAnswer = (etaSeconds: number, calculatedAt: string, serverTime = calculatedAt) => ({
  eta: {
    requestId: "7201", etaSeconds, distanceMeters: 3900, trafficAware: true, provider: "mappls",
    calculatedAt, destinationLat: 11.0092, destinationLng: 76.9605,
  },
  serverTime,
});

describe("the technician's ETA from the backend", () => {
  beforeEach(() => {
    api.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => vi.useRealTimers());

  it("asks for the technician's own job and places the ETA on this device's clock", async () => {
    api.mockResolvedValue(answer(etaAnswer(1260, "2026-10-03T11:00:00.000Z", "2026-10-03T11:00:30.000Z")));
    const { result } = renderHook(() => useTechnicianLiveEta({ requestId: 7201, enabled: true }));

    await waitFor(() => expect(result.current).not.toBeNull());
    expect(api).toHaveBeenCalledWith("/api/technicians/me/active-job/eta?requestId=7201", { technician: true });
    expect(result.current?.eta).toMatchObject({ requestId: "7201", etaSeconds: 1260, trafficAware: true });
    // 21 minutes from when it was worked out, which was 30 seconds before the answer.
    const receivedAt = Number(result.current?.eta.receivedAt);
    expect(result.current?.arrivalAt).toBe(receivedAt + 1260_000 - 30_000);
  });

  it("does not ask while the technician is not on the way, or has no job", () => {
    renderHook(() => useTechnicianLiveEta({ requestId: 7201, enabled: false }));
    renderHook(() => useTechnicianLiveEta({ requestId: null, enabled: true }));
    expect(api).not.toHaveBeenCalled();
  });

  it("asks again every half minute and takes a newer calculation", async () => {
    api.mockResolvedValueOnce(answer(etaAnswer(1260, "2026-10-03T11:00:00.000Z")));
    const { result } = renderHook(() => useTechnicianLiveEta({ requestId: 7201, enabled: true }));
    await waitFor(() => expect(result.current?.eta.etaSeconds).toBe(1260));

    api.mockResolvedValueOnce(answer(etaAnswer(900, "2026-10-03T11:00:45.000Z")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TECHNICIAN_ETA_POLL_MS);
    });
    await waitFor(() => expect(result.current?.eta.etaSeconds).toBe(900));
    expect(api).toHaveBeenCalledTimes(2);
  });

  it("keeps what it has when the same calculation comes back, or none does", async () => {
    api.mockResolvedValueOnce(answer(etaAnswer(1260, "2026-10-03T11:00:00.000Z")));
    const { result } = renderHook(() => useTechnicianLiveEta({ requestId: 7201, enabled: true }));
    await waitFor(() => expect(result.current).not.toBeNull());
    const first = result.current;

    // The backend's cached answer again: it is no fresher than before.
    api.mockResolvedValueOnce(answer(etaAnswer(1260, "2026-10-03T11:00:00.000Z", "2026-10-03T11:00:30.000Z")));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TECHNICIAN_ETA_POLL_MS);
    });
    expect(result.current).toBe(first);

    // No ETA this time, a server error, then no network at all.
    api.mockResolvedValueOnce(answer({ eta: null, reason: "no_recent_location" }));
    api.mockResolvedValueOnce(answer({ error: "boom" }, false));
    api.mockRejectedValueOnce(new Error("offline"));
    for (let poll = 0; poll < 3; poll += 1) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(TECHNICIAN_ETA_POLL_MS);
      });
    }
    expect(api).toHaveBeenCalledTimes(5);
    expect(result.current).toBe(first);
  });

  it("starts afresh for another job, and stops asking when the journey is over", async () => {
    api.mockResolvedValue(answer(etaAnswer(1260, "2026-10-03T11:00:00.000Z")));
    const { result, rerender } = renderHook(
      ({ requestId, enabled }: { requestId: number; enabled: boolean }) => useTechnicianLiveEta({ requestId, enabled }),
      { initialProps: { requestId: 7201, enabled: true } },
    );
    await waitFor(() => expect(result.current).not.toBeNull());

    rerender({ requestId: 7300, enabled: true });
    // The other job's ETA is not carried over (this answer is for 7201, so it is ignored too).
    expect(result.current).toBeNull();
    await waitFor(() => expect(api).toHaveBeenLastCalledWith("/api/technicians/me/active-job/eta?requestId=7300", { technician: true }));
    expect(result.current).toBeNull();

    const asked = api.mock.calls.length;
    rerender({ requestId: 7300, enabled: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(TECHNICIAN_ETA_POLL_MS * 2);
    });
    expect(api).toHaveBeenCalledTimes(asked);
  });
});
