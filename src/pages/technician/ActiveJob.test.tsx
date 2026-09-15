import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import ActiveJob from "./ActiveJob";

const capture = vi.hoisted(() => ({ mapProps: null as Record<string, unknown> | null }));
const refreshActiveJob = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const activeJobState = vi.hoisted(() => ({ value: null as Record<string, unknown> | null }));

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
    activeJob: activeJobState.value,
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
    activeJobState.value = {
      id: "request-42",
      requestId: "request-42",
      status: "accepted",
      pickupLatitude: 12.97,
      pickupLongitude: 77.59,
      amount: 500,
    };
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });
  });

  it("never substitutes a fake technician location while GPS is unavailable", async () => {
    render(
      <MemoryRouter initialEntries={["/technician/active-job/request-42"]}>
        <Routes>
          <Route path="/technician/active-job/:requestId" element={<ActiveJob />} />
        </Routes>
      </MemoryRouter>,
    );

    await screen.findByTestId("active-job-map");
    expect(capture.mapProps?.technicianLocation).toBeUndefined();
    expect(screen.getByText(/acquiring accurate location/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start navigation/i })).toBeDisabled();
  });

  it("starts the journey only after accurate GPS and a road route are ready", async () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, status: "en-route" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: vi.fn((success: PositionCallback) => {
          success({
            coords: {
              latitude: 12.97,
              longitude: 77.59,
              accuracy: 12,
              altitude: null,
              altitudeAccuracy: null,
              heading: 45,
              speed: 8,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          } as GeolocationPosition);
          return 7;
        }),
        clearWatch: vi.fn(),
      },
    });

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

    act(() => {
      (capture.mapProps?.onRouteStateChange as ((value: unknown) => void) | undefined)?.({
        status: "ready",
        distanceKm: 2.4,
        durationMinutes: 8,
      });
    });
    fireEvent.click(await screen.findByRole("button", { name: /start navigation/i }));

    await waitFor(() =>
      expect(capture.mapProps?.navigationMode).toBe(true),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/technician-status"),
      expect.objectContaining({ method: "PATCH" }),
    );
    expect(open).not.toHaveBeenCalled();
  });

  it("starts towing navigation toward the state-aware target after its status succeeds", async () => {
    activeJobState.value = {
      id: "tow-42",
      requestId: "tow-42",
      status: "accepted",
      isTowing: true,
      pickupLatitude: 12.97,
      pickupLongitude: 77.59,
      destinationLatitude: 12.99,
      destinationLongitude: 77.61,
      amount: 900,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, status: "en_route_pickup" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: vi.fn((success: PositionCallback) => {
          success({
            coords: {
              latitude: 12.965,
              longitude: 77.585,
              accuracy: 10,
              altitude: null,
              altitudeAccuracy: null,
              heading: null,
              speed: null,
              toJSON: () => ({}),
            },
            timestamp: Date.now(),
            toJSON: () => ({}),
          } as GeolocationPosition);
          return 9;
        }),
        clearWatch: vi.fn(),
      },
    });

    render(
      <MemoryRouter initialEntries={["/technician/active-job/tow-42"]}>
        <Routes>
          <Route path="/technician/active-job/:requestId" element={<ActiveJob />} />
        </Routes>
      </MemoryRouter>,
    );

    act(() => {
      (capture.mapProps?.onRouteStateChange as ((value: unknown) => void) | undefined)?.({
        status: "ready",
        distanceKm: 1.8,
        durationMinutes: 6,
      });
    });
    fireEvent.click(await screen.findByRole("button", { name: /start pickup/i }));

    await waitFor(() => expect(capture.mapProps?.navigationMode).toBe(true));
    expect(capture.mapProps?.navigationDestination).toEqual({ lat: 12.97, lng: 77.59 });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/technician-status"),
      expect.objectContaining({
        body: JSON.stringify({ status: "en_route_pickup" }),
      }),
    );
  });
});
