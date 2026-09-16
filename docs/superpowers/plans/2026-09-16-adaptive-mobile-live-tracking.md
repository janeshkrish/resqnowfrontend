# Adaptive Mobile Live Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the mobile customer live-tracking page into a customer-controlled, map-first tracking surface while retaining every existing tracking, payment, contact, towing and cancellation behavior.

**Architecture:** Preserve `RequestTracking` as the owner of request data, socket-driven ETA/distance, payment handlers and sheet motion state. Move the compact, reusable map/balanced-focus content into a presentational `MobileTrackingSummaryDock`, and let the existing `RequestTracking` mobile branch compose that dock with the existing detailed controls at the expanded snap point. Add an optional Mappls overlay visibility prop so the mobile caller avoids duplicating the status/ETA card while retaining a recenter action.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, shadcn UI primitives, Framer Motion, lucide-react, Mappls Web Maps, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-16-adaptive-mobile-live-tracking-design.md`

## Global Constraints

- Change only the mobile branch of `src/components/RequestTracking.tsx`; the desktop render tree and its visual hierarchy must remain unchanged.
- Preserve `useRealtimeServiceRequest`, all status/payment APIs, Mappls configuration, routing provider and technician location reporting exactly as they are.
- Keep existing ResQNow red, white, slate, green and amber colors; add no third-party UI library, generated imagery, illustration system or AI-style visuals.
- Retain all existing actions and their eligibility: map/recenter, Message, Call, towing route information, journey progress, timer, pricing, online/cash payment, payment summary, return home, cancellation and completion/review.
- The selected sheet focus must survive socket location/ETA/status renders. Only customer input changes `collapsed`, `half` or `expanded` after initial entry.
- Provide accessible labelled controls, 44px minimum touch targets, safe-area insets and reduced-motion-compatible behavior.

---

## File structure

| File | Responsibility |
| --- | --- |
| `src/components/user/MobileTrackingSummaryDock.tsx` | Pure mobile map/balanced-focus visual dock: current state, primary value, supporting text, technician contact actions, focus controls and compact online payment CTA. It has no socket, route or payment API logic. |
| `src/components/user/MobileTrackingSummaryDock.test.tsx` | Isolated DOM/accessibility tests for the dock and its callback/link contracts. |
| `src/components/RequestTracking.tsx` | Retains state and handlers; derives compact presentation data, updates sheet geometry, composes the new dock with current details and preserves status conditions. |
| `src/components/RequestTracking.test.tsx` | Mobile integration tests for focus selection, map prop continuity, payment visibility and retained conditional actions; existing desktop route-metric tests remain. |
| `src/components/user/LiveTrackingMap.tsx` | Adds an optional status-card visibility control while continuing to render the persistent map recenter action. |
| `src/components/user/LiveTrackingMap.test.tsx` | Verifies a caller can suppress the map status card without losing recenter functionality. |

### Task 1: Build the tested compact summary dock

**Files:**
- Create: `src/components/user/MobileTrackingSummaryDock.tsx`
- Create: `src/components/user/MobileTrackingSummaryDock.test.tsx`

**Interfaces:**
- Consumes: shadcn `Avatar`/`Button`, lucide `ChevronUp`, `ChevronDown`, `Map`, `MessageSquare`, `Phone`, `CreditCard` and the existing ResQNow Tailwind tokens.
- Produces:

```ts
export type MobileTrackingSummary = {
  eyebrow: string;
  value: string;
  detail: string;
  journeyLabel: string;
};

export type MobileTrackingTechnician = {
  name: string;
  avatarUrl?: string | null;
  phone?: string | null;
  ratingLabel: string;
  completedJobs: number;
};

export type MobileTrackingPaymentAction = {
  amountLabel: string;
  onPayOnline: () => void;
};

