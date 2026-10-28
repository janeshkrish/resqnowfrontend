# Android app analytics: build and acceptance

This adds optional first-party adoption reporting and `/admin/app-installs` to the existing portal. It does not implement an automatic APK updater or change voice/dispatch/payment logic.

Set `VITE_APP_ANALYTICS_ENABLED=true` only for an approved canary/release build. The default collector is off. Reporting is native Android only, behind optional consent; declining does not block app use. Guest controls are also on the Privacy Policy page, and signed-in controls are in customer Settings and the technician profile. Withdrawal remains available after disabling collection.

Identity/proof/consent live in an atomic file in Android's no-backup directory. Do not copy it, print it, back it up in test artifacts, or persist account JWTs in telemetry. Restarts/updates must retain this identity. Reinstall/clear-data should create a new one; corrupt storage disables analytics instead of silently generating more identities.

## Automated checks

- `npm test -- --pool=threads --maxWorkers=1`: frontend unit suite. On restricted Windows environments point TEMP/TMP at a writable isolated directory.
- `npm run build`: normal production build; supply the project's required API/Firebase environment without committing secrets.
- `npm run test:e2e -- e2e/app-installs.spec.ts --trace=off`: mocked-backend portal layout/error tests; these do not prove persistence.
- `npm run test:e2e:analytics`: actual loopback backend plus disposable database and phone/desktop Playwright. Start a local MySQL-compatible server on port 13307 with the synthetic test password, and set APP_ANALYTICS_BACKEND_DIR if the backend is not ../backend or ../resqnowbackend. The backend docs describe the allowlisted test database. The dedicated Vite config ignores local production `.env` and uses synthetic settings.
- `cd android` then `./gradlew :app:testDebugUnitTest`: native Java/state tests; needs the supported JDK/SDK. Run Capacitor sync after a web build before compiling a packaged APK.

The real API tests use a browser-native bridge simulation. They prove HTTP/auth/DB behavior, not no-backup storage or signed APK update compatibility. Screenshots go under ignored output/playwright; traces are off to avoid retaining proofs/tokens.

## Android release gate

Use a disposable emulator, targeting its explicit adb serial (never an attached personal phone). Test clean native install/open, no reports before opt-in, offline opt-in/reconnect, kill/relaunch, both authenticated roles/account switching, withdrawal/re-consent, and version reporting. Install a second debug-signed higher-version build in place to verify update retention; clear-data/reinstall must create a new native identity. Validate backup/restore separately on the supported Android versions. Preserve sanitized counts/results, not secrets.

A debug-signed emulator update does not prove compatibility with the distributed release APK. Before publication compare the public signing certificate of the current distributed APK with the intended release certificate, confirm the same application ID com.resqnow1.app, and choose a versionCode higher than every distributed build. Do not read/copy keystore passwords into Git/logs and never silently require users to uninstall. Current source version metadata is not automatically bumped by analytics implementation.

Backend must complete its additive migration and canary rollout first. Download sessions, reported first opens and distinct linked accounts are deliberately separate. Opted-out/offline/old-release users are not fully covered, and no historical/current physical-install total can be inferred. Backend docs cover retention, independent collection/retention flags, proxy/rate limits, kill switch and production approval gates.

Implementation verification, independent review fixes, deferred minors and release gates: [28 October handoff](analytics-acceptance-2026-10-28.md).
