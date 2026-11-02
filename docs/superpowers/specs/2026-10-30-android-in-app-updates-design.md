# Android in-app updates: design for approval

Date: 30 October 2026. Status: owner approved design and requested the build, including Wi-Fi automatic downloads with a manual mobile-data option. First production publication/activation remains separately gated.

## Intent and agreed constraints

Let customers and technicians using the website-distributed Android app receive new signed APK versions without returning to the website for every release. The owner selected user-confirmed installation, clean release checks, emulator testing, and GitHub Releases for artifact hosting. Actual source changes belong in the regular D:/resqnow-production-code/resqnowfrontend and resqnowbackend folders on main. Preserve both collaborators' changes.

The first updater-enabled APK must be installed once through the existing distribution flow. Today's APK cannot acquire a native updater merely because the website/backend changes. Future installations and in-place upgrades must retain app data and the analytics installation identity; never uninstall or clear data as an update step.

## Current implementation

- One Capacitor Android package, com.resqnow1.app, supports both roles. Source and the local backend distribution APK report versionName 1.3, versionCode 4, minSdk 24 and targetSdk 36. This local artifact is not automatically proof of the latest APK installed by every user.
- Web assets are packaged from dist; the Android app does not simply load the hosted website on every launch.
- Frontend main has reusable read-only release-quality CI but no APK signing/publication job or native update plugin. Backend has a local-file APK download endpoint and adoption analytics, not an update service.
- Release signing configuration and distribution-certificate continuity must be verified before publication. No private keystore/password may be written into source, chat, reports or build logs.
- Existing backend Dockerfile uses Node 18. Previous production build/audit findings included unsupported dependency engines and critical/high advisories. These need fresh triage and reviewed remediation before declaring a clean production release; test success alone is insufficient.

## Approaches considered

1. GitHub Actions plus GitHub Releases (owner selected): keep signed APKs and metadata outside Railway's temporary filesystem, with an audit trail tied to the source commit. The existing Railway backend provides the app-facing release API. One-time signing-secret and repository setup is required.
2. Separate persistent artifact storage: useful for dedicated distribution infrastructure, but introduces another service, storage permissions and operational setup. Not selected for version one.

No Play Store migration, paid hot-code-push service, silent installation, managed-device privileges, mandatory updates or new admin release-management screens are included.

## Release pipeline

For frontend main pushes: run the existing complete frontend checks and new updater/native tests; only then build the production web bundle, synchronize Capacitor, build and sign the APK, verify its package/version/public certificate, and create the release. Backend-only pushes still deploy backend changes; they do not rebuild an unchanged APK.

The release workflow uses a reusable read-only verification job. Production signing secrets are confined to a later trusted-main job with minimum permissions. Pull requests and fork code never receive signing credentials. Required public build settings must be supplied explicitly; synthetic Firebase/API settings from test gates must never become the distributed app configuration.

Serialize publication. Assign a monotonically increasing Android versionCode above every distributed version, not a timestamp that may exceed Android's integer limit. Record a reviewed starting floor and deterministic workflow sequence; retries must not overwrite a published version. Fail if the candidate is not newer than the current stable release or if version history cannot be validated. Human-readable versionName and source commit are recorded too.

Create a draft release, upload APK and manifest, verify uploaded digests, and only then publish as stable. Keep versioned tags/assets; do not replace an existing APK. Recommend repository immutable-release protection where available, but never assume it is already enabled. A failed gate/signing/upload must leave the previously published stable release usable. Reverting code requires a new higher versionCode, never a downgrade.

Initially publication is disabled behind explicit repository configuration. Provide a dry-run build/sign/verify mode. Configure the existing signing key through GitHub's secret mechanisms only with owner approval; do not generate a replacement production key. Enable automatic publication only after the first release and upgrade acceptance gates pass.

## Release contract and backend

Add GET /api/public/android-app/update. It returns state disabled/unavailable, or state ready with a validated stable release. Release metadata contains schemaVersion, stable channel, applicationId, versionCode, versionName, minSdk, targetSdk, APK byte size, APK SHA-256, signing-certificate SHA-256, immutable/version-specific APK URL, source commit and publication time. No login, installation ID or analytics consent is required to check updates.

