import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

type NativeFix = {
  jobId?: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  timestamp: number;
  sequenceId: number;
};
type NativeStatus = { state: string; reason?: string | null; jobId?: string | null };

const nativeTracking = vi.hoisted(() => ({
  enabled: false,
  start: vi.fn(),
  stop: vi.fn(),
  locationListeners: new Set<(fix: NativeFix) => void>(),
  statusListeners: new Set<(status: NativeStatus) => void>(),
}));

vi.mock("@/lib/nativeBackgroundTracking", () => ({
  isNativeBackgroundTrackingEnabled: () => nativeTracking.enabled,
  nativeBackgroundTracking: {
    start: (options: unknown) => nativeTracking.start(options),
    stop: (reason: string, jobId?: string) => nativeTracking.stop(reason, jobId),
    onLocation: async (listener: (fix: NativeFix) => void) => {
      nativeTracking.locationListeners.add(listener);
      return { remove: async () => { nativeTracking.locationListeners.delete(listener); } };
    },
    onStatus: async (listener: (status: NativeStatus) => void) => {
      nativeTracking.statusListeners.add(listener);
      return { remove: async () => { nativeTracking.statusListeners.delete(listener); } };
    },
  },
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

describe("technician active-job native background tracking (Android)", () => {
  const tree = () => (
    <MemoryRouter initialEntries={["/technician/active-job/request-42"]}>
      <Routes>
        <Route path="/technician/active-job/:requestId" element={<ActiveJob />} />
      </Routes>
    </MemoryRouter>
  );
  const renderActiveJob = () => render(tree());
  const emitFix = (fix: NativeFix) => act(() => {
    nativeTracking.locationListeners.forEach((listener) => listener(fix));
  });
  const emitStatus = (status: NativeStatus) => act(() => {
    nativeTracking.statusListeners.forEach((listener) => listener(status));
  });
  const locationCalls = (fetchMock: ReturnType<typeof vi.fn>) =>
    fetchMock.mock.calls.filter(([url]) => String(url).includes("/technicians/me/location"));

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    platform.native = true;
    nativeTracking.enabled = true;
    nativeTracking.start.mockReset().mockResolvedValue({ started: true, alreadyRunning: false });
    nativeTracking.stop.mockReset().mockResolvedValue(undefined);
    nativeTracking.locationListeners.clear();
    nativeTracking.statusListeners.clear();
    nativeGeolocation.checkPermissions.mockReset().mockResolvedValue({ location: "granted" });
    nativeGeolocation.requestPermissions.mockReset().mockResolvedValue({ location: "denied" });
    nativeGeolocation.watchPosition.mockReset().mockResolvedValue("plugin-watch-1");
    nativeGeolocation.clearWatch.mockReset().mockResolvedValue(undefined);
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
  });

  afterEach(() => {
    nativeTracking.enabled = false;
    platform.native = false;
  });

  it("starts the native service once for the job and never starts a second watcher", async () => {
    const { rerender } = renderActiveJob();

    await waitFor(() => expect(nativeTracking.start).toHaveBeenCalledOnce());
    expect(nativeTracking.start).toHaveBeenCalledWith({
      jobId: "request-42",
      technicianId: "tech-1",
      endpointUrl: expect.stringContaining("/api/technicians/me/location"),
      token: "test-token",
      sequenceFloor: expect.any(Number),
    });
    rerender(tree());
    await act(async () => { await Promise.resolve(); });
    expect(nativeTracking.start).toHaveBeenCalledOnce();
    expect(nativeGeolocation.watchPosition).not.toHaveBeenCalled();
  });

  it("delivers the service's fixes through the existing sender with the native sequence id", async () => {
    renderActiveJob();
    await waitFor(() => expect(nativeTracking.start).toHaveBeenCalledOnce());
    const timestamp = Date.now();

    emitFix({
      jobId: "request-42",
      latitude: 12.97,
      longitude: 77.59,
      accuracy: 6,
      speed: 7.5,
      heading: 90,
      timestamp,
      sequenceId: timestamp * 1000 + 7,
    });

    await waitFor(() => expect(locationCalls(fetchMock)).toHaveLength(1));
    const body = JSON.parse(String(locationCalls(fetchMock)[0][1]?.body));
    expect(body).toMatchObject({
      version: 1,
      jobId: "request-42",
      lat: 12.97,
      lng: 77.59,
      speed: 7.5,
      heading: 90,
      accuracy: 6,
      recordedAt: new Date(timestamp).toISOString(),
      sequenceId: timestamp * 1000 + 7,
    });
  });

  it("ignores fixes and status events that belong to another job", async () => {
    renderActiveJob();
    await waitFor(() => expect(nativeTracking.start).toHaveBeenCalledOnce());

    emitFix({ jobId: "request-99", latitude: 12.97, longitude: 77.59, timestamp: Date.now(), sequenceId: Date.now() * 1000 });
    emitStatus({ state: "stopped", reason: "AUTH_FAILED", jobId: "request-99" });
    await act(async () => { await Promise.resolve(); });

    expect(locationCalls(fetchMock)).toHaveLength(0);
    expect(screen.queryByText(/please sign in again/i)).not.toBeInTheDocument();
  });

  it("drops a fix the page could not send once the service reports the app is back in the foreground", async () => {
    fetchMock.mockImplementation((url: string) => String(url).includes("/technicians/me/location")
      ? Promise.reject(new Error("offline"))
      : Promise.resolve({ ok: true, status: 200, json: async () => ({ success: true }) }));
    renderActiveJob();
    await waitFor(() => expect(nativeTracking.start).toHaveBeenCalledOnce());
    emitFix({ jobId: "request-42", latitude: 12.97, longitude: 77.59, accuracy: 6, timestamp: Date.now(), sequenceId: Date.now() * 1000 });
    await waitFor(() => expect(locationCalls(fetchMock)).toHaveLength(1));
    await act(async () => { await Promise.resolve(); });

    // Backgrounded meanwhile: the service delivered newer fixes natively.
    emitStatus({ state: "delivery_js", jobId: "request-42" });
    act(() => { window.dispatchEvent(new Event("online")); });
    await act(async () => { await Promise.resolve(); });

    expect(locationCalls(fetchMock)).toHaveLength(1);
  });

  it("stops the service and removes its listeners when the job screen closes", async () => {
    const { unmount } = renderActiveJob();
    await waitFor(() => expect(nativeTracking.start).toHaveBeenCalledOnce());
    await waitFor(() => expect(nativeTracking.locationListeners.size).toBe(1));

    unmount();

    expect(nativeTracking.stop).toHaveBeenCalledWith("tracking_stopped", "request-42");
    await waitFor(() => expect(nativeTracking.locationListeners.size).toBe(0));
    expect(nativeTracking.statusListeners.size).toBe(0);
  });

  it("stops native tracking when the job completes and does not start it again", async () => {
    const { rerender } = renderActiveJob();
    await waitFor(() => expect(nativeTracking.start).toHaveBeenCalledOnce());

    activeJobState.value = { ...activeJobState.value, status: "service_completed" };
    rerender(tree());

    await waitFor(() => expect(nativeTracking.stop).toHaveBeenCalledWith("tracking_stopped", "request-42"));
    expect(nativeTracking.start).toHaveBeenCalledOnce();
  });

  it("switches the service to the next job with a sequence floor that keeps ids increasing", async () => {
    const { rerender } = renderActiveJob();
    await waitFor(() => expect(nativeTracking.start).toHaveBeenCalledOnce());
    const timestamp = Date.now();
    emitFix({ jobId: "request-42", latitude: 12.97, longitude: 77.59, accuracy: 6, timestamp, sequenceId: timestamp * 1000 + 50 });

    activeJobState.value = { ...activeJobState.value, id: "request-43", requestId: "request-43" };
    rerender(tree());

    await waitFor(() => expect(nativeTracking.start).toHaveBeenCalledTimes(2));
    expect(nativeTracking.stop).toHaveBeenCalledWith("tracking_stopped", "request-42");
    const nextStart = nativeTracking.start.mock.calls[1][0] as { jobId: string; sequenceFloor: number };
    expect(nextStart.jobId).toBe("request-43");
    expect(nextStart.sequenceFloor).toBeGreaterThanOrEqual(timestamp * 1000 + 50);
    // The old job's stop is requested before the new job's start.
    expect(nativeTracking.stop.mock.invocationCallOrder[0]).toBeLessThan(nativeTracking.start.mock.invocationCallOrder[1]);
  });

  it("falls back to the foreground watcher when the service cannot start", async () => {
    nativeTracking.start.mockRejectedValue(Object.assign(new Error("off"), { code: "LOCATION_DISABLED" }));

    renderActiveJob();

    await waitFor(() => expect(nativeGeolocation.watchPosition).toHaveBeenCalledOnce());
    expect(nativeTracking.locationListeners.size).toBe(0);
    expect(nativeTracking.statusListeners.size).toBe(0);
  });

  it("starts neither the service nor a watcher without location permission", async () => {
    nativeGeolocation.checkPermissions.mockResolvedValue({ location: "prompt" });

    renderActiveJob();

    await waitFor(() => expect(screen.getByText(/location permission is required/i)).toBeInTheDocument());
    expect(nativeTracking.start).not.toHaveBeenCalled();
    expect(nativeGeolocation.watchPosition).not.toHaveBeenCalled();
  });

  it("tells the technician to sign in again when the service reports an auth failure", async () => {
    renderActiveJob();
    await waitFor(() => expect(nativeTracking.statusListeners.size).toBe(1));

    emitStatus({ state: "stopped", reason: "AUTH_FAILED", jobId: "request-42" });

    expect(await screen.findByText(/please sign in again/i)).toBeInTheDocument();
  });
});
