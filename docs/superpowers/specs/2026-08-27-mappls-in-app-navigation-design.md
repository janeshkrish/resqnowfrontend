# Mappls In-App Navigation and Live Tracking Design

## Scope

Replace Leaflet-backed maps only on the technician active-job and user request-tracking screens. Preserve the current service-request status, payment, cancellation, geolocation, socket, route, and caller contracts. Add same-page technician navigation without opening another browser tab or maps application.

## Chosen integration

Use `mappls-web-maps` version `3.8.1` from the frontend bundle and initialize it with `VITE_MAPPLS_MAP_SDK_KEY`. The configured value is a Mappls static Map SDK credential intended for client-side use and must be restricted in the Mappls console to the production, development, and Capacitor WebView origins. No credential is hardcoded.

The same Web SDK will run in browsers and in the existing Capacitor WebView. This keeps one map implementation and avoids a new native plugin, Android/iOS lifecycle integration, and duplicated marker/navigation behavior. A native Mappls SDK bridge can be evaluated later if profiling shows unacceptable WebView rendering, background navigation, or voice-guidance limitations.

The existing OSRM-backed `fetchRoute()` and `/api/public/route` contract remains the routing source. Mappls is responsible for map rendering; ResQNow remains responsible for route presentation and navigation state. No Mappls client ID or client secret and no backend proxy are needed.

## Alternatives considered

1. **Mappls Web SDK plus existing OSRM routing — chosen.** Lowest migration risk, preserves all route consumers, supports fully branded overlays, and uses one implementation on web and Capacitor.
2. **Mappls Web Directions plugin.** Provides Mappls routing features but introduces a second routing contract, harder-to-control UI, additional entitlement requirements, and ambiguity around keeping existing route metadata synchronized.
3. **Native Android/iOS Mappls SDKs behind a Capacitor plugin.** Best ceiling for native navigation and voice/background features, but requires two native implementations and bridge lifecycle work. It is disproportionate for this release.

## Frontend architecture

### Map provider boundary

Add a focused module under `src/lib/mapProvider/`:

- A singleton SDK initializer validates `VITE_MAPPLS_MAP_SDK_KEY`, loads Mappls once, deduplicates concurrent initialization, and reports missing-key, load, authentication, and map-construction failures.
- Type declarations isolate the application from incomplete or changing third-party SDK types.
- A reusable React map surface owns the Mappls map instance, resize handling, interaction listeners, camera operations, and cleanup.
- Declarative inputs describe HTML markers, circles, polylines, camera framing, and recenter/follow behavior. The adapter updates existing overlays when coordinates change rather than recreating the map.
- Mappls attribution remains visible as required by its SDK terms. Default Mappls pins and unnecessary controls are disabled or replaced with ResQNow controls.

Both feature components continue accepting their existing props. New technician-navigation props are optional additions, so existing callers and tests remain compatible.

### Route and navigation model

Keep `[latitude, longitude]` as the application polyline format. Convert to the coordinate form expected by Mappls only inside the provider adapter.

Add a pure navigation helper that:

- removes invalid/duplicate route points;
- finds the nearest route segment to the live technician location;
- determines traveled and remaining route portions;
- classifies meaningful bearing changes as continue, slight turn, turn, or sharp turn;
- computes distance to the next maneuver and remaining distance;
- estimates remaining ETA by scaling the OSRM route duration when available, with a conservative speed fallback;
- returns stable instructions suitable for a screen-reader announcement and bottom navigation card.

The helper does not create geolocation watchers or polling. It consumes the same `currentLocation` state already populated by `Geolocation.watchPosition` or `navigator.geolocation.watchPosition`.

### Technician active job

`ActiveJob.tsx` owns an `isNavigationActive` flag. It resolves the active navigation target from the existing job/status rules: pickup before the vehicle/customer is reached, and towing drop after the towing workflow moves past pickup.

