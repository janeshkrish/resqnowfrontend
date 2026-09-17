# Polished Customer Live Tracking

## Goal

Improve the existing Redis, Socket.IO, and canonical-ingestion live-tracking path without changing its authority model or technician background-location behaviour.

## Playback model

The customer renders a short, client-side queue of already accepted locations. The queue deliberately trails authoritative reception by 250 ms and has at most two pending points. A segment is never cancelled merely because a newer point arrives; the next point waits for the current segment. Segment durations are derived from adjacent authoritative timestamps and constrained to 400–1,000 ms. This maintains visible motion without adding a large fixed delay.

If the queue is empty, the marker holds its last confirmed coordinate. It may predict for at most 5 seconds, only after a 1.4-second pause, only when speed, heading, and accuracy are usable, and never beyond 50 metres. The UI changes from LIVE to UPDATING, DELAYED, and OFFLINE based on the age of the last authoritative fix; it must not describe a predicted or frozen location as live.

Large visual discontinuities are not animated across the map. The marker briefly enters a repositioning state, then rebases to the accepted coordinate. This is presentation-only: canonical ingestion remains responsible for rejecting impossible movement.

## Camera and marker presentation

Initial load and explicit recenter perform a fit-to-route. Routine GPS updates only move the marker; they do not alter the fit-camera revision. Customer camera bearing remains unchanged. The vehicle glyph rotates using the shortest angular path and does not rotate while stationary.

## Realtime ownership

`SocketProvider` is the single authenticated frontend Socket.IO client. `useRealtimeServiceRequest` consumes it and manages only request-room subscriptions. REST polling continues to refresh non-location request state, but cannot overwrite a newer realtime technician coordinate. The legacy-compatible `PATCH /api/technicians/me/location` endpoint delegates to the same canonical ingestion service as v1 Socket.IO; it has no direct SQL persistence branch.
