# Mappls APK Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans inline. Use observed RED-to-GREEN tests; one focused final review, no implementer agents.

**Goal:** Prevent an APK from silently packaging stale/wrong Mappls configuration and contain SDK initialization errors.

**Architecture:** Retain the existing Web SDK and local Capacitor origin. Verify actual Vite output, synced assets and APK contents against the approved public key; share native web preparation between a local sync command and the existing release adapter.

**Tech Stack:** Node22, Vite6/Rollup AST, existing fflate ZIP reader, React18/Vitest, existing Capacitor8/Android tools.

**Spec:** docs/superpowers/specs/2026-11-17-mappls-apk-repair-design.md

## Global Constraints

- Edit only normal D: frontend main; do not stage, reset, overwrite or commit unrelated font/account/voice work.
- No backend behavior, Mappls account/quota, signing identity, publication flags, private-key access or device installation changes.
- Keep https://localhost and existing SDK; do not weaken origin, navigation or TLS protections.
- No online quota checks in builds/tests. Missing billing/license access is not solved by application code.

## Review Focus

- A matching key in unused text must not conceal a mismatched real key reader.
- Orphan chunks, stale index HTML or stale copied assets must not count as current app code.
- Verification must inspect the final APK and reject a development server URL or wrong scheme/hostname.
- Errors must not disclose compiled keys; ZIP/manifest reads must remain bounded and within their roots.
- Synchronous provider exceptions must reach the existing map retry fallback without breaking other screens.

### Task 1: Artifact and native-build guards

**Files:** Create scripts/mappls-artifacts.mjs and .test.mjs; modify scripts/android-release-build.mjs and .test.mjs. Add scripts/android-web-assets.mjs, its test, package.json android:sync command and a short runbook.

**Interfaces:** verifyMapplsDist({dist,key}) returns reachable files; verifyMapplsNativeAssets({root,key}) and verifyMapplsApk({root,apk,key}) validate actual assets/configuration; prepareAndroidWebAssets({root,publicSettings,env,run}) runs isolated Vite/Capacitor preparation. Existing release build consumes the prepared assets and checks final APK.

- [x] Write tests for real emitted code, wrong/missing key, matching-key decoy, orphan/traversal manifest, stale copied assets and APK, wrong native origin, valid output, redacted errors, isolated commands and refusal before signing.
- [x] Run Node tests and observe expected RED before implementing exports/behavior.
- [x] Implement focused bounded verifiers, preparation, local sync entry point and release adapter wiring without reading private credentials into web children.
- [x] Run Node tests to GREEN and real native-mode static build/artifact checks using controlled public settings. Document no live provider/device proof.

### Task 2: Contain initialization errors

**Files:** src/lib/mapProvider/MapplsMapSurface.tsx and .test.tsx.

- [x] Add a synchronous SDK loader failure/retry regression; observe RED.
- [x] Normalize loader invocation through the promise chain; retain existing UI/cleanup.
- [x] Run the complete map SDK/map surface/places/tracking unit suites, typecheck and relevant browser checks.

### Task 3: Verify and hand off

- [x] Run full Node scripts and unit suite in a source-matched, secret-free D: snapshot; record unrelated failures rather than altering concurrent voice work.
- [x] Build/inspect current native web and APK artifacts as feasible without production signing credentials; explicitly distinguish synthetic verification from a shippable APK.
- [x] Focused independent review and fix Important findings with RED-to-GREEN tests.
- [x] Report exact verified changes and remaining provider/production signing/device gates; no automatic push or publication.

## Handoff

See [the verification record](../../mappls-repair-verification-2026-11-18.md) for exact results and limitations. These completed implementation tasks do not assert live Mappls access, Android runtime acceptance, production signing or deployment. Changes remain in the normal D: frontend `main` checkout; this repair did not push or publish anything.
