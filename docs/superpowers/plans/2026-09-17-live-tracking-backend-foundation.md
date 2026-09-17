# Live Tracking Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace unauthenticated per-process location broadcast with one validated Redis-backed live-location ingestion path.

**Architecture:** `services/liveTrackingIngestion.js` owns validation, ordered Redis storage, sampled persistence, and route enrichment. Socket.IO and REST become authenticated adapters over that service, with a Socket.IO Redis adapter distributing authorised request-room messages across instances.

**Tech Stack:** Node.js ESM, Express, Socket.IO 4, `ioredis`, `@socket.io/redis-adapter`, MySQL2, Node `node:test`.

**Spec:** `resqnowfrontend/docs/superpowers/specs/2026-09-17-realtime-live-tracking-architecture.md`

## Global Constraints

- Keep `REDIS_URL` backend-only and never log it.
- Require JWT identity and active-job ownership for every tracking action.
- Redis current-state TTL is 30 seconds; MySQL history sampling is 15 seconds or 50 metres.
- REST and Socket.IO call the same `ingestTechnicianLocation` function.
- Preserve route ETA enrichment and compatibility server event names for one release.

---

### Task 1: Define the contract, validation, ordering, and Redis state

**Files:**
- Create: `resqnowbackend/services/liveTrackingContract.js`
- Create: `resqnowbackend/services/liveTrackingContract.test.js`
- Create: `resqnowbackend/services/liveTrackingStore.js`
- Create: `resqnowbackend/services/liveTrackingStore.test.js`

**Interfaces:**
- Produces: `parseTrackingLocation(payload, nowMs)`, `compareTrackingOrder(left, right)`, `distanceMeters(left, right)`, `TrackingError`, and `createLiveTrackingStore(redis)`.
- Consumes: no Express, socket, or global database state.

- [ ] **Step 1: Write failing contract/store tests**

```js
test('accepts a complete v1 point and orders by recordedAt then sequence', () => {
  assert.equal(parseTrackingLocation(valid, nowMs).sequenceId, 1001);
  assert.equal(compareTrackingOrder(newer, valid), 1);
});
test('rejects invalid coordinates, stale timestamps, and unsafe sequence IDs', () => {
  for (const input of [invalidCoordinates, stale, unsafeSequence]) {
    assert.throws(() => parseTrackingLocation(input, nowMs), TrackingError);
  }
});
test('keeps newest Redis record with a 30-second TTL', async () => {
  await store.putIfNewer(valid); await store.putIfNewer(newer);
  assert.equal(await redis.ttl('live-tracking:technician:7'), 30);
  assert.equal((await store.getForTechnician('7')).sequenceId, newer.sequenceId);
});
```

- [ ] **Step 2: Run the failing tests**

Run: `node --test services/liveTrackingContract.test.js services/liveTrackingStore.test.js`

Expected: FAIL because neither module exists.

- [ ] **Step 3: Implement pure contract and atomic store**

Export `TRACKING_EVENT = 'tracking:location:v1'` and `TRACKING_TTL_SECONDS = 30`. Implement all numeric/time ranges in the spec. Use a single Lua `EVAL` which decodes the existing JSON, compares `(recordedAtMs, sequenceId)`, writes valid newer JSON with `EX 30`, and returns `accepted`, `duplicate`, or `out_of_order`; do not add an in-memory fallback.

- [ ] **Step 4: Run the tests**

Run: `node --test services/liveTrackingContract.test.js services/liveTrackingStore.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/liveTrackingContract.js services/liveTrackingContract.test.js services/liveTrackingStore.js services/liveTrackingStore.test.js
git commit -m "feat: add ordered Redis tracking state"
```

### Task 2: Build the shared ingestion service and sampled history schema

**Files:**
- Create: `resqnowbackend/services/liveTrackingIngestion.js`
- Create: `resqnowbackend/services/liveTrackingIngestion.test.js`
- Modify: `resqnowbackend/db.js`

**Interfaces:**
- Consumes: Task 1 contract/store, injected `{ pool, store, now, publish }`.
- Produces: `createLiveTrackingIngestion(deps).ingest({ identity, payload, source })` and `.getRecoverySnapshot({ technicianId, requestId })`.

- [ ] **Step 1: Write failing service tests**

```js
test('publishes one accepted point only for its assigned live technician/job', async () => {
  const result = await ingestion.ingest({ identity: tech7, payload: valid, source: 'socket' });
  assert.equal(result.ok, true); assert.equal(publish.calls.length, 1);
});
test('rejects unauthorised, completed, duplicate, and implausible updates before persistence', async () => {
  for (const attempt of rejectedAttempts) assert.equal((await attempt()).ok, false);
  assert.equal(historyInserts.length, 0);
});
test('writes history only after 15 seconds or 50 metres', async () => {
  await ingestion.ingest(first); await ingestion.ingest(oneSecondLaterNearby);
  assert.equal(historyInserts.length, 1);
});
```

- [ ] **Step 2: Run the failing service test**

Run: `node --test services/liveTrackingIngestion.test.js`

Expected: FAIL because the ingestion service does not exist.

- [ ] **Step 3: Implement shared ingestion**

