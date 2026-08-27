import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ActiveJob from "./ActiveJob";

const capture = vi.hoisted(() => ({ mapProps: null as Record<string, unknown> | null }));
const refreshActiveJob = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/components/technician/ActiveJobMap", () => ({
  default: (props: Record<string, unknown>) => {
    capture.mapProps = props;
    return <div data-testid="active-job-map" />;
  },
}));

vi.mock("@/components/technician/TechnicianJobCompletion", () => ({
  default: () => null,
}));

vi.mock("@/components/technician/CancelledJobCard", () => ({
  default: () => null,
}));

vi.mock("@/hooks/useTechnicianActiveJob", () => ({
  useTechnicianActiveJob: () => ({
    activeJob: {
      id: "request-42",
      requestId: "request-42",
      status: "accepted",
      pickupLatitude: 12.97,
      pickupLongitude: 77.59,
      amount: 500,
    },
    dues: 0,
    setDues: vi.fn(),
    refreshActiveJob,
    refreshDues: vi.fn(),
  }),
}));

vi.mock("@/contexts/TechnicianAuthContext", () => ({
  useTechnicianAuth: () => ({
    token: "test-token",
    technician: { id: "tech-1" },
  }),
}));

vi.mock("@/contexts/SocketContext", () => ({
  useSocket: () => ({ socket: { emit: vi.fn() } }),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: {},
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("technician active-job navigation", () => {
  beforeEach(() => {
    capture.mapProps = null;
    refreshActiveJob.mockClear();
  });

  it("keeps Navigate and START JOURNEY inside the active-job page", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, status: "en-route" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemoryRouter initialEntries={["/technician/active-job/request-42"]}>
        <Routes>
          <Route
            path="/technician/active-job/:requestId"
            element={<ActiveJob />}
          />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(await screen.findByRole("button", { name: /navigate/i }));
    await waitFor(() =>
      expect(capture.mapProps?.navigationMode).toBe(true),
    );

    act(() => {
      (capture.mapProps?.onExitNavigation as (() => void) | undefined)?.();
    });
    fireEvent.click(screen.getByRole("button", { name: /start journey/i }));

    await waitFor(() =>
      expect(capture.mapProps?.navigationMode).toBe(true),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/technician-status"),
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(open).not.toHaveBeenCalled();
  });
});
