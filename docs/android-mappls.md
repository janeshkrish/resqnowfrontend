# Android Mappls builds

The APK uses the existing Mappls Web SDK in Capacitor at https://localhost. It reads the same public VITE_MAPPLS_MAP_SDK_KEY setting as the website, not a separate native Mappls Android SDK credential. Never put a REST client secret or server credential in a VITE variable.

From the D: frontend checkout, run `npm run android:sync` before an Android Studio/Gradle build. It loads the production public dotenv settings, sets native mode for its child processes only, builds the web app, verifies the compiled SDK key readers, syncs Android and compares the copied files. It does not sign, install, publish or enable updates. Use production API/provider configuration; editing dotenv after the build does not update copied assets or installed APKs.

The existing automated release adapter runs the same verified preparation and additionally checks the finished APK's entry graph and Capacitor origin configuration. A stale map chunk, incorrect key, old index, missing asset or accidental development-server URL fails the build instead of being returned for publication. The original signing, version and release-activation gates still apply.

The currently distributed v1.3/code4 APK was independently inspected on17November2026: it contains an older key rejected with401/ASSET_ACCESS_DENIED. Fixing packaging prevents stale configuration from being shipped, but does not grant Mappls entitlements or increase quota. Once Mappls account access/quota are valid, build/sign a new higher-version APK with the approved key and test actual SDK/map/tile requests on Android. No origin spoofing, permissive navigation or TLS workaround is required by these changes.

Tests use controlled SDK failures and real emitted/ZIP assets without calling paid Mappls services. A compiled/debug test APK is not a signed production release or Android runtime acceptance.
