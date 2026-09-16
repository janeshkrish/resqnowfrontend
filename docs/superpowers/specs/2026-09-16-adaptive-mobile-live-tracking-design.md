# Adaptive Mobile Live Tracking Design

## Scope

Redesign only the mobile rendering branch of `src/components/RequestTracking.tsx` into an adaptive, map-first customer live-tracking experience. The visual hierarchy must make the active road route, service state, ETA/distance, technician contact and critical payment state understandable without a long scroll.

The request-tracking data model, realtime socket handling, route calculation, Mappls map rendering, payment processing, towing workflow, cancellation, technician phone/SMS actions, completion/review flow and desktop layout remain unchanged. This is a presentation and interaction-hierarchy change, not a behavior or provider migration.

## Product goals

- Let the customer choose whether the map or the service controls are dominant.
- Default to a balanced view where the live state, route ETA/distance, technician and contact actions are visible at once.
- Retain every existing action and piece of information, placing secondary detail in an intentional expandable area rather than deleting it.
- Preserve the existing ResQNow red, white, slate, green and amber visual language using the current React, Tailwind, shadcn and Mappls dependencies only.
- Support normal mobile browser and Capacitor safe areas, touch gestures, reduced-motion preferences and accessible controls.

## Non-goals

- No desktop redesign.
- No changes to technician position reporting, realtime payloads, status transitions, Mappls configuration, routing provider, payment APIs or back-end contracts.
- No generated imagery, third-party UI kit, custom illustration system or AI-style visual treatment.
- No forced screen takeover when the request state changes; the customer controls their preferred map/detail focus.

## Existing behavior to preserve

The current screen supplies a fullscreen `LiveTrackingMap` with technician, customer and towing-drop coordinates, the live route, route ETA/distance, active status and a map-mode value derived from the mobile sheet position. The map supports manual interaction, automatic framing and recentering.

The current mobile screen includes:

- back navigation and live/reconnecting state;
- status copy and ETA/distance;
- towing pickup/drop details;
- five-stage journey progress;
- live amount breakdown;
- online and cash payment actions and `PaymentSummaryDialog`;
- technician identity, rating, completed-job count, SMS and telephone actions;
- active-service timer;
- request ID, return-home action and cancellation dialog;
- cancellation, payment-complete and `ClientJobCompletion` states.

All remain reachable in the redesigned view, with their current status and permission conditions intact.

## Chosen mobile interaction model

Use the existing draggable bottom sheet rather than introducing a new navigation paradigm. Its three snap positions represent a customer-controlled display preference:

1. **Map focus**: A compact, non-scrolling control dock leaves the road route dominant. It shows state, ETA/distance or its status-specific equivalent, technician identity and contact actions.
2. **Balanced focus**: The default after screen entry. A concise live-summary panel and technician row are visible together, while the map remains large enough to follow the route.
3. **Service focus**: The sheet expands into a normally scrollable detailed area containing route information, full journey progress, pricing, active timer, request controls and cancellation.

The customer changes focus through the sheet drag handle and its accessible expand/collapse control. Their snap choice persists as location updates, ETA changes and state messages arrive. Map interaction may move the sheet to map focus, retaining the current behavior of making the map usable. A meaningful status change must update the copy and compact summary but must not move the sheet without a direct customer gesture.

Payment pending is the sole visual exception: it retains the existing persistent payment CTA at the safe-area bottom so the payable action is never hidden. It must still not obscure the map or forcibly replace a chosen focus mode.

## Information hierarchy

### Shared top map controls

The top edge keeps only back navigation and connection status. They stay above the map and use the existing high-contrast translucent surface treatment. The live connection badge must remain concise and not compete with ETA.

`LiveTrackingMap` remains the only route/map renderer. Its existing status/recenter overlay remains available, but the layout will avoid repeating the same ETA/status as a large second map card. Camera padding continues to be driven from the current sheet map mode so both active route endpoints remain visible above the chosen sheet position.

### Compact summary dock

The dock replaces the stacked card sequence in map and balanced focus. It contains, in a predictable order:

- one short human status line (`Technician arriving`, `Technician has arrived`, `Service in progress`, towing phase, matching or payment state);
- the primary live value: server-backed ETA plus road-route distance while en route, `Arrived` when on site, elapsed service time in progress, or the appropriate payment/completion value;
- a small supporting line for connection, active destination or location freshness;
- a compact technician row, when assigned, with avatar/name/rating and existing Message and Call actions;
- a one-line route/journey indicator that communicates the active phase and opens service focus.

The dock does not render redundant amount, route-address, journey-stepper or timer cards. Those have one canonical representation in service focus.

### Service-focus detail order

The expanded sheet retains every existing component but gives them a status-aware order:

1. contextual status explanation;
2. towing pickup/drop details when applicable;
3. journey progress;
4. active service timer while applicable;
5. technician profile only when it is not already sufficient in the compact dock, without removing Message/Call access;
6. live amount breakdown and payment-specific controls under their existing eligibility rules;
7. request ID, return-home action, cancellation/dialog, cancellation notice and terminal-state content.

Payment controls retain their current confirmation dialog, coupon, fee and cash/online behavior. `ClientJobCompletion` remains unmodified and continues to take over at payment-complete completion states.

## Status-specific presentation

| Request state | Compact presentation | Expanded content retained |
| --- | --- | --- |
| Pending/matching | Matching state and connection | Existing matching explanation and request controls |
| Assigned/accepted | Technician matched and progress phase | Technician, journey and request detail |
| En route / towing pickup | Route ETA, road distance, technician and contact actions | Journey, towing addresses, amount/timer when applicable |
| Arrived | Arrival confirmation and technician contact | Service progress and request controls |
| In progress | Live service state and elapsed time | Timer, pricing and request controls |
| Towing drop leg | Drop-stage label and correctly targeted route | Pickup/drop details and towing route summary |
| Payment pending | Amount due and persistent Pay action | Full amount/payment controls and receipt path |
| Cancelled/completed/paid | Existing terminal messaging | Existing terminal and completion/review components |

## Component boundaries

Keep `RequestTracking` as the owner of the existing request state, actions, payment handlers and sheet animation state. Extract purely presentational mobile subcomponents only when it makes the 2,000-line file easier to reason about, for example:

- `MobileTrackingSummaryDock`: receives already-derived status, ETA/distance, technician and existing contact callbacks/links; it creates no socket, route or payment logic.
- `MobileTrackingDetails`: composes the current conditional detail blocks in the approved order; it receives existing render data and handlers.

No new shared provider or global state is required. `LiveTrackingMap` receives its existing inputs and any map mode values continue through its existing public prop contract.

## Accessibility and resilience

- Controls have descriptive accessible names and at least 44 by 44 CSS-pixel targets.
- The drag handle remains backed by a keyboard/touch-accessible expand/collapse button; drag is an enhancement, not the sole way to reveal details.
- Safe-area insets apply to top controls, the sheet and payment CTA.
- Existing `prefers-reduced-motion` handling remains effective; sheet/map transitions do not create essential information solely through animation.
- Long technician names, route addresses, distance labels and amount values truncate or wrap without covering action controls.
- Missing technician coordinates, ETA/distance, connection or map availability retain the current resilient fallback copy and never block payment, contact, cancellation or return-home actions.

## Verification

Tests are added before the relevant implementation changes. They must prove:

- mobile default, map-focused and expanded detail modes retain the live map inputs and map-mode relationship;
- every existing conditional action/component remains rendered in its eligible state, including SMS/Call, towing route detail, timer, cancellation and both payment actions;
- socket-driven ETA/distance and route destination behavior remain unchanged while the compact summary consumes those existing values;
- payment-pending retains a reachable sticky payment CTA and completion still uses `ClientJobCompletion`;
- desktop rendering remains unchanged.

Run focused Vitest tests, the frontend suite and `npm run build`. Perform responsive browser checks at 360x800, 390x844 and 412x915 for pending, en-route, arrived, in-progress, towing-drop and payment-pending fixtures. Verify sheet drag/tap, map interaction/recenter, phone/SMS links, payment dialog launch, cancellation dialog launch, safe-area placement, no console errors and no horizontal clipping. A production-authenticated two-device socket smoke test remains required after deployment to verify real technician movement and Mappls origin authorization; it is not substituted by fixture testing.
