# Android updater production delivery — 23 November 2026

Production rollout is still incomplete. Source changes are in the normal D: frontend/backend main checkouts. No production APK has been signed/published, website APK replaced, private keystore uploaded, update/publication flag enabled or production database migrated by this continuation.

## Latest integration checkpoint

The complete4875917-based frontend gate finished successfully, exit0:88 Node tests,1,110 unit tests/139files,470 browser passes plus22 approved viewport exclusions/0retries, and build16.68s. Evidence inside nysMHR: `output/quality/runs/c95a4db4-1982-489f-b8bc-b5978e6823ec/summary.json`.

Another main update then arrived: frontend eda7998 changes only account/tracking test fixtures; backend35be350 overlaps the audit/session-migration fixes. Both histories are being preserved. The latest frontend fixtures will be integrated and both complete affected browser files rerun; application/native/build-script source is unchanged by that incoming frontend commit. Do not claim a single source-exact monolithic run covering those later fixture changes until GitHub runs it.

Backend integration also caught GeoIP2's declared Node24+ requirement, incompatible with this project's Node22 contract. A new compatibility test reproduced that failure. The final candidate retains main's Node22-supported GeoIP1.4.10 with its explicit patched ip-address10.7.6 override; actual constructor, IPv4, IPv6 and mapped-IPv4 lookup regressions passed3/3. GeoIP2 was an undeployed trial, not the final supported dependency choice. Full merged backend verification and fresh audits are required before its merge/push is finalized.

## New main-branch integration blocker

After the full gate passed, the final pre-push fetch found frontend main advanced from66814bb to48759173fe60531108c71441a15607058ee6f135 (58 changed files, including native Mappls SDK/plugin and technician registration changes). Fast-forwarded the regular D: frontend main only after proving zero overlapping dirty paths; all33 existing modified/untracked files were SHA-256 checked unchanged afterward. No reset/stash, replacement of owner work, commit or push occurred.

The new Android map path selects the native Mappls plugin on Android, not the previous Web SDK integration. `android/app/mappls.gradle` requires matching approved `<appId>.a.conf` and `<appId>.a.olf`; there are zero such files in the local Android app directory. The Web Maps public key is not a substitute. The release adapter now rejects missing/mismatched/ambiguous/empty/non-regular pairs before build commands; its regression was RED then9/9GREEN. This metadata-only check is not provider authentication. Hosted configuration provisioning and live native acceptance still need the approved provider files. Do not disable the native path or use dummy licenses to force a release.

All frontend/native/production-web-assets results below qualify the reviewed66814bb-based snapshot, NOT the newly integrated4875917 source. The earlier source comparison was valid before that fast-forward, not afterward. Backend remains unchanged and its341-file comparison/908-test evidence still applies. No automatic publication/signing setting was changed; both pushes are held rather than treating the older gate as proof of the newer native implementation.

Continuation after the owner's request: new-main native compilation and85/85 JVM tests (17reports,140 rerun tasks) passed, and current production-configured web assets built/synced with emitted/native-byte verification. No provider authentication or signing was performed. The new direct-release guard was reproduced RED then GREEN; review additionally identified direct bundle-producer task names, now included in the guarded set and undergoing negative graph checks. The partial new-main frontend run was stopped for that review fix and is not a passing gate. Fresh final combined-source verification is still required.

The owner is unsure whether the approved native provider files are available. No files are supplied locally and no upload/provisioning authority is inferred. The focused guard changes preserve the new native implementation and keep production builds fail-closed; secure CI provisioning is still pending, not implemented by a dummy license or copied Web key.

## Current combined-source checks (in progress)

The final reviewed-fix source is frozen in independent D: snapshots nysMHR(frontend) and KrFtGc(native),1118files/SHA-256 `0f10fe8af15d1412f9b79272405aa5999ca0fd08b10a55b31d1b2f881fa143ce`, based on4875917. The complete frontend gate has passed typecheck,88/88 Node script tests and1,110/1,110 unit tests in139files;492 phone/desktop browser checks and its final build are still running. Log: `updater-newmain-full-postreview-20261123.log`; reports inside nysMHR: `output/quality/runs/c95a4db4-1982-489f-b8bc-b5978e6823ec`.