export interface MobileTrackingSummaryDockProps {
  summary: MobileTrackingSummary;
  technician?: MobileTrackingTechnician | null;
  isConnected: boolean;
  isMapFocus: boolean;
  paymentAction?: MobileTrackingPaymentAction | null;
  onShowMap: () => void;
  onShowDetails: () => void;
}
```

- Produces: `MobileTrackingSummaryDock`, which uses labelled buttons named `Show more map` and `View service details`, exposes `data-testid="mobile-tracking-summary"`, and renders existing `sms:`/`tel:` link behavior exactly.

- [ ] **Step 1: Write the failing dock tests**

Create `src/components/user/MobileTrackingSummaryDock.test.tsx` with the following coverage:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import MobileTrackingSummaryDock from "./MobileTrackingSummaryDock";

const summary = {
  eyebrow: "Technician arriving in",
  value: "8 min",
  detail: "2.4 km away",
  journeyLabel: "On the way",
};

describe("MobileTrackingSummaryDock", () => {
  it("shows the live essentials and preserves technician contact links", () => {
    render(
      <MobileTrackingSummaryDock
        summary={summary}
        isConnected={true}
        isMapFocus={false}
        onShowMap={vi.fn()}
        onShowDetails={vi.fn()}
        technician={{
          name: "Arun Kumar",
          phone: "9999999999",
          ratingLabel: "4.8",
          completedJobs: 12,
        }}
      />,
    );

    expect(screen.getByTestId("mobile-tracking-summary")).toHaveTextContent("8 min");
    expect(screen.getByTestId("mobile-tracking-summary")).toHaveTextContent("2.4 km away");
    expect(screen.getByRole("link", { name: "Message technician" })).toHaveAttribute("href", "sms:9999999999");
    expect(screen.getByRole("link", { name: "Call technician" })).toHaveAttribute("href", "tel:9999999999");
  });

  it("offers explicit customer-controlled map and details focus actions", () => {
    const onShowMap = vi.fn();
    const onShowDetails = vi.fn();
    render(
      <MobileTrackingSummaryDock
        summary={summary}
        isConnected={false}
        isMapFocus={false}
        onShowMap={onShowMap}
        onShowDetails={onShowDetails}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Show more map" }));
    fireEvent.click(screen.getByRole("button", { name: "View service details" }));
    expect(onShowMap).toHaveBeenCalledOnce();
    expect(onShowDetails).toHaveBeenCalledOnce();
    expect(screen.getByText("Reconnecting")).toBeInTheDocument();
  });

  it("keeps an online payment CTA reachable in map focus", () => {
    const onPayOnline = vi.fn();
    render(
      <MobileTrackingSummaryDock
        summary={summary}
        isConnected={true}
        isMapFocus={true}
        onShowMap={vi.fn()}
        onShowDetails={vi.fn()}
        paymentAction={{ amountLabel: "INR 500.00", onPayOnline }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Pay INR 500.00 online" }));
    expect(onPayOnline).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run: `npx vitest run src/components/user/MobileTrackingSummaryDock.test.tsx`

Expected: FAIL because `MobileTrackingSummaryDock` does not exist.

- [ ] **Step 3: Implement the presentational dock**

Create `MobileTrackingSummaryDock.tsx` with the declared types and a single `<section>` surface. Keep all interactive controls real buttons/anchors. The structural core must be:

```tsx
<section
  data-testid="mobile-tracking-summary"
  aria-live="polite"
  className="space-y-3 rounded-t-[28px] bg-white px-4 pb-4 pt-3 shadow-[0_-18px_42px_rgba(15,23,42,0.16)]"
