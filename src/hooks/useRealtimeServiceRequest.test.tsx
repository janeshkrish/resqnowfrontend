import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { useRealtimeServiceRequest } from "./useRealtimeServiceRequest";

const socketHarness = vi.hoisted(() => {
  const handlers = new Map<string, (data: unknown) => void>();
  return {
    handlers,
    socket: {
      connected: true,
      on: vi.fn((event: string, handler: (data: unknown) => void) => {
        handlers.set(event, handler);
      }),
      off: vi.fn(),
      emit: vi.fn(),
      disconnect: vi.fn(),
    },
  };
});

const apiFetch = vi.hoisted(() => vi.fn());

vi.mock("socket.io-client", () => ({
  io: () => socketHarness.socket,
}));

vi.mock("@/lib/api", () => ({
  apiFetch,
  apiUrl: (value: string) => value,
  FRONTEND_ONLY_MODE: false,
  getRequiredApiBaseUrl: () => "http://localhost:3000",
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

vi.mock("@/contexts/SocketContext", () => ({
  useSocket: () => ({ socket: socketHarness.socket, isConnected: true }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn() },
}));

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
});

describe("useRealtimeServiceRequest technician route metrics", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    socketHarness.handlers.clear();
    vi.clearAllMocks();
    apiFetch.mockImplementation(async (path: string) => ({
      ok: true,
      json: async () => ({
        id: path.split("/").pop() || "request-1",
        isTowing: false,
        user_id: "user-1",
        status: "en-route",
        service_type: "puncture",
        created_at: "2026-09-15T00:00:00.000Z",
        payment_status: "pending",
        technician: {
          id: "technician-1",
          name: "Test Technician",
          phone: "9999999999",
          rating: 4.8,
          location_lat: 12.96,
          location_lng: 77.58,
        },
      }),
    }));

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  const liveEtaOf = (value: ReturnType<typeof useRealtimeServiceRequest> | undefined) =>
    value?.technician?.liveEta ?? null;

  const renderHarness = async (requestId = "request-1") => {
    const state: { result?: ReturnType<typeof useRealtimeServiceRequest> } = {};
    const Harness = ({ id }: { id: string }) => {
      state.result = useRealtimeServiceRequest(id);
      return null;
    };
    await act(async () => {
      root.render(<Harness id={requestId} />);
      await Promise.resolve();
    });
    return {
      state,
      rerender: async (id: string) => {
        await act(async () => {
          root.render(<Harness id={id} />);
          await Promise.resolve();
          await Promise.resolve();
        });
      },
    };
  };

  const emit = (eventName: string, data: Record<string, unknown>) => {
    act(() => {
      socketHarness.handlers.get(eventName)?.(data);
    });
  };

  it.each(["tracking:location:v1", "location_update", "technician:location_update"])(
    "keeps the ETA when a later %s event carries only GPS",
    async (eventName) => {
      const { state } = await renderHarness();
      expect(state.result?.technician?.id).toBe("technician-1");

      emit(eventName, {
        requestId: "request-1",
        lat: 12.97,
        lng: 77.59,
        distanceKm: 12.3,
        durationMinutes: 17,
        etaText: "17 min",
        etaSource: "road_route",
        receivedAt: "2026-09-26T10:00:00.000Z",
      });

      expect(state.result?.technician).toMatchObject({ location_lat: 12.97, location_lng: 77.59 });
      expect(liveEtaOf(state.result)).toMatchObject({
        requestId: "request-1",
        etaSeconds: 17 * 60,
        distanceMeters: 12_300,
        trafficAware: false,
        provider: "road_route",
      });

      await act(async () => {
        state.result?.refresh();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(liveEtaOf(state.result)).toMatchObject({ etaSeconds: 17 * 60 });

      emit(eventName, {
        requestId: "request-1",
        lat: 12.98,
        lng: 77.6,
        receivedAt: "2026-09-26T10:00:03.000Z",
      });

      expect(state.result?.technician).toMatchObject({ location_lat: 12.98, location_lng: 77.6 });
      expect(liveEtaOf(state.result)).toMatchObject({ etaSeconds: 17 * 60, distanceMeters: 12_300 });
    }
  );

  it("reads the normalized traffic-aware ETA the backend attaches to each location", async () => {
    const { state } = await renderHarness();

    emit("tracking:location:v1", {
      requestId: "request-1",
      technicianId: "technician-1",
      lat: 12.97,
      lng: 77.59,
      eta: {
        requestId: "request-1",
        technicianLat: 12.97,
        technicianLng: 77.59,
        destinationLat: 12.9,
        destinationLng: 77.5,
        etaSeconds: 1_260,
        distanceMeters: 9_800,
        trafficAware: true,
        provider: "mappls",
        calculatedAt: "2026-09-26T10:00:00.000Z",
      },
    });

    expect(liveEtaOf(state.result)).toMatchObject({
      etaSeconds: 1_260,
      distanceMeters: 9_800,
      trafficAware: true,
      provider: "mappls",
      destinationLat: 12.9,
      destinationLng: 77.5,
      calculatedAt: Date.parse("2026-09-26T10:00:00.000Z"),
    });
  });

  it("replaces the ETA only with a newer calculation", async () => {
    const { state } = await renderHarness();
    const withEta = (etaSeconds: number, calculatedAt: string, recordedAt: string) => ({
      requestId: "request-1",
      technicianId: "technician-1",
      lat: 12.97,
      lng: 77.59,
      recordedAt,
      eta: { requestId: "request-1", etaSeconds, distanceMeters: 5_000, trafficAware: true, provider: "mappls", calculatedAt },
    });

    emit("tracking:location:v1", withEta(900, "2026-09-26T10:00:30.000Z", "2026-09-26T10:00:30.000Z"));
    expect(liveEtaOf(state.result)?.etaSeconds).toBe(900);

    // A newer GPS fix that still carries an older cached calculation.
    emit("tracking:location:v1", withEta(1_200, "2026-09-26T10:00:00.000Z", "2026-09-26T10:00:35.000Z"));
    expect(liveEtaOf(state.result)?.etaSeconds).toBe(900);

    emit("tracking:location:v1", withEta(840, "2026-09-26T10:01:15.000Z", "2026-09-26T10:01:15.000Z"));
    expect(liveEtaOf(state.result)?.etaSeconds).toBe(840);
  });

  it("drops an ETA that is not refreshed in time, even while GPS keeps arriving", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T10:00:00.000Z"));
    const { state } = await renderHarness();
    const cachedEta = {
      requestId: "request-1",
      etaSeconds: 600,
      distanceMeters: 4_000,
      trafficAware: true,
      provider: "mappls",
      calculatedAt: "2026-09-26T10:00:00.000Z",
    };

    emit("tracking:location:v1", { requestId: "request-1", lat: 12.97, lng: 77.59, eta: cachedEta });
    expect(liveEtaOf(state.result)?.etaSeconds).toBe(600);

    for (let second = 30; second <= 150; second += 30) {
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      // The same cached calculation re-sent with each fix must not extend its life.
      emit("tracking:location:v1", {
        requestId: "request-1",
        lat: 12.97 + second / 100_000,
        lng: 77.59,
        recordedAt: new Date(Date.now()).toISOString(),
        eta: cachedEta,
      });
      expect(liveEtaOf(state.result)?.etaSeconds).toBe(600);
    }

    await act(async () => { await vi.advanceTimersByTimeAsync(31_000); });
    expect(liveEtaOf(state.result)).toBeNull();
  });

  it("clears the ETA when the request changes but the technician does not", async () => {
    const { state, rerender } = await renderHarness();

    emit("technician:location_update", {
      requestId: "request-1",
      lat: 12.97,
      lng: 77.59,
      distanceKm: 12.3,
      durationMinutes: 17,
    });
    expect(liveEtaOf(state.result)).toMatchObject({ distanceMeters: 12_300 });

    await rerender("request-2");

    expect(liveEtaOf(state.result)).toBeNull();
  });

  it("clears the ETA and ignores late ETAs once the request is cancelled", async () => {
    const { state } = await renderHarness();

    emit("tracking:location:v1", {
      requestId: "request-1",
      lat: 12.97,
      lng: 77.59,
      distanceKm: 3,
      durationMinutes: 6,
    });
    expect(liveEtaOf(state.result)).not.toBeNull();

    const loadRequest = apiFetch.getMockImplementation()!;
    apiFetch.mockImplementation(async (path: string) => {
      const body = await (await loadRequest(path)).json();
      return { ok: true, json: async () => ({ ...body, status: "cancelled" }) };
    });
    await act(async () => {
      socketHarness.handlers.get("job:status_update")?.({ requestId: "request-1", status: "cancelled" });
      await Promise.resolve();
    });
    expect(liveEtaOf(state.result)).toBeNull();

    emit("tracking:location:v1", {
      requestId: "request-1",
      lat: 12.971,
      lng: 77.591,
      distanceKm: 2.5,
      durationMinutes: 5,
    });
    expect(liveEtaOf(state.result)).toBeNull();
  });

  it("ignores a location event from another technician", async () => {
    const { state } = await renderHarness();

    emit("technician:location_update", {
      requestId: "request-1",
      technicianId: "another-technician",
      lat: 28.61,
      lng: 77.21,
      distanceKm: 5.4,
      durationMinutes: 12,
    });

    expect(state.result?.technician).toMatchObject({
      id: "technician-1",
      location_lat: 12.96,
      location_lng: 77.58,
    });
    expect(liveEtaOf(state.result)).toBeNull();
  });

  it("rejects a delayed ETA for an older technician coordinate", async () => {
    const { state } = await renderHarness();

    emit("location_update", {
      requestId: "request-1",
      technicianId: "technician-1",
      lat: 12.98,
      lng: 77.6,
      locationUpdatedAt: "2026-09-16T10:00:02.000Z",
    });

    emit("technician:location_update", {
      requestId: "request-1",
      technicianId: "technician-1",
      lat: 12.97,
      lng: 77.59,
      distanceKm: 12.3,
      durationMinutes: 17,
      locationUpdatedAt: "2026-09-16T10:00:01.000Z",
    });

    expect(state.result?.technician).toMatchObject({
      location_lat: 12.98,
      location_lng: 77.6,
    });
    expect(liveEtaOf(state.result)).toBeNull();
  });

  it("keeps the newer Socket.IO coordinate when the status recovery poll returns an older snapshot", async () => {
    vi.useFakeTimers();
    let result: ReturnType<typeof useRealtimeServiceRequest> | undefined;
    const Harness = () => {
      result = useRealtimeServiceRequest("request-1");
      return null;
    };

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    act(() => {
      socketHarness.handlers.get("tracking:location:v1")?.({
        requestId: "request-1",
        technicianId: "technician-1",
        lat: 12.98,
        lng: 77.6,
        recordedAt: "2026-09-17T10:00:02.000Z",
        sequenceId: 2,
      });
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(result?.technician).toMatchObject({
      location_lat: 12.98,
      location_lng: 77.6,
      sequenceId: 2,
    });
  });

  it("applies the canonical P1 through P4 stream to customer map state and restores LIVE freshness", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T10:00:15.000Z"));
    let result: ReturnType<typeof useRealtimeServiceRequest> | undefined;
    const Harness = () => {
      result = useRealtimeServiceRequest("request-1");
      return null;
    };

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    const points = [
      [11.0000, 76.0000, 100],
      [11.0010, 76.0010, 101],
      [11.0020, 76.0020, 102],
      [11.0030, 76.0030, 103],
    ];
    for (const [lat, lng, sequenceId] of points) {
      act(() => {
        socketHarness.handlers.get("tracking:location:v1")?.({
          requestId: "request-1",
          technicianId: "technician-1",
          lat,
          lng,
          sequenceId,
          recordedAt: new Date(Date.now()).toISOString(),
          receivedAt: new Date(Date.now()).toISOString(),
        });
      });
      expect(result?.technician).toMatchObject({ location_lat: lat, location_lng: lng, sequenceId });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_000);
      });
    }

    expect(result?.trackingFreshness).toBe("LIVE");
  });

  it("stays LIVE between stationary heartbeats and ignores repeated events for the cadence", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-25T10:00:00.000Z"));
    let result: ReturnType<typeof useRealtimeServiceRequest> | undefined;
    const Harness = () => {
      result = useRealtimeServiceRequest("request-1");
      return null;
    };

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    const deliver = (sequenceId: number) => {
      const point = {
        requestId: "request-1",
        technicianId: "technician-1",
        lat: 11,
        lng: 76,
        sequenceId,
        recordedAt: new Date(Date.now()).toISOString(),
        receivedAt: new Date(Date.now()).toISOString(),
      };
      act(() => {
        // The backend emits each accepted fix under both event names.
        socketHarness.handlers.get("tracking:location:v1")?.(point);
        socketHarness.handlers.get("technician:location_update")?.(point);
      });
    };

    deliver(200);
    await act(async () => { await vi.advanceTimersByTimeAsync(12_000); });
    deliver(201);
    await act(async () => { await vi.advanceTimersByTimeAsync(11_000); });

    expect(result?.trackingFreshness).toBe("LIVE");

    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(result?.trackingFreshness).toBe("DELAYED");
  });
});