Read only from the configured owner/repository and Android release namespace. Bound response sizes/timeouts, validate every field, and cache/coalesce GitHub requests to avoid per-phone API calls and rate-limit amplification. Use HTTPS and a strict GitHub/CDN redirect allowlist; never fetch an arbitrary URL supplied by a client. Missing/malformed/unpublished/incomplete releases fail closed rather than suggesting a broken update. A backend kill switch stops new offers without affecting login, voice, jobs or payments.

Keep the existing website download URL and analytics semantics. Before the release source is activated, retain its current local-APK behavior. After activation, stream the selected stable APK from GitHub with bounded memory, cancellation and correct range/HEAD handling. A redirect alone is not a completed APK delivery and must not increment accepted-delivery analytics. Automatic native-update downloads are not website download sessions.

This service needs no business-database migration or account-schema changes. Installation analytics flags stay independent and are not enabled by this work.

## Native download and installation

Add a narrowly scoped Capacitor Android update plugin and use Android-managed download work so ordinary app backgrounding/process death does not corrupt the transfer. Restore/query download state on launch/resume, support cancellation/retry, and show actionable network/storage errors.

The owner approved automatic checking on launch/resume with a bounded interval, automatic downloading on unmetered networks, and an explicit Download action for mobile data.

Treat downloaded bytes as untrusted. Verify size/hash, package ID, higher versionCode, supported SDK, and signing-certificate compatibility with the installed app. Stage/reverify the installable APK in app-private cache; never install from a world-writable path or a remote URL. Restrict FileProvider grants to that cache directory. Clean obsolete/failed artifacts without touching user data. Persist only bounded updater state, not JWTs, audio or location.

Installation starts only after the user taps Update. Handle Android's per-app install-source permission and its installer confirmation; never silently change settings or request privileged installation rights. Denial/cancellation leaves the current app usable and allows retry. API 24/25 and API 26+ permission paths must be handled separately. On later launch, reconcile the actual installed version before declaring success or clearing a pending offer.

## Frontend and existing workflows

Use the current UI components for a small non-blocking update banner/status panel and a settings entry, available to both roles. Show version, download size/progress, Later/Cancel/Retry and Update when verified. Reuse existing visual patterns, not a new dashboard redesign.

Never automatically open the Android installer after download completion. Suppress intrusive prompts and installation entry points during request submission, tracking/active jobs, payment, OAuth and voice interactions; use existing route/job state conservatively and retain the offer for a safe screen. Do not alter dispatch, pricing, payment, voice, authentication or analytics identity behavior. Web/PWA users must not run native APK download/installation logic.

## Verification and acceptance

Use RED-to-GREEN tests for manifest validation, unavailable/disabled states, caching/rate limits, redirect/stream/range handling and download analytics preservation. Frontend tests cover both roles, web exclusion, permission/cancellation errors, active-workflow deferral and resumed state. Browser tests use a real local release API with synthetic release fixtures where practical; mocked native bridges are not proof of Android installation.

Run complete frontend/backend release checks, plus Android JVM/native tests. On an explicitly identified disposable emulator, install updater-enabled version A, obtain version B through the updater, approve Android's installer, and verify version change plus retained synthetic app data/analytics identity. Exercise denied permission, cancellation, offline/interrupted download, restart, insufficient storage, corrupt/truncated APK, wrong package/signer and lower version. Include supported API-boundary coverage, including current target behavior. Never use an attached personal phone or change Windows virtualization/security settings without separate approval.

Debug-key emulator acceptance proves the update flow only. Separately compare the actual distribution APK's public certificate with the intended production signing certificate and verify an increased versionCode. Test a hosted dry-run release workflow, the first approved signed publication, backend discovery/download, and a subsequent main-push release. Do not call the feature end-to-end complete with only Playwright mocks or a locally built APK.

## Activation and remaining owner setup

Approve this design and its network-download policy, confirm the latest distributed signing identity/version floor, configure production signing secrets and public app build settings, verify repository/Actions permissions, and approve first publication/automatic-release activation. Missing credentials, a non-booting emulator, failing release/security checks or unverified certificate continuity block activation, not safe code development. Report these separately rather than replacing the signing key, weakening checks or claiming an unperformed release.
