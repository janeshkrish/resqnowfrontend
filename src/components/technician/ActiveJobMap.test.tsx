import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ActiveJobMap from "./ActiveJobMap";

vi.mock("@/lib/mapProvider/MapplsMapSurface", () => ({
  MapplsMapSurface: (props: { camera: { mode: string } }) => (
    <div data-testid="mappls-surface" data-camera={props.camera.mode} />
  ),
}));

const fetchRoute = vi.hoisted(() => vi.fn());

vi.mock("@/lib/geo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/geo")>();
  return {
    ...actual,
    fetchRoute,
  };
});

describe("ActiveJobMap", () => {
  beforeEach(() => {
    fetchRoute.mockReset();
    fetchRoute.mockResolvedValue({
      distanceKm: 2.4,
      durationMinutes: 8,
      polyline: [
        [12.97, 77.59],
        [12.975, 77.595],
        [12.98, 77.6],
      ],
    });
  });

  it("renders an overview Mappls surface with job markers", () => {
    render(
      <ActiveJobMap
        technicianLocation={{ lat: 12.97, lng: 77.59 }}
        customerLocation={{ lat: 12.98, lng: 77.6 }}
      />,
    );

    expect(screen.getByTestId("mappls-surface")).toHaveAttribute(
      "data-camera",
      "fit",
    );
  });

  it("loads a road route for the selected vehicle and reports readiness", async () => {
    const onRouteStateChange = vi.fn();

    render(
      <ActiveJobMap
        technicianLocation={{ lat: 12.97, lng: 77.59 }}
        navigationDestination={{ lat: 12.98, lng: 77.6 }}
        vehicleMode="two-wheeler"
        onRouteStateChange={onRouteStateChange}
      />,
    );

    await waitFor(() =>
      expect(fetchRoute).toHaveBeenCalledWith(
        [
          { lat: 12.97, lng: 77.59 },
          { lat: 12.98, lng: 77.6 },
        ],
        "full",
        "two-wheeler",
      ),
    );
    await waitFor(() =>
      expect(onRouteStateChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "ready", distanceKm: 2.4 }),
      ),
    );
  });

  it("shows a retryable error and no guidance when road geometry is unavailable", async () => {
    fetchRoute.mockResolvedValueOnce({ polyline: [] });

    render(
      <ActiveJobMap
        technicianLocation={{ lat: 12.97, lng: 77.59 }}
        navigationDestination={{ lat: 12.98, lng: 77.6 }}
        navigationMode
      />,
    );

    expect(await screen.findByText("Road route unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/continue toward/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /retry route/i }));
    await waitFor(() => expect(fetchRoute).toHaveBeenCalledTimes(2));
  });

  it("renders same-page route navigation metrics and exits without changing status", async () => {
    const onExitNavigation = vi.fn();

    render(
      <ActiveJobMap
        technicianLocation={{ lat: 12.97, lng: 77.59 }}
        navigationDestination={{ lat: 12.98, lng: 77.6 }}
        navigationMode
        speedKmh={31}
        vehicleMode="car"
        onExitNavigation={onExitNavigation}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Turn-by-turn navigation" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("31 km/h")).toBeInTheDocument();
    expect(screen.getByText("Car")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exit navigation" }));
    expect(onExitNavigation).toHaveBeenCalledTimes(1);
  });
});
