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

  it("keeps the route on screen when an update fails, and says the network is weak", async () => {
    const onRouteStateChange = vi.fn();
    const destination = { lat: 12.98, lng: 77.6 };
    const view = render(
      <ActiveJobMap
        technicianLocation={{ lat: 12.97, lng: 77.59 }}
        navigationDestination={destination}
        navigationMode
        onRouteStateChange={onRouteStateChange}
      />,
    );
    expect(await screen.findByText("Remaining")).toBeInTheDocument();

    // 60 m further on, in a dead zone.
    fetchRoute.mockRejectedValueOnce(new Error("Route provider failed."));
    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5_000);
    view.rerender(
      <ActiveJobMap
        technicianLocation={{ lat: 12.9704, lng: 77.5904 }}
        navigationDestination={destination}
        navigationMode
        onRouteStateChange={onRouteStateChange}
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent("Weak network · showing the last route");
    expect(screen.queryByText("Road route unavailable")).not.toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
    // The page still has a route to work with.
    expect(onRouteStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ready", distanceKm: 2.4, durationMinutes: 8 }),
    );
    now.mockRestore();
  });

  it("still reports an error when there was never a route to keep", async () => {
    fetchRoute.mockRejectedValueOnce(new Error("Route provider failed."));
    render(
      <ActiveJobMap
        technicianLocation={{ lat: 12.97, lng: 77.59 }}
        navigationDestination={{ lat: 12.98, lng: 77.6 }}
        navigationMode
      />,
    );

    expect(await screen.findByText("Road route unavailable")).toBeInTheDocument();
    expect(screen.queryByText(/weak network/i)).not.toBeInTheDocument();
  });

  it("shows the last known position with a note, and asks for no new route from it", async () => {
    const destination = { lat: 12.98, lng: 77.6 };
    const view = render(
      <ActiveJobMap technicianLocation={{ lat: 12.97, lng: 77.59 }} navigationDestination={destination} navigationMode />,
    );
    expect(await screen.findByText("Remaining")).toBeInTheDocument();
    expect(fetchRoute).toHaveBeenCalledTimes(1);

    const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 5_000);
    view.rerender(
      <ActiveJobMap
        technicianLocation={{ lat: 12.97, lng: 77.59 }}
        navigationDestination={destination}
        navigationMode
        speedKmh={null}
        positionNote="Weak GPS signal · showing your last position"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Weak GPS signal · showing your last position");
    expect(screen.queryByText("Acquiring accurate location…")).not.toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
    expect(screen.getByText("-- km/h")).toBeInTheDocument();
    expect(fetchRoute).toHaveBeenCalledTimes(1);
    now.mockRestore();
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
