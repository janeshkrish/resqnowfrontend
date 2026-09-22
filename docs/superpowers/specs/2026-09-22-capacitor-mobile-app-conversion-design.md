# Capacitor Mobile App Conversion

## Objective

Convert the current ResQNow React/Vite web application into a mobile-ready Android application using Capacitor. The Android package must contain the latest frontend, including the September 18 customer live-tracking redesign, and continue using the current backend APIs and realtime services.

This is a fresh Capacitor package. It is not required to update the previously published APK in place because the private key for that APK's Android Debug certificate is unavailable. Devices with the old package may need to uninstall it before installing the new build.

## Current State

- The React/Vite frontend and Node/Express backend are separate Git repositories in the shared workspace.
- `capacitor.config.ts` identifies the Android app as `com.resqnow1.app`, names it `ResQNow`, and uses `dist` as `webDir`.
- Capacitor 8.1.0 and the App, Geolocation, Push Notifications, and Splash Screen plugins are installed.
- The Android source contains custom Firebase notification services, emergency alert handling, permissions, splash resources, and the `com.resqnow1.app` package namespace.
- `android/app/src/main/assets/public` and generated Cordova bridge files are absent, so Gradle cannot currently configure the application.
- The APK served by `resqnowbackend/public/downloads/resqnow.apk` contains an older 69 KB `RequestTracking` bundle. The current frontend produces a 95 KB tracking bundle with the redesigned mobile experience.
- The current public APK uses Android v2 signing with an Android Debug certificate. Its signing key is unavailable.

## Chosen Approach

Use a deterministic local-bundle Capacitor workflow:

1. Build the current Vite application with the configured production API and public service credentials.
2. Synchronize `dist` and installed Capacitor plugins into the Android project.
3. Compile a newly debug-signed APK for immediate installation and end-to-end testing.
4. Verify that the native assets exactly match the current Vite build before publishing the APK through the backend.
5. Keep production release signing external and credential-driven so no signing material is committed.

The application will not point its WebView at a hosted frontend. Bundling the web assets preserves a predictable release, startup reliability, and the existing PWA/native fallback behavior.

## Architecture

### Web application

The existing React application remains the only UI implementation. No mobile fork or duplicate page tree will be introduced. Capacitor loads the production Vite output from `dist` inside its Android WebView.

The current responsive layout, mobile navigation, customer tracking dock, technician portal, service-request flows, authentication, payments, and admin routes remain driven by the same React Router application. Existing `Capacitor.isNativePlatform()` branches continue to select native behavior where required.

### Backend and realtime communication

The packaged application uses `VITE_API_URL=https://resqnowbackend.onrender.com` at build time. REST and Socket.IO traffic continue through the centralized frontend API and socket clients. No backend route, database schema, Redis stream, dispatch workflow, or live-tracking contract changes are required for packaging.

Capacitor navigation and Android network configuration must permit the production HTTPS backend while retaining localhost support for authorized development. The packaged application must not embed backend secrets; only existing client-safe `VITE_*` values may enter the bundle.

### Native Android shell

The existing `android` project remains authoritative for native code and resources. Synchronization must preserve:

- package/application ID `com.resqnow1.app`;
- Firebase configuration and the custom `MyFirebaseMessagingService`;
- job alert, foreground service, emergency notification, and full-screen notification behavior;
- internet, location, notification, wake-lock, and foreground-service permissions;
- splash screen, launcher icons, and Android theme resources;
- Capacitor App, Geolocation, Push Notifications, and Splash Screen plugins.

Generated Capacitor files and copied web assets remain ignored by Git and are recreated for each build. Handwritten Java, manifest, Gradle, and resource files remain tracked.

## Build and Synchronization Workflow

Add explicit npm scripts and a small verification utility so future mobile packages use one repeatable sequence:

1. `npm run build` creates the production web bundle.
2. `npx cap sync android` copies web assets and regenerates native plugin files.
3. A verification step compares the synchronized native entry point and referenced hashed assets with `dist`, validates Capacitor configuration and required plugins, and fails on missing or stale files.
4. Gradle assembles the Android debug APK.
5. The resulting APK is verified for signature validity and inspected to confirm it contains the same current hashed frontend entry assets.
6. Only the verified artifact replaces `resqnowbackend/public/downloads/resqnow.apk`.

