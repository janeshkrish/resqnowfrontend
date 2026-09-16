# Active Job Navigation and Live Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep technician navigation in the embedded Active Job experience and show customers a request-scoped, actively refreshed road route and server-calculated ETA.

**Architecture:** The technician dashboard will hand active jobs to the existing Active Job route instead of opening a third-party site. Location delivery will become request-scoped and will send an immediate coordinate update followed by an asynchronous route-metric update. The customer map will derive a single active destination from job status and refresh only the technician-to-destination road route, retaining the existing visual fallback during a route request or failure.

**Tech Stack:** React 18, TypeScript, Vitest, Socket.IO, Express, Node test runner, existing OSRM route service, Mappls web-map surface.

**Spec:** User-approved design from the 2026-09-16 Active Job Navigation and Live Tracking root-cause analysis.

## Global Constraints

- Keep `ActiveJob.tsx` and `TechnicianDashboard.tsx` technician GPS emit payloads unchanged.
- Do not alter unrelated OpenStreetMap integrations.
- Preserve Haversine + flat-speed ETA only as a fallback when a current server metric is unavailable.
- Never expose another technician's coordinate or route metric to a customer tracking a different request.
- Do not delay the location PATCH response on a routing-provider request.

---

### Task 1: Route the dashboard navigation button into Active Job

**Files:**
- Modify: `src/pages/technician/TechnicianDashboard.tsx:1545-1576`
- Create: `src/pages/technician/TechnicianDashboard.test.tsx`

**Interfaces:**
- Consumes: `getTechnicianActiveJobPath(jobId): string`.
- Produces: `openNavigation(): void`, which calls React Router navigation with the active job state and never calls `window.open`.

- [x] **Step 1: Write the failing regression test**

```tsx
it("opens an arrived job in the embedded Active Job route", () => {
  fireEvent.click(screen.getByRole("button", { name: /nav/i }));
  expect(window.open).not.toHaveBeenCalled();
  expect(screen.getByTestId("active-job-route")).toHaveTextContent("request-42");
});
```

- [x] **Step 2: Run the focused test and verify it fails because Nav invokes `window.open`.**

Run: `npm test -- src/pages/technician/TechnicianDashboard.test.tsx`

- [x] **Step 3: Implement the minimal in-app navigation**

```tsx
const openNavigation = () => {
  const jobId = String(activeJob?.requestId ?? activeJob?.id ?? "").trim();
  if (!jobId) {
    toast.error("No active job is available for navigation.");
    return;
  }
  navigate(getTechnicianActiveJobPath(jobId), {
    state: { jobId, job: activeJob },
  });
};
```

- [x] **Step 4: Run the focused test and the existing Active Job navigation tests.**

Run: `npm test -- src/pages/technician/TechnicianDashboard.test.tsx src/pages/technician/ActiveJob.test.tsx`

### Task 2: Make realtime technician updates request-scoped and route-metric aware

**Files:**
- Create: `resqnowbackend/services/liveTrackingRouteMetrics.js`
- Modify: `resqnowbackend/services/socket.js:39-55`
- Modify: `resqnowbackend/routes/technicians.js:1-40,1765-1852`
- Create: `resqnowbackend/tests/live_tracking_route_metrics.test.js`
- Modify: `src/hooks/useRealtimeServiceRequest.ts:50-72,228-280`
- Modify: `src/hooks/useRealtimeServiceRequest.test.tsx:90-205`

**Interfaces:**
- Produces `resolveLiveTrackingDestination(request)` returning `{ lat, lng } | null` for pickup/customer before towing drop-leg statuses and drop afterward.
- Produces `buildTechnicianLocationPayload({ technicianId, requestId, latitude, longitude, route })`, with `distanceKm`, `durationMinutes`, `etaText`, and `etaSource` only when a road route exists.
- Produces `socketService.publishTechnicianLocation(payload)`, which emits only to the technician's room and request room.
- Frontend consumes only coordinate events whose `requestId` and `technicianId` match the displayed request/technician; a route metric is current only when it describes the same coordinate as state.

- [x] **Step 1: Write failing pure backend tests**

```js
test("routes a normal job to the customer and a loaded tow to the drop", () => {
  assert.deepEqual(resolveLiveTrackingDestination(normalJob), { lat: 12.97, lng: 77.59 });
  assert.deepEqual(resolveLiveTrackingDestination(loadedTow), { lat: 12.99, lng: 77.61 });
});

test("builds ETA fields only from a road route", () => {
  assert.deepEqual(buildTechnicianLocationPayload({ ...input, route: null }), basePayload);
  assert.equal(buildTechnicianLocationPayload({ ...input, route }).etaText, "8 min");
});
```

- [x] **Step 2: Run backend tests and verify the imported module is absent.**

