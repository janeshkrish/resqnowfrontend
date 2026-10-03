import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

const START = { lat: 12.97, lng: 77.59 };
const DESTINATION = { lat: 12.98, lng: 77.6 };
/** Points on the test route, each about 155 m further along. */
const ALONG = [
  { lat: 12.971, lng: 77.591 },
  { lat: 12.972, lng: 77.592 },
  { lat: 12.973, lng: 77.593 },
];
/** About 150 m off the route, on the east side. */
const OFF_ROUTE = [
  { lat: 12.971, lng: 77.593 },
  { lat: 12.9712, lng: 77.5932 },
];

/**
 * Opens the map at the start of the route and waits for it; each `ride(point)` is the
 * next position from the phone, a few seconds after the last.
 */
async function navigate(props: Partial<React.ComponentProps<typeof ActiveJobMap>> = {}) {
  let clock = Date.now();
  const now = vi.spyOn(Date, "now").mockImplementation(() => clock);
  const element = (location: { lat: number; lng: number }) => (
    <ActiveJobMap technicianLocation={location} navigationDestination={DESTINATION} navigationMode {...props} />
  );
  const view = render(element(START));
  await screen.findByTestId("mappls-surface");
  await waitFor(() => expect(fetchRoute).toHaveBeenCalledTimes(1));
  if (props.navigationMode !== false) await screen.findByText("Remaining");
  else await waitFor(() => expect(props.onRouteStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ status: "ready" })));
  cleanups.push(() => now.mockRestore());
  return (location: { lat: number; lng: number }) => {
    clock += 5_000;
    view.rerender(element(location));
  };
}
const cleanups: Array<() => void> = [];

describe("ActiveJobMap", () => {
  afterEach(() => cleanups.splice(0).forEach((cleanup) => cleanup()));

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
    const ride = await navigate({ onRouteStateChange });

    // Off the route twice, in a dead zone.
    fetchRoute.mockRejectedValueOnce(new Error("Route provider failed."));
    ride(OFF_ROUTE[0]);
    ride(OFF_ROUTE[1]);

    expect(await screen.findByRole("status")).toHaveTextContent("Weak network · showing the last route");
    expect(fetchRoute).toHaveBeenCalledTimes(2);
    expect(screen.queryByText("Road route unavailable")).not.toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
    // The page still has a route to work with.
    expect(onRouteStateChange).toHaveBeenLastCalledWith(expect.objectContaining({ status: "ready" }));
  });

  describe("re-routing while navigating", () => {
    it("asks for no new route while the technician follows the one on screen", async () => {
      const ride = await navigate();
      ALONG.forEach(ride);
      expect(fetchRoute).toHaveBeenCalledTimes(1);
    });

    it("asks for a new route after two readings off it, from where the technician is", async () => {
      const ride = await navigate();
      // One reading off the route could be GPS noise.
      ride(OFF_ROUTE[0]);
      expect(fetchRoute).toHaveBeenCalledTimes(1);

      ride(OFF_ROUTE[1]);
      expect(fetchRoute).toHaveBeenCalledTimes(2);
      expect(fetchRoute).toHaveBeenLastCalledWith([OFF_ROUTE[1], DESTINATION], "full", "car");
      await screen.findByText("Remaining");
    });

    it("does not count a single noisy reading once back on the route", async () => {
      const ride = await navigate();
      ride(OFF_ROUTE[0]);
      ride(ALONG[0]);
      ride(OFF_ROUTE[1]);
      expect(fetchRoute).toHaveBeenCalledTimes(1);
    });

    it("asks for a new route when riding back along it the wrong way", async () => {
      const ride = await navigate();
      ALONG.forEach(ride);
      expect(fetchRoute).toHaveBeenCalledTimes(1);

      ride({ lat: 12.972, lng: 77.592 });
      expect(fetchRoute).toHaveBeenCalledTimes(1);
      ride({ lat: 12.9715, lng: 77.5915 });
      expect(fetchRoute).toHaveBeenCalledTimes(2);
    });

    it("waits for the technician to move on before asking again from the same spot", async () => {
      const ride = await navigate();
      ride(OFF_ROUTE[0]);
      ride(OFF_ROUTE[1]);
      expect(fetchRoute).toHaveBeenCalledTimes(2);
      await screen.findByText("Remaining");

      // Still off the route (the new one here is the same line), within a few metres.
      ride({ lat: 12.97121, lng: 77.59321 });
      ride({ lat: 12.97122, lng: 77.59322 });
      expect(fetchRoute).toHaveBeenCalledTimes(2);
    });
  });

  it("reports what is left of the route as the technician moves, without a new request", async () => {
    const onRouteStateChange = vi.fn();
    const ride = await navigate({ onRouteStateChange, navigationMode: false });
    expect(onRouteStateChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "ready", distanceKm: 2.4, durationMinutes: 8 }),
    );

    ride(ALONG[1]);
    const last = onRouteStateChange.mock.calls.at(-1)?.[0];
    expect(last.status).toBe("ready");
    expect(last.distanceKm).toBeGreaterThan(1.8);
    expect(last.distanceKm).toBeLessThan(2.4);
    expect(last.durationMinutes).toBeLessThan(8);
    expect(fetchRoute).toHaveBeenCalledTimes(1);
  });

  it("offers Google Maps in place of a route it cannot work out, when given the link", async () => {
    const href = "https://www.google.com/maps/dir/?api=1&destination=12.98%2C77.6&travelmode=driving&dir_action=navigate";
    fetchRoute.mockRejectedValue(new Error("Route provider failed."));
    const view = render(
      <ActiveJobMap technicianLocation={START} navigationDestination={DESTINATION} externalNavigationUrl={href} />,
    );

    expect(await screen.findByText("Road route unavailable")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Open in Google Maps" });
    expect(link).toHaveAttribute("href", href);
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("button", { name: /retry route/i })).toBeInTheDocument();

    // Before the journey has started the page gives no link, and none is shown.
    view.rerender(<ActiveJobMap technicianLocation={START} navigationDestination={DESTINATION} />);
    expect(screen.queryByRole("link", { name: "Open in Google Maps" })).not.toBeInTheDocument();
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

  it("shows the job's own panel on the navigation screen only", async () => {
    const panel = <p>Customer location</p>;
    const view = render(
      <ActiveJobMap technicianLocation={START} navigationDestination={DESTINATION} navigationPanel={panel} />,
    );
    await waitFor(() => expect(fetchRoute).toHaveBeenCalledTimes(1));
    // The job card already shows it while not navigating.
    expect(screen.queryByText("Customer location")).not.toBeInTheDocument();

    view.rerender(
      <ActiveJobMap technicianLocation={START} navigationDestination={DESTINATION} navigationMode navigationPanel={panel} />,
    );
    expect(await screen.findByText("Customer location")).toBeInTheDocument();
    expect(screen.getByText("Remaining")).toBeInTheDocument();
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
