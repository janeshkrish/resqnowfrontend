# Live Tracking Client Stream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish full active-job GPS fixes once and render authorised customer tracking updates as a smooth, heading-aware Mappls vehicle marker.

**Architecture:** A shared frontend tracking module owns v1 types, ordering, and buffered display calculation. `ActiveJob` emits the primary Socket.IO update and uses REST only for recovery; `useRealtimeServiceRequest` owns the accepted canonical stream; `LiveTrackingMap` consumes display coordinates without refitting on every fix.

**Tech Stack:** React 18, TypeScript, Capacitor Geolocation, Socket.IO client, Vitest, Mappls web maps.

**Spec:** `resqnowfrontend/docs/superpowers/specs/2026-09-17-realtime-live-tracking-architecture.md`

## Global Constraints

- Do not change existing customer status labels, colours, route ETA presentation, or Mappls provider selection.
- Socket is primary; REST recovery uses the same backend ingestion service.
- Playback buffer is 1.25 seconds; prediction is limited to five seconds and 50 metres.
- Ignore older `(recordedAt, sequenceId)` coordinates and retain newer socket data through a request refresh.
- Respect `prefers-reduced-motion` by disabling interpolation and prediction.

---

### Task 1: Create shared tracking types, ordering, and display interpolation

**Files:**
- Create: `resqnowfrontend/src/lib/liveTracking.ts`
- Create: `resqnowfrontend/src/lib/liveTracking.test.ts`

**Interfaces:**
- Produces: `TrackingLocationV1`, `compareTrackingLocations`, `isNewerTrackingLocation`, `TrackingPlaybackBuffer`, `bearingBetween`, `projectLocation`.
- Consumes: no React, map, or socket dependency.

- [ ] **Step 1: Write failing pure tests**

```ts
it('keeps only a strictly newer coordinate', () => {
  expect(isNewerTrackingLocation(newer, older)).toBe(true);
  expect(isNewerTrackingLocation(older, newer)).toBe(false);
});
it('interpolates buffered authoritative fixes at the playback time', () => {
  const buffer = new TrackingPlaybackBuffer(1250);
  buffer.push(first); buffer.push(second);
  expect(buffer.positionAt(second.recordedAtMs - 1250)?.lat).toBeCloseTo(expectedLat);
});
it('caps prediction and does not predict without valid motion', () => {
  expect(projectLocation(latest, 6000)).toBeNull();
});
```

- [ ] **Step 2: Run the failing unit test**

Run: `npx vitest run src/lib/liveTracking.test.ts`

Expected: FAIL because the tracking module does not exist.

- [ ] **Step 3: Implement deterministic playback**

Use linear latitude/longitude interpolation only between authoritative fixes. Retain at most 12 points. Return movement metadata with display values, derive a bearing only when points are more than five metres apart, and require finite speed plus heading before projecting. Projection stops at five seconds/50 metres and returns `null` for stale/reduced-motion callers.

- [ ] **Step 4: Run the unit tests**

Run: `npx vitest run src/lib/liveTracking.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/liveTracking.ts src/lib/liveTracking.test.ts
git commit -m "feat: add live tracking interpolation primitives"
```

### Task 2: Publish the complete technician GPS payload with acknowledgement recovery

**Files:**
- Modify: `resqnowfrontend/src/pages/technician/ActiveJob.tsx`
- Create: `resqnowfrontend/src/pages/technician/ActiveJob.tracking.test.tsx`

**Interfaces:**
- Consumes: Task 1 `TrackingLocationV1` and existing GPS quality functions.
- Produces: one `tracking:location:v1` emission per accepted fix, with REST recovery only after socket failure.

- [ ] **Step 1: Write failing transport tests**

