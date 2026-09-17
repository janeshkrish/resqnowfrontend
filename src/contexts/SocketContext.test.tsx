import { render, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const socketIo = vi.hoisted(() => vi.fn());

vi.mock("socket.io-client", () => ({ io: socketIo }));
vi.mock("@/lib/api", () => ({
  FRONTEND_ONLY_MODE: false,
  getRequiredApiBaseUrl: () => "https://api.example.test",
  getTechnicianToken: () => "technician-token",
  getUserToken: () => "user-token",
}));
vi.mock("./TechnicianAuthContext", () => ({
  useTechnicianAuth: () => ({
    technician: { id: "tech-1" },
    isAuthenticated: true,
  }),
}));
vi.mock("./AuthContext", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
    isAuthenticated: true,
  }),
}));

import { SocketProvider } from "./SocketContext";

function createSocket() {
  return {
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  };
}

describe("SocketProvider portal identity", () => {
  beforeEach(() => {
    socketIo.mockReset();
    socketIo.mockReturnValue(createSocket());
  });

  it("uses the user identity for a customer tracking route when both sessions exist", async () => {
    render(
      <MemoryRouter initialEntries={["/request-service-tracking/request-44"]}>
        <SocketProvider><div>tracking</div></SocketProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(socketIo).toHaveBeenCalledTimes(1));
    expect(socketIo).toHaveBeenCalledWith(
      "https://api.example.test",
      expect.objectContaining({ auth: { token: "user-token" } }),
    );
  });

  it("uses the technician identity for a technician route", async () => {
    render(
      <MemoryRouter initialEntries={["/technician/active-job/request-44"]}>
        <SocketProvider><div>active job</div></SocketProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(socketIo).toHaveBeenCalledTimes(1));
    expect(socketIo).toHaveBeenCalledWith(
      "https://api.example.test",
      expect.objectContaining({ auth: { token: "technician-token" } }),
    );
  });
});
