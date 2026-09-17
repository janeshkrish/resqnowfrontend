import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  MapCameraSpec,
  MapCircleSpec,
  MapMarkerSpec,
  MapPolylineSpec,
} from "@/lib/mapProvider/types";

import LiveTrackingMap from "./LiveTrackingMap";

type CapturedSurfaceProps = {
  markers: MapMarkerSpec[];
  polylines: MapPolylineSpec[];
  circles: MapCircleSpec[];
  camera?: MapCameraSpec;
  onInteract?: () => void;
};

const surfaceCapture = vi.hoisted(() => ({
  props: null as CapturedSurfaceProps | null,
}));
const fetchRouteMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/mapProvider/MapplsMapSurface", () => ({
  MapplsMapSurface: (props: CapturedSurfaceProps) => {
    surfaceCapture.props = props;
    return <div data-testid="mappls-surface" />;
  },
}));

vi.mock("@/lib/geo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/geo")>();
  return {
    ...actual,
    fetchRoute: fetchRouteMock,
  };
});

describe("LiveTrackingMap", () => {
  beforeEach(() => {
    surfaceCapture.props = null;
    fetchRouteMock.mockReset();
    fetchRouteMock.mockResolvedValue({ polyline: [] });
  });

  it("passes pulse markers, circles, cased route, and fit camera to Mappls", () => {
    render(
      <LiveTrackingMap
        techLocation={{ lat: 12.97, lng: 77.59 }}
        userLocation={{ lat: 12.98, lng: 77.6 }}
        eta="8 min"
        variant="fullscreen"
      />,
    );

    const props = surfaceCapture.props;
    expect(props).not.toBeNull();
    expect(
      props?.markers.find((marker: { id: string }) => marker.id === "technician").html,
    ).toContain("tracking-tech-marker__bubble");
    expect(
      props?.markers.find((marker: { id: string }) => marker.id === "technician").html,
    ).toContain("8 min");
    expect(props?.circles).toHaveLength(3);
    expect(props?.polylines.map((line: { id: string }) => line.id)).toEqual([
      "route-casing",
      "route-primary",
    ]);
    expect(props?.camera.mode).toBe("fit");
  });

  it("forwards interactions and recenters the fullscreen map", () => {
    const onInteract = vi.fn();
    render(
      <LiveTrackingMap
        techLocation={null}
        userLocation={{ lat: 12.98, lng: 77.6 }}
        variant="fullscreen"
        onInteract={onInteract}
      />,
    );

    act(() => surfaceCapture.props?.onInteract?.());
    expect(onInteract).toHaveBeenCalledTimes(1);
    const before = surfaceCapture.props?.camera.revision;
    fireEvent.click(
      screen.getByRole("button", { name: "Recenter live tracking map" }),
    );
    expect(surfaceCapture.props?.camera.revision).toBeGreaterThan(before);
  });

  it("keeps the initial camera frame stable while routine technician fixes arrive", () => {
    const { rerender } = render(
      <LiveTrackingMap
        techLocation={{ lat: 12.97, lng: 77.59 }}
        userLocation={{ lat: 12.98, lng: 77.6 }}
        routeDestination={{ lat: 12.98, lng: 77.6 }}
        variant="fullscreen"
      />,
    );
    const initialRevision = surfaceCapture.props?.camera?.revision;

    rerender(
      <LiveTrackingMap
        techLocation={{ lat: 12.971, lng: 77.591 }}
        userLocation={{ lat: 12.98, lng: 77.6 }}
        routeDestination={{ lat: 12.98, lng: 77.6 }}
        variant="fullscreen"
      />,
    );

    expect(surfaceCapture.props?.camera?.revision).toBe(initialRevision);
  });

  it("stops automatic following after a customer manually moves the map", () => {
    const { rerender } = render(
      <LiveTrackingMap
        techLocation={{ lat: 12.97, lng: 77.59 }}
        userLocation={{ lat: 12.98, lng: 77.6 }}
        variant="fullscreen"
        mapMode="map"
      />,
    );

    act(() => surfaceCapture.props?.onInteract?.());
    const lockedRevision = surfaceCapture.props?.camera?.revision;
    expect(surfaceCapture.props?.camera?.mode).toBe("fit");

    rerender(
      <LiveTrackingMap
        techLocation={{ lat: 12.972, lng: 77.592 }}
        userLocation={{ lat: 12.98, lng: 77.6 }}
        variant="fullscreen"
        mapMode="map"
      />,
    );

    expect(surfaceCapture.props?.camera?.mode).toBe("fit");
    expect(surfaceCapture.props?.camera?.revision).toBe(lockedRevision);
  });

  it("passes a heading-aware vehicle marker without rotating the map", () => {
    render(
      <LiveTrackingMap
        techLocation={{ lat: 12.97, lng: 77.59 }}
        userLocation={{ lat: 12.98, lng: 77.6 }}
        technicianHeading={90}
        technicianSpeed={8}
      />,
    );

    expect(surfaceCapture.props?.markers.find((marker) => marker.id === "technician")?.heading).toBe(90);
    expect(surfaceCapture.props?.camera?.mode).not.toBe("follow");
  });

  it("uses the changing technician position and active destination instead of a static booking route", async () => {
    fetchRouteMock.mockResolvedValue({
      polyline: [
        [12.97, 77.59],
        [12.975, 77.595],
        [12.98, 77.6],
      ],
    });
    const { rerender } = render(
      <LiveTrackingMap
        techLocation={{ lat: 12.97, lng: 77.59 }}
        userLocation={{ lat: 12.98, lng: 77.6 }}
        routeDestination={{ lat: 12.98, lng: 77.6 }}
        routePolyline={[
          [12.8, 77.4],
          [12.9, 77.5],
        ]}
      />,
    );

    await waitFor(() =>
      expect(fetchRouteMock).toHaveBeenLastCalledWith(
        [{ lat: 12.97, lng: 77.59 }, { lat: 12.98, lng: 77.6 }],
        "full",
      ),
    );

    rerender(
      <LiveTrackingMap
        techLocation={{ lat: 12.971, lng: 77.591 }}
        userLocation={{ lat: 12.98, lng: 77.6 }}
        routeDestination={{ lat: 12.98, lng: 77.6 }}
      />,
    );

    await waitFor(() =>
      expect(fetchRouteMock).toHaveBeenLastCalledWith(
        [{ lat: 12.971, lng: 77.591 }, { lat: 12.98, lng: 77.6 }],
        "full",
      ),
    );
    expect(fetchRouteMock).toHaveBeenCalledTimes(2);
  });

  it("can hide the duplicate status card without removing map recenter", () => {
    render(
      <LiveTrackingMap
        techLocation={{ lat: 12.97, lng: 77.59 }}
        userLocation={{ lat: 12.98, lng: 77.6 }}
        eta="8 min"
        status="en-route"
        variant="fullscreen"
        showStatusOverlay={false}
      />,
    );

    expect(screen.queryByText("On the way")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recenter live tracking map" })).toBeInTheDocument();
  });
});