Current native verification executed140 Gradle tasks,85 JVM tests/17reports/0failures/errors/skips, and compiled consent instrumentation. The shipped CI guard driver checked all5 direct APK/bundle producers against the missing-provider-files case without executing a release/signing task. Current real-router browser integration passed6/6,0retries,15.3s; the native bridge is simulated. Production-configured web assets subsequently built/synced and passed emitted/native-byte verification in the separate native snapshot. No SDK license acceptance, signed APK or actual installation is inferred from those results.

A filename-only search of D: project folders found no provider pair (generated outputs excluded). Source comparison before later reporting edits found no application/native/script differences from the frozen frontend; only README differs. Backend341files still match its908-test passing snapshot. Earlier complete frontend/native numbers in the following historical section must not be substituted for completion of the current run.

## Completed continuation work

- Preserve the owner's new page-visit work. Account tests now fulfill navigation telemetry separately while retaining all account-data mutation assertions;25 tests passed plus one existing responsive exclusion.
- Production native automatic wake is explicitly off, as the owner approved. Both the background listener and restored wake URL honor the same eligibility policy. A review-found capture bypass was reproduced RED and fixed;27 related hook/page/component tests and12 wake browser cases passed. Manual microphone use remains available when server policy permits it.
- The actual hosted A-to-B attempt exposed a test-driver incompatibility: Playwright tried unsupported desktop download management against Android WebView. The adapter regression was RED then5/5GREEN with documented `noDefaults`; real A-to-B must still be rerun. Added bounded synthetic-emulator UI diagnostics for the unresolved legacy consent cases without changing their assertions/permission requirements.
- The friend's GeoIP dependency introduced a high advisory through ip-address5.9.4. Parser and actual bundled-data lookup regressions were added RED-to-GREEN; the initial GeoIP2 trial was superseded by the Node22-compatible integration described above. No tracking code was removed.
- The new page-visit browser session is classified as an opaque identifier only for that table. Unrelated unmodeled session IDs still fail closed; all active tables retain UUID primary keys. Updated stale table-count fixtures. Only test doubles/disposable analytics DBs were used, not production migration commands.

## Verified checks

- Backend full suite:908/908 passed,0skips; complete-report verifier accepted it.287 JavaScript syntax checks passed. The341-file secret-free snapshot matches current backend source.
- Fresh advisory reports: frontend0high/critical (16moderate); backend0high/critical (7moderate/1low).
- Fresh native checks:137 Gradle tasks executed successfully,14 JVM reports/70 tests with0failures/errors/skips, and updated consent instrumentation compiled.172 tracked Android files were copied/verified in the isolated D: snapshot. This is compile/unit evidence, not installation acceptance.
- The complete frontend gate finished successfully, exit0, exclusively in `output/quality/updater-release-20261118-M1LzLx`: typecheck,83/83 Node script tests,1,075/1,075 unit tests in131files,468 browser passes plus22 approved viewport-only exclusions (245 source cases, both projects,0retries), and final build13.20s. Fresh evidence: `output/quality/runs/74e23fa6-1ed9-4588-9a49-9c85899bd1d6/summary.json` inside that snapshot; log `updater-release-gate-exclusive-20261123.log`. The preceding postreview attempt was invalidated after a concurrent integration server replaced its shared Vite dependency cache. Failure evidence is retained; no technician assertions/timeouts were weakened.
- After completion, source comparison found no application/native/script/configuration differences between the current frontend and the passing snapshot; only two reporting documents differ. All341 backend source files match its passing snapshot. No private dotenv/signing files were included in either comparison.
- Real-router updater browser integration passed6/6 cases,0retries. Native bridge behavior in these browser checks is simulated, not Android install acceptance.
- A separate production-configured native web-assets build passed in18.06s; Capacitor sync and Mappls emitted/native asset verification passed. This is not a signed APK or live provider/device acceptance.
- Earlier interrupted/stopped/typecheck-failed runs remain incomplete/failed and are not combined into a passing full gate.

