# Android In-App Updates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver verified APK updates to both roles after a successful main-push release, with user-confirmed installation and retained app data.

**Architecture:** GitHub Releases holds versioned signed artifacts and a strict manifest. Railway caches/distributes release information and streams website APK deliveries; Android uses persistent managed work for verified downloads and its system installer. Publication starts disabled and is activated only after release/device acceptance.

**Tech Stack:** Existing Node22/Express, React/TypeScript/Capacitor8, Android Java21/API24-36, AndroidX WorkManager2.11.2, Gradle8.14.3, Vitest/Node tests/Playwright/JUnit, GitHub Actions.

**Spec:** D:/resqnow-production-code/resqnowfrontend/docs/superpowers/specs/2026-10-30-android-in-app-updates-design.md (approved).

## Global Constraints

- Edit only the regular frontend/backend main checkouts under D:/resqnow-production-code; preserve others' changes. Do not create an implementation branch/worktree or push/publish automatically.
- applicationId com.resqnow1.app; current source versionCode4/versionName1.3; supported minSdk24/targetSdk36. Verify actual distributed maximum and certificate independently before release.
- Automatic unmetered-network download, explicit mobile-data download, explicit Update tap and Android confirmation. No forced updates, data clearing, replacement production signing key or personal-phone tests.
- No business DB migrations, analytics flag changes, backend secrets in web bundles, private keystore material in logs/Git, or installer prompts during critical workflows.
- Use Node22, JDK21 and D:-hosted disposable caches/AVDs because C: has less than1GB free. Never repair virtualization/security settings without approval.
- Keep public delivery/update flags and automatic publication disabled until acceptance. Every implementation task uses observed RED-to-GREEN tests and a targeted local commit; commit only that task's files, never unrelated edits. No remote push or production mutation is implied.
- Run full release gates in a disposable, source-identical verification snapshot that excludes private .env files; actual edits stay on main. Do not weaken checks or treat mocked native bridges as proof of an Android update.

## File structure and shared interfaces

Backend root below means D:/resqnow-production-code/resqnowbackend; frontend root means this repository. Modules remain focused; do not restructure unrelated routes/providers.

- Backend services/androidReleaseManifest.js: parseAndroidRelease(value,{repository,tag}) -> normalized manifest or validation error. services/androidReleaseService.js: createAndroidReleaseService({env,fetch,now}) -> {getRelease():Promise<ReleaseResult>}. routes/androidUpdates.js: createAndroidUpdatesRouter({service}) -> Router.
- Manifest v1: {schemaVersion:1,channel:'stable',applicationId:'com.resqnow1.app',versionCode:number,versionName:string,minSdk:number,targetSdk:number,sizeBytes:number,sha256:string,signingCertificateSha256:string,apkUrl:string,sourceCommit:string,publishedAt:string}. Canonical tag android-v<versionCode>, assets resqnow.apk and android-release.json. Digests are lowercase64-hex, sourceCommit40-hex, APK cap200MiB, manifest cap16KiB, versionCode integer1..2147483647.
- ReleaseResult: {state:'disabled'|'unavailable'} or {state:'ready',release:AndroidReleaseManifest}. GET /api/public/android-app/update uses this contract; disabled/unavailable never masquerade as version0.
- Native package com.resqnow1.app.updates: UpdateManifest, UpdateStateStore, UpdateDownloader, UpdateDownloadWorker, UpdateInstaller. AppUpdaterPlugin registers AppUpdater and exposes getState(), scheduleDownload({release,allowMetered}), cancelDownload(), requestInstall(), openInstallPermissionSettings().
- UpdateSnapshot: {phase:'idle'|'queued'|'downloading'|'verifying'|'ready'|'permission-required'|'installing'|'failed'|'cancelled',installedVersionCode:number,sdkVersion:number,release?:AndroidReleaseManifest,bytesDownloaded:number,errorCode?:string}. Emit updateStateChange; native validation is authoritative.
- Frontend src/lib/appUpdates/{types,native,client,policy}.ts and src/components/{AppUpdateProvider,AppUpdatePanel}.tsx. Provider lives below TechnicianJobProvider and both auth contexts; settings panels consume it. No native side effects on web/PWA.

## Review Focus

