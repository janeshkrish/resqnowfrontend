# Android APK updater

Implementation is in the regular frontend/backend main checkouts. A local commit is not a deployment. Production publication and update offers remain disabled until the owner accepts the release and hosted Android tests.

## Delivery and user flow

The backend serves `GET /api/public/android-app/update` with disabled/unavailable/ready states. A validated release is hosted at `janeshkrish/resqnowfrontend`, tag `android-v<versionCode>`, assets `resqnow.apk` and `android-release.json`. The website's download endpoint preserves its delivery analytics; a native background download is not a website download session.

Both signed-in roles get the same native updater. Background downloads require unmetered networking unless the user explicitly selects mobile data. Installation needs a fresh safe-screen action, no active customer work, and no online/accepted/pending technician job. Android confirms installation. Returning from unknown-source settings never triggers installation automatically.

An update verifies file size/hash, application ID, increasing version, SDK metadata and the installed signing certificate. APK bytes are private cache files. Persistent updater state is separate from analytics identity. An interrupted/cancelled older generation cannot promote a newer candidate. Cache loss or corrupt state is recoverable by retrying, never by clearing app data.

Packaged builds set `VITE_NATIVE_BUILD=true` to omit PWA registration. A native version-change listener unregisters only the old own-origin `sw.js` and clears Workbox precache/page/static-code caches, with at most one reload. It does not clear login storage, cookies, databases, API/image caches or installation identity. The normal website remains a PWA.

## Gates and release identity

Defaults: `VITE_APP_UPDATES_ENABLED=false`, Gradle `RESQNOW_APP_UPDATES_ENABLED=false`, backend `ANDROID_UPDATES_ENABLED=false`, backend `ANDROID_RELEASE_DOWNLOADS_ENABLED=false`. These are independent. A native updater bootstrap APK must explicitly enable both frontend and Gradle gates. Existing APKs need that first manually installed bootstrap; a GitHub push cannot add a native plugin to an already-installed older APK.

Source defaults remain versionCode4/versionName1.3. Release builds must supply paired checked Gradle properties `RESQNOW_ANDROID_VERSION_CODE` and `RESQNOW_ANDROID_VERSION_NAME`. Allocation is reviewed floor + GitHub workflow run number, never a timestamp. Candidate codes must exceed both reviewed distributed maximum and all reserved release history. Overflow, rerun attempts, reused tags and inaccessible history fail closed. Rollbacks use a new, higher code.

Before signing, the owner must confirm the highest version ever distributed and the existing production signing certificate. A local distribution APK was inspected: code4, package `com.resqnow1.app`, certificate SHA-256 `3874c317a48dcd014c0665786a139246890bb0f951561097eb7d2d732bcf6826`. This alone does **not** establish the identity of every previously distributed APK. Do not replace the production key.

Signing is environment-only: `RESQNOW_ANDROID_KEYSTORE_PATH`, `RESQNOW_ANDROID_KEY_ALIAS`, `RESQNOW_ANDROID_STORE_PASSWORD`, `RESQNOW_ANDROID_KEY_PASSWORD`. Never commit keys/passwords, copy them into web variables, print them, or include signing intermediates in artifacts. Unsigned/unconfigured release builds are refused; debug builds keep the usual debug key and are never production artifacts.

The release verifier independently runs Android badging and signature tools, rejects debuggable/debug-signed/wrong-version/wrong-package/wrong-signer APKs, hashes actual bytes before and after inspection, and generates the strict manifest. Required production public Firebase/API/maps/payment settings are explicit and cannot use the synthetic verification configuration. Android Firebase config must match the approved project and package.

## Verification / outstanding activation

- Frontend: `npm run typecheck`, `npm run test:scripts`, `npm test`, `npm run release:check` in a secret-free snapshot.
- Real API/browser integration: `node node_modules/@playwright/test/cli.js test --config=playwright.updates.config.ts`. Native/auth boundaries are test-only simulations; the backend release router and React controls are real.
- Android: JDK21/SDK36; `android/gradlew.bat -p android :app:testDebugUnitTest :app:compileDebugAndroidTestJavaWithJavac :app:assembleDebug --no-daemon`.
- Hosted Android acceptance after review/approved push: actual A-to-B in-app download and system installer confirmation, frontend version marker change, retained synthetic settings/installation identity, plus interruption/cancellation/permission/integrity/SDK cases. Local emulator boot failed; compiled instrumentation is not a runtime pass.
- Owner setup, hosted dry-run, verified production signing continuity, first approved publication and a subsequent main-push update must actually succeed before the feature is called end-to-end complete. No key upload, repository-setting changes, push/publication, production flag changes or business DB migrations are authorized by implementation alone.
