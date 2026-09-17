# Realtime Live Tracking Architecture

**Status:** Approved by the product request on 2026-09-17. Implementation preserves the existing tracking UI, route metrics, and Mappls rendering.

## Goal

Deliver an authorised, multi-instance-safe live-tracking pipeline in which an active technician's vehicle moves continuously on the customer's Mappls map, without trusting client-supplied identities or allowing polling to replace newer realtime state.

## Evidence from the existing implementation

| Stage | Existing code | Finding |
| --- | --- | --- |
| Technician GPS | `resqnowfrontend/src/pages/technician/ActiveJob.tsx` | Capacitor/browser `watchPosition` collects latitude, longitude, accuracy, speed, heading, and timestamp, but sends only latitude/longitude. Native cadence uses a 10-second timeout. |
| Transmission | `ActiveJob.tsx` | Every fix is sent twice: `PATCH /api/technicians/me/location` and an unacknowledged `technician:location_update` socket event. |
| Socket server | `resqnowbackend/services/socket.js` | Connections, room joins, and location events are unauthenticated; callers choose technician, user, and request IDs. Rooms are local process memory. |
| Ingestion/storage | `resqnowbackend/routes/technicians.js`, `db.js` | REST validates finite coordinates, updates `technicians`, and inserts every point into MySQL history. It has no device timestamp, sequence, accuracy, or movement validation. |
| Redis | `resqnowbackend/services/dispatchQueueService.js` | `ioredis` and `REDIS_URL` exist for BullMQ dispatch only; tracking state and a Socket.IO adapter are absent. |
| Customer state | `resqnowfrontend/src/hooks/useRealtimeServiceRequest.ts` | The hook receives two event names and polls every two seconds. Its API refresh can replace a newer socket coordinate because the response lacks comparable ordering metadata. |
| Customer map | `resqnowfrontend/src/components/user/LiveTrackingMap.tsx` | A fixed 900 ms point-to-point animation exists, but no time buffer, heading, bounded prediction, or stale state exists. Camera revision is based on raw technician points. |

## Selected architecture

```
Technician GPS watch
  -> versioned, sequenced location payload
  -> authenticated Socket.IO ingest (REST recovery uses the same service)
  -> job and location validation
  -> Redis ordered current-location record with TTL
  -> Socket.IO Redis adapter + authorised request-room fan-out
  -> customer canonical stream and recovery snapshot
  -> buffered interpolation, heading rotation, bounded prediction
  -> Mappls marker setPosition updates

Sampled MySQL history and technician last-known fields run alongside this path;
they are not the real-time source of truth.
```

## Scope and non-goals

- Phase 1 is foreground tracking while the active-job page is running. It supports frequent active-job updates, but does not claim background tracking.
- Android/iOS background location needs a dedicated native service, permission and battery-policy release; it is deferred rather than simulated with a web timer.
- Existing Mappls maps, route/ETA calculation, status labels, customer routes, and the customer-facing UI remain in place.
- Existing location fields remain available for compatibility. No secrets are added to frontend source or documentation.

## Canonical contract

The technician sends `tracking:location:v1` with an acknowledgement callback:

```ts
type TrackingLocationV1 = {
  version: 1;
  technicianId: string; // ignored by server; retained for compatibility telemetry
  jobId: string;
  lat: number;
  lng: number;
  speed: number | null;    // metres/second
  heading: number | null;  // degrees clockwise from north
  accuracy: number | null; // metres
  recordedAt: string;      // device ISO timestamp
  sequenceId: number;      // positive monotonic integer
};

type TrackingLocationAcceptedV1 = TrackingLocationV1 & {
  technicianId: string; // server-authenticated identity
  requestId: string;
  receivedAt: string;
  locationUpdatedAt: string;
};
```

The server emits `tracking:location:v1` only to `request_<requestId>` after successful ingestion. For one release, it also emits the existing `technician:location_update` event with the same canonical fields. The raw `location_update` client broadcast and global `technician:<id>:location` fan-out are removed only after all call sites are migrated.

```ts
type TrackingAck =
  | { ok: true; location: TrackingLocationAcceptedV1 }
  | { ok: false; code: 'UNAUTHENTICATED' | 'FORBIDDEN' | 'NO_ACTIVE_JOB' |
      'INVALID_LOCATION' | 'STALE_LOCATION' | 'OUT_OF_ORDER' |
      'DUPLICATE_LOCATION' | 'IMPLAUSIBLE_MOVEMENT' | 'STORE_UNAVAILABLE' };
```

The server is authoritative for technician identity, request identity, receipt time, and accepted ordering. A client never selects its room or impersonates another technician.

## Security and authorisation