1. A completed worker from an older/cancelled release must not overwrite a newer candidate or present an unsafe install; Task3 tests generation ownership.
2. Process death, cache eviction or partial range resumption must never turn truncated bytes into a ready update; Tasks3/8 test restore and integrity.
3. A GitHub outage, malformed redirect or publication race must not amplify requests, regress version or count failed downloads; Tasks1/2/7 test these boundaries.
4. Returning from install-source settings is not permission to automatically start installation; Tasks4/5 require a fresh user action.
5. A superficially green browser/debug build must not be published with synthetic settings, the wrong certificate or a reused versionCode; Tasks6/7/8 enforce independent release evidence.

### Task1: Validated, cached release discovery

**Files:** Create backend services/androidReleaseManifest.js, services/androidReleaseService.js, routes/androidUpdates.js, tests/android_release_manifest.test.js, tests/android_release_service.test.js, tests/android_updates_api.test.js. Modify backend routes/public.js and .env.example. Add matching JSON fixtures under both repositories' test fixtures.

**Interfaces:** Implements the manifest and ReleaseResult above. ANDROID_UPDATES_ENABLED=false and ANDROID_RELEASE_DOWNLOADS_ENABLED=false are independent; ANDROID_RELEASES_REPOSITORY defaults to janeshkrish/resqnowfrontend. No GitHub write token or account token is needed for public discovery.

- [ ] Write tests rejecting wrong app/tag/host, invalid dates/versions/SDK/digests, encoded URL tricks, missing/mismatched assets, drafts/prereleases and oversized responses. API tests prove disabled/unavailable/ready without auth or DB calls. Test concurrent cache misses coalesce, positive TTL300s, failed lookups30s, 5s network deadlines and at most3 approved HTTPS redirects.
- [ ] Run node --test tests/android_release_manifest.test.js tests/android_release_service.test.js tests/android_updates_api.test.js; observe failures because the feature is absent.
- [ ] Implement strict validation, bounded GitHub release/manifest fetching, stable release selection, coalesced caching and the public router. Never fall back to an unvalidated/older release after a malformed latest stable candidate.
- [ ] Re-run the same tests; expect zero failures. Run npm run build and relevant existing public-route tests; commit this task only.

### Task2: Preserve website download behavior with streamed GitHub assets

**Files:** Create backend services/androidReleaseStream.js and tests/android_release_stream.test.js. Modify backend routes/public.js, tests/app_analytics_download.test.js and backend docs/android-in-app-updates.md.

**Interfaces:** streamAndroidRelease(req,res,{release,headOnly,fetch,onAccepted}) -> Promise<void>. handleAndroidApkDownload keeps existing behavior while the release-download flag is off; after activation it consumes getRelease() and the stream helper. Native direct asset downloads never use website session accounting.

- [ ] Add RED tests using a real loopback upstream for complete GET, HEAD, valid/invalid/suffix ranges,416, content-length mismatch, blocked redirects, upstream timeout/disconnect and client abort. Assert accepted-delivery accounting occurs only on completed successful website GET/206 responses, with the existing per-action deduplication behavior.
- [ ] Run node --test tests/android_release_stream.test.js tests/app_analytics_download.test.js; confirm the new expectations fail.
- [ ] Implement a bounded-memory streaming pipeline with upstream cancellation and approved HTTPS redirects, correct headers/range status, and no local filesystem publication. Preserve the existing local fallback only while the new source is disabled; an enabled but unavailable release fails explicitly.
- [ ] Re-run both files and Task1 tests, expect zero failures, then commit.

### Task3: Persistent native downloader and integrity state

**Files:** Create android/app/src/main/java/com/resqnow1/app/updates/{UpdateManifest,UpdateStateStore,UpdateDownloader,UpdateDownloadWorker}.java and matching JVM/instrumentation tests. Modify android/app/build.gradle for WorkManager2.11.2/test helpers without changing SDK levels.

**Interfaces:** WorkManager unique job resqnow-apk-update; generation-owned atomic state in no-backup storage; APK bytes in private cache apk-updates/. Automatic work requires UNMETERED; user-authorized downloads require CONNECTED. Worker/retry state maps to UpdateSnapshot.

