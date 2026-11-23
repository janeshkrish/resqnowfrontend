# Android Mappls builds

Current-main notice (23 November 2026): commit4875917 introduced a native Mappls SDK/plugin path on Android. That path needs the approved matching `<appId>.a.conf`/`<appId>.a.olf` files for `com.resqnow1.app` and its signing certificate. The Web key is not a substitute. The WebView repair/build evidence below describes the earlier66814bb-based implementation; it does not establish native SDK acceptance. See [current production delivery status](android-production-release-status-2026-11-23.md) before building or publishing.

The earlier WebView APK used the Mappls Web SDK in Capacitor at https://localhost. It read the same public VITE_MAPPLS_MAP_SDK_KEY setting as the website, not a separate native Mappls Android SDK credential. That is historical context, not the credential requirement of the current native SDK. Never put a REST client secret or server credential in a VITE variable.

From the D: frontend checkout, run `npm run android:sync` before an Android Studio/Gradle build. It loads the production public dotenv settings, sets native mode for its child processes only, builds the web app, verifies the compiled SDK key readers, syncs Android and compares the copied files. It does not sign, install, publish or enable updates. Use production API/provider configuration; editing dotenv after the build does not update copied assets or installed APKs.

The existing automated release adapter runs the same verified preparation and additionally checks the finished APK's entry graph and Capacitor origin configuration. A stale map chunk, incorrect key, old index, missing asset or accidental development-server URL fails the build instead of being returned for publication. The original signing, version and release-activation gates still apply.

`config/mappls-public-key.json` contains only the SHA256 fingerprint of the intended public website SDK key, not the credential. Native builds check this before launching any build command, so an outdated CI variable cannot quietly select a different key. For an intentional key rotation, update the public setting in both website and APK environments and review/update this fingerprint in the same release. Do not replace it with a REST credential or disable the comparison to get a build through.

The public v1.3/code4 APK inspected on 17 November 2026 contains an older key rejected with HTTP 401/ASSET_ACCESS_DENIED. Fixing packaging prevents stale configuration from being shipped, but does not grant Mappls entitlements or increase quota. Once Mappls account access/quota are valid, build/sign a new higher-version APK with the approved key and test actual SDK/map/tile requests on Android. No origin spoofing, permissive navigation or TLS workaround is required by these changes.

Tests use controlled SDK failures and real emitted/ZIP assets without calling paid Mappls services. A compiled/debug test APK is not a signed production release or Android runtime acceptance.

The repair's verified test/build results and remaining release checks are recorded in [Mappls repair verification, 18 November 2026](mappls-repair-verification-2026-11-18.md).
