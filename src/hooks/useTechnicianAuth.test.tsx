import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => [] as string[]);

vi.mock("@/services/technicianAuthService", () => ({
  technicianAuthService: {
    fetchTechnicianProfile: vi.fn().mockResolvedValue(null),
    heartbeat: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn(async () => { calls.push("auth_logout"); }),
  },
}));

vi.mock("@/services/technicianAdminService", () => ({
  technicianAdminService: { approveTechnician: vi.fn(), rejectTechnician: vi.fn() },
}));

vi.mock("@/lib/api", () => ({
  getTechnicianToken: () => "test-token",
}));

vi.mock("@/lib/nativeBackgroundTracking", () => ({
  stopNativeBackgroundTracking: vi.fn(async (reason: string) => { calls.push(`native_stop:${reason}`); }),
}));

import { useTechnicianAuth } from "./useTechnicianAuth";

describe("technician logout", () => {
  it("stops native background tracking before signing the technician out", async () => {
    const { result } = renderHook(() => useTechnicianAuth());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.logout();
    });

    expect(calls).toEqual(["native_stop:logout", "auth_logout"]);
  });
});