```tsx
it('emits complete v1 GPS data with a monotonic sequence', async () => {
  emitPosition({ latitude: 12.9, longitude: 77.5, speed: 8, heading: 90, accuracy: 12 });
  expect(socket.emit).toHaveBeenCalledWith('tracking:location:v1', expect.objectContaining({ version: 1, speed: 8, heading: 90, accuracy: 12 }), expect.any(Function));
});
it('PATCHes only after a failed socket acknowledgement', async () => {
  acknowledge({ ok: false, code: 'STORE_UNAVAILABLE' });
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/technicians/me/location'), expect.anything()));
});
```

- [ ] **Step 2: Run the failing transport tests**

Run: `npx vitest run src/pages/technician/ActiveJob.tracking.test.tsx`

Expected: FAIL because the page emits only coordinates and PATCHes in parallel.

- [ ] **Step 3: Update active-job publication**

Keep current permission, navigation, quality, and cleanup behavior. Request a one-second desired collection interval where Capacitor supports it. Build the v1 body from native/browser `Position`, emit with a bounded acknowledgement timeout, and call PATCH only on disconnected socket, timeout, or negative acknowledgement. A successful ack must never be followed by PATCH.

- [ ] **Step 4: Run the focused tests**

Run: `npx vitest run src/pages/technician/ActiveJob.tracking.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/technician/ActiveJob.tsx src/pages/technician/ActiveJob.tracking.test.tsx
git commit -m "feat: publish sequenced technician tracking fixes"
```

### Task 3: Make customer request state a canonical ordered stream

**Files:**
- Modify: `resqnowfrontend/src/hooks/useRealtimeServiceRequest.ts`
- Modify: `resqnowfrontend/src/hooks/useRealtimeServiceRequest.test.tsx`

**Interfaces:**
- Consumes: Task 1 ordering and authenticated backend events.
- Produces: technician metadata (`speed`, `heading`, `accuracy`, `recordedAt`, `sequenceId`, stale state) that cannot regress through polling.

- [ ] **Step 1: Add failing realtime-state tests**

```tsx
it('subscribes on reconnect and adopts its snapshot', () => {
  fireConnect();
  expect(socket.emit).toHaveBeenCalledWith('tracking:subscribe:v1', { requestId: '44' }, expect.any(Function));
});
it('does not allow older API data to replace a newer socket fix', async () => {
  fireTrackingEvent(sequence11); resolvePollingResponse(sequence10);
  expect(result.current.technician?.sequenceId).toBe(11);
});
it('rejects foreign, stale, and lower-sequence events', () => {
  fireTrackingEvent(foreignOrOlder);
  expect(result.current.technician?.location_lat).toBe(existingLat);
});
```

- [ ] **Step 2: Run the failing hook tests**

Run: `npx vitest run src/hooks/useRealtimeServiceRequest.test.tsx`

Expected: FAIL because the hook uses unchecked legacy joins and unconditional API replacement.

- [ ] **Step 3: Implement ordered subscription and merge**

Authenticate Socket.IO using the existing user token, emit `tracking:subscribe:v1` with acknowledgement on every connect, and listen to v1 plus the server-emitted compatibility event. Parse valid v1 coordinates, merge with `isNewerTrackingLocation`, and accept route metrics only for their matching accepted location. Preserve newer realtime state in `fetchRequest`; polling becomes status/recovery duty rather than coordinate authority.

- [ ] **Step 4: Run hook tests**

Run: `npx vitest run src/hooks/useRealtimeServiceRequest.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useRealtimeServiceRequest.ts src/hooks/useRealtimeServiceRequest.test.tsx
git commit -m "feat: consume ordered customer tracking stream"
```

### Task 4: Render buffered position and heading without camera churn

**Files:**
- Modify: `resqnowfrontend/src/components/user/LiveTrackingMap.tsx`
- Modify: `resqnowfrontend/src/components/user/LiveTrackingMap.test.tsx`
- Modify: `resqnowfrontend/src/lib/mapProvider/MapplsMapSurface.tsx`
- Modify: `resqnowfrontend/src/lib/mapProvider/MapplsMapSurface.test.tsx`
- Modify: `resqnowfrontend/src/index.css`

