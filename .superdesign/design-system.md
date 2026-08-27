# ResQNow Map and Navigation Design System

## Product context

ResQNow is an Indian roadside-assistance marketplace. The two target experiences are high-attention mobile surfaces: a technician actively traveling to a customer and a customer watching that technician arrive. Information must be glanceable outdoors, touch targets must be usable one-handed, and status/payment flows must remain visually separate from navigation controls.

## Visual foundation

- Use Plus Jakarta Sans for map overlays and Inter elsewhere.
- Preserve the existing red primary (`hsl(0 84% 60%)` / approximately `#ef4444`), white cards, deep slate copy, pale slate surfaces, and semantic emerald/amber/indigo states.
- Use rounded 20–32px cards over the map with thin white/slate borders, strong but soft downward shadows, and restrained translucent blur.
- Map content is full bleed inside its existing frame. Brand overlays float above it with safe-area-aware top and bottom spacing.
- Route styling uses a light/white casing and a saturated red or blue primary stroke with rounded caps. The route must remain legible over Mappls vector styling.
- Keep Mappls attribution visible and visually unobstructed.

## Technician navigation composition

- Top: compact instruction banner with a large directional icon, next maneuver, and distance to maneuver.
- Center: map with live technician marker, remaining route, destination marker, and heading-follow camera.
- Bottom: one floating card containing remaining distance, ETA, recenter, and a persistent Exit navigation action.
- Exit is secondary but always visible. Job status progression remains outside the map navigation card.
- On map/SDK failure, use a calm slate fallback with Retry and preserve Exit navigation.

## Customer tracking composition

- Preserve the existing white ETA technician bubble, red pulse, dark destination ripple pin, cased red route, live status pill, and circular recenter control.
- Fullscreen mobile mode must respect the draggable bottom sheet and safe areas.
- Card mode keeps the same marker language at a smaller viewport without extra chrome.
- Panning signals user interaction; recenter explicitly restores automatic framing.

## Motion and accessibility

- Smoothly interpolate marker position with CSS/SDK transitions; do not recreate the map.
- Follow/recenter camera movement should be brief and non-disorienting.
- Honor `prefers-reduced-motion` by disabling float/ripple animation and avoiding animated camera transitions.
- Use 44px minimum interactive targets, visible focus states, `aria-live="polite"` for maneuver changes, and explicit labels for recenter/exit/retry.

## Hard constraints

- Use only existing fonts, semantic colors, spacing, and shadcn/Tailwind component language.
- Do not introduce purple/neon palettes, decorative fonts, skeuomorphic road signs, or Mappls default pins.
- Do not obscure status, attribution, or the draggable customer tracking sheet.