>
  <div className="flex items-center justify-between gap-3">
    <button type="button" onClick={onShowMap} aria-label="Show more map" className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100">
      <Map className="h-4 w-4" />
    </button>
    <button type="button" onClick={onShowDetails} aria-label="View service details" className="inline-flex h-11 min-w-11 items-center justify-center rounded-full bg-primary px-3 text-xs font-extrabold text-primary-foreground transition-colors hover:bg-primary/90">
      {isMapFocus ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
  </div>
  <div className="flex items-end justify-between gap-3">
    <div className="min-w-0">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-primary">{summary.eyebrow}</p>
      <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{summary.value}</p>
      <p className="mt-1 truncate text-xs font-medium text-slate-500">{summary.detail}</p>
    </div>
    <span className={isConnected ? "rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-emerald-700" : "rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em] text-amber-700"}>
      {isConnected ? "Live" : "Reconnecting"}
    </span>
  </div>
</section>
```

Add the technician row when `technician` is present. It must show avatar fallback, `ratingLabel`, `completedJobs`, and two 44px circular anchor buttons with the existing `sms:${phone || ""}` and `tel:${phone || ""}` hrefs. Add a one-line `summary.journeyLabel` button that calls `onShowDetails`. When `paymentAction` exists, append one `Button` named `Pay ${paymentAction.amountLabel} online` that calls `paymentAction.onPayOnline`; it replaces, rather than duplicates, the outer sticky payment bar only in map focus.

- [ ] **Step 4: Run the dock tests to verify they pass**

Run: `npx vitest run src/components/user/MobileTrackingSummaryDock.test.tsx`

Expected: PASS with all three tests passing.

- [ ] **Step 5: Commit the independently tested dock**

```bash
git add src/components/user/MobileTrackingSummaryDock.tsx src/components/user/MobileTrackingSummaryDock.test.tsx
git commit -m "feat: add mobile tracking summary dock"
```

### Task 2: Give the fullscreen map an optional non-duplicating status surface

**Files:**
- Modify: `src/components/user/LiveTrackingMap.tsx:25-42,278-333`
- Modify: `src/components/user/LiveTrackingMap.test.tsx:43-63`

**Interfaces:**
- Consumes: existing `LiveTrackingMapProps`, map marker/camera/recenter behavior.
- Produces: optional `showStatusOverlay?: boolean` prop defaulting to `true`; status copy is omitted only when `false`, while `Recenter live tracking map` remains available.

- [ ] **Step 1: Write the failing map-overlay regression test**

Append this test to `LiveTrackingMap.test.tsx`:

```tsx
it("can hide the duplicate status card without removing map recenter", () => {
  render(
    <LiveTrackingMap
      techLocation={{ lat: 12.97, lng: 77.59 }}
      userLocation={{ lat: 12.98, lng: 77.6 }}
      eta="8 min"
      status="en-route"
      variant="fullscreen"
      showStatusOverlay={false}
    />,
  );

  expect(screen.queryByText("On the way")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Recenter live tracking map" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused map test to verify it fails**

Run: `npx vitest run src/components/user/LiveTrackingMap.test.tsx`

Expected: FAIL because `showStatusOverlay` is not part of the component contract and the status card still renders.

- [ ] **Step 3: Implement the optional overlay flag without changing map behavior**

Add the optional prop to `LiveTrackingMapProps` and the component parameters:

```ts
interface LiveTrackingMapProps {
  showStatusOverlay?: boolean;
}

// Add this destructured default beside the component's current props.
showStatusOverlay = true,
```

In the fullscreen branch, render the status-card `<div>` only when `showStatusOverlay` is true. Keep the same outer overlay container and always render the recenter `<button>` so camera recovery works in all variants:

```tsx
<div className="flex items-start justify-between gap-3">
  {showStatusOverlay ? (
    <div className="pointer-events-auto rounded-[1.5rem] border border-white/80 bg-white/92 px-4 py-3 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.4)] backdrop-blur-xl">
      <div className="flex items-center gap-2 text-[15px] font-bold text-emerald-600">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        {statusLabel}
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[12px] font-medium text-slate-500">
        <RadioTower className="h-3.5 w-3.5 text-emerald-500" />
        {supportingLabel}
      </div>
    </div>
  ) : <span />}
  <button type="button" onClick={recenter} aria-label="Recenter live tracking map" className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/75 bg-white/92 text-slate-700 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.4)] backdrop-blur-xl transition hover:bg-white">
    <LocateFixed className="h-5 w-5" />
  </button>
</div>
```

Do not modify marker creation, route refresh thresholds, route fetches, camera calculations, interaction callbacks or default callers.

- [ ] **Step 4: Run map tests to verify they pass**

Run: `npx vitest run src/components/user/LiveTrackingMap.test.tsx`

Expected: PASS with the original map rendering, interaction, live-route tests and the new overlay regression test.

- [ ] **Step 5: Commit the map presentation contract**

```bash
git add src/components/user/LiveTrackingMap.tsx src/components/user/LiveTrackingMap.test.tsx
git commit -m "feat: support compact live tracking map overlay"
```

### Task 3: Add mobile integration tests for customer-selected focus and critical states

**Files:**
- Modify: `src/components/RequestTracking.test.tsx:11-49,75-194`

**Interfaces:**
- Consumes: `MobileTrackingSummaryDock` test id/button labels, `trackingMapModeFromSheetSnap` contract, existing realtime and map mocks.
- Produces: a mobile-capable harness that proves the parent preserves map inputs, chosen sheet focus, payment reachability, towing destination and desktop behavior.

- [ ] **Step 1: Change the mocked viewport to be selectable per test**

Replace the constant `useIsMobile: () => false` mock with a hoisted flag:

```tsx
const viewportHarness = vi.hoisted(() => ({ isMobile: false }));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => viewportHarness.isMobile,
}));
```

Reset `viewportHarness.isMobile = false` in `beforeEach`. Add a `renderTracking()` helper that contains the existing `MemoryRouter`, `Routes` and route. Set `viewportHarness.isMobile = true` only in mobile tests.

- [ ] **Step 2: Write failing mobile integration tests**

Add these tests after the existing route-metric cases:

```tsx
it("starts mobile tracking in balanced focus and lets the customer select map and details focus", async () => {
  viewportHarness.isMobile = true;
  await renderTracking();

  expect(screen.getByTestId("mobile-tracking-summary")).toHaveTextContent("17 min");
  expect(trackingHarness.mapProps).toMatchObject({ mapMode: "balanced", showStatusOverlay: false });

  fireEvent.click(screen.getByRole("button", { name: "Show more map" }));
  expect(trackingHarness.mapProps).toMatchObject({ mapMode: "map" });

  fireEvent.click(screen.getByRole("button", { name: "View service details" }));
  expect(trackingHarness.mapProps).toMatchObject({ mapMode: "sheet" });
  expect(screen.getByText("Journey progress")).toBeInTheDocument();
});

it("keeps payment reachable in map focus without forcing the details sheet", async () => {
  viewportHarness.isMobile = true;
  trackingHarness.request = {
    ...trackingHarness.request,
    status: "payment_pending",
    payment_status: "pending",
  };
  await renderTracking();

  fireEvent.click(screen.getByRole("button", { name: "Show more map" }));
  expect(screen.getByRole("button", { name: "Pay INR 500.00 online" })).toBeInTheDocument();
  expect(trackingHarness.mapProps).toMatchObject({ mapMode: "map" });
});

it("keeps the desktop tracking hierarchy when the mobile viewport flag is false", async () => {
  await renderTracking();

  expect(screen.queryByTestId("mobile-tracking-summary")).not.toBeInTheDocument();
  expect(trackingHarness.mapProps).toMatchObject({ showRoutePath: true });
});
```

Use the existing rendering and async `act` setup so Framer Motion effects settle before assertions. Import `fireEvent`, `screen` and `waitFor` from Testing Library rather than querying raw DOM classes. If the initial animation schedules asynchronously, wait for the captured map prop with `await waitFor(() => expect(trackingHarness.mapProps).not.toBeNull())` before checking map mode.

- [ ] **Step 3: Run the request-tracking suite to verify the new tests fail**

Run: `npx vitest run src/components/RequestTracking.test.tsx`

Expected: FAIL because the parent does not yet render `mobile-tracking-summary`, pass `showStatusOverlay`, or keep payment in the selected map focus.

- [ ] **Step 4: Do not change production code in this task**

Leave the failure in place. Task 4 makes the smallest production changes that satisfy these integration tests and preserves the existing ETA/route tests.

### Task 4: Compose the adaptive dock in the mobile tracking screen

**Files:**
- Modify: `src/components/RequestTracking.tsx:1-70,278-370,970-1100,1270-1770`
- Modify: `src/components/RequestTracking.test.tsx:11-260` only if an assertion needs the exact accessible name emitted by the finished dock.

**Interfaces:**
- Consumes: `MobileTrackingSummaryDock`, `showStatusOverlay`, existing `trackingSummary`, `trackingSteps`, `snapTo`, `showPayment`, payment handlers and `trackingMapModeFromSheetSnap`.
- Produces: mobile-only map, balanced and service-focus layouts connected to the existing sheet state. `collapsed` maps to map focus, `half` to balanced, and `expanded` to service focus.

- [ ] **Step 1: Derive the compact data without changing business rules**

Import the dock and derive a `journeyLabel` from the already-normalized status. Keep `trackingSummary` as the single source of primary text:

```tsx
const compactTrackingSummary = {
  eyebrow: trackingSummary.eyebrow,
  value: trackingSummary.value,
  detail: trackingSummary.detail,
  journeyLabel:
    isTowingRequest && isTowingDropLeg
      ? "Towing to drop location"
      : trackingSteps[stageIndex]?.label || "Journey progress",
};

const compactTechnician = technician
  ? {
      name: technician.name || "Technician",
      avatarUrl: technician.avatar_url,
      phone: technician.phone,
      ratingLabel: technicianRatingLabel,
      completedJobs: Number.isFinite(technicianJobs) ? technicianJobs : 0,
    }
  : null;
const isMapFocus = sheetSnapState === "collapsed";
```

Do not alter `liveTrackingMetrics`, server route freshness checks, `liveTrackingDestination`, towing-drop logic, payment request functions or phone/SMS URI formation.

- [ ] **Step 2: Adjust snap geometry for a useful map-focus dock**

Replace the hard-coded 110px collapsed visibility with named geometry that accommodates the summary dock and remains ordered at short viewport heights:

```tsx
const MOBILE_MAP_DOCK_HEIGHT = showPayment && !paymentCompleted ? 206 : 158;
const EXPANDED_Y = Math.max(56, Math.round(viewportHeight * 0.10));
const HALF_Y = Math.max(EXPANDED_Y + 150, Math.round(viewportHeight * 0.46));
const COLLAPSED_Y = Math.max(
  HALF_Y + 92,
  Math.max(EXPANDED_Y + 242, viewportHeight - MOBILE_MAP_DOCK_HEIGHT),
);
```

Keep `trackingMapModeFromSheetSnap(sheetSnapState)` unchanged. Simplify the initial animation effect so `showPayment` does not call `snapTo("expanded")` or otherwise change the customer-selected state. On first mobile entry, animate only to `HALF_Y`; after that, only `snapTo`, sheet drag, the header controls or map interaction update the snap state.

- [ ] **Step 3: Replace the mobile header/body hierarchy, preserving every detail block**

In the existing `if (isMobile)` return:

1. Keep the fullscreen `LiveTrackingMap`, its real locations/route props, `onInteract={() => snapTo("collapsed")}`, `showRoutePath`, and the top back/connection controls.
2. Pass `showStatusOverlay={false}` so the compact dock is the canonical state/ETA display. The map’s recenter button remains supplied by `LiveTrackingMap`.
3. Place the drag handle in a 44px accessible control region. Its button has `aria-label="View service details"` when not expanded and `aria-label="Show balanced tracking view"` when expanded. Keep the drag gesture on that region.
4. Render `MobileTrackingSummaryDock` above the native-scroll detail container in every sheet position:

```tsx
<MobileTrackingSummaryDock
  summary={compactTrackingSummary}
  technician={compactTechnician}
  isConnected={isConnected}
  isMapFocus={isMapFocus}
  onShowMap={() => snapTo("collapsed")}
  onShowDetails={() => snapTo("expanded")}
  paymentAction={
    showPayment && !paymentCompleted && isMapFocus
      ? {
          amountLabel: `${currency} ${amountDueLabel}`,
          onPayOnline: handleOnlinePaymentClick,
        }
      : null
  }
/>
```

5. Show the detail container only when `sheetSnapState !== "collapsed"`; use native `overflow-y-auto`, current safe-area bottom padding and the existing status-aware order: subtitle, towing route, journey progress, active timer, amount breakdown, full payment controls, request/home and cancellation states.
6. Do not duplicate the old large technician profile in detail mode. The compact dock retains avatar, rating, job count and Message/Call, so all of its information and actions remain available in every focus mode.
7. Retain the outer fixed online/cash payment bar in balanced/service focus only:

```tsx
const showExpandedPaymentBar =
  showPayment && !paymentCompleted && sheetSnapState !== "collapsed";
```

Use `showExpandedPaymentBar` for both its render condition and scroll padding. Map focus exposes its online CTA in the dock; cash remains one tap away through service details. Keep the existing `PaymentSummaryDialog` unmodified.

8. Keep cancelled notices and `ClientJobCompletion` outside the focus-specific presentation exactly as they currently are.

- [ ] **Step 4: Run focused tests until all pass**

Run:

```bash
npx vitest run src/components/user/MobileTrackingSummaryDock.test.tsx
npx vitest run src/components/user/LiveTrackingMap.test.tsx
npx vitest run src/components/RequestTracking.test.tsx
```

Expected: PASS. In particular, the original five route-metric/towing tests remain green, the map still receives the current live route/destination, customer focus changes map padding mode, and the payment CTA remains reachable in map focus.

- [ ] **Step 5: Commit the parent composition**

```bash
git add src/components/RequestTracking.tsx src/components/RequestTracking.test.tsx
git commit -m "feat: redesign mobile live tracking"
```

### Task 5: Verify the production build and responsive customer flows

**Files:**
- Modify: no source files unless a verification failure identifies a scoped defect; add a regression test before changing that defect.

**Interfaces:**
- Consumes: completed mobile presentation, existing frontend test/build scripts and a local Vite runtime.
- Produces: evidence that mobile-only changes compile, preserve the desktop screen, and fit common mobile viewports without clipping or blocked actions.

- [ ] **Step 1: Run the full automated frontend verification**

Run:

```bash
npx vitest run
npx tsc --noEmit
npm run build
```

Expected: all test suites pass, TypeScript succeeds and Vite emits a production build. If a pre-existing lint failure is observed, report it separately and do not weaken lint rules to mask it.

- [ ] **Step 2: Start the local web app and perform visual responsive checks**

Run: `npm run dev -- --host 127.0.0.1`

With an authenticated/fixture customer request, use browser responsive emulation at 360x800, 390x844 and 412x915. At each size inspect the following in the en-route state:

1. Map focus: route, technician marker, recenter, back control, compact summary, Message and Call remain visible without horizontal clipping.
2. Balanced focus: ETA, distance, technician and detail entry point are visible in one glance.
3. Service focus: dragging/tapping opens route detail, journey, timer, pricing, cancellation and return-home controls; inner scrolling is native and does not drag the map.

Then verify arrived, in-progress, towing drop and payment-pending fixtures. For payment-pending, ensure the map-focus online CTA launches the unchanged payment dialog and balanced/service focus retains online/cash actions. For towing drop, confirm the route still points at the drop destination. Check browser console for errors and use the recenter control after a manual map pan.

- [ ] **Step 3: Record deployment limits and run a final diff review**

Run:

```bash
git diff HEAD~3..HEAD --check
git status --short
```

Expected: no whitespace errors and no untracked/generated artifacts. Record that a production-authenticated two-device check remains required after deployment because real socket movement and Mappls origin authorization cannot be conclusively exercised by local fixture data.