The workflow must fail immediately when required environment values, Android SDK components, generated Capacitor files, native assets, or APK output are unavailable. It must not silently publish a previous build.

## Versioning and Signing

The new Android package uses `versionCode 2` and `versionName 1.1.0` to distinguish it from the existing package metadata.

For this task, Gradle may create a new local Android Debug key and use it to produce an installable test APK. The key is local machine state and must not be committed. Because its certificate differs from the existing APK, Android may require uninstalling the previous application first.

Production distribution and Play Store submission require a permanent release keystore owned and backed up by ResQNow. Release signing configuration must read paths, aliases, and passwords from local or CI-provided values and must never commit the keystore or credentials. Creating or custodying that permanent production key is outside this task.

## APK Publication

The backend continues serving `public/downloads/resqnow.apk` through its existing public Android status and download routes. Publication consists of copying the newly verified APK to that exact path and then confirming:

- the status route reports the file as available;
- HEAD and GET download responses use the expected file name and non-zero content length;
- the served file SHA-256 matches the locally verified build artifact;
- the backend repository contains only the intended APK change.

No deployment, push, or external release upload is part of this task.

## Testing and Verification

### Automated web and backend checks

- Run all frontend Vitest tests.
- Run TypeScript with `tsc --noEmit`.
- Run the frontend production build.
- Run backend tests by explicit test-file paths so the email smoke script is not discovered.
- Run the backend syntax build check.
- Record the existing global frontend lint baseline separately; unrelated lint cleanup is outside scope.

### Native checks

- Run Capacitor diagnostics after synchronization.
- Verify synchronized native assets match the Vite build.
- Run Android unit tests and Gradle lint where supported by the generated project.
- Assemble the debug APK.
- Verify APK signing and package metadata.
- Inspect the APK archive for the current `index.html`, current hashed application bundle, current tracking bundle, Capacitor configuration, and installed plugin manifest.

### End-to-end checks

- Run the built web application at mobile viewport sizes representative of Android phones.
- Check app startup, responsive shell, primary customer navigation, service flow entry, authentication entry, and the redesigned customer live-tracking surface without desktop overflow.
- Confirm production API health and permitted cross-origin access from the Capacitor origin where network access is available.
- Exercise the backend APK status and download endpoints against the new artifact.
- If an Android emulator or connected device is available, install and launch the APK, inspect startup logs, and smoke-test native location/push initialization. Absence of a device must be reported rather than represented as a completed device test.

## Error Handling and Safety

- Never overwrite the backend APK until the replacement has built and passed package verification.
- Preserve the old APK until the new artifact is ready, then perform one explicit replacement.
- Do not print or commit `.env` values, Firebase credentials, signing passwords, or private keys.
- A failed web build, Capacitor sync, Gradle build, signature check, asset freshness check, or backend download check blocks publication.
- Existing unrelated lint failures are reported with their baseline counts and do not authorize repository-wide refactoring.

## Out of Scope

- iOS packaging.
- Play Store submission or store listing assets.
- Production keystore creation, storage, or recovery.
- Compatibility with in-place upgrades from the old debug-signed APK.
- Backend business-logic, database, live-tracking, pricing, payment, or dispatch changes.
- Redesigning frontend screens beyond fixes required for correct Capacitor behavior.
- Resolving the repository-wide historical ESLint backlog.

## Success Criteria

- The Android project synchronizes cleanly from the current frontend.
- Capacitor diagnostics no longer report missing Android assets.
- Gradle produces an installable, validly signed APK with version code 2 and version name 1.1.0.
- The APK contains the same hashed entry assets as the freshly generated `dist` bundle and includes the redesigned `RequestTracking` output.
- Existing frontend and backend automated suites remain green, excluding the documented pre-existing lint baseline.
- Mobile viewport checks show the current responsive application rather than the stale package UI.
- The backend download artifact is replaced only with the verified APK, and its status/download endpoints serve the same file bytes.