Run: `node --test tests/live_tracking_route_metrics.test.js`

- [x] **Step 3: Implement the pure metric helper and request-room publisher**

```js
socketService.publishTechnicianLocation = (payload) => {
  this.io.to(`technician_${payload.technicianId}`).emit("location_update", payload);
  if (payload.requestId) {
    this.io.to(`request_${payload.requestId}`).emit("location_update", payload);
    this.io.to(`request_${payload.requestId}`).emit("technician:location_update", payload);
  }
};
```

Have `/me/location` publish an immediate request-scoped GPS update, call `getRoute` asynchronously for the active request's status-aware destination, and publish a second payload with ETA/distance if the route succeeds. Return the PATCH response immediately. Keep the raw Socket.IO location relay as a coordinate fallback only.

- [x] **Step 4: Update the frontend hook and its failing regressions**

```tsx
if (eventRequestId && eventRequestId !== String(requestId)) return;
if (eventTechnicianId && eventTechnicianId !== String(prev.id)) return prev;
const routeIsForLatestCoordinate = hasRouteMetrics && sameCoordinate(event, prev);
return {
  ...prev,
  location_lat: lat,
  location_lng: lng,
  routeDistanceKm: routeIsForLatestCoordinate ? distanceKm : undefined,
  routeEtaMinutes: routeIsForLatestCoordinate ? durationMinutes : undefined,
};
```

Test matching delivery, wrong-technician rejection, bare-update metric clearing, and metric retention only when coordinate-current.

- [x] **Step 5: Run focused backend and frontend hook tests.**

Run: `node --test tests/live_tracking_route_metrics.test.js tests/towing_phase2.test.js` from `resqnowbackend`; `npm test -- src/hooks/useRealtimeServiceRequest.test.tsx` from `resqnowfrontend`.

### Task 3: Render an actively refreshed customer route to the current destination

**Files:**
- Modify: `src/components/RequestTracking.tsx:715-870,1248-1265,1745-1762`
- Modify: `src/components/user/LiveTrackingMap.tsx:20-300`
- Modify: `src/components/RequestTracking.test.tsx:108-180`
- Modify: `src/components/user/LiveTrackingMap.test.tsx:1-100`

**Interfaces:**
- `RequestTracking` passes `routeDestination={liveTrackingDestination}` and enables `showRoutePath` whenever technician and active destination are present.
- `LiveTrackingMap` accepts optional `routeDestination: MapPoint | null`; when supplied, its route has exactly `[techLocation, routeDestination]`, ignores the static booking polyline while a technician coordinate exists, and retains its existing curved fallback.

- [x] **Step 1: Write failing component tests**

```tsx
expect(trackingHarness.mapProps).toMatchObject({
  showRoutePath: true,
  routeDestination: { lat: 0, lng: 0 },
});

expect(fetchRoute).toHaveBeenLastCalledWith(
  [{ lat: 12.97, lng: 77.59 }, { lat: 12.98, lng: 77.6 }],
  "full",
  "car",
);
```

Include a towing `vehicle_loaded` fixture asserting the target becomes the drop point, and a rerender with a sufficiently moved technician asserting a fresh route request replaces the old geometry.

- [x] **Step 2: Run the focused component tests and verify the normal-job route expectation fails.**

Run: `npm test -- src/components/RequestTracking.test.tsx src/components/user/LiveTrackingMap.test.tsx`

- [x] **Step 3: Implement the active-leg route calculation**

```tsx
const routeWaypoints = routeDestination && techLocation
  ? [techLocation, routeDestination]
  : [techLocation, userLocation, dropLocation].filter(Boolean);

const shouldRefresh = !lastRequest || destinationChanged ||
  distanceMeters(lastRequest.origin, techLocation) >= 25 ||
  Date.now() - lastRequest.at >= 5_000;
```

Track the latest request version in a ref; only that version may set route geometry. Fit the camera to the active leg when a `routeDestination` exists. Leave the existing curve as the immediate visual fallback when Mappls/route API data has not arrived or fails.

- [x] **Step 4: Run focused component tests.**

Run: `npm test -- src/components/RequestTracking.test.tsx src/components/user/LiveTrackingMap.test.tsx`

### Task 4: Full regression verification

**Files:**
- Verify only; do not modify unrelated files.

- [x] **Step 1: Run all frontend tests, TypeScript checking, lint, and production build.**

Run: `npm test`; `npx tsc --noEmit`; `npm run lint`; `npm run build` from `resqnowfrontend`.

- [x] **Step 2: Run all backend test scripts and build check.**

Run: `npm run test:dispatch-matching`; `npm run test:technician-pricing`; `npm run test:towing-phase2`; `npm run build` from `resqnowbackend`.

- [x] **Step 3: Inspect the final diff and report the verification results and any environment-limited visual smoke test.**
