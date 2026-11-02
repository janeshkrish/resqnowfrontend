# QA-015: Saved paid subscriptions remain visible

Reference: root `QA_DEEP_AUDIT_REPORT.md`, QA-015. Existing QA-001 backend order/owner/purpose/plan verification remains the entitlement authority.

## Behavior

- Auth initialization maps the saved subscription from authenticated `GET /api/auth/me`, rather than constructing every user with `subscription: free`.
- Email, phone and OTP sign-ins store the new token, then retrieve the current server profile. These sign-in responses currently omit the plan; no backend contract or schema change is required. Google return/reopening uses the same initialization read.
- Profile mapping and storage use the same server result. Nonempty configured plan codes remain intact; they are not coerced to basic. A missing/null server plan uses the existing free default.
- AuthContext exposes `refreshUser()` instead of the local-only `updateSubscription(plan)` setter. Successful payment verification invokes refreshUser; the checkout selection is never used to grant client state. Replaying an older paid order therefore displays the current server plan rather than reverting to the order's plan.
- If verification succeeds but profile loading fails, the app reports the verified payment and asks the customer to refresh without paying again. The last confirmed profile stays unchanged. Focus/visibility return and reopening retry the authoritative read, supporting delayed server/webhook confirmation.
- A free card is marked Active Plan when current, otherwise Included by default. It does not offer a false local cancellation/downgrade of a saved paid subscription. No server subscription cancellation workflow was added.
- Profile editing refreshes server data instead of locally merging entitlement fields from an edit payload.
- Session and request guards prevent old account/profile reads, unmounted providers and old checkout callbacks from replacing newer state. Explicit invalid-profile authorization clears the customer session; transient refresh failures preserve its last confirmed state.
- Auth profile requests bypass browser HTTP caches (`no-store`) and the updated PWA service worker (`NetworkOnly` before the generic API cache). Deploy the updated frontend/worker together; already-open older clients continue to need an update/reload.
- Frontend-only demo verification updates its simulated saved profile for an available plan so the same refresh flow works. It is a simulator, not proof of real payment verification.

## Verification and limits

Tests render the real AuthProvider and Subscription screen. Only HTTP/storage/provider boundaries are controlled; callback, profile mapping, session races, navigation and visible entitlement state run through production React code. Vite cache-rule tests execute the actual configuration and match the first runtime route for profile/payment URLs.

Initial red: all11 auth regressions failed on literal free/missing refresh behavior; subsequent profile-edit and purchase regressions caught6 remaining failures. Demo and PWA tests reproduced old free state, unknown-plan success and NetworkFirst profile fallback.

Fresh review identified a cancellation regression in the added post-login profile request. A test that aborts email login after credentials succeed while `/me` is pending failed before the correction. The login AbortSignal now reaches profile fetch and is checked before publishing a profile or resolving login success.

Final verification: all 27 focused regressions pass; all 879 frontend tests across 111 files pass after the review correction; all 61 backend QA-001 binding tests pass with synthetic credentials. Typecheck and production build pass, including the updated PWA worker. Existing chunk-size advisory remains. Diff whitespace check passes. Temporary test logs were removed; no manual-testing services were recreated.

Review scope decisions: live gateway/database/deployed-worker behavior requires deployment-environment verification; no historical entitlement repair or refund/expiry/cancellation policy was added; prior QA-001–005 changes are preserved and integration regression-tested rather than re-audited wholesale. No review minors were deferred.

No live database/gateway transactions, deployment, GitHub changes, or manual-test environment recreation were performed. This fixes display/state synchronization; it does not repair historical backend entitlements, add refunds/expiry/cancellation policy, or prove live merchant delivery.
