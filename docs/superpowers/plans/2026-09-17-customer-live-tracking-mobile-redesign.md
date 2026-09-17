# Customer Live Tracking Mobile Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replicate the approved Stitch-inspired mobile customer live-tracking design with real ResQNow data, controls, and Mappls tracking.

**Architecture:** `RequestTracking` remains the orchestration layer for request/realtime/payment/dialog state and passes view models plus callbacks into `MobileTrackingSummaryDock`. The dock becomes a focused mobile presentation component. `LiveTrackingMap` continues to own camera and marker behavior; its existing fullscreen recenter capability is positioned within the approved overlay composition rather than replaced.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Framer Motion, shadcn/ui Dialog and Button, Lucide, Mappls web map surface, Vitest and Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-17-customer-live-tracking-mobile-redesign-design.md`

## Global Constraints

- Apply the redesign only to the existing mobile branch of `RequestTracking`; desktop markup remains unchanged.
- Preserve Mappls, Socket.IO, Redis, playback, route calculation, REST recovery, and all existing request/payment APIs.
- Bind every label, ETA, distance, technician detail, service detail, price, and timeline state to live request data; introduce no mock data or static map artwork.
- Use ResQNow red for active/progress/primary actions; retain freshness semantics: emerald LIVE, amber DELAYED/RECONNECTING, slate UPDATING/OFFLINE.
- SOS opens an in-app dialog that links to `/emergency` and `/contact`; it does not call a number or require a new backend endpoint.
- Preserve accessible labels, keyboard activation, reduced-motion behavior, safe-area spacing, and the existing cancellation confirmation API.

---

## File structure

- Modify `src/components/user/MobileTrackingSummaryDock.tsx`: focused compact-sheet presentation, three-stage timeline, verified technician/communication block, pricing presentation, accessible slide-to-cancel, and action callbacks.
- Modify `src/components/user/MobileTrackingSummaryDock.test.tsx`: regression coverage for every dock action and conditional surface.
- Modify `src/components/RequestTracking.tsx`: derive the dock's three-stage view model from live request state, own emergency dialog/share/cancel handlers, and compose the map overlays.
- Modify `src/components/RequestTracking.test.tsx`: prove mobile wiring, real-value propagation, and unchanged desktop map behavior.
- Modify `src/components/user/LiveTrackingMap.tsx`: only if necessary to place the existing recenter control in the reference-aligned fullscreen overlay; do not change playback or camera-follow calculations.
- Modify `src/components/user/LiveTrackingMap.test.tsx`: assert the existing recenter action remains exposed and follows real map state.

### Task 1: Refactor the mobile summary dock into the approved live-sheet surface

**Files:**
- Modify: `src/components/user/MobileTrackingSummaryDock.tsx`
- Modify: `src/components/user/MobileTrackingSummaryDock.test.tsx`

**Interfaces:**
- Consumes: the existing `MobileTrackingSummary`, `MobileTrackingTechnician`, `MobileTrackingPaymentAction`, sheet callbacks, and freshness state.
- Produces: an expanded `MobileTrackingSummaryDockProps` with `timeline`, `serviceSummary`, `onRefresh`, `onShare`, `onEmergency`, `canCancel`, and `onRequestCancellation`; all callbacks remain owned by `RequestTracking`.

- [ ] **Step 1: Write failing dock tests for the approved visible hierarchy**

```tsx
it('renders the real ETA, three-stage timeline, verification and pricing surfaces', () => {
  render(<MobileTrackingSummaryDock {...props} />);

  expect(screen.getByTestId('mobile-tracking-summary')).toHaveTextContent('8 min');
  expect(screen.getByTestId('mobile-tracking-timeline')).toHaveTextContent('Accepted');
  expect(screen.getByTestId('mobile-tracking-timeline')).toHaveTextContent('On the way');
  expect(screen.getByTestId('mobile-tracking-timeline')).toHaveTextContent('Arrived');
  expect(screen.getByText('Verified ResQNow partner')).toBeInTheDocument();
  expect(screen.getByText('INR 500.00')).toBeInTheDocument();
});

