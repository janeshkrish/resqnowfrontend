# Mappls In-App Navigation and Live Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Leaflet on the technician active-job and user tracking screens with Mappls, and add same-page technician navigation driven by the existing live location stream.

**Architecture:** A small Mappls adapter owns SDK initialization, map lifecycle, overlays, camera behavior, and graceful failure. Existing OSRM route data remains in `[lat,lng]` form until the adapter renders it; a pure navigation model derives remaining route, maneuvers, distance, and ETA from that route and the existing technician location state.

**Tech Stack:** React 18, TypeScript, Vite, Vitest/Testing Library, `mappls-web-maps@3.8.1`, Tailwind/shadcn, Capacitor 8, existing OSRM backend contract

**Spec:** `docs/superpowers/specs/2026-08-27-mappls-in-app-navigation-design.md`

## Global Constraints

- Use `VITE_MAPPLS_MAP_SDK_KEY`; never hardcode a key or add a client secret to frontend code.
- Keep `/api/public/route`, `fetchRoute()`, and route polyline coordinate order backward-compatible.
- Do not add geolocation watchers, socket listeners, or route polling outside the existing flows.
- Preserve every existing public prop on `ActiveJobMap` and `LiveTrackingMap`; navigation additions are optional.
- Preserve status, payment, cancellation, completion, phone, socket, and 15-second active-job refresh behavior.
- Do not remove Leaflet dependencies globally while other repository screens still use them.
- Do not use Leaflet, OSM, or CartoDB in the two migrated components, including fallback UI.
- Preserve user-owned working-tree changes and stage/commit only files belonging to the current task.
- Do not create implementation commits in this workspace: every existing target/configuration file is already modified relative to HEAD, so staging it would also commit user-owned work. Use scoped `git diff --check -- <files>` checkpoints instead.
- Keep Mappls attribution visible.

---

### Task 1: Mappls dependency, configuration, and SDK loader

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `.env.example`
- Modify: `src/vite-env.d.ts`
- Create: `src/lib/mapProvider/types.ts`
- Create: `src/lib/mapProvider/mapplsSdk.ts`
- Test: `src/lib/mapProvider/mapplsSdk.test.ts`

**Interfaces:**
- Consumes: `import.meta.env.VITE_MAPPLS_MAP_SDK_KEY`
- Produces: `initializeMapplsSdk(): Promise<MapplsRuntime>`, `MapProviderError`, `resetMapplsSdkForTests()`

- [ ] **Step 1: Add a failing SDK-loader test**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMapplsSdkLoader } from "./mapplsSdk";

