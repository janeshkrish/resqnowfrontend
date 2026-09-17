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

  it.each(["location_update", "technician:location_update"])(
    "stores route metrics from the latest %s event and clears stale metrics",
    async (eventName) => {
      let result: ReturnType<typeof useRealtimeServiceRequest> | undefined;
      const Harness = () => {
        result = useRealtimeServiceRequest("request-1");
        return null;
      };

      await act(async () => {
        root.render(<Harness />);
        await Promise.resolve();
      });
      expect(result?.technician?.id).toBe("technician-1");

      act(() => {
        socketHarness.handlers.get(eventName)?.({
          requestId: "request-1",
          lat: 12.97,
          lng: 77.59,
          distanceKm: 12.3,
          durationMinutes: 17,
          etaText: "17 min",
          etaSource: "mappls",
        });
      });

      expect(result?.technician).toMatchObject({
        location_lat: 12.97,
        location_lng: 77.59,
        routeDistanceKm: 12.3,
        routeEtaMinutes: 17,
        routeEtaText: "17 min",
        routeEtaSource: "mappls",
        routeLocationLat: 12.97,
        routeLocationLng: 77.59,
      });

      await act(async () => {
        result?.refresh();
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result?.technician).toMatchObject({
        routeDistanceKm: 12.3,
        routeEtaMinutes: 17,
        routeEtaText: "17 min",
        routeEtaSource: "mappls",
      });

      act(() => {
        socketHarness.handlers.get(eventName)?.({
          requestId: "request-1",
          lat: 12.98,
          lng: 77.6,
        });
      });

      expect(result?.technician).toMatchObject({
        location_lat: 12.98,
        location_lng: 77.6,
      });
      expect(
        (result?.technician as unknown as Record<string, unknown>)
          .routeDistanceKm
      ).toBeUndefined();
      expect(
        (result?.technician as unknown as Record<string, unknown>)
          .routeEtaMinutes
      ).toBeUndefined();
      expect(
        (result?.technician as unknown as Record<string, unknown>).routeEtaText
      ).toBeUndefined();
      expect(
        (result?.technician as unknown as Record<string, unknown>)
          .routeEtaSource
      ).toBeUndefined();
    }
  );

  it("does not preserve route metrics when the request changes but the technician does not", async () => {
    let result: ReturnType<typeof useRealtimeServiceRequest> | undefined;
    const Harness = ({ requestId }: { requestId: string }) => {
      result = useRealtimeServiceRequest(requestId);
      return null;
    };

    await act(async () => {
      root.render(<Harness requestId="request-1" />);
      await Promise.resolve();
    });

    act(() => {
      socketHarness.handlers.get("technician:location_update")?.({
        requestId: "request-1",
        lat: 12.97,
        lng: 77.59,
        distanceKm: 12.3,
        durationMinutes: 17,
        etaText: "17 min",
        etaSource: "mappls",
      });
    });
    expect(result?.technician).toMatchObject({ routeDistanceKm: 12.3 });

    await act(async () => {
      root.render(<Harness requestId="request-2" />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(
      (result?.technician as unknown as Record<string, unknown>).routeDistanceKm
    ).toBeUndefined();
    expect(
      (result?.technician as unknown as Record<string, unknown>).routeEtaMinutes
    ).toBeUndefined();
  });

  it("ignores a location event from another technician", async () => {
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
      socketHarness.handlers.get("technician:location_update")?.({
        requestId: "request-1",
        technicianId: "another-technician",
        lat: 28.61,
        lng: 77.21,
        distanceKm: 5.4,
        durationMinutes: 12,
      });
    });

    expect(result?.technician).toMatchObject({
      id: "technician-1",
      location_lat: 12.96,
      location_lng: 77.58,
    });
    expect(
      (result?.technician as unknown as Record<string, unknown>).routeDistanceKm,
    ).toBeUndefined();
  });

  it("rejects delayed route metrics for an older technician coordinate", async () => {
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
      socketHarness.handlers.get("location_update")?.({
        requestId: "request-1",
        technicianId: "technician-1",
        lat: 12.98,
        lng: 77.6,
        locationUpdatedAt: "2026-09-16T10:00:02.000Z",
      });
    });

    act(() => {
      socketHarness.handlers.get("technician:location_update")?.({
        requestId: "request-1",
        technicianId: "technician-1",
        lat: 12.97,
        lng: 77.59,
        distanceKm: 12.3,
        durationMinutes: 17,
        locationUpdatedAt: "2026-09-16T10:00:01.000Z",
      });
    });

    expect(result?.technician).toMatchObject({
      location_lat: 12.98,
      location_lng: 77.6,
    });
    expect(
      (result?.technician as unknown as Record<string, unknown>).routeDistanceKm,
    ).toBeUndefined();
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
});
