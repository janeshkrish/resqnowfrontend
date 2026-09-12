import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NearbyMapCanvas } from "./NearbyMapCanvas";
import type { MapMarkerSpec, MapCameraSpec, MapCircleSpec, MapPolylineSpec } from "@/lib/mapProvider/types";

let captured: { markers: MapMarkerSpec[]; camera: MapCameraSpec; circles: MapCircleSpec[]; polylines: MapPolylineSpec[] };
vi.mock("@/lib/mapProvider/MapplsMapSurface", () => ({
  MapplsMapSurface: (props: typeof captured & { onInteract?: () => void }) => {
    captured = props;
    return <div>
      {props.markers.filter((marker) => marker.onClick).map((marker) =>
        <button key={marker.id} onClick={marker.onClick}>{marker.id}</button>)}
      <button onClick={props.onInteract}>Pan map</button>
    </div>;
  },
}));
describe("Nearby technician Mappls map", () => {
  it("preserves selection, overlays and framing when technician data changes", () => {
    const first = { id: "one", latitude: 11.1, longitude: 77.4 };
    const second = { id: "two", latitude: 11.2, longitude: 77.5 };
    const onSelect = vi.fn(), onInteract = vi.fn();
    const props = { center: [11, 77] as [number, number], userPosition: [11, 77] as [number, number],
      activeTechPosition: [11.1, 77.4] as [number, number], technicians: [first, second], selectedTechId: "one",
      routePath: [[11, 77], [11.1, 77.4]] as [number, number][], bottomPadding: 300, rightPadding: 24, onSelect, onInteract };
    const view = render(<NearbyMapCanvas {...props} />);
    expect(captured.markers.map((marker) => marker.id)).toEqual(["user", "tech-one", "tech-two"]);
    expect(captured.circles).toHaveLength(3);
    expect(captured.polylines[1].points).toEqual([{lat:11,lng:77}, {lat:11.1,lng:77.4}]);
    expect(captured.camera).toMatchObject({ mode: "fit", padding: {bottom:300, right:24} });
    const revision = captured.camera.revision;
    fireEvent.click(screen.getByText("tech-two"));
    expect(onSelect).toHaveBeenCalledWith(second);
    fireEvent.click(screen.getByText("Pan map"));
    expect(onInteract).toHaveBeenCalledOnce();
    view.rerender(<NearbyMapCanvas {...props} selectedTechId="two" activeTechPosition={[11.2, 77.5]} />);
    expect(captured.camera.revision).toBeGreaterThan(revision);
    expect(captured.markers[2].html).toContain("#ea4335");
  });
});
