# Android adoption analytics — implementation handoff, 28 October 2026

Status: implemented and independently reviewed on isolated local branches. **Not deployed, merged or pushed. Production release is not approved or fully validated.** This feature measures adoption; it is not an automatic APK updater.

## Code and verification

Both repositories use `codex/android-install-analytics`:

- Frontend code: `5fe71b422caa9f80c14c2247f88d8153bb7bba65` → `55823f4f8159aa312ed142906a128bdde8863c7e`.
- Backend code: `94a99bb81e07691afc0096f81894e5e767322447` → `31d029e69a6915d2d096d870787cdb2138d0893b`.
- Worktrees: `D:/resqnow-production-code/.worktrees/android-analytics/{frontend,backend}`. Original `E:/resqnow production code/{resqnowfrontend,resqnowbackend}` checkout files were not changed. Subsequent documentation commits do not change the validated implementation.

Fresh final results after the review fixes:

| Check | Result | Scope |
| --- | --- | --- |
| Backend `APP_ANALYTICS_TEST_DB=1 npm test` | 616 passed, 0 failed/skipped | Includes disposable real MariaDB concurrency, migration, validation, JWT guards and production rate budgets |
| Backend `npm run build` | 241 files syntax-checked | No production server/database startup |
| Frontend `vitest run --pool=threads --maxWorkers=1` | 811 passed in 102 files | Full frontend suite |
| Real-backend Playwright | 12 passed | Phone/desktop, real feature routes/guards/DB; browser-native bridge is simulated |
| Portal/technician Playwright | 44 passed | Existing mocked-backend admin auth, responsive metrics UI and technician/towing workflows |
| Rerun voice scenarios | 4 passed | Phone/desktop: existing answers/map warning and highway towing |
| Android `:app:testDebugUnitTest` | 47 passed, 0 failures/errors | Java/plugin compilation, including 4 installation-state tests |
| Vite production build + Capacitor sync | Passed | Synthetic loopback/Firebase settings only; not a production release build |
| Android `:app:assembleDebug` | Passed | Latest web assets and native code packaged; no release signing/publication |
| TypeScript whole-project check | Not clean: 91 diagnostics | Exact same 91 diagnostics on baseline; no added diagnostics |

Ignored evidence lives in sibling `runtime/`: `backend-review-final.log` is instead in backend `.superpowers/sdd/2026-10-27-android-install-analytics/`; other key logs are `frontend-review-final.log`, `playwright-review-final.log`, `portal-regression-final.log`, `voice-regression-final.log`, `android-packaged-final.log`, `frontend-build-review-final.log`, and `types-review-final.log`. Sanitized screenshots are under frontend `output/playwright/analytics/` and `output/playwright/cli/`. No proof/JWT traces are retained in Git.

The earlier full browser run stopped at 39/96, and two earlier full frontend runs had worker-start errors. Those runs are not passes. The final frontend run above is green. Two service-request pricing assertions fail identically on the unchanged baseline: old towing fare ₹1,014 versus “Price shown after a technician accepts”, and old fuel-cost wording versus current accepted-technician pricing. They were not changed to make this feature look green. The two transient voice failures passed on both baseline and final feature reruns. We do not claim every existing browser test is green.

Playwright CLI smoke used fresh snapshots in an owned persistent shell: consent produced a real DB-backed count of 1, the actual admin page rendered it, selecting version 1.3 then changing to 7 days cleared the version filter, and a sanitized viewport screenshot was inspected. A prior expired synthetic JWT redirected to admin login. The deliberately narrow backend harness does not mount general nav-count/notification/socket services; their expected 404/reconnect console entries are not presented as full production-server coverage. The CLI needed an isolated Chrome launch config and persistent shell because this sandbox ends detached browser sessions across commands; application code was not changed for that workaround.

## Independent review and one fix pass

One fresh-context whole-branch reviewer inspected both ranges before fixes. No Critical finding; three Important findings were reproduced with failing tests and fixed:

1. Offline withdrawal → offline re-consent could discard cleanup. Native storage now retains an independent pending-withdrawal revision across restart and clears it only with its own acknowledgement. The client flushes withdrawal before renewed reporting, even with collection disabled. Client and Java regressions went RED → GREEN; real API/DB browser tests show historical links removed without recounting the installation.
2. Concurrent deletion/linking could retain an orphan account link without gap locking. Cleanup now obtains the same parent-account lock as the linker, held by the existing deletion transaction. A real READ COMMITTED concurrency regression for both roles went RED → GREEN.
3. Ordinary storage rejection could disappear without a coverage warning. It now increments persistent-in-process anonymous loss health; successful recovery does not reset that coverage counter. Queue regression went RED → GREEN and the portal warning is covered.