## Hosted Android result and remaining acceptance

[Verification-only run45116117621](https://github.com/janeshkrish/resqnowfrontend/actions/runs/45116117621) ran against existing remote main66814bb, before this continuation's uncommitted fixes. Native verification and ordinary instrumentation on API24/26/36 succeeded. Separate real A-to-B and legacy consent API24/26 jobs failed; the Android release job was skipped. This is not a successful end-to-end update.

API24 failed returning from Security settings; API26 reached the installer but did not find its explicit Cancel control. Current code adds foreground/window diagnostics so the next hosted attempt can identify the actual UI before changing behavior. Those failures are not waived or claimed fixed.

## Release configuration and identity

- Signed-in in-app GitHub access was successfully used to inspect settings: repository variables and signing secrets were absent. Automatic publication was therefore off. The browser-control tool subsequently became unavailable again; do not ask for another login, use an external browser or extract browser credentials.
- The existing backend local public payment setting contained a JavaScript-style inline `//` comment including an old test ID. Normalized that local comment and copied only the live public ID into the ignored frontend production override. No server secret was copied or printed. The merged production public settings, approved Railway API origin, Mappls fingerprint and Android Firebase project/package validation now pass offline. No real payment or paid Mappls request was made; provider operation/billing is not proven by configuration validation.
- APK inventory found the existing production signing certificate on versions1/4/5/6/7. The owner confirmed7 is the highest distributed/installed version; use a reviewed floor of7 and still validate newer release/tag history. GitHub currently has no published releases. Inventory evidence: `output/quality/updater-local-apk-inventory-20261123.json`.
- The owner has the existing keystore password and can enter it securely. Signing credentials are not configured in the build environment or GitHub; no password/key belongs in chat, source or logs. Private-key upload requires specific owner approval and secure handling, not an assumed permission from code implementation.

## Still required before publication

1. Finish the final combined-source frontend/native gates after the focused release-guard fixes, preserving all owner/friend work. Locate/obtain the approved native configuration/license pair and implement its reviewed secure hosted provisioning before a production build. The older complete gate must not be reused to qualify4875917.
2. Run the corrected driver/new diagnostics on hosted emulators; fix/retest any actual return/cancel failure, and prove real Android-confirmed A-to-B installation with retained data.
3. Configure reviewed GitHub public variables and securely provision the existing signing identity; run a signed non-publishing dry-run and verify certificate/version independently.
4. Obtain first-publication/activation confirmation, publish the verified bootstrap APK, then enable website delivery/update offers and verify a subsequent main-push upgrade.

Existing old APKs lack the native updater and require one manually installed higher-version, same-signature bootstrap. Never uninstall/clear data. Subsequent downloads can be automatic; Android installation remains user-confirmed.

Deferred minor from the scoped independent review: Settings fallback wording can promise manual microphone availability when the server intentionally disables voice/recognition. Server switches still prevent capture; this wording issue does not bypass them.

The small, newly discovered catalogue correction received a focused extension of the same independent review: no Critical/Important findings. A second deferred minor concerns mixing globally named and fully-qualified exceptions in one set; a hypothetical literal dotted column could match globally, although normal unrelated session IDs are still rejected and current schema identifiers do not use that shape.

The new native-file guard delta received a focused extension of that same review seat. Direct bundle-producer coverage was reproduced RED and fixed, then all5 producer checks passed with the shipped driver. A third deferred minor is direct Gradle's symlink policy differing from Node's no-follow policy; the reviewer confirmed no harmful supported automated-APK path or licensing/signing bypass. No provider file contents were read to investigate it.