1. Socket.IO middleware verifies the JWT issued by `middleware/auth.js` and stores only `{ id, role, email }` on `socket.data.identity`.
2. `tracking:location:v1` requires the `technician` role and verifies that `jobId` is assigned to that technician and is in a live status before any Redis write or fan-out.
3. `tracking:subscribe:v1` requires a `user`/`admin` identity and checks the request's `user_id` matches the user unless role is `admin`. It joins exactly `request_<requestId>` and returns a still-live Redis snapshot.
4. Existing join events become authenticated compatibility handlers; they do not trust supplied identifiers.
5. Errors are acknowledged or returned through `connect_error` without leaking another request's location.

## Validation and ordering

Reject before state mutation when latitude is outside `[-90, 90]`, longitude is outside `[-180, 180]`, required numeric values are non-finite, `sequenceId` is not a positive safe integer, `recordedAt` is older than 60 seconds or more than five seconds ahead of server time, or `accuracy` is outside `[0, 500]` metres.

Reject an update when `(recordedAt, sequenceId)` is not newer than the Redis record for that technician/job, when it duplicates the latest accepted fix (same sequence or within 3 metres less than one second later), or when it implies more than 60 m/s plus the two accuracy radii unless the prior point is over 30 seconds old.

The client generates `sequenceId` as `max(Date.now() * 1000, priorSequenceId + 1)`. The backend uses the validated device time as primary ordering and never trusts a client identity.

## Redis and persistence

- `live-tracking:technician:<technicianId>` stores JSON `TrackingLocationAcceptedV1` with a 30-second TTL. It includes `jobId`; reads are valid only for a matching authorised request.
- An atomic Lua compare-and-set compares `(recordedAtMs, sequenceId)`, sets the new JSON with `EX 30` only if newer, and refreshes TTL only for an accepted write.
- `@socket.io/redis-adapter` uses duplicated `ioredis` publisher/subscriber clients so request rooms work across backend instances.
- MySQL history is retained only if a fix is at least 15 seconds or 50 metres from the last sample for technician/job. It records `recorded_at`, `received_at`, `sequence_id`, `accuracy_m`, `speed_mps`, and `heading_degrees` through existing idempotent schema helpers in `db.js`.
- The sampled write also updates `technicians.latitude`, `longitude`, `current_lat`, `current_lng`, and `last_location_update`. Request recovery reads matching Redis first, then this MySQL snapshot.
- Redis failure is observable and returns `STORE_UNAVAILABLE`; it never silently falls back to in-process location state.

## Transport and recovery

- Socket is primary. `ActiveJob.tsx` sends a full v1 payload after its existing local quality checks, with a bounded acknowledgement timeout.
- REST `PATCH /api/technicians/me/location` accepts v1 and invokes the same `ingestTechnicianLocation` service. It is used only after disconnected socket, timeout, or negative acknowledgement.
- On reconnect, the technician resumes with the next sequence. The customer re-subscribes and receives its snapshot in the subscribe acknowledgement before normal events continue.
- Existing route-metric enrichment remains asynchronous but is keyed to accepted `sequenceId`; it may update route metrics only for that same accepted location and cannot move a marker backwards.

## Customer rendering

- `useRealtimeServiceRequest` owns a canonical tracking location and accepts only a newer `(recordedAt, sequenceId)` tuple. REST snapshots merge by the same comparator.
- A pure interpolation module keeps a 1.25-second playback buffer. Each animation frame interpolates between surrounding authoritative points.
- With no next point, project at most five seconds and 50 metres, only from finite speed/heading. The next authoritative point corrects through the normal buffer.
- Do not predict for reduced-motion users, fixes older than 30 seconds, or missing/invalid movement metadata. Show stale after 15 seconds and stop prediction after five seconds.
- Heading rotates a dedicated vehicle glyph. If heading is absent and points differ by more than five metres, derive bearing; otherwise retain prior heading.
- Fit camera bounds at initial/recenter actions only. Realtime marker updates preserve map camera and use the existing Mappls `setPosition` path.

## Acceptance criteria

1. An authenticated, assigned technician's valid update reaches the authorised request owner once, has canonical metadata, is in Redis for 30 seconds, and smoothly moves the marker.
2. A non-owner cannot subscribe to another request and a technician cannot update a different or completed job.
3. Invalid, stale, duplicate, out-of-order, and implausible updates do not mutate Redis, MySQL, or customer map state.
4. Reconnect returns the latest valid snapshot; REST recovery follows the same validation and ordering.
5. Database history is sampled, not written for every active one-second update.
6. Tests cover supplied cases, legacy route-metric compatibility, stale polling protection, and map display correction.
