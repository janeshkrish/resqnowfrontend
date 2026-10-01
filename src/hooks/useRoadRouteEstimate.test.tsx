import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchRoute } from "@/lib/geo";
import { useRoadRouteEstimate } from "./useRoadRouteEstimate";

vi.mock("@/lib/geo", () => ({ fetchRoute: vi.fn() }));
const route = vi.mocked(fetchRoute);

const HOME = { lat: 11.0168, lng: 76.9558 };
const CUSTOMER = { lat: 11.0092, lng: 76.9605 };
type Props = { from: typeof HOME | null; to: typeof HOME | null };
const mount = (props: Props) =>
  renderHook(({ from, to }: Props) => useRoadRouteEstimate(from, to, "car"), { initialProps: props });

describe("the road distance and time to a job", () => {
  beforeEach(() => {
    route.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("comes from the route service, not from a straight line", async () => {
    route.mockResolvedValue({ distanceKm: 3.4, durationMinutes: 9 });
    const { result } = mount({ from: HOME, to: CUSTOMER });

    // Nothing is shown until the route answers.
    expect(result.current).toEqual({ distanceKm: null, durationMinutes: null });
    await waitFor(() => expect(result.current).toEqual({ distanceKm: 3.4, durationMinutes: 9 }));
    expect(route).toHaveBeenCalledWith([HOME, CUSTOMER], "simplified", "car");
  });

  it("waits for a location and a destination", () => {
    mount({ from: null, to: CUSTOMER });
    mount({ from: HOME, to: null });
    mount({ from: { lat: 0, lng: 0 }, to: CUSTOMER });
    expect(route).not.toHaveBeenCalled();
  });

  it("does not ask again for every small GPS movement", async () => {
    route.mockResolvedValue({ distanceKm: 3.4, durationMinutes: 9 });
    const { result, rerender } = mount({ from: HOME, to: CUSTOMER });
    await waitFor(() => expect(result.current.distanceKm).toBe(3.4));

    rerender({ from: { lat: HOME.lat + 0.0001, lng: HOME.lng }, to: CUSTOMER });
    expect(route).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ distanceKm: 3.4, durationMinutes: 9 });
  });

  it("asks again once the technician has moved on, after a pause", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    route.mockResolvedValueOnce({ distanceKm: 3.4, durationMinutes: 9 });
    const { result, rerender } = mount({ from: HOME, to: CUSTOMER });
    await waitFor(() => expect(result.current.distanceKm).toBe(3.4));

    const closer = { lat: 11.0131, lng: 76.9580 };
    route.mockResolvedValueOnce({ distance_km: 1.9, estimated_duration: 5 });
    // Moved far enough, but too soon after the last request.
    rerender({ from: closer, to: CUSTOMER });
    expect(route).toHaveBeenCalledTimes(1);

    now.mockReturnValue(1_000_000 + 16_000);
    rerender({ from: { ...closer, lat: closer.lat - 0.00001 }, to: CUSTOMER });
    await waitFor(() => expect(result.current).toEqual({ distanceKm: 1.9, durationMinutes: 5 }));
    expect(route).toHaveBeenCalledTimes(2);
  });

  it("starts over for a different destination", async () => {
    route.mockResolvedValueOnce({ distanceKm: 3.4, durationMinutes: 9 });
    const { result, rerender } = mount({ from: HOME, to: CUSTOMER });
    await waitFor(() => expect(result.current.distanceKm).toBe(3.4));

    route.mockResolvedValueOnce({ distanceKm: 6.1, durationMinutes: 17 });
    rerender({ from: HOME, to: { lat: 11.0351, lng: 76.9712 } });
    // The pickup's figures are not shown for the drop.
    expect(result.current).toEqual({ distanceKm: null, durationMinutes: null });
    await waitFor(() => expect(result.current).toEqual({ distanceKm: 6.1, durationMinutes: 17 }));
  });

  it("shows nothing when the route fails, and tries again later from the same spot", async () => {
    const now = vi.spyOn(Date, "now").mockReturnValue(2_000_000);
    route.mockRejectedValueOnce(new Error("Route calculation failed."));
    const { result, rerender } = mount({ from: HOME, to: CUSTOMER });
    await waitFor(() => expect(console.error).toHaveBeenCalled());
    expect(result.current).toEqual({ distanceKm: null, durationMinutes: null });

    route.mockResolvedValueOnce({ distanceKm: 3.4, durationMinutes: 9 });
    now.mockReturnValue(2_000_000 + 16_000);
    rerender({ from: { lat: HOME.lat + 0.00001, lng: HOME.lng }, to: CUSTOMER });
    await waitFor(() => expect(result.current).toEqual({ distanceKm: 3.4, durationMinutes: 9 }));
  });

  it("does not show a route with no distance or time", async () => {
    route.mockResolvedValue({ distanceKm: 0, durationMinutes: 0 });
    const { result } = mount({ from: HOME, to: CUSTOMER });
    await waitFor(() => expect(route).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual({ distanceKm: null, durationMinutes: null });
  });
});
