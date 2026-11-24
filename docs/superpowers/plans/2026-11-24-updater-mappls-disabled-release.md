# Updater Bootstrap Without Mappls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this approved extension inline. Preserve the prior Android updater plan/evidence; one focused independent review covers this delta.

**Goal:** Deliver a production-signed updater bootstrap to new website installers with native maps explicitly disabled, preserving all map code.

**Architecture:** A strict paired web/native build flag gates map entry points and native registration. The existing release builder retains artifact/signing/integrity checks and relaxes only the approved native-map prerequisite when maps are explicitly disabled. Publication and Railway activation occur only after signed artifact verification.

**Tech Stack:** React/Vite, Capacitor/Java/Gradle, Node22, existing GitHub Releases and Railway adapters.

**Spec:** `docs/superpowers/specs/2026-11-24-updater-with-mappls-disabled.md` (owner-approved release scope).

## Global Constraints

- Work in the regular D: production frontend/backend main checkouts; preserve both owner Thozhan notes and friend changes.
- Defaults retain enabled maps. Web maps remain unchanged. No map implementation deletion or replacement.
- No new signing key, private-key upload, password logging, personal-phone install, paid provider call, production DB change or unattended installation.
- Website delivery and update discovery stay off until a real, verified release exists.

## Review Focus

- Disabled Android UI must not load native or web map renderers or perform native place search (Task1).
- Missing/true mode must retain the native license guard; typos/mismatches cannot disable it (Tasks1-2).
- Direct Gradle release producers must enforce mode agreement plus all existing signing/updater gates (Task2).
- A disabled release must retain the native updater and approved production settings, with unchanged website rendering (Tasks1-3).
- Failed build/sign/upload must leave current website/download configuration intact; original production signer and increasing version required (Task3).

### Task1: Reversible Android map boundary

**Files:** `src/lib/mapProvider/PlatformMapSurface.tsx`, its tests, `nativeMapBridge.ts`, its tests, `nativeMapTypes.ts`, `src/vite-env.d.ts`.

**Interfaces:** `VITE_NATIVE_MAPPLS_ENABLED=false` produces a deliberate Android-only map fallback and `DISABLED` bridge availability; absent/true retains existing behavior.

- [ ] Add UI/bridge tests: false Android loads neither renderer and performs no native map/search calls; false web still renders the web map.
- [ ] Observe RED against existing behavior, implement the minimal gate, and run complete map/provider and updater unit tests GREEN.

### Task2: Strict native/build mode

**Files:** `android/app/mappls.gradle`, `android/app/build.gradle`, `MainActivity.java`, `scripts/android-release-build.mjs`, its tests, `scripts/android-release.mjs`, its tests, release workflow/runbooks.

**Interfaces:** normalized public flag maps to exact Gradle `RESQNOW_MAPPLS_ENABLED` boolean, BuildConfig registration gate and manifest mode metadata; false does not require provider files, true still does. Contradictory web/native modes fail before signing.

- [ ] Add behavior regressions for explicit false without a pair, malformed settings, preserved default guard and exact Gradle/public flag forwarding; observe RED.
- [ ] Implement minimal flags/registration/build guard changes. Keep existing signing/updater/asset checks and web-key verification intact.
- [ ] Run complete Node scripts, fresh native JVM/instrumentation compilation and direct Gradle producer negative checks (default map mode and mode mismatch) GREEN. No signed build during negative checks.

### Task3: Verification, original-key signing and controlled rollout

**Files:** existing release scripts/runbooks plus narrowly scoped secure local signing helper if required; ignored evidence under D: output.

- [ ] Create a new secret-free D: source snapshot; run typecheck/unit/browser/build release gates with honest counts and scoped source hashes. Never refresh a running/passing snapshot.
- [ ] Obtain one focused independent review of this delta, resolve important findings RED-to-GREEN and preserve minor findings in the ledger.
- [ ] Commit/push only verified task files to main, preserve concurrent work, run exact-head hosted checks and real Android upgrade acceptance with maps disabled.
- [ ] Reconfirm release history and version floor. Request owner password entry in a secure local prompt only after prerequisites pass; never request it in chat or export the keystore.
- [ ] Build with native/web updater true, maps false, automatic wake false and approved Railway public settings. Verify package/version/SDK/production certificate, native updater registration/mode metadata and packaged assets independently.
- [ ] Publish only `resqnow.apk` + `android-release.json` as a stable `android-v<code>` release, independently verify public digests. Then activate the two approved backend delivery flags and verify website/update endpoints match the release.
- [ ] Record any unperformed live subsequent-release test explicitly; no completion claim from synthetic acceptance alone.
