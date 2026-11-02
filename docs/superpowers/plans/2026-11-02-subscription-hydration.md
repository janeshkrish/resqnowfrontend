# QA-015 subscription hydration implementation plan

> **For agentic workers:** Use superpowers:executing-plans inline with test-driven-development and a fresh final review.

**Goal:** Display the server's saved subscription after initialization, every customer sign-in method and verified purchases.

**Architecture:** Centralize profile mapping and no-cache `/api/auth/me` reads in AuthContext. Customer login endpoints currently omit subscription, so fetch the authoritative profile after storing the returned token rather than trusting a local default or expanding backend contracts. Replace local plan mutation with profile refresh; payment verification remains the QA-001 server-owned entitlement boundary. Preserve configured plan IDs rather than coercing them to basic.

**Tech stack:** React, TypeScript, Vitest, Testing Library; existing Express profile endpoint.

**Spec:** root `QA_DEEP_AUDIT_REPORT.md`, QA-015, with QA-001 secure plan binding.

## Constraints

- Preserve prior QA fixes and uncommitted changes. No GitHub actions, deployment, database writes, provider transactions, or recreation of the removed manual-test environment.
- Reuse existing `/api/auth/me` and payment verification contracts; no schema or dependency addition.
- A free-plan action cannot pretend to cancel a paid server entitlement.

## Review focus

- Premium/custom paid profile survives restart and email/phone/OTP authentication even when login payload omits the plan.
- Failed refresh/verification must never grant a paid plan locally or report a fabricated free downgrade.
- Late profile/purchase responses must not overwrite another account or a newer entitlement refresh.
- Verified purchase followed by profile-fetch failure remains recoverable by subsequent refresh/reopen, without a second payment.
- Demo and existing profile/admin login behavior remain compatible.

## Task 1: Authoritative customer profiles

**Files:** modify `src/contexts/AuthContext.tsx`; add `src/contexts/AuthContext.test.tsx`.

**Interface:** `refreshUser(): Promise<UserProfile | null>` replaces `updateSubscription(plan)`. UserProfile.subscription retains the server plan string with free fallback only when server profile has no plan. Profile reads are `cache: no-store`, guarded against changed sessions/out-of-order responses.

- [x] Add failing real-provider tests for saved plan hydration/remount, all sign-in paths, refresh failures/recovery, custom codes and stale responses.
- [x] Implement shared profile mapping/refresh, authenticated sign-in completion and guards; preserve admin branch and profile editing.
- [x] Run the focused tests to green.

## Task 2: Verified purchase refresh

**Files:** modify `src/pages/Subscription.tsx`; add `src/pages/Subscription.test.tsx`; document `docs/qa-015-subscription-hydration.md`.

**Interface:** after successful `/verify-subscription-payment`, call Task1 refreshUser; the selected plan ID is never an entitlement setter. Free-card UI must not advertise a fake downgrade. Synchronize selected card after server hydration.

- [x] Add failing purchase/provider tests for server plan vs selected plan, failed verification, successful verification followed by failed refresh/recovery and free-card behavior.
- [x] Implement refresh-based purchase completion and accurate free-plan display; preserve payment-bound plan IDs.
- [x] Run focused and complete frontend suites, typecheck/build, applicable backend payment regressions, and fresh code review.
- [x] Record final evidence and limitations; remove temporary test logs only.

## Execution evidence

Pre-flight: Task2 consumes Task1 refreshUser and string plan IDs. No conflicting interface. Inline work in the existing checkout preserves the earlier uncommitted dependent QA changes.

Additional ownership: `vite.config.ts` and `src/lib/profileCachePolicy.test.ts` put `/api/auth/me` ahead of generic API caches using NetworkOnly; this is required so no-store refreshes cannot fall back to another cached profile. `src/lib/api.ts` and `src/lib/subscription.demo.test.ts` preserve simulated purchase behavior after removing local AuthContext grants. The demo catalog has basic/free, so its fixture uses basic; arbitrary custom server codes are covered in real-provider/purchase tests.

RED/GREEN: Initial auth11 failures reproduced; subsequent purchase/profile-edit6 failures reproduced. Demo2 and PWA2 negative regressions reproduced. Final focused26/26 pass; typecheck exit0. First cache-config test import needed Node environment because jsdom's TypedArray realm violates esbuild's invariant; correcting the test environment then exposed the real NetworkFirst defect.

Fresh final review: one Important finding, missing propagation of email login cancellation into the new profile request. Added `aborting email login while its profile is pending cannot authenticate or report success`, observed failure (login incorrectly resolved), passed signal through completion/profile fetch and checked abortion before committing. Focused27/27 pass; production build exit0. Existing QA-001 binding61/61 pass. Final full-suite/typecheck verification pending.

Completion evidence: final full frontend suite879/879 across111 files, zero failures/skips; final typecheck exit0; production/PWA build exit0 (30.07 seconds, existing chunk-size advisory); backend binding61/61. Diff whitespace checks pass. Review finding fixed RED→GREEN and the entire frontend suite rerun afterward. Temporary logs removed; previous manual QA folders remain absent. No commits, GitHub operations, live integration calls or deployment.

Final: Ruling: Live merchant delivery, actual database entitlement changes and deployed worker upgrades are not established by unit/configuration tests. No live payment or deployment was authorized/performed; cost if wrong: deployment-specific behavior still needs environment validation.
Final: Ruling: Historical repair and refund/expiry/cancellation policy stay outside this display/state fix. Cost: historical bad records require separate reconciliation and paid-plan cancellation remains unimplemented, rather than falsely simulated in the UI.
Final: Ruling: Earlier QA-001–005 changes remain intact and are regression-tested, not re-reviewed wholesale. Cost: an older issue outside suite coverage may remain.
Final review: no deferred minor findings.
