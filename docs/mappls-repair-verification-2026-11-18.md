# Mappls APK repair: verification and handoff

## Scope and diagnosis

Changes are in `D:\resqnow-production-code\resqnowfrontend` on `main`. No backend workflows, Mappls account settings, signing identity, release flags or installed apps were changed. This repair did not push, publish or replace the public APK.

The public v1.3/versionCode 4 APK inspected on 17 November packaged an older public Web SDK key (SHA256 prefix `f00437b2247e`) that returned HTTP 401 `ASSET_ACCESS_DENIED`. The website and intended local production setting matched a different public key (`a8ac0cf72457`). The latter separately returned HTTP 403 `DAILY_LIMIT_EXHAUSTED`; the user deferred provider quota/billing work. No Android-origin-only restriction was established.

This APK uses the hybrid Mappls Web SDK at Capacitor's `https://localhost` origin, not the native Android Mappls SDK. A separate native credential is not part of the current integration. Updating a website or dotenv does not update assets already installed in an APK.

## Changes

- `npm run android:sync` builds native-mode production web assets, verifies their actual entry/import graph and SDK key readers, then syncs and checks Capacitor's copied files.
- A reviewed, source-controlled SHA256 pin rejects an outdated environment/CI key before any native preparation command. Only the hash is committed; intentional rotation requires reviewing the pin alongside public settings in both website and APK environments.
- The existing release adapter uses the same preparation and verifies the finished APK's actual web assets and native origin. Existing signing, version and publication gates remain intact.
- Synchronous SDK initialization exceptions use the existing map error/Retry panel instead of escaping to the global error boundary. Existing map/tracking contracts and cleanup remain unchanged.

## Evidence

All implementation, test output, temporary files and build artifacts for this repair are on D:. Builds/tests used controlled providers or static inspection, not paid Mappls calls.

| Check | Result and evidence under `output/quality/` |
| --- | --- |
| Current root TypeScript check | `tsc --noEmit --pretty false`, exit 0 on 18 November |
| Current root script tests | 81 passed, 0 failed/skipped; `mappls-resume-all-node-tests-network.log` |
| Current root map-provider units | 35 passed across 3 files; `mappls-resume-current-runtime.log` |
| Full unit regression snapshot | 1,055 passed across 127 files; `mappls-all-unit-tests-final.log` and `u-map17/output/quality/mappls-unit-final.json` |
| Customer tracking browser suite | 51 passed, 5 existing responsive exclusions, 0 retries; `mappls-tracking-browser-all.log` |
| Browser RED/GREEN proof | Old loader reached the real global boundary in both viewports; fixed loader passed both failure/Retry regressions; `mappls-browser-red-evidence/` and `mappls-browser-green.log` |
| Current native web preparation | Real `npm run android:sync` passed build, sync and asset checks; `mappls-native-sync-current.log` |
| Debug APK assembly | 151 tasks executed successfully in isolated D: snapshot; `mappls-snapshot-debug-build-final.log` |
| Final artifact inspection | Reviewed key, current synced assets and assembled debug APK reverified successfully on 18 November; 166 reachable files in the verified build graph |
| Focused independent review | 0 Critical, 2 Important findings; both reproduced with failing tests and fixed. Import/manifest mismatch and unlabeled/computed key-reader regressions pass. |

The full unit/browser runs used the source-matched, secret-free `u-map17` snapshot. The 11 relevant Mappls/build/browser files and dependency lock were subsequently compared with the current checkout without differences. This is not a claim that later, unrelated voice edits received another full unit/browser run.

Initial runs are not concealed: one full-unit run had a configuration-test timeout during concurrent builds; that unchanged test passed alone and the subsequent full run passed. On 18 November, four localhost fixture tests failed under restricted networking; a minimal diagnostic returned `connect EACCES 127.0.0.1`. After granting local-test network access, all 81 script tests passed without source changes. The shared Gradle cache also failed with a generated Groovy closure class error; no shared caches were deleted. The isolated D: native build succeeded after normal Capacitor sync supplied generated Cordova assets.

Verified debug artifact:

- Path: `output/quality/u-map17/android/app/build/outputs/apk/debug/app-debug.apk`
- Size: 27,751,488 bytes
- SHA256: `33d97a738442a0687131ec1a7c030c9dbfe5ff7f2ff1ec8bef3fbb771a70bb2f`
- Debug-only: not production signed, installed or published; not offered as an update for an existing production installation.

## Remaining release/runtime acceptance

1. Resolve provider authorization/quota with Mappls. Packaging checks cannot grant entitlements or make exhausted quotas usable.
2. Build a higher-version production APK using the established production signing identity and approved live public configuration. The separate updater release checks still apply; the local Razorpay public ID was test-mode, so this debug verification is not a shippable production release.
3. On the approved emulator/test device, verify real SDK/tile loading, customer and technician maps, permissions/location, towing/non-towing tracking and recovery after a provider/network failure.
4. Complete the production release review before distribution. The earlier no-publication constraint remains: APK auto-publication has not been confirmed disabled, so no GitHub push was performed by this repair.

Existing installed APKs have not changed. Live Mappls rendering and Android runtime acceptance remain unverified; this handoff completes the scoped code/build hardening, not those external release steps.

### Continuation preflight, 18 November

Rechecked public configuration without printing credentials: the Mappls key matches the reviewed fingerprint, the API is the approved Railway origin and native mode is enabled for native preparation. The local Razorpay public ID is not live-mode and app updates are not explicitly enabled; neither was silently changed. The configured local emulator's `-accel-check` returned code 6 (Hyper-V detected, but required acceleration unavailable); no Windows features were changed or previously failing software-emulation loop repeated. The GitHub settings page is signed out, so the publication variable and approved hosted release settings remain unread. The browser was handed to the user for sign-in; no push, signing or hosted job was initiated. Concurrent voice-document edits were left untouched.
