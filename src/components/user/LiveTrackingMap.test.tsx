import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  advancedTracking?: {
    enabled: boolean;
    technician: {
      lat: number;
      lng: number;
      speed?: number | null;
      heading?: number | null;
      recordedAtMs?: number | null;
    } | null;
    destination: { lat: number; lng: number } | null;
  };
};

const surfaceCapture = vi.hoisted(() => ({
  props: null as CapturedSurfaceProps | null,
}));
const fetchRouteMock = vi.hoisted(() => vi.fn());
const { logLiveTrackingDiagnostic } = vi.hoisted(() => ({
  logLiveTrackingDiagnostic: vi.fn(),
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
    fetchRoute: fetchRouteMock,
  };
});

vi.mock("@/lib/liveTrackingDiagnostics", () => ({
  logLiveTrackingDiagnostic,
}));

describe("LiveTrackingMap", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    surfaceCapture.props = null;
    fetchRouteMock.mockReset();
    fetchRouteMock.mockResolvedValue({ polyline: [] });
  });

  it("passes the technician and customer markers, a cased route, and a fit camera to Mappls", () => {
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
    ).toContain("tracking-tech-marker__eta");
    expect(
      props?.markers.find((marker: { id: string }) => marker.id === "technician").html,
    ).toContain("8 min");
    // The markers pulse by themselves; no discs are drawn under them.
    expect(props?.circles).toHaveLength(0);
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

  afterEach(() => {
    vi.unstubAllEnvs();
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

  describe("framing both ends of the trip", () => {
    const customer = { lat: 12.98, lng: 77.6 };
    const technician = { lat: 12.97, lng: 77.59 };
    const drop = { lat: 12.995, lng: 77.62 };
    const frame = () => {
      const camera = surfaceCapture.props?.camera;
      return camera?.mode === "fit" ? { revision: camera.revision, points: camera.points } : null;
    };

    it("frames the technician and the customer together when both are known as the page opens", () => {
      render(<LiveTrackingMap techLocation={technician} userLocation={customer} routeDestination={customer} variant="fullscreen" />);

      expect(frame()?.points).toEqual([technician, customer]);
    });

    it("frames both again when a technician is assigned after the page opened", () => {
      const { rerender } = render(<LiveTrackingMap techLocation={null} userLocation={customer} routeDestination={customer} variant="fullscreen" />);
      const alone = frame();
      expect(alone?.points).toEqual([customer]);

      rerender(<LiveTrackingMap techLocation={technician} userLocation={customer} routeDestination={customer} variant="fullscreen" />);

      expect(frame()?.points).toEqual([technician, customer]);
      expect(frame()?.revision).toBeGreaterThan(alone?.revision ?? 0);
    });

    it("frames them once: the technician's later positions do not move the frame", () => {
      const { rerender } = render(<LiveTrackingMap techLocation={null} userLocation={customer} routeDestination={customer} variant="fullscreen" />);
      rerender(<LiveTrackingMap techLocation={technician} userLocation={customer} routeDestination={customer} variant="fullscreen" />);
      const framed = frame();

      rerender(<LiveTrackingMap techLocation={{ lat: 12.973, lng: 77.593 }} userLocation={customer} routeDestination={customer} variant="fullscreen" />);
      rerender(<LiveTrackingMap techLocation={{ lat: 12.976, lng: 77.596 }} userLocation={customer} routeDestination={customer} variant="fullscreen" />);

      expect(frame()).toEqual(framed);
    });

    it("leaves the map where the customer put it, until they ask to recentre", () => {
      const { rerender } = render(<LiveTrackingMap techLocation={null} userLocation={customer} routeDestination={customer} variant="fullscreen" />);
      act(() => surfaceCapture.props?.onInteract?.());
      const mine = frame();

      rerender(<LiveTrackingMap techLocation={technician} userLocation={customer} routeDestination={customer} variant="fullscreen" />);
      expect(frame()).toEqual(mine);

      fireEvent.click(screen.getByRole("button", { name: "Recenter live tracking map" }));
      expect(frame()?.points).toEqual([technician, customer]);
      expect(frame()?.revision).toBeGreaterThan(mine?.revision ?? 0);
    });

    it("frames the technician and the drop when a tow turns towards it", () => {
      const tow = { techLocation: technician, userLocation: customer, dropLocation: drop, variant: "fullscreen" as const };
      const { rerender } = render(<LiveTrackingMap {...tow} routeDestination={customer} />);
      const toPickup = frame();
      expect(toPickup?.points).toEqual([technician, customer]);

      rerender(<LiveTrackingMap {...tow} techLocation={customer} routeDestination={drop} />);

      expect(frame()?.points).toEqual([customer, drop]);
      expect(frame()?.revision).toBeGreaterThan(toPickup?.revision ?? 0);
    });
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

    const following = surfaceCapture.props?.camera;
    expect(following?.mode).toBe("follow");

    // The map is given the very same camera afterwards, so it sends no camera command:
    // it neither follows the technician nor jumps back to the overview.
    act(() => surfaceCapture.props?.onInteract?.());
    expect(surfaceCapture.props?.camera).toBe(following);

    rerender(
      <LiveTrackingMap
        techLocation={{ lat: 12.972, lng: 77.592 }}
        userLocation={{ lat: 12.98, lng: 77.6 }}
        variant="fullscreen"
        mapMode="map"
      />,
    );
    expect(surfaceCapture.props?.camera).toBe(following);

    // Recentre hands the map back: it follows again.
    fireEvent.click(screen.getByRole("button", { name: "Recenter live tracking map" }));
    expect(surfaceCapture.props?.camera?.mode).toBe("follow");
    expect(surfaceCapture.props?.camera?.revision).toBeGreaterThan(following?.revision ?? 0);
  });

  it("reports that manual map interaction disables auto-frame", async () => {
    render(
      <LiveTrackingMap
        techLocation={{ lat: 12.97, lng: 77.59 }}
        userLocation={{ lat: 12.98, lng: 77.6 }}
        variant="fullscreen"
        mapMode="map"
      />,
    );
    logLiveTrackingDiagnostic.mockClear();

    act(() => surfaceCapture.props?.onInteract?.());

    await waitFor(() => expect(logLiveTrackingDiagnostic).toHaveBeenCalledWith(
      "[RT-MAP-CAMERA-VERIFY]",
      "camera_state",
      expect.objectContaining({
        autoFrame: false,
        mapMode: "map",
        variant: "fullscreen",
        displayedTechLat: 12.97,
        displayedTechLng: 77.59,
      }),
    ));
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

  describe("marker pictures", () => {
    const markerHtml = (id: string) => {
      const marker = surfaceCapture.props?.markers.find((candidate) => candidate.id === id);
      const host = document.createElement("div");
      host.innerHTML = String(marker?.html ?? "");
      return host;
    };
    const base = {
      techLocation: { lat: 12.97, lng: 77.59 },
      userLocation: { lat: 12.98, lng: 77.6 },
    };

    it("draws the technician as their vehicle in a disc, with the minutes left over it", () => {
      render(<LiveTrackingMap {...base} eta="8 mins" variant="fullscreen" />);

      const technician = markerHtml("technician");
      const shell = technician.querySelector('[data-tracking-marker="technician"]');
      expect(shell).toHaveClass("mappls-marker-shell", "tracking-tech-marker");
      expect(technician.querySelector(".tracking-tech-marker__badge .rq-symbol")).toHaveTextContent("two_wheeler");
      expect(technician.querySelector(".tracking-tech-marker__eta")).toHaveTextContent("8 min");
      // The part the map surface turns with the heading, and reads back in its diagnostics.
      expect(technician.querySelector(".tracking-tech-marker__vehicle")).not.toBeNull();
      expect(technician).not.toHaveTextContent("Technician");
    });

    it.each(["On the way", "Arrived", "Live", undefined])("puts no chip on the marker when there is no figure (%s)", (eta) => {
      render(<LiveTrackingMap {...base} eta={eta} variant="fullscreen" />);

      expect(markerHtml("technician").querySelector(".tracking-tech-marker__eta")).toBeNull();
      expect(markerHtml("technician").querySelector(".tracking-tech-marker__badge")).not.toBeNull();
    });

    it("draws a tow truck for a towing technician", () => {
      render(<LiveTrackingMap {...base} technicianVehicle="tow" />);

      expect(markerHtml("technician").querySelector(".rq-symbol")).toHaveTextContent("auto_towing");
    });

    it("shows the direction pointer only once the direction is known", () => {
      const still = render(<LiveTrackingMap {...base} />);
      expect(markerHtml("technician").querySelector(".tracking-tech-marker")).not.toHaveClass("has-heading");
      still.unmount();

      render(<LiveTrackingMap {...base} technicianHeading={90} technicianSpeed={8} />);
      expect(markerHtml("technician").querySelector(".tracking-tech-marker")).toHaveClass("has-heading");
    });

    it.each([
      ["LIVE", false],
      ["UPDATING", false],
      ["DELAYED", true],
      ["RECONNECTING", true],
      ["OFFLINE", true],
    ] as const)("marks an old position on the marker (%s)", (trackingFreshness, stale) => {
      render(<LiveTrackingMap {...base} trackingFreshness={trackingFreshness} />);

      expect(markerHtml("technician").querySelector(".tracking-tech-marker")?.classList.contains("is-stale")).toBe(stale);
    });

    it("marks the customer's spot with a dot and one word", () => {
      render(<LiveTrackingMap {...base} />);

      const customer = markerHtml("customer");
      expect(customer.querySelector('[data-tracking-place="customer"]')).toHaveClass("mappls-marker-shell", "tracking-place-marker");
      expect(customer.querySelector(".tracking-place-marker__label")).toHaveTextContent("You");
      expect(customer.querySelector(".tracking-place-marker__dot")).not.toBeNull();
      expect(customer.querySelector(".tracking-place-marker__pulse")).not.toBeNull();
    });

    it("tells the pickup from the drop on a tow", () => {
      render(<LiveTrackingMap {...base} dropLocation={{ lat: 12.99, lng: 77.61 }} userLabel="Pickup" technicianVehicle="tow" />);

      expect(markerHtml("customer").querySelector(".tracking-place-marker__label")).toHaveTextContent("Pickup");
      const drop = markerHtml("destination");
      expect(drop.querySelector('[data-tracking-place="drop"]')).toHaveClass("is-drop");
      expect(drop.querySelector(".tracking-place-marker__label")).toHaveTextContent("Drop");
      expect(drop.querySelector(".tracking-place-marker__pulse")).toBeNull();
    });

    it("keeps marker text as text", () => {
      render(<LiveTrackingMap {...base} userLabel={'<img src=x onerror="alert(1)">'} />);

      const customer = markerHtml("customer");
      expect(customer.querySelector("img")).toBeNull();
      expect(customer.querySelector(".tracking-place-marker__label")).toHaveTextContent('<img src=x onerror="alert(1)">');
    });

    it("keeps each marker's box, anchor and offset, so the map places them exactly as before", () => {
      render(<LiveTrackingMap {...base} dropLocation={{ lat: 12.99, lng: 77.61 }} eta="8 min" />);

      const spec = (id: string) => {
        const marker = surfaceCapture.props?.markers.find((candidate) => candidate.id === id);
        return { anchor: marker?.anchor, width: marker?.width, height: marker?.height, offset: marker?.offset, zIndex: marker?.zIndex };
      };
      expect(spec("customer")).toEqual({ anchor: "center", width: 86, height: 92, offset: [0, -18], zIndex: 640 });
      expect(spec("destination")).toEqual({ anchor: "center", width: 86, height: 92, offset: [0, -18], zIndex: 620 });
      expect(spec("technician")).toEqual({ anchor: "center", width: 108, height: 96, offset: [0, -18], zIndex: 720 });
    });
  });

  it("keeps the current renderer untouched unless the advanced tracking flag is enabled", () => {
    render(
      <LiveTrackingMap
        techLocation={{ lat: 12.97, lng: 77.59 }}
        userLocation={{ lat: 12.98, lng: 77.6 }}
        routeDestination={{ lat: 12.98, lng: 77.6 }}
        technicianSpeed={8}
        technicianHeading={90}
        technicianRecordedAt={1_000}
      />,
    );

    expect(surfaceCapture.props?.advancedTracking).toBeUndefined();
  });

  it("passes the existing authoritative technician stream to the feature-flagged renderer", () => {
    vi.stubEnv("VITE_MAPPLS_ADVANCED_TRACKING", "true");
    render(
      <LiveTrackingMap
        techLocation={{ lat: 12.97, lng: 77.59 }}
        userLocation={{ lat: 12.98, lng: 77.6 }}
        routeDestination={{ lat: 12.98, lng: 77.6 }}
        technicianSpeed={8}
        technicianHeading={90}
        technicianRecordedAt={1_000}
      />,
    );

    expect(surfaceCapture.props?.advancedTracking).toEqual({
      enabled: true,
      technician: {
        lat: 12.97,
        lng: 77.59,
        speed: 8,
        heading: 90,
        recordedAtMs: 1_000,
      },
      destination: { lat: 12.98, lng: 77.6 },
    });
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
    expect(screen.getByTestId("live-tracking-recenter")).toHaveAccessibleName("Recenter live tracking map");
    expect(screen.getByTestId("live-tracking-recenter").parentElement).toHaveClass("bottom-20");
  });
});