describe("Mappls SDK loader", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects a missing client-safe Map SDK key", async () => {
    const loader = createMapplsSdkLoader({
      readKey: () => "",
      createSdk: vi.fn(),
    });
    await expect(loader()).rejects.toMatchObject({ code: "missing_key" });
  });

  it("deduplicates concurrent SDK initialization", async () => {
    const initialize = vi.fn((_key, _options, done) => done());
    const createSdk = vi.fn(async () => ({ sdk: { initialize } }));
    const loader = createMapplsSdkLoader({ readKey: () => "public-key", createSdk });
    const [first, second] = await Promise.all([loader(), loader()]);
    expect(first).toBe(second);
    expect(createSdk).toHaveBeenCalledTimes(1);
    expect(initialize).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/mapProvider/mapplsSdk.test.ts`

Expected: FAIL because `mapplsSdk.ts` and its exports do not exist.

- [ ] **Step 3: Define the provider types and minimal loader**

```ts
export type MapPoint = { lat: number; lng: number };
export type MapPadding = { top: number; right: number; bottom: number; left: number };

export interface MapplsLayer {
  remove?: () => void;
  setData?: (data: unknown) => void;
}

export interface MapplsMarker extends MapplsLayer {
  setPosition?: (position: MapPoint) => void;
  setLngLat?: (position: [number, number]) => void;
}

export interface MapplsMap {
  on(event: string, handler: () => void): void;
  off(event: string, handler: () => void): void;
  fitBounds(bounds: unknown, options?: Record<string, unknown>): void;
  jumpTo(options: Record<string, unknown>): void;
  resize(): void;
  remove(): void;
}

export interface MapplsRuntime {
  Map(options: { id: string; properties: Record<string, unknown> }): MapplsMap;
  Marker(options: Record<string, unknown>): MapplsMarker;
  Polyline(options: Record<string, unknown>): MapplsLayer;
  Circle(options: Record<string, unknown>): MapplsLayer;
  removeLayer(input: { map: MapplsMap; layer: MapplsLayer }): void;
}

export class MapProviderError extends Error {
  constructor(public code: "missing_key" | "sdk_load_failed" | "map_failed", message: string) {
    super(message);
    this.name = "MapProviderError";
  }
}
```

Implement `createMapplsSdkLoader()` with one cached promise, `version: "3.0"`, `map: true`, empty plugins/libraries, and a lazy `import("mappls-web-maps")`. Resolve only from the SDK initialize callback; reject initialization exceptions as `sdk_load_failed`.

- [ ] **Step 4: Add dependency and environment declarations**

Run: `npm install mappls-web-maps@3.8.1 --save-exact`

Add exactly this committed example entry:

```dotenv
VITE_MAPPLS_MAP_SDK_KEY=
```

Extend `ImportMetaEnv`:

```ts
readonly VITE_MAPPLS_MAP_SDK_KEY?: string;
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run: `npm test -- src/lib/mapProvider/mapplsSdk.test.ts`

Expected: both loader tests PASS.

- [ ] **Step 6: Check the scoped Task 1 diff**

```bash
git diff --check -- package.json package-lock.json .env.example src/vite-env.d.ts src/lib/mapProvider/types.ts src/lib/mapProvider/mapplsSdk.ts src/lib/mapProvider/mapplsSdk.test.ts
```

---

### Task 2: Declarative Mappls map surface

**Files:**
- Create: `src/lib/mapProvider/MapplsMapSurface.tsx`
- Create: `src/lib/mapProvider/MapplsMapSurface.test.tsx`
- Modify: `src/lib/mapProvider/types.ts`

**Interfaces:**
- Consumes: `initializeMapplsSdk()`, `MapPoint`, Mappls runtime wrapper
- Produces: `MapplsMapSurface`, `MapMarkerSpec`, `MapCircleSpec`, `MapPolylineSpec`, `MapCameraSpec`

- [ ] **Step 1: Write failing surface tests**

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    off: vi.fn((event: string, handler: () => void) => handlers.get(event)?.delete(handler)),
    emit: (event: string) => handlers.get(event)?.forEach((handler) => handler()),
    fitBounds: vi.fn(),
    jumpTo: vi.fn(),
    resize: vi.fn(),
    remove: vi.fn(),
  };
  const layer = () => ({ remove: vi.fn(), setPosition: vi.fn(), setData: vi.fn() });
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

it("shows a retryable fallback when Mappls cannot initialize", async () => {
  const loadSdk = vi.fn().mockRejectedValue(new Error("invalid key"));
  render(<MapplsMapSurface ariaLabel="Job map" loadSdk={loadSdk} markers={[]} polylines={[]} circles={[]} />);
  expect(await screen.findByRole("status")).toHaveTextContent("Map is temporarily unavailable");
  fireEvent.click(screen.getByRole("button", { name: "Retry map" }));
  expect(loadSdk).toHaveBeenCalledTimes(2);
});

it("creates one map and forwards map interactions", async () => {
  const onInteract = vi.fn();
  const { fakeMap, runtime } = createFakeRuntime();
  render(<MapplsMapSurface ariaLabel="Tracking map" loadSdk={async () => runtime} markers={[]} polylines={[]} circles={[]} onInteract={onInteract} />);
  await waitFor(() => expect(runtime.Map).toHaveBeenCalledTimes(1));
  fakeMap.emit("load");
  await waitFor(() => expect(fakeMap.on).toHaveBeenCalledWith("dragstart", expect.any(Function)));
  fakeMap.emit("dragstart");
  expect(onInteract).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/lib/mapProvider/MapplsMapSurface.test.tsx`

Expected: FAIL because the surface does not exist.

- [ ] **Step 3: Define declarative surface inputs**

```ts
export type MapMarkerSpec = {
  id: string;
  position: MapPoint;
  html: string | HTMLElement;
  anchor?: "center" | "bottom";
  zIndex?: number;
  heading?: number | null;
};

export type MapPolylineSpec = {
  id: string;
  points: MapPoint[];
  color: string;
  width: number;
  opacity: number;
};

export type MapCircleSpec = {
  id: string;
  center: MapPoint;
  radiusMeters: number;
  fillColor: string;
  fillOpacity: number;
};

export type MapCameraSpec =
  | { mode: "fit"; points: MapPoint[]; padding: MapPadding; maxZoom: number; revision: number }
  | { mode: "follow"; center: MapPoint; zoom: number; bearing?: number; pitch?: number; revision: number };
```

- [ ] **Step 4: Implement lifecycle, overlay reconciliation, and fallback**

Use a unique `useId()`-derived DOM id, initialize once per mount, wait for the map `load` event, observe container resizing, register `click`, `mousedown`, `touchstart`, `dragstart`, and `zoomstart`, and clean up every marker/layer/listener plus the map instance on unmount. Reconcile overlays by stable `id`; update positions/data where the SDK supports it and replace only that overlay otherwise. Camera changes apply only when `revision` or camera mode changes.

The fallback must contain:

```tsx
<div role="status" className="flex h-full min-h-[240px] flex-col items-center justify-center bg-slate-100 p-6 text-center">
  <p className="font-bold text-slate-900">Map is temporarily unavailable</p>
  <p className="mt-1 text-sm text-slate-500">Live job details will continue updating.</p>
  <Button type="button" variant="outline" onClick={retry}>Retry map</Button>
</div>
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/lib/mapProvider/MapplsMapSurface.test.tsx src/lib/mapProvider/mapplsSdk.test.ts`

Expected: PASS with map cleanup and no React act warnings.

- [ ] **Step 6: Check the scoped Task 2 diff**

```bash
git diff --check -- src/lib/mapProvider/types.ts src/lib/mapProvider/MapplsMapSurface.tsx src/lib/mapProvider/MapplsMapSurface.test.tsx
```

---

### Task 3: Pure navigation progress and maneuver model

**Files:**
- Create: `src/lib/navigation/routeNavigation.ts`
- Test: `src/lib/navigation/routeNavigation.test.ts`

**Interfaces:**
- Consumes: `GeoPoint`, `[lat,lng][]`, optional OSRM route duration
- Produces: `getNavigationProgress(input): NavigationProgress`

- [ ] **Step 1: Write failing geometry/navigation tests**

```ts
import { describe, expect, it } from "vitest";
import { getNavigationProgress } from "./routeNavigation";

describe("route navigation", () => {
  const route: Array<[number, number]> = [
    [12.9716, 77.5946],
    [12.9726, 77.5946],
    [12.9726, 77.5966],
  ];

  it("snaps progress to the nearest route segment and returns the remaining line", () => {
    const result = getNavigationProgress({ current: { lat: 12.9721, lng: 77.59462 }, route });
    expect(result.remainingPolyline[0][0]).toBeCloseTo(12.9721, 3);
    expect(result.remainingDistanceMeters).toBeGreaterThan(150);
  });

  it("describes the next meaningful right turn", () => {
    const result = getNavigationProgress({ current: { lat: 12.9717, lng: 77.5946 }, route });
    expect(result.maneuver.kind).toBe("turn-right");
    expect(result.instruction).toMatch(/right/i);
    expect(result.distanceToManeuverMeters).toBeGreaterThan(50);
  });

  it("falls back to direct destination guidance when no route is available", () => {
    const result = getNavigationProgress({ current: { lat: 12.97, lng: 77.59 }, destination: { lat: 12.98, lng: 77.60 }, route: [] });
    expect(result.instruction).toBe("Continue toward the destination");
    expect(result.remainingPolyline).toHaveLength(2);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/lib/navigation/routeNavigation.test.ts`

Expected: FAIL because the module is absent.

- [ ] **Step 3: Implement the minimal navigation model**

```ts
export type ManeuverKind = "continue" | "slight-left" | "slight-right" | "turn-left" | "turn-right" | "sharp-left" | "sharp-right" | "arrive";

export type NavigationInput = {
  current: GeoPoint;
  destination?: GeoPoint;
  route: Array<[number, number]>;
  routeDurationMinutes?: number;
};

export type NavigationProgress = {
  instruction: string;
  maneuver: { kind: ManeuverKind; bearing: number };
  distanceToManeuverMeters: number;
  remainingDistanceMeters: number;
  remainingEtaMinutes: number;
  remainingPolyline: Array<[number, number]>;
  offRoute: boolean;
};

export function getNavigationProgress(input: NavigationInput): NavigationProgress;
```

Use haversine distances, local equirectangular projection for nearest-segment snapping, normalized bearing deltas, and thresholds of 20°/45°/120° for slight/turn/sharp classification. Mark off-route at 80 meters. Collapse adjacent points closer than 3 meters. ETA scales `routeDurationMinutes` by remaining/total length when provided; otherwise use 30 km/h with a minimum of one minute.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/lib/navigation/routeNavigation.test.ts`

Expected: all navigation tests PASS.

- [ ] **Step 5: Check the scoped Task 3 diff**

```bash
git diff --check -- src/lib/navigation/routeNavigation.ts src/lib/navigation/routeNavigation.test.ts
```

---

### Task 4: Mappls technician active-job map and navigation UI

**Files:**
- Modify: `src/components/technician/ActiveJobMap.tsx`
- Create: `src/components/technician/ActiveJobMap.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `MapplsMapSurface`, `fetchRoute()`, `routePolylineFromMetadata()`, `getNavigationProgress()`
- Preserves: `technicianLocation`, `customerLocation`, `destinationLocation`, `routePolyline`
- Adds: `navigationMode?`, `navigationDestination?`, `heading?`, `onExitNavigation?`

- [ ] **Step 1: Write failing component tests with the map surface mocked**

```tsx
vi.mock("@/lib/mapProvider/MapplsMapSurface", () => ({
  MapplsMapSurface: (props: any) => <div data-testid="mappls-surface" data-camera={props.camera.mode} />,
}));

it("renders an overview Mappls surface with job markers", () => {
  render(<ActiveJobMap technicianLocation={{ lat: 12.97, lng: 77.59 }} customerLocation={{ lat: 12.98, lng: 77.60 }} />);
  expect(screen.getByTestId("mappls-surface")).toHaveAttribute("data-camera", "fit");
});

it("renders same-page navigation guidance and exits without changing status", async () => {
  const onExitNavigation = vi.fn();
  render(<ActiveJobMap technicianLocation={{ lat: 12.97, lng: 77.59 }} navigationDestination={{ lat: 12.98, lng: 77.60 }} navigationMode onExitNavigation={onExitNavigation} />);
  expect(await screen.findByRole("region", { name: "Turn-by-turn navigation" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Exit navigation" }));
  expect(onExitNavigation).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- src/components/technician/ActiveJobMap.test.tsx`

Expected: FAIL because the component still renders Leaflet and has no navigation props/UI.

- [ ] **Step 3: Replace Leaflet rendering with Mappls surface inputs**

Remove every `react-leaflet`, Leaflet CSS, `L`, icon asset, `MapContainer`, and OSM `TileLayer` import. Build branded HTML marker specs for technician, pickup, and drop. Convert route points to `{lat,lng}` only when building `MapPolylineSpec`.

In overview mode, camera is:

```ts
{ mode: "fit", points: availablePoints, padding: { top: 56, right: 44, bottom: 56, left: 44 }, maxZoom: 15, revision: overviewRevision }
```

In navigation mode, camera follows the live technician at zoom 17, pitch 45, and provided heading or navigation maneuver bearing.

- [ ] **Step 4: Add route request control and navigation cards**

Fetch the active origin-to-target route when no supplied route is usable. Abort/ignore stale calls. Re-route only when the current position moved at least 35 meters from the previous route origin or `progress.offRoute` is true, with a 4-second minimum between requests. Reuse the last route during the request.

Render a top instruction banner with a maneuver icon and formatted maneuver distance, plus a bottom card with remaining distance, ETA, recenter, and Exit navigation. Use `aria-live="polite"` for instruction changes and `role="region" aria-label="Turn-by-turn navigation"` for the navigation shell.

- [ ] **Step 5: Update only Mappls-specific tracking styles**

Replace `.tracking-live-map .leaflet-*` selectors only where the two migrated components depend on them. Add `.mappls-marker-shell`, `.active-job-navigation-marker`, and reduced-motion rules; keep all existing tracking marker class bodies intact.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `npm test -- src/components/technician/ActiveJobMap.test.tsx src/lib/navigation/routeNavigation.test.ts`

Expected: PASS, with no Leaflet module needed by the test.

- [ ] **Step 7: Check the scoped Task 4 diff**

```bash
git diff --check -- src/components/technician/ActiveJobMap.tsx src/components/technician/ActiveJobMap.test.tsx src/index.css
```

---

### Task 5: Wire Navigate and START JOURNEY into same-page navigation

**Files:**
- Create: `src/lib/activeJobNavigation.ts`
- Test: `src/lib/activeJobNavigation.test.ts`
- Modify: `src/pages/technician/ActiveJob.tsx`
- Create: `src/pages/technician/ActiveJob.test.tsx`

**Interfaces:**
- Consumes: current status/job coordinates and `updateStatus(status): Promise<boolean>`
- Produces: `resolveActiveJobNavigationTarget(job, status): GeoPoint | null`, `isNavigationActive` state

- [ ] **Step 1: Write failing target-resolution and status-gating tests**

```ts
it("uses pickup before towing pickup completion and drop afterward", () => {
  const job = { pickupLatitude: 12.97, pickupLongitude: 77.59, destinationLatitude: 12.99, destinationLongitude: 77.61 };
  expect(resolveActiveJobNavigationTarget(job, "en_route_pickup")).toEqual({ lat: 12.97, lng: 77.59 });
  expect(resolveActiveJobNavigationTarget(job, "vehicle_loaded")).toEqual({ lat: 12.99, lng: 77.61 });
});

it("starts navigation only after START JOURNEY status succeeds", async () => {
  const setNavigationActive = vi.fn();
  await startJourneyAndNavigate(vi.fn().mockResolvedValue(false), setNavigationActive);
  expect(setNavigationActive).not.toHaveBeenCalled();
  await startJourneyAndNavigate(vi.fn().mockResolvedValue(true), setNavigationActive);
  expect(setNavigationActive).toHaveBeenCalledWith(true);
});
```

The page integration test mocks auth/socket/job hooks and `ActiveJobMap`, then asserts that Navigate sets `navigationMode`, START JOURNEY issues the existing PATCH before setting `navigationMode`, and `window.open` is never called.

```tsx
const capture = vi.hoisted(() => ({ mapProps: null as any }));
vi.mock("@/components/technician/ActiveJobMap", () => ({
  default: (props: any) => {
    capture.mapProps = props;
    return <div data-testid="active-job-map" />;
  },
}));
vi.mock("@/hooks/useTechnicianActiveJob", () => ({
  useTechnicianActiveJob: () => ({
    activeJob: { id: "request-42", status: "accepted", pickupLatitude: 12.97, pickupLongitude: 77.59 },
    dues: 0,
    setDues: vi.fn(),
    refreshActiveJob: vi.fn().mockResolvedValue(undefined),
    refreshDues: vi.fn(),
  }),
}));
vi.mock("@/contexts/TechnicianAuthContext", () => ({
  useTechnicianAuth: () => ({ token: "test-token", technician: { id: "tech-1" } }),
}));
vi.mock("@/contexts/SocketContext", () => ({ useSocket: () => ({ socket: { emit: vi.fn() } }) }));

it("keeps Navigate and START JOURNEY inside the active-job page", async () => {
  const open = vi.spyOn(window, "open").mockImplementation(() => null);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, status: "en-route" }),
  }));
  render(
    <MemoryRouter initialEntries={["/technician/active-job/request-42"]}>
      <Routes><Route path="/technician/active-job/:requestId" element={<ActiveJob />} /></Routes>
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /navigate/i }));
  await waitFor(() => expect(capture.mapProps.navigationMode).toBe(true));
  act(() => capture.mapProps.onExitNavigation());
  fireEvent.click(screen.getByRole("button", { name: /start journey/i }));
  await waitFor(() => expect(capture.mapProps.navigationMode).toBe(true));
  expect(open).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/lib/activeJobNavigation.test.ts src/pages/technician/ActiveJob.test.tsx`

Expected: FAIL because the helper and same-page state do not exist.

- [ ] **Step 3: Implement pure navigation target helpers**

```ts
export async function startJourneyAndNavigate(
  updateStatus: (status: string) => Promise<boolean>,
  setNavigationActive: (active: boolean) => void,
) {
  const updated = await updateStatus("en-route");
  if (updated) setNavigationActive(true);
  return updated;
}
```

`resolveActiveJobNavigationTarget()` must reuse the exact towing drop-status set from the existing `openNavigation()` logic and return `null` for incomplete coordinates.

- [ ] **Step 4: Modify ActiveJob without changing unrelated flows**

Make `updateStatus` return `true` only for an OK/success response and `false` for rollback/error. Remove `window.open` entirely. Add `isNavigationActive`, calculate `navigationTarget`, and pass:

```tsx
<ActiveJobMap
  technicianLocation={currentLocation || fallbackLocation}
  customerLocation={customerLocation}
  destinationLocation={dropLocation}
  routePolyline={existingPolyline}
  navigationMode={isNavigationActive}
  navigationDestination={navigationTarget || undefined}
  onExitNavigation={() => setIsNavigationActive(false)}
/>
```

Navigate validates `navigationTarget` before enabling. START JOURNEY calls `startJourneyAndNavigate(updateStatus, setIsNavigationActive)`. Status transitions to arrived/completed/cancelled automatically disable navigation, while manually exiting navigation does not mutate status.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/lib/activeJobNavigation.test.ts src/pages/technician/ActiveJob.test.tsx src/components/technician/ActiveJobMap.test.tsx`

Expected: PASS and the window-open spy has zero calls.

- [ ] **Step 6: Check the scoped Task 5 diff**

```bash
git diff --check -- src/lib/activeJobNavigation.ts src/lib/activeJobNavigation.test.ts src/pages/technician/ActiveJob.tsx src/pages/technician/ActiveJob.test.tsx
```

---

### Task 6: Mappls user live-tracking map

**Files:**
- Modify: `src/components/user/LiveTrackingMap.tsx`
- Create: `src/components/user/LiveTrackingMap.test.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `MapplsMapSurface`, existing OSRM route helper and all current props
- Produces: the same `LiveTrackingMap` default export and visual overlays without Leaflet

- [ ] **Step 1: Write failing preservation tests**

```tsx
const surfaceCapture = vi.hoisted(() => ({ props: null as any }));
vi.mock("@/lib/mapProvider/MapplsMapSurface", () => ({
  MapplsMapSurface: (props: any) => {
    surfaceCapture.props = props;
    return <div data-testid="mappls-surface" />;
  },
}));

it("passes pulse markers, circles, cased route, and fit camera to Mappls", async () => {
  render(<LiveTrackingMap techLocation={{ lat: 12.97, lng: 77.59 }} userLocation={{ lat: 12.98, lng: 77.60 }} eta="8 min" variant="fullscreen" />);
  const props = surfaceCapture.props;
  expect(props.markers.find((marker) => marker.id === "technician").html).toContain("tracking-tech-marker__bubble");
  expect(props.markers.find((marker) => marker.id === "technician").html).toContain("8 min");
  expect(props.circles).toHaveLength(3);
  expect(props.polylines.map((line) => line.id)).toEqual(["route-casing", "route-primary"]);
  expect(props.camera.mode).toBe("fit");
});

it("forwards interactions and recenters the fullscreen map", () => {
  const onInteract = vi.fn();
  render(<LiveTrackingMap techLocation={null} userLocation={{ lat: 12.98, lng: 77.60 }} variant="fullscreen" onInteract={onInteract} />);
  surfaceCapture.props.onInteract();
  expect(onInteract).toHaveBeenCalledTimes(1);
  const before = surfaceCapture.props.camera.revision;
  fireEvent.click(screen.getByRole("button", { name: "Recenter live tracking map" }));
  expect(surfaceCapture.props.camera.revision).toBeGreaterThan(before);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm test -- src/components/user/LiveTrackingMap.test.tsx`

Expected: FAIL because the component still uses Leaflet.

- [ ] **Step 3: Replace Leaflet with declarative Mappls overlays**

Remove all Leaflet imports and icon construction. Return marker HTML strings using the existing class names. Escape the ETA text before inserting it into HTML. Preserve the current curved fallback and supplied-route precedence.

Create three pulse circles with the existing radii/colors, two destination markers, one smoothly updating technician marker, and route casing/primary polylines. Camera padding remains variant/map-mode dependent and includes all available points. The surface receives `onInteract` only when appropriate but the callback prop remains callable in both variants.

- [ ] **Step 4: Preserve fullscreen/card shells and fallback behavior**

Keep the fullscreen status card and recenter button. Keep the card wrapper height and `className` behavior. Ensure SDK fallback fills either shell and does not hide the status/recenter controls.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run: `npm test -- src/components/user/LiveTrackingMap.test.tsx src/lib/mapProvider/MapplsMapSurface.test.tsx`

Expected: PASS with the marker class/ETA assertions intact.

- [ ] **Step 6: Check the scoped Task 6 diff**

```bash
git diff --check -- src/components/user/LiveTrackingMap.tsx src/components/user/LiveTrackingMap.test.tsx src/index.css
```

---

### Task 7: Preserve RequestTracking fullscreen/card behavior

**Files:**
- Modify: `src/components/RequestTracking.tsx`
- Create: `src/lib/trackingMapMode.ts`
- Test: `src/lib/trackingMapMode.test.ts`

**Interfaces:**
- Consumes: existing `sheetSnapState`, `snapTo()`, both existing `LiveTrackingMap` sites
- Produces: `trackingMapModeFromSheetSnap()`, fullscreen `onInteract`

- [ ] **Step 1: Write the failing sheet-to-map-mode test**

```ts
expect(trackingMapModeFromSheetSnap("expanded")).toBe("sheet");
expect(trackingMapModeFromSheetSnap("half")).toBe("balanced");
expect(trackingMapModeFromSheetSnap("collapsed")).toBe("map");
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/lib/trackingMapMode.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the pure mode mapping and wire the mobile render**

```ts
export type TrackingMapMode = "map" | "balanced" | "sheet";
export const trackingMapModeFromSheetSnap = (snap: "expanded" | "half" | "collapsed"): TrackingMapMode =>
  snap === "expanded" ? "sheet" : snap === "collapsed" ? "map" : "balanced";
```

Pass `mapMode={trackingMapModeFromSheetSnap(sheetSnapState)}` and `onInteract={() => snapTo("collapsed")}` to the fullscreen map. Leave the desktop/card render props unchanged. Remove the unused `sheetMode` state only after confirming it has no other consumers.

- [ ] **Step 4: Run RequestTracking and map tests**

Run: `npm test -- src/lib/trackingMapMode.test.ts src/components/user/LiveTrackingMap.test.tsx`

Expected: PASS. Search confirms exactly two `LiveTrackingMap` render sites remain.

- [ ] **Step 5: Check the scoped Task 7 diff**

```bash
git diff --check -- src/components/RequestTracking.tsx src/lib/trackingMapMode.ts src/lib/trackingMapMode.test.ts
```

---

### Task 8: Full verification, web visual check, and Android build

**Files:**
- Modify only if a test exposes a defect: files already listed in Tasks 1–7

**Interfaces:**
- Consumes: completed feature and configured local Mappls key
- Produces: evidence for web/native readiness and a manual checklist

- [ ] **Step 1: Run all focused and full automated tests**

```bash
npm test -- src/lib/mapProvider/mapplsSdk.test.ts src/lib/mapProvider/MapplsMapSurface.test.tsx src/lib/navigation/routeNavigation.test.ts src/lib/activeJobNavigation.test.ts src/pages/technician/ActiveJob.test.tsx src/components/technician/ActiveJobMap.test.tsx src/components/user/LiveTrackingMap.test.tsx src/lib/trackingMapMode.test.ts
npm test
```

Expected: all tests PASS with no unhandled rejection or React act warning introduced by these tests.

- [ ] **Step 2: Build the frontend and scan forbidden providers**

```bash
npm run build
rg -n "react-leaflet|leaflet/dist|openstreetmap|tile.openstreetmap|cartocdn|TileLayer|MapContainer" src/components/technician/ActiveJobMap.tsx src/components/user/LiveTrackingMap.tsx
rg -n "window\.open|openstreetmap\.org/directions" src/pages/technician/ActiveJob.tsx
```

Expected: build exits 0; both searches return no matches.

- [ ] **Step 3: Run the web app and browser verification**

Run: `npm run dev -- --host 127.0.0.1`

Use the browser verification workflow on:

- Sign into the technician fixture account, open its current job from the dashboard, and verify: overview renders Mappls, Navigate enters the same-page navigation shell, Exit returns to overview, START JOURNEY PATCH succeeds then enters navigation, and no new tab appears.
- Sign into the paired user fixture account, open the same request from My Requests on mobile and desktop viewports, and verify: Mappls loads, marker bubbles/ripples animate, socket-driven technician updates move the existing marker, route and ETA remain visible, manual pan collapses the mobile sheet, and recenter restores framing.
- Missing/invalid key test using a temporary development environment override: fallback and Retry render without breaking page actions.

Expected: no console errors attributable to Mappls integration, no hidden attribution, and no external navigation.

- [ ] **Step 4: Sync and build Capacitor Android**

```bash
npx cap sync android
cd android
./gradlew assembleDebug
```

Expected: Capacitor sync and Gradle debug build exit 0. Install the APK on an emulator/device and repeat both flows, checking Mappls authorization for the WebView origin, safe areas, touch gestures, marker movement, status PATCH, and Exit navigation.

- [ ] **Step 5: Review the final diff against scope**

```bash
git diff --check
git diff --stat
git status --short
```

Confirm no backend file, Google Places file, payment implementation, geolocation watcher, socket hook, or unrelated dependency was changed. Do not discard pre-existing working-tree modifications.

- [ ] **Step 6: Record final verification evidence**

The final handoff must list exact command outcomes, any environment limitation that prevented a native/device check, both navigation triggers, both tracking variants, and the known WebView/native-SDK limitation from the design.
