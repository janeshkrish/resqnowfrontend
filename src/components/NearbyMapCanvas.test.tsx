import { act, render, screen, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { NearbyMapCanvas, type RadarPin } from "./NearbyMapCanvas";
import type { MapMarkerSpec, MapCameraSpec, MapCircleSpec, MapPolylineSpec } from "@/lib/mapProvider/types";

let captured: { markers: MapMarkerSpec[]; camera: MapCameraSpec; circles: MapCircleSpec[]; polylines: MapPolylineSpec[] };
vi.mock("@/lib/mapProvider/MapplsMapSurface", () => ({
  MapplsMapSurface: (props: typeof captured & { onMapClick?: () => void }) => {
    captured = props;
    return <div>
      {props.markers.filter((marker) => marker.onClick).map((marker) =>
        <button key={marker.id} onClick={() => { marker.onClick?.(); props.onMapClick?.(); }}>{marker.id}</button>)}
      <button onClick={props.onMapClick}>Map</button>
    </div>;
  },
}));

const pin = (id: string, lat: number, lng: number, onClick = vi.fn()): RadarPin =>
  ({ id, lat, lng, html: `<div>${id}</div>`, width: 44, height: 50, anchor: "bottom", onClick });

const base = { center: [11, 77] as [number, number], userPosition: [11, 77] as [number, number], topPadding: 150, bottomPadding: 300, rightPadding: 32 };

describe("Live radar map", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("draws the customer and the given pins, and frames the focused pin with room for the header and sheet", () => {
    const first = pin("tech-one", 11.1, 77.4);
    const second = pin("tech-two", 11.2, 77.5);
    const view = render(<NearbyMapCanvas {...base} pins={[first, second]} focus={[[11.1, 77.4]]} />);

    expect(captured.markers.map((marker) => marker.id)).toEqual(["user", "tech-one", "tech-two"]);
    expect(captured.markers[0].html).toContain("rqr-me");
    expect(captured.markers[1]).toMatchObject({ anchor: "bottom", width: 44, height: 50 });
    expect(captured.circles.map((circle) => circle.id)).toEqual(["user-outer", "user-inner"]);
    expect(captured.polylines).toEqual([]);
    expect(captured.camera).toMatchObject({
      mode: "fit",
      points: [{ lat: 11, lng: 77 }, { lat: 11.1, lng: 77.4 }],
      padding: { top: 150, right: 32, bottom: 300, left: 24 },
    });

    const revision = captured.camera.revision;
    view.rerender(<NearbyMapCanvas {...base} pins={[first, second]} focus={[[11.1, 77.4]]} />);
    expect(captured.camera.revision).toBe(revision);
    view.rerender(<NearbyMapCanvas {...base} pins={[first, second]} focus={[[11.2, 77.5]]} />);
    expect(captured.camera.revision).toBeGreaterThan(revision);
  });

  it("frames the area around the customer when nothing is focused", () => {
    render(<NearbyMapCanvas {...base} userPosition={null} pins={[]} focus={[]} />);
    expect(captured.markers).toEqual([]);
    expect(captured.camera).toMatchObject({ points: [{ lat: 11, lng: 77 }], maxZoom: 14 });
  });

  it("reports a tap on the map, but not the tap that picked a pin", () => {
    const onMapTap = vi.fn();
    const onPin = vi.fn();
    render(<NearbyMapCanvas {...base} pins={[pin("ev-A", 11.02, 76.96, onPin)]} focus={[]} onMapTap={onMapTap} />);

    fireEvent.click(screen.getByText("ev-A"));
    act(() => { vi.advanceTimersByTime(200); });
    expect(onPin).toHaveBeenCalledOnce();
    expect(onMapTap).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(400); });
    fireEvent.click(screen.getByText("Map"));
    act(() => { vi.advanceTimersByTime(200); });
    expect(onMapTap).toHaveBeenCalledOnce();
  });
});
