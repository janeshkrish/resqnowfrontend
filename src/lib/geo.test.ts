import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchRoute } from "./geo";

const apiFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  apiFetch,
  readJsonSafely: async (response: Response) => response.json(),
}));

describe("road route requests", () => {
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
