# Customer Live Tracking Mobile Redesign

## Scope

Redesign only the customer-facing mobile live-tracking view in `RequestTracking`. The supplied screen is a visual reference for hierarchy and density, not source code or a substitute for the live map. Desktop tracking remains unchanged.

The redesign preserves the existing Mappls surface, Socket.IO-driven live technician state, playback animation, routing, payment, status handling, request refresh, technician contact, and cancellation API.

## Visual direction

Use the reference composition with ResQNow's red primary brand treatment:

- Full-bleed live Mappls map in the upper viewport, with the actual route and animated technician marker.
- Floating controls above the map: back, a compact live/freshness pill, SOS, destination annotation, technician ETA chip, and recenter control.
- A white, high-elevation mobile sheet with a small drag handle and rounded top edge.
- Arrival headline, server-preferred ETA/distance, refresh affordance, and a three-stage progress timeline.
- Dense technician card with verification treatment, prominent red call action, chat/share shortcuts, price summary, and a slide-to-cancel affordance.
- White and slate surfaces, red for active route/progress and primary actions, emerald only for positive/live signals, and amber/slate for freshness warnings.

No static map drawing, placeholder location, sample vehicle, sample pricing, or hard-coded ETA may be introduced.

## Component structure

`RequestTracking` remains the owner of request data, realtime state, payment state, sheet snap state, and dialog state.

`MobileTrackingSummaryDock` becomes the visible compact mobile sheet summary. It receives existing live summary, technician, freshness, payment, and sheet callbacks plus narrowly scoped action callbacks for refresh, SOS, share, recenter, and cancellation eligibility. It does not fetch data or calculate tracking values.

`LiveTrackingMap` retains marker playback and map rendering. It receives a narrowly scoped recenter trigger/callback so the mobile floating recenter button can restore the existing follow view without changing camera-follow policy or marker playback.

The existing cancellation dialog and payment summary dialog stay owned by `RequestTracking`; the slide control only opens the cancellation dialog after a deliberate threshold gesture.

## Interaction model

### Map and sheet

- The initial mobile state is the existing balanced sheet state.
- Map-focus, balanced, and details sheet snaps remain customer controlled through the existing drag handle and explicit controls.
- Recenter restores the route/technician view using the actual live map coordinates.
- Map interaction continues to stop aggressive automatic reframing and exposes map focus.

### Live state

- The headline uses existing ETA and distance values. Server route metrics remain preferred where available.
- The freshness pill uses the existing LIVE, UPDATING, DELAYED, RECONNECTING, and OFFLINE states. It must never label stale tracking as live.
- The timeline derives from existing request status stages, including pickup and towing stages. It never displays hard-coded times.

### Customer actions

- Refresh invokes the existing `refresh` request action.
- Call Partner uses the existing `tel:` technician link.
- Chat uses the existing `sms:` technician link.
- Share uses `navigator.share` with a request-specific tracking URL when supported; otherwise it copies the URL and confirms the fallback with a toast.
- SOS opens an in-app dialog. It presents request-aware emergency/support choices: navigate to the existing `/emergency` flow or `/contact` support route. It does not silently place a telephone call.
- The slide-to-cancel control is visible only while cancellation is allowed. A drag past the defined threshold opens the existing confirmation dialog; releasing earlier restores the thumb. Keyboard and screen-reader users retain an accessible button that opens the same dialog.

## Status and error handling

- Pending or unassigned requests show the existing matching state instead of technician actions.
- Technician contact controls are shown only when contact details exist.
- Payment actions and sticky payment controls retain their current eligibility logic.
- Cancelled, completed, and paid requests do not expose cancellation.
- Web Share and clipboard failures show a toast and leave the sheet usable.
- If Mappls is unavailable, the existing map fallback remains intact; no reference-image map is rendered.

## Accessibility and responsiveness

- Mobile only: the visual redesign applies below the existing mobile breakpoint; desktop markup remains unchanged.
- All icon-only controls have visible focus states and accessible names.
- The drag cancellation affordance has a conventional accessible activation path.
- Respect reduced-motion preference: no required meaning depends on the route/progress motion treatment.
- Preserve safe-area padding and avoid hiding payment or emergency actions under the mobile browser chrome.

## Testing and verification

- Update `RequestTracking` tests for the redesigned mobile hierarchy, ETA/freshness data, status-dependent actions, and unchanged desktop behavior.
- Update `MobileTrackingSummaryDock` tests for contact links, refresh, share fallback, emergency dialog trigger, map/details controls, payment visibility, and cancellation eligibility.
- Update `LiveTrackingMap` tests for recenter trigger handling without changing marker playback behavior.
- Run the full frontend test suite, TypeScript check, production build, and a manual mobile viewport inspection against a real Mappls-backed tracking request.

## Out of scope

- No backend, Redis, Socket.IO, playback algorithm, route calculation, or location-ingestion changes.
- No desktop redesign.
- No new emergency backend endpoint or automatic emergency phone call.
- No fake map, simulated vehicle movement, or hard-coded request data.
