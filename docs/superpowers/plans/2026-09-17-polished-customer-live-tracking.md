# Polished Customer Live Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the existing customer tracking map continuously polished while retaining Redis-backed canonical location authority.

**Architecture:** A pure playback controller receives accepted locations, maintains a tiny two-point queue, and returns display position, bearing, prediction, jump, and freshness state. `LiveTrackingMap` renders that controller output independently from a camera fit revision. The shared authenticated `SocketProvider` owns the only client socket; request tracking subscribes/unsubscribes by request.

**Tech Stack:** React, TypeScript, Socket.IO, Mappls Web Maps, Vitest, Express.

**Spec:** `docs/superpowers/specs/2026-09-17-polished-customer-live-tracking.md`

## Global Constraints

- Preserve Redis, Socket.IO, route ETA, backend validation, and foreground GPS collection.
- Buffer delay is 250 ms; maximum pending points is two; segment duration is 400–1,000 ms.
- Prediction starts only after 1.4 s, ends by 5 s or 50 m, and requires valid speed, heading, and accuracy.
- Do not claim road-snapped vehicle movement.
- REST polling must not become location authority.

### Task 1: Deterministic playback primitives

**Files:** Create `src/lib/liveTrackingPlayback.ts`; create `src/lib/liveTrackingPlayback.test.ts`.

- [ ] Write failing tests for continuous adjacent segments, rapid queueing, delayed empty-queue behaviour, bounded prediction, correction, wraparound heading, stationary heading, large jumps, and freshness thresholds.
- [ ] Implement the pure controller and helpers for point interpolation, shortest-angle heading, conservative projection, jump classification, and freshness state.
- [ ] Run `npx vitest run src/lib/liveTrackingPlayback.test.ts`.

### Task 2: Single customer socket and freshness state

**Files:** Modify `src/hooks/useRealtimeServiceRequest.ts`, `src/contexts/SocketContext.tsx`; modify `src/hooks/useRealtimeServiceRequest.test.tsx`.

- [ ] Write failing tests proving the hook subscribes through the shared socket, cleans up its request subscription, reports reconnect/freshness state, and retains newer socket coordinates through REST polling.
- [ ] Replace the hook-owned Socket.IO client with `useSocket`; retain authenticated request-room subscription and recovery acknowledgement.
- [ ] Run `npx vitest run src/hooks/useRealtimeServiceRequest.test.tsx`.

### Task 3: Customer marker and camera

**Files:** Modify `src/components/user/LiveTrackingMap.tsx`, `src/components/user/LiveTrackingMap.test.tsx`, `src/components/RequestTracking.tsx`.

- [ ] Write failing tests for stable camera revision during ordinary updates, explicit recenter, map interaction locking, and passing motion/freshness data to playback.
- [ ] Replace the 900 ms restart-on-update hook with the playback controller; rotate only the marker glyph; use initial/explicit fit and no raw-coordinate camera refits.
- [ ] Render LIVE, UPDATING, DELAYED, RECONNECTING, and OFFLINE status with the existing colour system.
- [ ] Run focused map and request-tracking tests.

### Task 4: Canonical legacy REST endpoint

**Files:** Modify `../resqnowbackend/routes/technicians.js`; create `../resqnowbackend/tests/live_tracking_recovery.test.js`.

- [ ] Write a recovery-handler test for `PATCH /api/technicians/me/location` showing it calls canonical ingestion/publish rather than direct SQL persistence.
- [ ] Replace the direct legacy handler with the existing `handleLiveTrackingRecovery` adapter and remove unreachable duplicate persistence code from `/me/location`.
- [ ] Run backend tracking tests.

### Task 5: Release verification

- [ ] Run all frontend tests, TypeScript validation, frontend production build, backend tracking tests, and backend build.
- [ ] Review diffs for accidental foreground/background location changes and validate every global constraint.
