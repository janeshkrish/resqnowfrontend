import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MapplsMapSurface } from "./MapplsMapSurface";

const createFakeRuntime = () => {
  const handlers = new Map<string, Set<() => void>>();
  const fakeMap = {
    on: vi.fn((event: string, handler: () => void) => {
      const listeners = handlers.get(event) || new Set<() => void>();
      listeners.add(handler);
      handlers.set(event, listeners);
    }),
    off: vi.fn((event: string, handler: () => void) =>
      handlers.get(event)?.delete(handler),
    ),
    emit: (event: string) =>
      handlers.get(event)?.forEach((handler) => handler()),
    fitBounds: vi.fn(),
    jumpTo: vi.fn(),
    resize: vi.fn(),
    remove: vi.fn(),
  };
  const layer = () => ({
    addListener: vi.fn((_event: string, _handler: () => void) => {}),
    remove: vi.fn(),
    setPosition: vi.fn(),
    setData: vi.fn(),
  });

  return {
    fakeMap,
    runtime: {
      Map: vi.fn(() => fakeMap),
      Marker: vi.fn(layer),
      Polyline: vi.fn(layer),
      Circle: vi.fn(layer),
      removeLayer: vi.fn(),
    },
  };
};

describe("Mappls map surface", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  it("shows a retryable fallback when Mappls cannot initialize", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const onUnavailable = vi.fn();
    const loadSdk = vi.fn().mockRejectedValue(new Error("invalid key"));

    render(
      <MapplsMapSurface
        ariaLabel="Job map"
        loadSdk={loadSdk}
        markers={[]}
        polylines={[]}
        circles={[]}
        onUnavailable={onUnavailable}
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Map is temporarily unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry map" }));
    await waitFor(() => expect(loadSdk).toHaveBeenCalledTimes(2));
    expect(onUnavailable).toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith("[Mappls]", { code: "map_failed", origin: window.location.origin });
  });

  it("creates one map and forwards map interactions", async () => {
    const onInteract = vi.fn();
    const { fakeMap, runtime } = createFakeRuntime();

    render(
      <MapplsMapSurface
        ariaLabel="Tracking map"
        loadSdk={async () => runtime}
        markers={[]}
        polylines={[]}
        circles={[]}
        onInteract={onInteract}
      />,
    );

    await waitFor(() => expect(runtime.Map).toHaveBeenCalledTimes(1));
    await act(async () => { fakeMap.emit("load"); });
    await waitFor(() =>
      expect(fakeMap.on).toHaveBeenCalledWith(
        "dragstart",
        expect.any(Function),
      ),
    );
    await act(async () => { fakeMap.emit("dragstart"); });
    expect(onInteract).toHaveBeenCalledTimes(1);
  });

  it("does not create a map after unmounting during SDK loading", async () => {
    const { runtime } = createFakeRuntime();
    let ready: (value: typeof runtime) => void;
    const loadSdk = () => new Promise<typeof runtime>((resolve) => { ready = resolve; });
    const view = render(<MapplsMapSurface ariaLabel="Map" markers={[]} circles={[]} polylines={[]} loadSdk={loadSdk} />);
    view.unmount();
    await act(async () => { ready(runtime); });
    expect(runtime.Map).not.toHaveBeenCalled();
  });

  it("uses the latest technician click handler without recreating the marker", async () => {
    const { fakeMap, runtime } = createFakeRuntime();
    const onClick = vi.fn(), nextClick = vi.fn();
    const loadSdk = async () => runtime;
    const marker = { id: "tech", position: {lat:11,lng:77}, html: "<span>Technician</span>", onClick };
    const view = render(<MapplsMapSurface ariaLabel="Map" markers={[marker]} circles={[]} polylines={[]} loadSdk={loadSdk} />);
    await waitFor(() => expect(runtime.Map).toHaveBeenCalledOnce());
    await act(async () => { fakeMap.emit("load"); });
    const layer = runtime.Marker.mock.results[0].value;
    const click = layer.addListener.mock.calls[0][1] as () => void;
    click();
    expect(onClick).toHaveBeenCalledOnce();
    view.rerender(<MapplsMapSurface ariaLabel="Map" markers={[{...marker, onClick:nextClick}]} circles={[]} polylines={[]} loadSdk={loadSdk} />);
    click();
    expect(nextClick).toHaveBeenCalledOnce();
    expect(runtime.Marker).toHaveBeenCalledOnce();
  });
});