The reviewer also identified double-counting a timed-out operation toward the circuit threshold. This was promoted to Important because the agreed budget is five failed operations. Per-job accounting now counts once; a three-operation reproduction went RED → GREEN. Full suites above ran after the fix pass; no second reviewer was dispatched.

## Deferred minors

- Re-consent reconstructs an exact `firstSeenAt` from the retained day at midnight UTC. The portal uses the retained day, not that artificial precision. A future API cleanup should make the exact timestamp nullable and expose the retained day explicitly; consumers must not treat this timestamp as known precision.
- Reporting time is sampled when queued work executes. A request immediately before Kolkata midnight can be attributed to the next day. Capture receipt/acceptance time before enqueueing in a follow-up.
- Application shutdown does not yet own a bounded analytics queue/pool drain. Pending best-effort telemetry may be lost on process exit, and process-local health resets on restart. Add bounded shutdown ownership before relying on lossless reporting; current metrics are explicitly partial reported usage, not a complete install census.

## Rulings and their costs

1. Native worktree tooling could not target these external repositories; manual Git worktrees were used. Cost: app-managed attachment/cleanup is not automatic; the exact paths/branches are preserved here.
2. Git Bash helpers failed under the sandbox; equivalent PowerShell ledger/verification bookkeeping was used. Cost: less helper automation; commands/results were explicitly recorded.
3. Docker Desktop was unavailable; a disposable loopback MariaDB runtime was used instead of any existing DB configuration. Cost: this does not establish production TiDB compatibility. The no-gap-lock deletion case was subsequently covered using READ COMMITTED, but production staging remains required.
4. Stable native UUID inserts use a dedicated raw mysql2 pool rather than the business ID-generating adapter. Cost: analytics UUID validation and SQL schema compatibility must remain explicit; business persistence behavior is unchanged.
5. Retention has its own default-off `APP_ANALYTICS_RETENTION_ENABLED` flag. Cost: operators must enable/sustain retention independently, including during collection rollback.
6. Semantic/client 4xx errors do not trip the storage breaker. Cost: malformed-client traffic remains a validation/rate-monitoring concern, not database-failure health.
7. Real E2E injects larger test-only lifecycle budgets. Cost: accelerated browser lifecycles do not prove production timing. Separate real-HTTP tests pin 30/minute/IP registration and 6/minute/installation telemetry defaults.
8. Coherent repository-level checkpoint commits group related tasks. Cost: coarser bisect/revert boundaries; the reviewer inspected explicit full base-to-head ranges.
9. The circuit double-counting finding was promoted from Minor to Important and fixed in the one pass. Cost: one extra regression/scope adjustment, justified by the explicit five-operation threshold.
10. Actual Android backup/restore, native first-open, signed update, clear-data and reinstall were not inferred from Java or browser stubs. Cost: device acceptance remains an uncompleted release gate.
11. Distributed signing/version compatibility was not inferred from a local debug APK or a local aligned APK. No keystore password/private key was read or copied. Cost: the owner must supply/confirm the distributed artifact and release certificate/version before publication.
12. Production TiDB, proxy topology, schema deployment and privacy approval were not accessed/assumed validated. Cost: staged rollout needs separate owner approval and operational checks.
13. Interrupted/RED/worker-error runs were not combined into a fictitious green full regression run. Cost: the report names separate verified suites and leaves broader coverage gaps explicit.
14. Baseline pricing expectations and 91 existing TypeScript errors were not changed in this feature. Cost: the project still needs a separate baseline-cleanup decision before claiming an entirely clean type/browser gate.

## Remaining release gates

The owner approved a disposable emulator, not modifications to Windows security/virtualization or a personal phone. Emulator acceleration check returns code 6: Hyper-V detected and Windows Hypervisor Platform available, but asks for those features to be enabled. Software-mode attempts with separate AVD/data directories did not complete boot (adb remained offline). No Windows features were enabled and no phone app was replaced/uninstalled.

Finish native install/offline/restart/update/reinstall/backup acceptance after an approved working emulator or equivalent disposable Android environment is available. A debug-signed in-place update proves only debug-key continuity; compare the real distributed release certificate and a higher release versionCode separately. Then verify production-compatible staging DB/proxy/retention/privacy settings and obtain approval before migration, merge/push, flag enablement or APK publication. See [build/acceptance instructions](android-app-analytics.md) and the backend rollout runbook.
