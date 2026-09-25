import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  apiUrl: (path: string) => `https://api.test${path}`,
}));

import { useGeolocation } from "./useGeolocation";

const setGeolocation = (value: unknown) => {
  Object.defineProperty(navigator, "geolocation", { configurable: true, value });
};

describe("useGeolocation", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps the full address and adds a short place summary", async () => {
    setGeolocation({
      getCurrentPosition: (success: PositionCallback) => success({
        coords: { latitude: 11.02, longitude: 76.99 },
      } as GeolocationPosition),
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        display_name: "Avinashi Road, Peelamedu, Coimbatore North, Coimbatore, Tamil Nadu, 641004, India",
        address: { road: "Avinashi Road", suburb: "Peelamedu", city: "Coimbatore", postcode: "641004" },
      }),
    }));
    const { result } = renderHook(() => useGeolocation());

    act(() => { result.current.requestLocation(); });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.address).toContain("Coimbatore North");
    expect(result.current.place).toEqual({ title: "Peelamedu", subtitle: "Avinashi Road, Peelamedu, Coimbatore 641004" });
    expect(result.current.errorCode).toBeNull();
  });

  it("reports the permission error code so callers can tell denial from other failures", async () => {
    setGeolocation({
      getCurrentPosition: (_success: PositionCallback, failure: PositionErrorCallback) => failure({
        code: 1,
        message: "denied",
      } as GeolocationPositionError),
    });
    const { result } = renderHook(() => useGeolocation());

    act(() => { result.current.requestLocation(); });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.errorCode).toBe(1);
    expect(result.current.place).toBeNull();
    expect(result.current.error).toMatch(/permission denied/i);
  });
});
