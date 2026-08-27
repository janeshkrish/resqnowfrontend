import { fireEvent, render, screen } from "@testing-library/react";
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
    fetchRoute: vi.fn().mockResolvedValue({ polyline: [] }),
  };
});

describe("LiveTrackingMap", () => {
  beforeEach(() => {
    surfaceCapture.props = null;
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

    surfaceCapture.props?.onInteract();
    expect(onInteract).toHaveBeenCalledTimes(1);
    const before = surfaceCapture.props?.camera.revision;
    fireEvent.click(
      screen.getByRole("button", { name: "Recenter live tracking map" }),
    );
    expect(surfaceCapture.props?.camera.revision).toBeGreaterThan(before);
  });
});
