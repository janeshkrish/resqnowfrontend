import { beforeEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ apiFetch }));

import { fetchVehiclePhoto, studioImage } from "./vehiclePhoto";

const photo = {
  url: "https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Nexon.jpg/960px-Nexon.jpg",
  width: 960,
  height: 640,
  article: "Tata Nexon",
  credit: { author: "Someone", license: "CC BY-SA 4.0", source: "https://commons.wikimedia.org/wiki/File:Nexon.jpg" },
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("vehicle photos", () => {
  beforeEach(() => apiFetch.mockReset());

  it("asks the backend for the model's photo", async () => {
    apiFetch.mockResolvedValue(json({ photo }));
    await expect(fetchVehiclePhoto("Tata Motors", "Nexon")).resolves.toEqual(photo);
    expect(apiFetch.mock.calls[0][0]).toBe("/api/public/vehicle-photo?make=Tata+Motors&model=Nexon");
  });

  it("shows no photo when there is none, the lookup fails, or the address isn't https", async () => {
    apiFetch.mockResolvedValueOnce(json({ photo: null }));
    await expect(fetchVehiclePhoto("Hero", "Splendor+")).resolves.toBeNull();

    apiFetch.mockResolvedValueOnce(json({ error: "busy" }, 503));
    await expect(fetchVehiclePhoto("Tata Motors", "Nexon")).resolves.toBeNull();

    apiFetch.mockResolvedValueOnce(json({ photo: { ...photo, url: "javascript:alert(1)" } }));
    await expect(fetchVehiclePhoto("Tata Motors", "Nexon")).resolves.toBeNull();
  });

  it("uses the studio car or bike picture as the fallback", () => {
    expect(studioImage("bike")).toBe("/images/vehicles/bike.webp");
    expect(studioImage("car")).toBe("/images/vehicles/car.webp");
    expect(studioImage(undefined)).toBe("/images/vehicles/car.webp");
  });
});