it('keeps refresh, SOS, share, contact, and accessible cancellation controls actionable', () => {
  const onRefresh = vi.fn();
  const onEmergency = vi.fn();
  const onShare = vi.fn();
  const onRequestCancellation = vi.fn();
  render(<MobileTrackingSummaryDock {...props} onRefresh={onRefresh} onEmergency={onEmergency} onShare={onShare} canCancel onRequestCancellation={onRequestCancellation} />);

  fireEvent.click(screen.getByRole('button', { name: 'Refresh live tracking' }));
  fireEvent.click(screen.getByRole('button', { name: 'Open emergency support' }));
  fireEvent.click(screen.getByRole('button', { name: 'Share tracking link' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
  expect(onRefresh).toHaveBeenCalledOnce();
  expect(onEmergency).toHaveBeenCalledOnce();
  expect(onShare).toHaveBeenCalledOnce();
  expect(onRequestCancellation).toHaveBeenCalledOnce();
});
```

- [ ] **Step 2: Run the dock test file to verify the new hierarchy fails**

Run: `npm.cmd test -- src/components/user/MobileTrackingSummaryDock.test.tsx`

Expected: FAIL because the timeline, verified label, callback props, service summary, and cancellation control do not yet exist.

- [ ] **Step 3: Add typed, data-only view models and the new dock structure**

```tsx
export type MobileTrackingTimelineStep = {
  label: string;
  caption: string;
  complete: boolean;
  active: boolean;
};

export type MobileTrackingServiceSummary = {
  title: string;
  detail: string;
  amountLabel: string;
  guaranteeLabel?: string | null;
};

export interface MobileTrackingSummaryDockProps {
  summary: MobileTrackingSummary;
  timeline: readonly MobileTrackingTimelineStep[];
  serviceSummary?: MobileTrackingServiceSummary | null;
  technician?: MobileTrackingTechnician | null;
  onRefresh: () => void;
  onEmergency: () => void;
  onShare: () => void;
  canCancel: boolean;
  onRequestCancellation: () => void;
  // Retain existing map/details/payment props unchanged.
}
```

Implement the reference composition using semantic regions and test IDs: ETA header plus refresh, `mobile-tracking-timeline`, verified technician row, red gradient `Call Partner` link, chat/share shortcut controls, service/price card, and an interactive pointer slide control. The slide must call `onRequestCancellation` only after an 85% completion threshold, reset on release below that threshold, and provide the labelled cancel button fallback for keyboard and screen-reader users. Render only real props; omit unavailable technician/service/payment sections rather than substituting reference text.

- [ ] **Step 4: Run the dock test file to verify it passes**

Run: `npm.cmd test -- src/components/user/MobileTrackingSummaryDock.test.tsx`

Expected: PASS, including existing contact-link and map/details/payment tests.

- [ ] **Step 5: Commit the focused dock change**

```powershell
git add src/components/user/MobileTrackingSummaryDock.tsx src/components/user/MobileTrackingSummaryDock.test.tsx
git commit -m "feat: redesign mobile tracking summary dock"
```

### Task 2: Wire live request data and approved customer actions into the mobile view

**Files:**
- Modify: `src/components/RequestTracking.tsx`
- Modify: `src/components/RequestTracking.test.tsx`

**Interfaces:**
- Consumes: the expanded dock props from Task 1 and current `useRealtimeServiceRequest` return values.
- Produces: live three-step timeline, service-summary view model, emergency dialog, native-share/copy fallback, and a mobile overlay composition while preserving desktop JSX.

- [ ] **Step 1: Write failing mobile integration tests**

```tsx
it('binds mobile dock values and actions to the real request and technician state', async () => {
  viewportHarness.isMobile = true;
  await renderTracking();

  expect(screen.getByText('17 min')).toBeInTheDocument();
  expect(screen.getByText('12.3 km away')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh live tracking' }));
  expect(trackingHarness.refresh).toHaveBeenCalledOnce();
  expect(screen.getByRole('link', { name: 'Call technician' })).toHaveAttribute('href', 'tel:9999999999');
});

it('opens in-app emergency support without creating a phone call', async () => {
  viewportHarness.isMobile = true;
  await renderTracking();
  fireEvent.click(screen.getByRole('button', { name: 'Open emergency support' }));

  expect(screen.getByRole('dialog')).toHaveTextContent('Emergency & support');
  expect(screen.getByRole('link', { name: 'Get emergency assistance' })).toHaveAttribute('href', '/emergency');
  expect(screen.getByRole('link', { name: 'Contact ResQNow support' })).toHaveAttribute('href', '/contact');
});
```

Extend the existing realtime-hook mock with a stable `refresh` spy so the test observes the actual callback passed to the dock.

- [ ] **Step 2: Run the RequestTracking test file to verify the new mobile tests fail**

Run: `npm.cmd test -- src/components/RequestTracking.test.tsx`

Expected: FAIL because mobile dock values/actions and the emergency dialog are not yet wired.

- [ ] **Step 3: Derive mobile-specific live view models and handlers in RequestTracking**

```tsx
const mobileTimeline = [
  { label: 'Accepted', caption: formatCompactTime(request?.created_at) || 'Confirmed', complete: stageIndex >= 1, active: stageIndex === 1 },
  { label: 'On the way', caption: eta || TRACKING_FRESHNESS_LABELS[effectiveTrackingFreshness], complete: stageIndex >= 2, active: stageIndex === 2 },
  { label: 'Arrived', caption: status === 'arrived' ? 'Now' : 'Pending', complete: stageIndex >= 3, active: stageIndex >= 3 },
];

const canCancelRequest = !['cancelled', 'completed', 'paid'].includes(status) && !paymentCompleted;
```

Build `mobileServiceSummary` only from current service title, vehicle detail, existing amount breakdown, and currency. Add local state for the emergency dialog. Use a `Dialog` with semantic links to `/emergency` and `/contact`. Implement share with `navigator.share({ title, text, url })`; if unavailable or rejected, call `navigator.clipboard.writeText(url)` and surface the existing toast success/failure messaging. Reuse the existing cancellation dialog by extracting a single `openCancelDialog` state/trigger path instead of duplicating the cancellation PATCH request.

Replace only the mobile branch markup with the reference-aligned map overlay and new dock props: back control, live freshness pill, SOS trigger, destination/ETA labels from existing live values, and no hard-coded labels. Keep `LiveTrackingMap` as the live map child and preserve its motion props. Leave the desktop branch unchanged.

- [ ] **Step 4: Run the RequestTracking test file to verify it passes**

Run: `npm.cmd test -- src/components/RequestTracking.test.tsx`

Expected: PASS for server ETA preference, fallback metrics, motion props, mobile view controls, support dialog, and existing desktop assertions.

- [ ] **Step 5: Commit the RequestTracking integration change**

```powershell
git add src/components/RequestTracking.tsx src/components/RequestTracking.test.tsx
git commit -m "feat: compose mobile live tracking experience"
```

### Task 3: Align the real Mappls fullscreen overlays and preserve recenter behavior

**Files:**
- Modify: `src/components/user/LiveTrackingMap.tsx`
- Modify: `src/components/user/LiveTrackingMap.test.tsx`

**Interfaces:**
- Consumes: existing `fullscreen`, `trackingFreshness`, `eta`, `distanceLabel`, `status`, and camera state.
- Produces: a reference-aligned, accessible recenter affordance that calls the existing local `recenter` function without altering marker or camera-follow policy.

- [ ] **Step 1: Write a failing fullscreen-map overlay test**

```tsx
it('keeps an accessible recenter control over the fullscreen live Mappls surface', () => {
  render(<LiveTrackingMap {...liveProps} variant="fullscreen" showStatusOverlay={false} />);

  expect(screen.getByTestId('live-tracking-recenter')).toBeInTheDocument();
  expect(screen.getByLabelText('Live service tracking map')).toBeInTheDocument();
});
```

The new `data-testid` makes this a deterministic red test before the placement update.

- [ ] **Step 2: Run the map test file to verify the placement assertion fails**

Run: `npm.cmd test -- src/components/user/LiveTrackingMap.test.tsx`

Expected: FAIL because the existing recenter control is in the upper status overlay rather than the approved reference-aligned map overlay position.

- [ ] **Step 3: Move only the recenter control presentation, preserving `recenter`**

```tsx
<button
  type="button"
  onClick={recenter}
  data-testid="live-tracking-recenter"
  className="pointer-events-auto absolute bottom-5 right-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white/95 text-slate-700 shadow-md backdrop-blur"
  aria-label="Recenter live tracking map"
>
  <LocateFixed className="h-4 w-4" />
</button>
```

Keep the existing `recenter` function, `autoFrame`, `followCenter`, route polyline, playback loop, and Mappls surface unchanged. Avoid rendering duplicate recenter controls when `RequestTracking` supplies the surrounding mobile overlay.

- [ ] **Step 4: Run the map test file to verify it passes**

Run: `npm.cmd test -- src/components/user/LiveTrackingMap.test.tsx`

Expected: PASS, including existing marker, route, interaction, and camera assertions.

- [ ] **Step 5: Commit the map-overlay adjustment**

```powershell
git add src/components/user/LiveTrackingMap.tsx src/components/user/LiveTrackingMap.test.tsx
git commit -m "style: align mobile map controls with tracking sheet"
```

### Task 4: Full regression and visual verification

**Files:**
- Verify only: `src/components/RequestTracking.tsx`
- Verify only: `src/components/user/MobileTrackingSummaryDock.tsx`
- Verify only: `src/components/user/LiveTrackingMap.tsx`

**Interfaces:**
- Consumes: completed Tasks 1–3.
- Produces: verified mobile redesign with no desktop or realtime regression.

- [ ] **Step 1: Run the full frontend test suite**

Run: `npm.cmd test`

Expected: PASS with no failing test files.

- [ ] **Step 2: Run TypeScript and production build checks**

Run: `npx.cmd tsc --noEmit`

Expected: exit code 0.

Run: `npm.cmd run build`

Expected: exit code 0; record any pre-existing bundle or Browserslist warnings separately from failures.

- [ ] **Step 3: Manually inspect the mobile tracking route at 390×844 and 412×892**

Verify: live Mappls surface renders; technician marker and route remain real; map controls are reachable; sheet does not hide actions behind safe areas; contact/refresh/share/SOS/cancel behavior works; stale freshness is not labelled live; desktop tracking remains visually unchanged.

- [ ] **Step 4: Commit final verified state**

```powershell
git add src/components/RequestTracking.tsx src/components/RequestTracking.test.tsx src/components/user/MobileTrackingSummaryDock.tsx src/components/user/MobileTrackingSummaryDock.test.tsx src/components/user/LiveTrackingMap.tsx src/components/user/LiveTrackingMap.test.tsx
git commit -m "test: verify mobile live tracking redesign"
```