**Interfaces:**
- Consumes: Task 1 playback and Task 3 movement metadata.
- Produces: stable `technician` Mappls marker position and a CSS-rotated vehicle glyph.

- [ ] **Step 1: Write failing map tests**

```tsx
it('uses playback coordinates rather than raw fixes', () => {
  render(<LiveTrackingMap techLocation={latest} />);
  expect(lastMapProps.markers.find(marker => marker.id === 'technician')?.position).toEqual(interpolated);
});
it('does not alter camera revision for routine tracking movement', () => {
  rerender(<LiveTrackingMap techLocation={next} />);
  expect(lastMapProps.camera.revision).toBe(initialRevision);
});
it('updates retained Mappls marker position and heading presentation', () => {
  rerenderSurface(nextHeadingMarker);
  expect(existingMarker.setPosition).toHaveBeenCalledWith(nextHeadingMarker.position);
});
```

- [ ] **Step 2: Run the failing map tests**

Run: `npx vitest run src/components/user/LiveTrackingMap.test.tsx src/lib/mapProvider/MapplsMapSurface.test.tsx`

Expected: FAIL because current animation has no playback time model and camera uses raw coordinates.

- [ ] **Step 3: Implement map consumption**

Replace only `useInterpolatedPoint` with a hook backed by Task 1’s buffer. Extend map marker specs with a safe heading/presentation revision; preserve marker identity and use `setPosition` for movement. Rotate a dedicated vehicle arrow with a CSS variable inside the existing technician marker. Lock automatic fit after the initial frame until an explicit recenter/map-mode action, retaining current controls and reduced-motion behavior.

- [ ] **Step 4: Run focused map tests**

Run: `npx vitest run src/components/user/LiveTrackingMap.test.tsx src/lib/mapProvider/MapplsMapSurface.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/user/LiveTrackingMap.tsx src/components/user/LiveTrackingMap.test.tsx src/lib/mapProvider/MapplsMapSurface.tsx src/lib/mapProvider/MapplsMapSurface.test.tsx src/index.css
git commit -m "feat: smooth live tracking vehicle marker"
```

### Task 5: Verify the complete release boundary

**Files:**
- Modify: only test/fix files created by Tasks 1-4 if verification identifies a covered defect.

**Interfaces:**
- Consumes: complete backend and frontend implementation.
- Produces: release evidence; no new public interface.

- [ ] **Step 1: Run backend tracking verification**

Run: `node --test services/liveTrackingContract.test.js services/liveTrackingStore.test.js services/liveTrackingIngestion.test.js services/socket.test.js tests/live_tracking_recovery.test.js tests/live_tracking_route_metrics.test.js`

Expected: PASS.

- [ ] **Step 2: Run frontend tracking verification**

Run: `npx vitest run src/lib/liveTracking.test.ts src/pages/technician/ActiveJob.tracking.test.tsx src/hooks/useRealtimeServiceRequest.test.tsx src/components/user/LiveTrackingMap.test.tsx src/lib/mapProvider/MapplsMapSurface.test.tsx`

Expected: PASS.

- [ ] **Step 3: Run builds**

Run: `npx tsc --noEmit && npm run build` in `resqnowfrontend`, then `npm run build` in `resqnowbackend`.

Expected: all commands exit 0.

- [ ] **Step 4: Perform a manual two-session acceptance run**

Run backend plus frontend, sign in with one assigned technician and the request owner, submit three valid non-identical points, reconnect the customer socket, and verify that one owner sees smooth motion while an unrelated customer sees none. Report unavailable local Redis or device GPS as a limitation rather than substituting mocked success.

- [ ] **Step 5: Commit release-only corrections**

```bash
git add <only-test-or-fix-files-created-by-this-plan>
git commit -m "test: verify realtime live tracking flow"
```
