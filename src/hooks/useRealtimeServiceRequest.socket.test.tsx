import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useRealtimeServiceRequest } from "./useRealtimeServiceRequest";

const socketIo = vi.hoisted(() => vi.fn());
const privateSocket = vi.hoisted(() => ({
  connected: true,
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  disconnect: vi.fn(),
}));
const sharedSocket = vi.hoisted(() => ({
  connected: true,
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
}));
const apiFetch = vi.hoisted(() => vi.fn());

vi.mock("socket.io-client", () => ({ io: socketIo }));
vi.mock("@/contexts/SocketContext", () => ({
  useSocket: () => ({ socket: sharedSocket, isConnected: true }),
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { id: "user-1" } }) }));
vi.mock("@/lib/api", () => ({
  apiFetch,
  apiUrl: (path: string) => path,
  FRONTEND_ONLY_MODE: false,
  getRequiredApiBaseUrl: () => "http://localhost:3000",
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

beforeAll(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

describe("useRealtimeServiceRequest socket ownership", () => {
  let root: Root;
  let container: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    socketIo.mockReturnValue(privateSocket);
    apiFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "request-1",
        isTowing: false,
        user_id: "user-1",
        status: "en-route",
        service_type: "repair",
        created_at: "2026-09-17T00:00:00.000Z",
        payment_status: "pending",
        technician: { id: "tech-1", location_lat: 12.97, location_lng: 77.59 },
      }),
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("reuses the authenticated shared socket and subscribes only to the active request", async () => {
    const Harness = () => {
      useRealtimeServiceRequest("request-1");
      return null;
    };

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });

    expect(socketIo).not.toHaveBeenCalled();
    expect(sharedSocket.emit).toHaveBeenCalledWith(
      "tracking:subscribe:v1",
      { requestId: "request-1" },
      expect.any(Function),
    );
  });

  it("cleans up request-scoped listeners without disconnecting the shared socket", async () => {
    const Harness = () => {
      useRealtimeServiceRequest("request-1");
      return null;
    };

    await act(async () => {
      root.render(<Harness />);
      await Promise.resolve();
    });
    act(() => root.unmount());

    expect(sharedSocket.off).toHaveBeenCalledWith("connect", expect.any(Function));
    expect(sharedSocket.off).toHaveBeenCalledWith("tracking:location:v1", expect.any(Function));
    expect(sharedSocket.off).toHaveBeenCalledWith("technician:location_update", expect.any(Function));
    expect(socketIo).not.toHaveBeenCalled();
  });
});
