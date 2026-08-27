# Extractable components

The Mappls change is localized inside two self-contained page map regions. No shared shell component needs extraction for this target; passing the actual page/map source preserves fidelity better than converting the large application headers.

## LiveStatusPill
- Source: `src/components/user/LiveTrackingMap.tsx`
- Category: basic
- Description: white floating live-status card with emerald status and distance/ETA support copy.
- Extractable props: `statusLabel`, `supportingLabel`
- Hardcoded: RadioTower icon, green presence dot, rounded white glass surface.

## TechnicianEtaMarker
- Source: `src/components/user/LiveTrackingMap.tsx`
- Category: basic
- Description: animated technician map marker with white live ETA bubble, red pulse, and pin.
- Extractable props: `etaLabel`
- Hardcoded: Technician label, marker structure, pulse/ripple class names.

These are basic localized map elements, so the design workflow should pass their source directly and skip remote component extraction.
