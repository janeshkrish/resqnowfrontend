import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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
    remove: vi.fn(),
    setPosition: vi.fn(),
    setData: vi.fn(),
  });

  return {
    fakeMap,
    runtime: {
      Map: vi.fn(async () => fakeMap),
      Marker: vi.fn(layer),
      Polyline: vi.fn(layer),
      Circle: vi.fn(layer),
      removeLayer: vi.fn(),
    },
  };
};

describe("Mappls map surface", () => {
  it("shows a retryable fallback when Mappls cannot initialize", async () => {
    const loadSdk = vi.fn().mockRejectedValue(new Error("invalid key"));

    render(
      <MapplsMapSurface
        ariaLabel="Job map"
        loadSdk={loadSdk}
        markers={[]}
        polylines={[]}
        circles={[]}
      />,
    );

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Map is temporarily unavailable",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry map" }));
    await waitFor(() => expect(loadSdk).toHaveBeenCalledTimes(2));
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
});
