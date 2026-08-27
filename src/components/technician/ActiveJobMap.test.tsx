import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ActiveJobMap from "./ActiveJobMap";

vi.mock("@/lib/mapProvider/MapplsMapSurface", () => ({
  MapplsMapSurface: (props: { camera: { mode: string } }) => (
    <div data-testid="mappls-surface" data-camera={props.camera.mode} />
  ),
}));

vi.mock("@/lib/geo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/geo")>();
  return {
    ...actual,
    fetchRoute: vi.fn().mockResolvedValue({ polyline: [] }),
  };
});

describe("ActiveJobMap", () => {
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

  it("renders same-page navigation guidance and exits without changing status", () => {
    const onExitNavigation = vi.fn();

    render(
      <ActiveJobMap
        technicianLocation={{ lat: 12.97, lng: 77.59 }}
        navigationDestination={{ lat: 12.98, lng: 77.6 }}
        navigationMode
        onExitNavigation={onExitNavigation}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Turn-by-turn navigation" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Exit navigation" }));
    expect(onExitNavigation).toHaveBeenCalledTimes(1);
  });
});