Query `service_requests` by `id` and `technician_id`; reject rows missing or not in an active tracking status. Validate movement against the accepted Redis record, call `putIfNewer`, and publish only after its success. Add idempotent history columns `recorded_at DATETIME(3)`, `received_at DATETIME(3)`, `sequence_id BIGINT`, `accuracy_m DECIMAL(8,2)`, `speed_mps DECIMAL(8,3)`, `heading_degrees DECIMAL(7,3)`, plus index `(service_request_id, recorded_at)` through the existing `db.js` helper style. Update technician last-known coordinates only on the same sampled persistence path.

- [ ] **Step 4: Run the service tests**

Run: `node --test services/liveTrackingIngestion.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/liveTrackingIngestion.js services/liveTrackingIngestion.test.js db.js
git commit -m "feat: ingest authorised live tracking locations"
```

### Task 3: Authenticate Socket.IO, authorise rooms, and distribute with Redis

**Files:**
- Modify: `resqnowbackend/services/socket.js`
- Create: `resqnowbackend/services/socket.test.js`
- Modify: `resqnowbackend/index.js`
- Modify: `resqnowbackend/package.json`
- Modify: `resqnowbackend/package-lock.json`

**Interfaces:**
- Consumes: Task 2 ingestion/recovery interfaces and JWT role extraction rules in `middleware/auth.js`.
- Produces: `tracking:location:v1` ingress, `tracking:subscribe:v1` authorised subscription, canonical room broadcast.

- [ ] **Step 1: Write failing socket integration tests**

```js
test('rejects a missing or invalid JWT during handshake', async () => {
  await assert.rejects(connectSocket({ token: 'invalid' }), /Unauthorized/);
});
test('refuses a customer subscription to a request they do not own', async () => {
  assert.deepEqual(await emitAck(otherCustomer, 'tracking:subscribe:v1', { requestId: '44' }), { ok: false, code: 'FORBIDDEN' });
});
test('sends accepted location only to the authorised request room', async () => {
  await emitAck(technician, 'tracking:location:v1', valid);
  assert.equal(ownerEvents.length, 1); assert.equal(otherCustomerEvents.length, 0);
});
```

- [ ] **Step 2: Run the failing socket tests**

Run: `node --test services/socket.test.js`

Expected: FAIL because existing `socket.js` trusts all room IDs and payload identities.

- [ ] **Step 3: Implement secure distributed Socket.IO**

Add `@socket.io/redis-adapter`; create duplicated `ioredis` publisher/subscriber clients from `REDIS_URL` and attach the adapter before connections. Add `io.use` JWT verification and minimal `socket.data.identity`. Replace unchecked join listeners with owner/technician checks. Route v1 event through Task 2 and acknowledge each result. Publish canonical `tracking:location:v1` to `request_<requestId>`; retain `technician:location_update` only as a server-emitted compatibility event, never raw client rebroadcast.

- [ ] **Step 4: Run socket tests**

Run: `node --test services/socket.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/socket.js services/socket.test.js index.js package.json package-lock.json
git commit -m "feat: secure distributed tracking sockets"
```

### Task 4: Route REST recovery and request snapshots through the same service

**Files:**
- Modify: `resqnowbackend/routes/technicians.js`
- Modify: `resqnowbackend/routes/service_requests.js`
- Modify: `resqnowbackend/tests/live_tracking_route_metrics.test.js`
- Create: `resqnowbackend/tests/live_tracking_recovery.test.js`

**Interfaces:**
- Consumes: Task 2 `.ingest`/`.getRecoverySnapshot` and Task 3 publisher.
- Produces: v1 PATCH recovery and owner-authorised current snapshot fields.

- [ ] **Step 1: Write failing recovery tests**

```js
test('PATCH delegates the complete v1 body to shared ingestion', async () => {
  const response = await request.patch('/api/technicians/me/location').send(valid);
  assert.equal(response.status, 200);
});
test('GET request returns matching Redis current location before MySQL fallback', async () => {
  const response = await request.get('/api/service-requests/44').auth(ownerToken, { type: 'bearer' });
  assert.equal(response.body.technician.location.sequenceId, valid.sequenceId);
});
```

- [ ] **Step 2: Run the failing recovery tests**

Run: `node --test tests/live_tracking_recovery.test.js tests/live_tracking_route_metrics.test.js`

Expected: FAIL because PATCH directly writes MySQL and GET does not load Redis tracking data.

- [ ] **Step 3: Replace competing location logic only**

Make the existing PATCH call Task 2 with authenticated `req.technicianId`, the full body, and `source: 'rest'`; preserve response envelope. Key asynchronous route enrichment to accepted `sequenceId`. In the owner-authorised request GET, merge a matching Redis snapshot before timestamped MySQL coordinates; never expose a location for another request.

- [ ] **Step 4: Run full backend tracking verification**

Run: `node --test services/liveTrackingContract.test.js services/liveTrackingStore.test.js services/liveTrackingIngestion.test.js services/socket.test.js tests/live_tracking_recovery.test.js tests/live_tracking_route_metrics.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add routes/technicians.js routes/service_requests.js tests/live_tracking_route_metrics.test.js tests/live_tracking_recovery.test.js
git commit -m "feat: unify live tracking recovery"
```
