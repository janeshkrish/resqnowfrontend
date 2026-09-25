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

const platform = vi.hoisted(() => ({ native: false }));
const nativeGeolocation = vi.hoisted(() => ({
  checkPermissions: vi.fn(),
  requestPermissions: vi.fn(),
  watchPosition: vi.fn(),
  clearWatch: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => platform.native },
}));

vi.mock("@capacitor/geolocation", () => ({
  Geolocation: nativeGeolocation,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("technician active-job navigation", () => {
  beforeEach(() => {
    capture.mapProps = null;
    platform.native = false;
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

  it("reopens embedded navigation from an arrived dashboard job once GPS and route are ready", async () => {
    activeJobState.value = {
      id: "request-42",
      requestId: "request-42",
      status: "arrived",
      pickupLatitude: 12.97,
      pickupLongitude: 77.59,
      amount: 500,
    };
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: vi.fn((success: PositionCallback) => {
          success({
            coords: {
              latitude: 12.969,
              longitude: 77.589,
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
          return 11;
        }),
        clearWatch: vi.fn(),
      },
    });

    render(
      <MemoryRouter
        initialEntries={[{
          pathname: "/technician/active-job/request-42",
          state: { openNavigation: true },
        }]}
      >
        <Routes>
          <Route path="/technician/active-job/:requestId" element={<ActiveJob />} />
        </Routes>
      </MemoryRouter>,
    );

    act(() => {
      (capture.mapProps?.onRouteStateChange as ((value: unknown) => void) | undefined)?.({
        status: "ready",
        distanceKm: 0.2,
        durationMinutes: 1,
      });
    });

    await waitFor(() => expect(capture.mapProps?.navigationMode).toBe(true));
  });
});

describe("technician active-job live location sending", () => {
  const position = (latitude: number, timestamp: number) => ({
    coords: {
      latitude,
      longitude: 77.59,
      accuracy: 6,
      altitude: null,
      altitudeAccuracy: null,
      heading: 90,
      speed: 0,
      toJSON: () => ({}),
    },
    timestamp,
    toJSON: () => ({}),
  } as GeolocationPosition);

  const locationCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls.filter(([url]) => String(url).includes("/technicians/me/location"));

  const renderActiveJob = () => render(
    <MemoryRouter initialEntries={["/technician/active-job/request-42"]}>
      <Routes>
        <Route path="/technician/active-job/:requestId" element={<ActiveJob />} />
      </Routes>
    </MemoryRouter>,
  );

  let emitFix: PositionCallback | null = null;
  let clearWatch: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    platform.native = false;
    emitFix = null;
    clearWatch = vi.fn();
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true }) });
    vi.stubGlobal("fetch", fetchMock);
    activeJobState.value = {
      id: "request-42",
      requestId: "request-42",
      status: "en-route",
      pickupLatitude: 12.97,
      pickupLongitude: 77.59,
      amount: 500,
    };
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        watchPosition: vi.fn((success: PositionCallback) => {
          emitFix = success;
          return 7;
        }),
        clearWatch,
      },
    });
  });

  it("sends the first fix, holds stationary jitter for the heartbeat, and stops on unmount", async () => {
    const { unmount } = renderActiveJob();
    await waitFor(() => expect(emitFix).not.toBeNull());
    const start = Date.now();

    act(() => emitFix?.(position(12.97, start)));
    await waitFor(() => expect(locationCalls(fetchMock)).toHaveLength(1));
    const firstBody = JSON.parse(String(locationCalls(fetchMock)[0][1]?.body));
    expect(firstBody).toMatchObject({
      version: 1,
      technicianId: "tech-1",
      jobId: "request-42",
      lat: 12.97,
      lng: 77.59,
      heading: 90,
      speed: 0,
      accuracy: 6,
      recordedAt: new Date(start).toISOString(),
    });

    act(() => {
      emitFix?.(position(12.97001, start + 1_000));
      emitFix?.(position(12.97002, start + 2_000));
    });
    await Promise.resolve();
    expect(locationCalls(fetchMock)).toHaveLength(1);

    unmount();
    expect(clearWatch).toHaveBeenCalledWith(7);
    act(() => emitFix?.(position(12.98, start + 20_000)));
    expect(locationCalls(fetchMock)).toHaveLength(1);
  });

  it("does not transmit locations once the request has ended", async () => {
    activeJobState.value = { ...activeJobState.value, status: "service_completed" };
    renderActiveJob();
    await waitFor(() => expect(emitFix).not.toBeNull());

    act(() => emitFix?.(position(12.97, Date.now())));
    await Promise.resolve();

    expect(locationCalls(fetchMock)).toHaveLength(0);
  });

  it("clears a native watch that finished starting after the job page unmounted", async () => {
    platform.native = true;
    let resolveWatch: (id: string) => void = () => {};
    nativeGeolocation.checkPermissions.mockResolvedValue({ location: "granted" });
    nativeGeolocation.watchPosition.mockImplementation(() => new Promise<string>((resolve) => {
      resolveWatch = resolve;
    }));
    nativeGeolocation.clearWatch.mockResolvedValue(undefined);

    const { unmount } = renderActiveJob();
    await waitFor(() => expect(nativeGeolocation.watchPosition).toHaveBeenCalled());
    unmount();
    expect(nativeGeolocation.clearWatch).not.toHaveBeenCalled();

    await act(async () => { resolveWatch("native-watch-1"); });

    expect(nativeGeolocation.clearWatch).toHaveBeenCalledWith({ id: "native-watch-1" });
  });
});