- [ ] Add RED tests for strict manifest/URL validation, wrong package/version/SDK, hash/size mismatch, interrupted/oversized transfers, corrupt stored state, cache eviction, cancellation/replacement races and stale-generation completion. Exercise range resumption against a real controlled HTTP fixture; restarting from zero is mandatory if upstream identity/range validation fails.
- [ ] Run android/gradlew.bat :app:testDebugUnitTest with JDK21/D: cache and record the expected new failures.
- [ ] Implement bounded chunked HTTP with manual approved HTTPS redirects, time/size limits and stop checks; retries cannot bypass final full-file SHA-256. Use ordinary bounded WorkManager jobs, not an unbounded foreground service or privileged installer. Native release builds never allow HTTP; test-only loopback transport belongs in debug/test sources.
- [ ] Re-run native tests, verify state reconciliation after worker restart, and commit. Preserve existing analytics no-backup identity.

### Task4: User-confirmed system installation bridge

**Files:** Create AppUpdaterPlugin.java and updates/UpdateInstaller.java plus tests. Modify MainActivity.java and AndroidManifest.xml; add a separate updater FileProvider with res/xml/update_file_paths.xml scoped only to apk-updates/. Do not widen the existing image provider.

**Interfaces:** Implements all AppUpdater methods and updateStateChange. requestInstall rechecks bytes/package/version/SDK and the installed public signing-certificate compatibility; permission-required is a recoverable state, not success.

- [ ] Add RED tests for wrong signer, current/lower version, changed/evicted APK, denied source permission, installer cancellation and safe content-URI grants. API24/25 and26+ must follow the appropriate system permission paths. Settings return alone must never launch an installer.
- [ ] Run native tests and instrumentation cases against the new expected behavior; verify the missing implementation is the cause of failure.
- [ ] Register the plugin, add REQUEST_INSTALL_PACKAGES, and implement guarded private-cache handoff with read-only temporary grants and a resolvable system activity. On a new launch compare actual installed version; do not infer installation success from opening the installer. No self-uninstall/data clearing.
- [ ] Re-run native tests and assembleDebug; commit after all required checks pass.

### Task5: Non-disruptive customer/technician update controls

**Files:** Create frontend src/lib/appUpdates/{types,native,client,policy}.ts and tests, src/components/{AppUpdateProvider,AppUpdatePanel}.tsx and tests; modify App.tsx, pages/Settings.tsx, pages/technician/TechnicianSettings.tsx, vite-env.d.ts and .env.example. Add e2e/app-updates.spec.ts.

**Interfaces:** AppUpdateProvider supplies snapshot, check(), download({allowMetered}), cancel(), install(), openPermissionSettings(). VITE_APP_UPDATES_ENABLED=false by default. Check at start/resume with a6h success interval; bounded error backoff30s; fetch public API without auth cookies/tokens and cache:no-store. Reconcile native state before scheduling a new candidate.

- [ ] Add RED unit/browser tests for both roles, web exclusion, automatic unmetered scheduling, manual metered action, progress/retry/cancel, malformed/unavailable API, resumed downloads and permission settings return. Test route/technician accepted-job or pending-acceptance deferral for service submission, tracking/jobs, payments, OAuth and voice; use safe-screen allowlisting rather than guessing every dangerous route.
- [ ] Run affected Vitest and Playwright tests; observe missing-provider/control behavior fail before implementation.
- [ ] Implement a passive banner and reusable settings panel using current components. Never auto-install on completion or interrupt an existing workflow; recheck safety at click time. Clean up subscriptions/timers and handle StrictMode without duplicate work. Set updater metadata/API paths NetworkOnly in PWA caching.
- [ ] Re-run targeted tests and typecheck, then commit. Native bridges in browser tests remain simulations, not device acceptance.

### Task6: Deterministic release preparation and artifact verification

**Files:** Create frontend scripts/android-release.mjs, scripts/android-release.test.mjs and android-release.json schema fixtures; modify android/app/build.gradle for checked RESQNOW_ANDROID_VERSION_CODE/RESQNOW_ANDROID_VERSION_NAME overrides and environment-only release signing configuration. Add docs/android-in-app-updates.md.

**Interfaces:** prepareAndroidVersion({floor,runNumber,latestVersionCode}) -> {versionCode,versionName,tag}; verifyAndroidArtifact({apk,expectedManifest,tools}) -> validated manifest; runAndroidRelease({context,settings,runner,github}) supports dryRun. No helper logs secret values.