The current Navigate action validates the target and sets navigation mode instead of calling `window.open`. The normal-service START JOURNEY handler awaits the existing `updateStatus('en-route')` operation and enables navigation only after a successful status response. Other status, payment, completion, and cancellation behavior is unchanged. Towing status actions keep their existing workflow; the explicit Navigate button can enter navigation for the status-appropriate target.

`ActiveJobMap.tsx` renders a Mappls overview by default. In navigation mode it:

- follows the live technician marker with a heading-oriented camera where heading is available, otherwise route bearing;
- draws the active route and visually distinguishes the remaining segment;
- shows a branded top maneuver banner and bottom distance/ETA card;
- exposes persistent recenter and Exit navigation actions;
- returns to the same overview map without changing job status when navigation is exited.

Route fetching is deduplicated and thresholded so frequent watch-position updates do not cause a request for every GPS sample. It re-routes after a meaningful off-route or distance threshold and ignores stale responses.

### User live tracking

`LiveTrackingMap.tsx` renders Mappls while preserving `techLocation`, `userLocation`, `dropLocation`, `eta`, `variant`, `status`, `distanceLabel`, `mapMode`, `onInteract`, `routePolyline`, and `showRoutePath`.

HTML marker elements reuse the existing `tracking-tech-marker*` and `tracking-destination-marker*` CSS classes so the live ETA bubble, pulse, and destination ripples retain their current appearance. Mappls circles replace Leaflet circles, and two Mappls polylines retain the white route casing and red route stroke.

Camera framing includes all available technician, pickup/user, and drop points with padding derived from fullscreen/card variant and sheet mode. The map emits `onInteract` for pointer, drag, and zoom interactions. The existing recenter control restores automatic framing. Marker position changes use Mappls marker updates and CSS transitions rather than rebuilding the map.

`RequestTracking.tsx` retains both render sites. The mobile fullscreen call passes its actual sheet mode and an interaction callback that moves the sheet toward map view where appropriate; the card call remains API-compatible.

## Failure handling

If the key is missing, SDK initialization fails, authentication is rejected, or WebGL/map construction fails, each map area renders a branded non-crashing fallback containing the available status/location summary and a Retry map button. Navigation mode still exposes Exit navigation. No Leaflet, OSM, or CartoDB fallback tiles are used on these two screens.

SDK and route errors are scoped to the map. They do not block status changes, payment, phone calls, cancellation, or socket updates. Route fetch failure falls back to a direct curved line for tracking and a direct destination instruction for technician navigation.

## Configuration and dependencies

- Add `mappls-web-maps` `3.8.1` to `resqnowfrontend/package.json` and its lockfile.
- Add `VITE_MAPPLS_MAP_SDK_KEY=` to a committed `resqnowfrontend/.env.example`.
- Do not add `MAPPLS_CLIENT_ID` or `MAPPLS_CLIENT_SECRET`.
- Do not remove Leaflet dependencies globally because other screens may still use them. Remove Leaflet imports only from the two migrated map components.

## Verification

Automated tests cover SDK initialization/error normalization, route-progress/maneuver calculations, map component fallback states, both technician navigation triggers, navigation exit, and preservation of map caller props. Tests are written before their corresponding production behavior.

Verification commands include focused Vitest runs, the full frontend test suite, `npm run build`, Leaflet/OSM/CartoDB reference scans limited to the two migrated components, and `npx cap sync android`. A browser verification exercises both routes with mocked/live fixture data, checks console errors and interactions, and confirms no new browsing context is opened. Android verification builds the debug app and manually checks WebView SDK authorization, safe-area placement, gestures, live marker updates, and navigation exit.

## Non-goals and follow-ups

- No change to address autocomplete, Google Places, geocoding providers, or the backend OSRM contract.
- No voice guidance, background navigation, Android Auto/CarPlay, lane guidance, or native lock-screen navigation in this release.
- No removal of Leaflet from the repository while other screens still consume it.
- If WebView profiling or product requirements demand native-grade navigation, introduce a separately designed Capacitor bridge to Mappls Android/iOS navigation SDKs.
