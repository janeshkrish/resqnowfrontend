import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ apiFetch }));

import { useNearbySearchTechnicians } from "./useNearbySearchTechnicians";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);
const SPOT = { lat: 11.0168, lng: 76.9558 };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("useNearbySearchTechnicians", () => {
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockImplementation(async () =>
      json([
        { id: 21, latitude: 11.02, longitude: 76.96, distance: 0.6, is_available: true },
        { id: 23, latitude: 11.018, longitude: 76.951, distance: 0.5, is_available: false },
      ]),
    );
  });

  it("asks who is near the customer for this service and vehicle, and keeps those who are available", async () => {
    const { result } = renderHook(
      () => useNearbySearchTechnicians({ enabled: true, location: SPOT, serviceType: "car-towing", vehicleType: "car" }),
      { wrapper },
    );

    await waitFor(() => expect(result.current).toEqual([{ id: "21", lat: 11.02, lng: 76.96 }]));
    expect(apiFetch).toHaveBeenCalledTimes(1);
    const [path] = apiFetch.mock.calls[0];
    const asked = new URL(path, "https://api.test");
    expect(asked.pathname).toBe("/api/technicians/nearby");
    expect(Object.fromEntries(asked.searchParams)).toEqual({ lat: "11.0168", lng: "76.9558", service_type: "car-towing", vehicle_type: "car" });
  });

  it("asks nothing once the search is over, or before the customer's spot is known", () => {
    const over = renderHook(() => useNearbySearchTechnicians({ enabled: false, location: SPOT, serviceType: "car-towing" }), { wrapper });
    const nowhere = renderHook(() => useNearbySearchTechnicians({ enabled: true, location: null, serviceType: "car-towing" }), { wrapper });

    expect(over.result.current).toBeUndefined();
    expect(nowhere.result.current).toBeUndefined();
    expect(apiFetch).not.toHaveBeenCalled();
  });

  it("passes the EV subtype, brand and service scope to discovery and refreshes when scope changes", async () => {
    const { result, rerender } = renderHook(({ scope }) => useNearbySearchTechnicians({
      enabled: true, location: SPOT, serviceType: "ev-mechanical", vehicleType: "ev",
      vehicleSubtype: "electric-scooter", vehicleBrand: "Ather",
      details: { answers: [{ id: "mechanical_scope", value: scope }] },
    }), { wrapper, initialProps: { scope: "chassis" } });
    await waitFor(() => expect(result.current).toEqual([{ id: "21", lat: 11.02, lng: 76.96 }]));
    const asked = new URL(apiFetch.mock.calls[0][0], "https://api.test");
    expect(asked.searchParams.get("vehicle_subtype")).toBe("electric-scooter");
    expect(asked.searchParams.get("vehicle_brand")).toBe("Ather");
    expect(JSON.parse(asked.searchParams.get("details") || "null")).toEqual({ answers: [{ id: "mechanical_scope", value: "chassis" }] });
    rerender({ scope: "ev-system" });
    await waitFor(() => expect(apiFetch).toHaveBeenCalledTimes(2));
    expect(JSON.parse(new URL(apiFetch.mock.calls[1][0], "https://api.test").searchParams.get("details") || "null")).toEqual({ answers: [{ id: "mechanical_scope", value: "ev-system" }] });
  });

  it("gives nothing, quietly, when the list cannot be loaded", async () => {
    apiFetch.mockImplementation(async () => json({ error: "down" }, 500));
    const { result } = renderHook(() => useNearbySearchTechnicians({ enabled: true, location: SPOT }), { wrapper });

    await waitFor(() => expect(apiFetch).toHaveBeenCalled());
    expect(result.current).toBeUndefined();
  });
});