- [ ] Add RED script tests exercising version monotonicity/overflow, retry/tag conflicts, inaccessible/ambiguous history, wrong app/certificate, absent production build settings, synthetic-settings rejection and a dry-run that cannot publish. Use actual process exit/status and controlled command/API adapters, not source-text assertions.
- [ ] Run node --test scripts/android-release.test.mjs; observe new feature failures.
- [ ] Implement floor+workflow-run-number allocation within Android bounds, exact certificate/version verification through Android tools, sha256 manifest generation and upload/download digest checks. Existing published tags are never overwritten. First release requires an explicitly reviewed distribution floor/certificate; absence does not generate a new key.
- [ ] Re-run script tests and native Gradle override tests, then commit. No production key is required for synthetic helper tests.

### Task7: Gated main-push signing/publication workflow

**Files:** Modify frontend .github/workflows/frontend-verify.yml and scripts/android-release.mjs/tests; add owner setup instructions to docs/android-in-app-updates.md.

**Interfaces:** Retain reusable read-only checks. Add native checks and a later trusted-main release job with contents:write only on that job. Signing secrets are not exposed to verification/PR jobs. ANDROID_AUTO_RELEASE_ENABLED defaults off. workflow_dispatch supports verification/dry-run; publication additionally requires explicit owner activation.

- [ ] Add RED behavior tests proving pull-request/non-main/disabled/missing-check contexts cannot sign/publish; failed upload/digest checks leave the prior stable release untouched. Test concurrent/retried runs and draft-before-publish ordering through the real orchestration helper.
- [ ] Run the script suite; observe the unmet policy fail before implementation.
- [ ] Extend the existing workflow rather than running duplicate complete frontend gates. Use JDK21/SDK36 and production public build settings for the actual APK build. Serialize release jobs, materialize signing credentials only in private ephemeral runner files, remove them in finally/always cleanup, and never upload private intermediates. Publish resqnow.apk and android-release.json only after all checks.
- [ ] Re-run policy/script checks, validate workflow structure, and commit. Owner must configure secrets/settings and approve a hosted dry-run/first publication; do not mutate repository settings or upload keys automatically.

### Task8: Full verification, release prerequisites and Android acceptance

**Files:** Add frontend e2e-integration/app-updates.spec.ts, scripts/start-app-updates-e2e.mjs, playwright.updates.config.ts and native acceptance harness/tests. Update both runbooks and the plan-specific ignored ledger/evidence. Adjust release-blocking runtime/dependencies only through narrowly scoped reviewed fixes with regression tests.

**Interfaces:** Real local release API/HTTP fixture plus a browser bridge simulation for integration; independent disposable emulator serial for actual installation. No personal account data, production credentials or destructive emulator/global OS operations.

- [ ] Run a fresh complete frontend release:check in a source-identical secret-free D: snapshot; run the full backend suite with disposable DB tests enabled and complete-report verification, then npm run build. Record commands/counts, failures and skips honestly. Re-triage audit/runtime findings and validate any approved fixes without npm audit fix --force.
- [ ] Run updater browser integration with a real local API and all native unit/instrumentation tests; execute corrupt signer/hash/SDK/version, denied permission, offline/restart, stale worker and safe-workflow tests from Tasks1-7.
- [ ] On the expressly approved disposable emulator, install A, download/install B through the real update UI/system installer, and prove version increase plus retained synthetic settings/installation identity. Repeat cancellation/interruption/cache-eviction cases. Do not substitute adb install B for exercising the in-app installer. If emulator acceleration/boot is unavailable, report the exact unperformed acceptance instead of weakening checks.
- [ ] Independently review the complete two-repository diff, fix important findings RED-to-GREEN, re-run affected/full gates, and record the review result. Commit only verified changes.
- [ ] Hand off implementation/evidence and explicit activation steps. Complete means hosted dry-run, certificate continuity, first approved release and subsequent main-push update have actually succeeded. Missing secrets/permissions/native acceptance are activation blockers, not silently completed items. Request owner authority before any production publication or push.

## Self-review and execution handoff

Spec coverage: discovery/streaming Tasks1-2; persistent download and installer Tasks3-4; safe UX Tasks5; versioning/signing/CI Tasks6-7; security, real-device acceptance and activation Task8. Shared field/method names above are authoritative. All five Review Focus cases have owning task tests. Native WorkManager2.11.2 is a builder choice compatible with the existing SDK footprint; it provides managed retries while our downloader can enforce redirect/integrity rules directly.

Recommended execution: native/inline in this chat, since the backend, manifest, plugin and UI interfaces are tightly coupled; one independent whole-change review follows. Before implementation, owner reviews this plan and confirms the execution method. No app code or production settings were changed by writing the plan.
