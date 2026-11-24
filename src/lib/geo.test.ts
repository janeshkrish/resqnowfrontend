import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchRoute, searchLocations } from "./geo";

const apiFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  apiFetch,
  readJsonSafely: async (response: Response) => response.json(),
}));

describe("road route requests", () => {
  it('uses the existing Photon endpoint and preserves cancellation for disabled-map place selection', async () => {
    const controller=new AbortController();
    apiFetch.mockResolvedValue({ok:true,status:200,json:async()=>({results:[]})});
    await searchLocations('Garage',3,{provider:'photon',signal:controller.signal});
    expect(apiFetch).toHaveBeenCalledWith('/api/public/location-search?q=Garage&limit=3&provider=photon',{signal:controller.signal});
  });
  beforeEach(() => {
    apiFetch.mockReset();
    apiFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        distanceKm: 2.4,
        durationMinutes: 8,
        polyline: [
          [12.97, 77.59],
          [12.975, 77.595],
          [12.98, 77.6],
        ],
      }),
    });
  });

  it("sends the selected navigation vehicle mode to the backend", async () => {
    await fetchRoute(
      [
        { lat: 12.97, lng: 77.59 },
        { lat: 12.98, lng: 77.6 },
      ],
      "full",
      "commercial-tow",
    );

    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining("vehicleMode=commercial-tow"),
    );
  });
});
