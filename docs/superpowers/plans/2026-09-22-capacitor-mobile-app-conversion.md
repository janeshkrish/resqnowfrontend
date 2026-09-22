# Capacitor Mobile App Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Package the unchanged current ResQNow React/Vite web application as a synchronized, tested Capacitor Android app and publish its verified debug APK through the existing backend download endpoint.

**Architecture:** The Vite production bundle remains the single UI implementation and is copied into the existing native Android shell by `cap sync`. Focused Node utilities verify web/native asset parity, Capacitor configuration, plugin registration, Android release metadata, and signing inputs before Gradle builds; publication happens only after signature and archive inspection succeed.

**Tech Stack:** React 18, Vite 5, Node.js ESM and `node:test`, Capacitor 8.1, Android Gradle Plugin 8.13, Gradle 8.14.3, Java 21-compatible bytecode, Android SDK 36, PowerShell, Express 4.

**Spec:** `docs/superpowers/specs/2026-09-22-capacitor-mobile-app-conversion-design.md`

## Global Constraints

- Do not change frontend UI, routes, responsive layouts, business logic, backend APIs, database behavior, realtime contracts, payment behavior, or dispatch behavior.
- Keep `appId` and Android `applicationId` equal to `com.resqnow1.app`, `appName` equal to `ResQNow`, and Capacitor `webDir` equal to `dist`.
- Package `VITE_API_URL=https://resqnowbackend.onrender.com`; never print or commit any `.env` value, Firebase credential, signing password, private key, or keystore.
- Preserve the custom Firebase messaging service, emergency notification classes, job-alert foreground service, manifest permissions, splash resources, launcher resources, and the four installed Capacitor plugins.
- Use `versionCode 2` and `versionName 1.1.0`.
- Build a new debug-signed APK for immediate testing. Do not claim compatibility with in-place upgrades from the old APK certificate.
- Keep generated native web assets, generated Cordova bridge files, Android SDK files, build output, keystores, and signing credentials out of Git.
- Never replace `resqnowbackend/public/downloads/resqnow.apk` until the candidate APK passes signature, metadata, archive-content, and synchronized-asset verification.
- Treat the existing frontend lint baseline of 369 errors and 51 warnings as pre-existing and outside this change; do not refactor unrelated application source.
- Run backend tests by explicit test-file paths. Never use bare `node --test`, because it discovers the email smoke script.

## Review Focus

- A successful Vite build followed by a skipped or stale Capacitor copy must fail verification instead of producing an APK with old UI; Task 1 tests mismatched entry files and referenced assets.
- A sync that omits the tracking chunk or any required Capacitor plugin must fail with the missing path/package in the error; Task 1 tests both cases.
- Zero release-signing variables is allowed for this debug build, but any partially configured release-signing environment must fail before Gradle; Task 1 tests the all-or-none contract.
- A future edit that changes application ID, version code/name, package scripts, or keystore ignore rules must fail repository-contract verification; Task 2 adds a real-repository integration test.
- Publication must not serve a stale or truncated APK; Task 4 compares source, destination, HEAD, and GET SHA-256 values after an atomic workspace-scoped replacement.

---

## File Structure

- Create `scripts/mobile-package-utils.mjs`: pure and filesystem-backed verification helpers for synchronized assets, Capacitor config/plugins, Android metadata, signing environment, and Gradle wrapper selection.
- Create `scripts/mobile-package-utils.test.mjs`: Node tests for successful verification and every release-blocking failure mode.
- Create `scripts/verify-mobile-sync.mjs`: small CLI that runs the verification helpers against the real repository and prints only non-secret artifact metadata.
- Create `scripts/run-android-gradle.mjs`: cross-platform Gradle-wrapper launcher used by npm scripts.
- Modify `package.json`: expose deterministic `mobile:sync`, `mobile:verify`, `android:test`, `android:assemble:debug`, and `android:package:debug` commands.
- Modify `android/app/build.gradle`: set Android version 2/1.1.0 and add optional all-or-none environment-based release signing without changing debug signing.
- Modify `android/.gitignore`: always ignore `*.jks` and `*.keystore`.
- Modify `README.md`: document the exact mobile build, verification, reinstall, SDK, and future release-signing workflow.
- Create `../resqnowbackend/tests/android_apk_distribution.test.js`: assert the status, HEAD, and GET endpoints serve the expected candidate bytes.
- Replace `../resqnowbackend/public/downloads/resqnow.apk`: publish only the verified final binary.

### Task 1: Add deterministic mobile-package verification helpers

**Files:**
- Create: `scripts/mobile-package-utils.mjs`
- Create: `scripts/mobile-package-utils.test.mjs`

**Interfaces:**
- Produces: `REQUIRED_CAPACITOR_PLUGINS`, `collectLocalAssetPaths(html)`, `validateSigningEnvironment(env)`, `getGradleWrapper(platform)`, `verifySynchronizedWebAssets(options)`, and `verifyAndroidReleaseContract(options)`.
- Consumes: only Node built-ins (`node:assert`, `node:crypto`, `node:fs/promises`, `node:os`, `node:path`, `node:test`).

- [ ] **Step 1: Write failing unit tests for matching and stale web assets**

Create `scripts/mobile-package-utils.test.mjs` with a temporary fixture containing `dist/index.html`, a hashed entry bundle, a hashed `RequestTracking` bundle, matching native copies, Capacitor JSON, and plugin JSON. Start with these assertions:

```js
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  REQUIRED_CAPACITOR_PLUGINS,
  verifySynchronizedWebAssets,
} from "./mobile-package-utils.mjs";

async function createMobileFixture({
  omitNativeEntryAsset = false,
  omitTrackingAsset = false,
  omitPlugin = null,
} = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "resqnow-mobile-package-"));
  const webDir = path.join(root, "dist");
  const nativeAssetsDir = path.join(root, "native-assets");
  const nativeWebDir = path.join(nativeAssetsDir, "public");
  await mkdir(path.join(webDir, "assets"), { recursive: true });
  await mkdir(path.join(nativeWebDir, "assets"), { recursive: true });

  const indexHtml = '<script type="module" src="/assets/index-current.js"></script><link rel="stylesheet" href="/assets/index-current.css">';
  await writeFile(path.join(webDir, "index.html"), indexHtml);
  await writeFile(path.join(nativeWebDir, "index.html"), indexHtml);
  await writeFile(path.join(webDir, "assets", "index-current.js"), "entry");
  await writeFile(path.join(webDir, "assets", "index-current.css"), "styles");
  await writeFile(path.join(nativeWebDir, "assets", "index-current.css"), "styles");
  if (!omitNativeEntryAsset) {
    await writeFile(path.join(nativeWebDir, "assets", "index-current.js"), "entry");
  }
  if (!omitTrackingAsset) {
    await writeFile(path.join(webDir, "assets", "RequestTracking-current.js"), "tracking");
    await writeFile(path.join(nativeWebDir, "assets", "RequestTracking-current.js"), "tracking");
  }

  const capacitorConfigPath = path.join(nativeAssetsDir, "capacitor.config.json");
  const capacitorPluginsPath = path.join(nativeAssetsDir, "capacitor.plugins.json");
  await writeFile(capacitorConfigPath, JSON.stringify({
    appId: "com.resqnow1.app",
    appName: "ResQNow",
    webDir: "dist",
    server: { androidScheme: "https", allowNavigation: ["resqnowbackend.onrender.com"] },
  }));
  await writeFile(
    capacitorPluginsPath,
    JSON.stringify(
      REQUIRED_CAPACITOR_PLUGINS
        .filter((plugin) => plugin !== omitPlugin)
        .map((pkg) => ({ pkg })),
    ),
  );

  return {
    paths: { webDir, nativeWebDir, capacitorConfigPath, capacitorPluginsPath },
  };
}

test("accepts native assets that exactly match the Vite build", async () => {
  const fixture = await createMobileFixture();
  const report = await verifySynchronizedWebAssets(fixture.paths);
  assert.equal(report.appId, "com.resqnow1.app");
  assert.equal(report.trackingAsset, "assets/RequestTracking-current.js");
  assert.deepEqual(report.plugins, REQUIRED_CAPACITOR_PLUGINS);
});

test("rejects a stale synchronized entry point", async () => {
  const fixture = await createMobileFixture();
  await writeFile(path.join(fixture.paths.nativeWebDir, "index.html"), "stale");
  await assert.rejects(
    verifySynchronizedWebAssets(fixture.paths),
    /Native index\.html does not match dist\/index\.html/,
  );
});

test("rejects a missing referenced asset", async () => {
  const fixture = await createMobileFixture({ omitNativeEntryAsset: true });
  await assert.rejects(
    verifySynchronizedWebAssets(fixture.paths),
    /Missing synchronized asset: assets\/index-current\.js/,
  );
});
```

The fixture HTML must reference `/assets/index-current.js` and `/assets/index-current.css`, and its `dist/assets` directory must include `RequestTracking-current.js`. The fixture plugin JSON must contain one `{ "pkg": packageName }` record for each required plugin.

- [ ] **Step 2: Run the tests and confirm the module is missing**

Run: `node --test scripts/mobile-package-utils.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/mobile-package-utils.mjs`.

- [ ] **Step 3: Implement asset and plugin verification**

Create `scripts/mobile-package-utils.mjs` with this implementation:

```js
import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

export const REQUIRED_CAPACITOR_PLUGINS = Object.freeze([
  "@capacitor/app",
  "@capacitor/geolocation",
  "@capacitor/push-notifications",
  "@capacitor/splash-screen",
]);

export function collectLocalAssetPaths(html) {
  const paths = new Set();
  for (const match of html.matchAll(/\b(?:src|href)=["']\/([^"'#?]+)(?:[?#][^"']*)?["']/g)) {
    paths.add(match[1].replaceAll("/", path.sep));
  }
  return [...paths].sort();
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

async function readRequiredFile(filePath, label) {
  try {
    return await readFile(filePath);
  } catch (error) {
    throw new Error(`Missing ${label}: ${filePath}`, { cause: error });
  }
}

async function assertMatchingFile(webDir, nativeWebDir, relativePath) {
  const portablePath = relativePath.split(path.sep).join("/");
  const webValue = await readRequiredFile(path.join(webDir, relativePath), `web asset ${portablePath}`);
  let nativeValue;
  try {
    nativeValue = await readFile(path.join(nativeWebDir, relativePath));
  } catch (error) {
    throw new Error(`Missing synchronized asset: ${portablePath}`, { cause: error });
  }
  if (sha256(webValue) !== sha256(nativeValue)) {
    throw new Error(`Synchronized asset differs from Vite build: ${portablePath}`);
  }
}

export async function verifySynchronizedWebAssets({
  webDir,
  nativeWebDir,
  capacitorConfigPath,
  capacitorPluginsPath,
}) {
  const webIndex = await readRequiredFile(path.join(webDir, "index.html"), "dist/index.html");
  const nativeIndex = await readRequiredFile(
    path.join(nativeWebDir, "index.html"),
    "native index.html",
  );
  if (sha256(webIndex) !== sha256(nativeIndex)) {
    throw new Error("Native index.html does not match dist/index.html");
  }

  const entryAssets = collectLocalAssetPaths(webIndex.toString("utf8"));
  for (const relativePath of entryAssets) {
    await assertMatchingFile(webDir, nativeWebDir, relativePath);
  }

  const assetNames = await readdir(path.join(webDir, "assets"));
  const trackingAssets = assetNames.filter((name) => /^RequestTracking-[A-Za-z0-9_-]+\.js$/.test(name));
  if (trackingAssets.length !== 1) {
    throw new Error(`Expected exactly one RequestTracking bundle, found ${trackingAssets.length}`);
  }
  const trackingAsset = path.join("assets", trackingAssets[0]);
  await assertMatchingFile(webDir, nativeWebDir, trackingAsset);

  const capacitorConfig = JSON.parse(
    (await readRequiredFile(capacitorConfigPath, "Capacitor config")).toString("utf8"),
  );
  if (capacitorConfig.appId !== "com.resqnow1.app") {
    throw new Error(`Unexpected Capacitor appId: ${capacitorConfig.appId}`);
  }
  if (capacitorConfig.webDir !== "dist") {
    throw new Error(`Unexpected Capacitor webDir: ${capacitorConfig.webDir}`);
  }
  if (capacitorConfig.appName !== "ResQNow") {
    throw new Error(`Unexpected Capacitor appName: ${capacitorConfig.appName}`);
  }
  if (capacitorConfig.server?.androidScheme !== "https") {
    throw new Error("Capacitor androidScheme must be https");
  }
  if (!capacitorConfig.server?.allowNavigation?.includes("resqnowbackend.onrender.com")) {
    throw new Error("Capacitor navigation must allow resqnowbackend.onrender.com");
  }

  const pluginRecords = JSON.parse(
    (await readRequiredFile(capacitorPluginsPath, "Capacitor plugins")).toString("utf8"),
  );
  const installedPlugins = pluginRecords.map(({ pkg }) => pkg).filter(Boolean);
  for (const requiredPlugin of REQUIRED_CAPACITOR_PLUGINS) {
    if (!installedPlugins.includes(requiredPlugin)) {
      throw new Error(`Missing Capacitor plugin: ${requiredPlugin}`);
    }
  }

  return {
    appId: capacitorConfig.appId,
    entryAssets,
    trackingAsset: trackingAsset.split(path.sep).join("/"),
    plugins: REQUIRED_CAPACITOR_PLUGINS.slice(),
  };
}
```

Use SHA-256 for each comparison. Errors must name the missing or mismatched relative path. Require `appId === "com.resqnow1.app"` and `webDir === "dist"`; compare required plugins in sorted order while allowing Capacitor to add unrelated future plugin records.

- [ ] **Step 4: Add and run failure tests for the tracking bundle and plugins**

Add:

```js
test("rejects a build without the current tracking chunk", async () => {
  const fixture = await createMobileFixture({ omitTrackingAsset: true });
  await assert.rejects(
    verifySynchronizedWebAssets(fixture.paths),
    /Expected exactly one RequestTracking bundle, found 0/,
  );
});

test("rejects a missing Capacitor plugin registration", async () => {
  const fixture = await createMobileFixture({ omitPlugin: "@capacitor/geolocation" });
  await assert.rejects(
    verifySynchronizedWebAssets(fixture.paths),
    /Missing Capacitor plugin: @capacitor\/geolocation/,
  );
});
```

Run: `node --test scripts/mobile-package-utils.test.mjs`

Expected: PASS for the matching fixture and all four rejection cases.

- [ ] **Step 5: Add signing and wrapper-selection tests first**

Extend the utility import with `getGradleWrapper` and `validateSigningEnvironment`, then add:

```js
test("allows no release-signing variables for a debug package", () => {
  assert.equal(validateSigningEnvironment({}), null);
});

test("rejects partially configured release signing", () => {
  assert.throws(
    () => validateSigningEnvironment({ RESQNOW_ANDROID_KEYSTORE_PATH: "release.jks" }),
    /Release signing requires all four RESQNOW_ANDROID_/,
  );
});

test("accepts a complete release-signing environment without exposing secrets", () => {
  assert.deepEqual(
    validateSigningEnvironment({
      RESQNOW_ANDROID_KEYSTORE_PATH: "release.jks",
      RESQNOW_ANDROID_KEY_ALIAS: "resqnow",
      RESQNOW_ANDROID_STORE_PASSWORD: "store-secret",
      RESQNOW_ANDROID_KEY_PASSWORD: "key-secret",
    }),
    { configured: true, keystorePath: "release.jks", keyAlias: "resqnow" },
  );
});
```

Also assert `getGradleWrapper("win32") === "gradlew.bat"` and `getGradleWrapper("linux") === "./gradlew"`.

Run: `node --test scripts/mobile-package-utils.test.mjs`

Expected: FAIL because the two new functions are not exported.

- [ ] **Step 6: Implement signing validation and Gradle wrapper selection**

Use these exact signing variable names:

```js
const SIGNING_KEYS = [
  "RESQNOW_ANDROID_KEYSTORE_PATH",
  "RESQNOW_ANDROID_KEY_ALIAS",
  "RESQNOW_ANDROID_STORE_PASSWORD",
  "RESQNOW_ANDROID_KEY_PASSWORD",
];
```

`validateSigningEnvironment` must return `null` when all four are absent, throw when one to three are non-empty, and return only `{ configured: true, keystorePath, keyAlias }` when all four exist. It must never return either password. `getGradleWrapper` returns `gradlew.bat` only for `win32`, otherwise `./gradlew`.

```js
export function validateSigningEnvironment(env) {
  const values = Object.fromEntries(
    SIGNING_KEYS.map((key) => [key, String(env[key] ?? "").trim()]),
  );
  const configuredCount = Object.values(values).filter(Boolean).length;
  if (configuredCount === 0) return null;
  if (configuredCount !== SIGNING_KEYS.length) {
    throw new Error("Release signing requires all four RESQNOW_ANDROID_* variables.");
  }
  return {
    configured: true,
    keystorePath: values.RESQNOW_ANDROID_KEYSTORE_PATH,
    keyAlias: values.RESQNOW_ANDROID_KEY_ALIAS,
  };
}

export function getGradleWrapper(platform = process.platform) {
  return platform === "win32" ? "gradlew.bat" : "./gradlew";
}
```

Run: `node --test scripts/mobile-package-utils.test.mjs`

Expected: PASS with no secret values printed.

- [ ] **Step 7: Commit the focused verifier unit**

```powershell
git add scripts/mobile-package-utils.mjs scripts/mobile-package-utils.test.mjs
git commit -m "test: add capacitor package verification contract"
```

### Task 2: Wire the repository into the verified Capacitor build contract

**Files:**
- Modify: `scripts/mobile-package-utils.test.mjs`
- Create: `scripts/verify-mobile-sync.mjs`
- Create: `scripts/run-android-gradle.mjs`
- Modify: `package.json:6-21`
- Modify: `android/app/build.gradle:4-25`
- Modify: `android/.gitignore:55-59`
- Modify: `README.md:306-320`

**Interfaces:**
- Consumes: Task 1 verification helpers.
- Produces: `npm run mobile:sync`, `npm run mobile:verify`, `npm run android:test`, `npm run android:assemble:debug`, and `npm run android:package:debug`.

- [ ] **Step 1: Add a failing real-repository contract test**

Extend the test imports with `readFile`, `fileURLToPath`, and `verifyAndroidReleaseContract`, then append:

```js
test("repository declares the mobile build and Android release contract", async () => {
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(scriptsDir, "..");
  const report = verifyAndroidReleaseContract({
    packageJson: await readFile(path.join(repositoryRoot, "package.json"), "utf8"),
    buildGradle: await readFile(path.join(repositoryRoot, "android", "app", "build.gradle"), "utf8"),
    androidGitignore: await readFile(path.join(repositoryRoot, "android", ".gitignore"), "utf8"),
  });
  assert.deepEqual(report, {
    applicationId: "com.resqnow1.app",
    versionCode: 2,
    versionName: "1.1.0",
    scripts: [
      "android:assemble:debug",
      "android:package:debug",
      "android:test",
      "mobile:sync",
      "mobile:verify",
    ],
  });
});
```

The helper must require `*.jks` and `*.keystore` ignore entries and all four signing variable names in the Gradle file.

- [ ] **Step 2: Run the repository contract test and verify the current metadata fails**

Run: `node --test scripts/mobile-package-utils.test.mjs`

Expected: FAIL reporting current `versionCode 1` instead of `2` and missing mobile scripts/signing configuration.

- [ ] **Step 3: Implement the real-repository contract helper**

Add `verifyAndroidReleaseContract` to `scripts/mobile-package-utils.mjs`:

```js
const REQUIRED_MOBILE_SCRIPTS = Object.freeze([
  "android:assemble:debug",
  "android:package:debug",
  "android:test",
  "mobile:sync",
  "mobile:verify",
]);

export function verifyAndroidReleaseContract({ packageJson, buildGradle, androidGitignore }) {
  const parsedPackage = JSON.parse(packageJson);
  const applicationId = buildGradle.match(/^\s*applicationId\s+["']([^"']+)["']/m)?.[1];
  const versionCode = Number(buildGradle.match(/^\s*versionCode\s+(\d+)\s*$/m)?.[1]);
  const versionName = buildGradle.match(/^\s*versionName\s+["']([^"']+)["']/m)?.[1];

  assert.equal(applicationId, "com.resqnow1.app", "Android applicationId must remain com.resqnow1.app");
  assert.equal(versionCode, 2, "Android versionCode must be 2");
  assert.equal(versionName, "1.1.0", "Android versionName must be 1.1.0");
  for (const scriptName of REQUIRED_MOBILE_SCRIPTS) {
    assert.equal(typeof parsedPackage.scripts?.[scriptName], "string", `Missing npm script: ${scriptName}`);
  }
  for (const variableName of SIGNING_KEYS) {
    assert.match(buildGradle, new RegExp(`System\\.getenv\\(['\"]${variableName}['\"]\\)`));
  }
  assert.match(androidGitignore, /^\*\.jks\s*$/m);
  assert.match(androidGitignore, /^\*\.keystore\s*$/m);

  return {
    applicationId,
    versionCode,
    versionName,
    scripts: REQUIRED_MOBILE_SCRIPTS.slice(),
  };
}
```

Add `import assert from "node:assert/strict";` to the utility. Parse `packageJson` with `JSON.parse`, and check only for signing variable names, never password values.

Run: `node --test scripts/mobile-package-utils.test.mjs`

Expected: still FAIL against the unchanged repository, now with a precise version/script error rather than a missing export.

- [ ] **Step 4: Update Android versioning and optional release signing**

Change `android/app/build.gradle` to:

```groovy
def releaseSigningVariables = [
    keystorePath: System.getenv('RESQNOW_ANDROID_KEYSTORE_PATH'),
    keyAlias: System.getenv('RESQNOW_ANDROID_KEY_ALIAS'),
    storePassword: System.getenv('RESQNOW_ANDROID_STORE_PASSWORD'),
    keyPassword: System.getenv('RESQNOW_ANDROID_KEY_PASSWORD'),
]
def configuredReleaseSigningValues = releaseSigningVariables.values().count { value -> value != null && !value.trim().isEmpty() }
if (configuredReleaseSigningValues > 0 && configuredReleaseSigningValues < releaseSigningVariables.size()) {
    throw new GradleException('Release signing requires all four RESQNOW_ANDROID_* variables.')
}
def hasReleaseSigning = configuredReleaseSigningValues == releaseSigningVariables.size()

android {
    namespace = "com.resqnow1.app"
    compileSdk = rootProject.ext.compileSdkVersion
    defaultConfig {
        applicationId "com.resqnow1.app"
        minSdkVersion rootProject.ext.minSdkVersion
        targetSdkVersion rootProject.ext.targetSdkVersion
        versionCode 2
        versionName "1.1.0"
        testInstrumentationRunner "androidx.test.runner.AndroidJUnitRunner"
        aaptOptions {
            ignoreAssetsPattern = '!.svn:!.git:!.ds_store:!*.scc:.*:!CVS:!thumbs.db:!picasa.ini:!*~'
        }
    }
    signingConfigs {
        if (hasReleaseSigning) {
            release {
                storeFile file(releaseSigningVariables.keystorePath)
                storePassword releaseSigningVariables.storePassword
                keyAlias releaseSigningVariables.keyAlias
                keyPassword releaseSigningVariables.keyPassword
            }
        }
    }
    buildTypes {
        release {
            if (hasReleaseSigning) signingConfig signingConfigs.release
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

Keep the existing repositories, dependencies, Capacitor Gradle application, Firebase JSON validation, and Google Services plugin statements below this complete `android` block unchanged. Add uncommented `*.jks` and `*.keystore` lines to `android/.gitignore`.

- [ ] **Step 5: Add the synchronization and Gradle CLIs**

Create `scripts/verify-mobile-sync.mjs`:

```js
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  validateSigningEnvironment,
  verifyAndroidReleaseContract,
  verifySynchronizedWebAssets,
} from "./mobile-package-utils.mjs";

try {
  const root = process.cwd();
  validateSigningEnvironment(process.env);
  const syncReport = await verifySynchronizedWebAssets({
    webDir: path.join(root, "dist"),
    nativeWebDir: path.join(root, "android", "app", "src", "main", "assets", "public"),
    capacitorConfigPath: path.join(root, "android", "app", "src", "main", "assets", "capacitor.config.json"),
    capacitorPluginsPath: path.join(root, "android", "app", "src", "main", "assets", "capacitor.plugins.json"),
  });
  verifyAndroidReleaseContract({
    packageJson: await readFile(path.join(root, "package.json"), "utf8"),
    buildGradle: await readFile(path.join(root, "android", "app", "build.gradle"), "utf8"),
    androidGitignore: await readFile(path.join(root, "android", ".gitignore"), "utf8"),
  });
  console.log(JSON.stringify({
    ok: true,
    appId: syncReport.appId,
    trackingAsset: syncReport.trackingAsset,
    entryAssetCount: syncReport.entryAssets.length,
    pluginCount: syncReport.plugins.length,
  }));
} catch (error) {
  console.error(`Mobile package verification failed: ${error.message}`);
  process.exitCode = 1;
}
```

Do not dump objects from `process.env`.

Create `scripts/run-android-gradle.mjs`:

```js
import { spawnSync } from "node:child_process";
import path from "node:path";
import { getGradleWrapper } from "./mobile-package-utils.mjs";

const tasks = process.argv.slice(2);
if (tasks.length === 0) {
  console.error("At least one Gradle task is required.");
  process.exit(2);
}

const androidDir = path.join(process.cwd(), "android");
const result = spawnSync(getGradleWrapper(), tasks, {
  cwd: androidDir,
  stdio: "inherit",
  shell: process.platform === "win32",
});
if (result.error) {
  console.error(`Unable to start Gradle: ${result.error.message}`);
  process.exit(1);
}
process.exit(result.status ?? 1);
```

- [ ] **Step 6: Add deterministic npm commands**

Add these scripts to `package.json` without changing existing web scripts:

```json
"mobile:verify": "node scripts/verify-mobile-sync.mjs",
"mobile:sync": "npm run build && npx cap sync android && npm run mobile:verify",
"android:test": "node scripts/run-android-gradle.mjs testDebugUnitTest lintDebug",
"android:assemble:debug": "node scripts/run-android-gradle.mjs assembleDebug",
"android:package:debug": "npm run mobile:sync && npm run android:test && npm run android:assemble:debug"
```

- [ ] **Step 7: Document the exact Android workflow and signing boundary**

Replace the README Android section with:

````markdown
## Android / Capacitor

The Capacitor app packages the existing production web UI without changing or duplicating it.

Prerequisites: Android SDK Platform 36, Android SDK Build-Tools 36.0.0, and a Java runtime supported by Gradle 8.14.3. Keep `VITE_API_URL=https://resqnowbackend.onrender.com` for the production package.

```powershell
npm run mobile:sync
npm run android:package:debug
```

The installable debug APK is written to `android/app/build/outputs/apk/debug/app-debug.apk`. This build uses a newly generated Android Debug certificate, so uninstall the old differently signed ResQNow APK before installing it.

Future release signing is optional and all-or-none through `RESQNOW_ANDROID_KEYSTORE_PATH`, `RESQNOW_ANDROID_KEY_ALIAS`, `RESQNOW_ANDROID_STORE_PASSWORD`, and `RESQNOW_ANDROID_KEY_PASSWORD`. Never commit a keystore or any signing credential.

Before publishing an APK, run `npm run mobile:verify`, Android tests/lint, `apksigner verify`, and compare the packaged asset hashes with `dist`.
````

- [ ] **Step 8: Run the repository contract test and static checks**

Run:

```powershell
node --test scripts/mobile-package-utils.test.mjs
npx.cmd tsc --noEmit
git diff --check
```

Expected: utility and repository-contract tests PASS, TypeScript exits 0, and `git diff --check` prints nothing.

- [ ] **Step 9: Commit the build-contract integration**

```powershell
git add package.json scripts/verify-mobile-sync.mjs scripts/run-android-gradle.mjs scripts/mobile-package-utils.mjs scripts/mobile-package-utils.test.mjs android/app/build.gradle android/.gitignore README.md
git commit -m "build: add verified capacitor android workflow"
```

### Task 3: Synchronize the current web application and build the Android package

**Files:**
- Generate, ignored: `android/app/src/main/assets/public/**`
- Generate, ignored: `android/app/src/main/assets/capacitor.config.json`
- Generate, ignored: `android/app/src/main/assets/capacitor.plugins.json`
- Generate, ignored: `android/capacitor-cordova-android-plugins/**`
- Generate, ignored: `android/app/build/outputs/apk/debug/app-debug.apk`
- Generate locally if needed, ignored: `android/local.properties`

**Interfaces:**
- Consumes: Task 2 npm commands and the current `.env` without printing values.
- Produces: a synchronized Android project and a debug-signed candidate APK; no tracked frontend source changes.

- [ ] **Step 1: Verify required client environment keys without printing values**

Run this from `resqnowfrontend`:

```powershell
$required = @('VITE_API_URL','VITE_MAPPLS_MAP_SDK_KEY','VITE_RAZORPAY_KEY_ID','VITE_FIREBASE_API_KEY','VITE_FIREBASE_PROJECT_ID','VITE_FIREBASE_APP_ID')
$configured = @{}
Get-Content .env | Where-Object { $_ -match '^\s*[^#][^=]*=' } | ForEach-Object { $parts = $_ -split '=',2; $configured[$parts[0].Trim()] = $parts[1].Trim() }
$missing = $required | Where-Object { -not $configured.ContainsKey($_) -or [string]::IsNullOrWhiteSpace($configured[$_]) }
if ($missing) { throw "Missing required mobile build variables: $($missing -join ', ')" }
if ($configured['VITE_API_URL'] -ne 'https://resqnowbackend.onrender.com') { throw 'VITE_API_URL must target the production backend for this package.' }
```

Expected: exit 0 with no values printed.

- [ ] **Step 2: Configure Android SDK 36 when the preflight finds no SDK**

First check `ANDROID_HOME`, `ANDROID_SDK_ROOT`, `android/local.properties`, and `%LOCALAPPDATA%\Android\Sdk`. If all are absent, request approval for the network download and standard user-profile SDK installation. Download the current official Windows command-line tools archive recorded by Android's September 2026 download page and verify its published SHA-256 before extraction:

Official source: [Android Studio downloads](https://developer.android.com/studio/).

```powershell
$sdkRoot = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
$archive = Join-Path $env:TEMP 'commandlinetools-win-15859902_latest.zip'
$stage = Join-Path $env:TEMP ("resqnow-android-sdk-" + [guid]::NewGuid().ToString('N'))
Invoke-WebRequest -Uri 'https://dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip' -OutFile $archive
$archiveHash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
if ($archiveHash -ne '90ae805d20434428bffcb699c290860f19bb5f66a67e6b330067e3de801fb04a') { throw 'Android command-line tools checksum mismatch.' }
New-Item -ItemType Directory -Path $stage | Out-Null
Expand-Archive -LiteralPath $archive -DestinationPath $stage
New-Item -ItemType Directory -Path (Join-Path $sdkRoot 'cmdline-tools') -Force | Out-Null
Move-Item -LiteralPath (Join-Path $stage 'cmdline-tools') -Destination (Join-Path $sdkRoot 'cmdline-tools\latest')
```

Then install the exact SDK packages required by the tracked Android configuration:

```powershell
$sdkManager = Join-Path $sdkRoot 'cmdline-tools\latest\bin\sdkmanager.bat'
1..100 | ForEach-Object { 'y' } | & $sdkManager --sdk_root="$sdkRoot" --licenses
& $sdkManager --sdk_root="$sdkRoot" 'platform-tools' 'platforms;android-36' 'build-tools;36.0.0'
```

Write only this ignored local pointer to `android/local.properties`, using the actual resolved SDK path with escaped backslashes:

```properties
sdk.dir=C\:\\Users\\Ash\\AppData\\Local\\Android\\Sdk
```

If Gradle 8.14.3 rejects Java 25, install Temurin JDK 21 with `winget install --exact --id EclipseAdoptium.Temurin.21.JDK --accept-package-agreements --accept-source-agreements`, set `JAVA_HOME` to that JDK for the build session, and rerun the failed Gradle command.

- [ ] **Step 3: Prove the unsynchronized verifier fails before copying assets**

If `android/app/src/main/assets/public` is still absent, run: `npm.cmd run mobile:verify`

Expected: FAIL naming the missing native `index.html` or native web directory. This is the integration RED evidence that prevents stale packaging.

- [ ] **Step 4: Build and synchronize the current production bundle**

Run: `npm.cmd run mobile:sync`

Expected: Vite production build exits 0, Capacitor reports copied web assets and four Android plugins, and `mobile:verify` prints JSON with `ok: true` plus the current `RequestTracking-*.js` filename.

- [ ] **Step 5: Run Capacitor and Gradle native checks**

Run:

```powershell
npx.cmd cap doctor
npm.cmd run android:test
```

Expected: Capacitor no longer reports a missing assets directory; `testDebugUnitTest` and `lintDebug` exit 0. Warnings are recorded verbatim rather than silently discarded.

- [ ] **Step 6: Assemble the candidate APK**

Run: `npm.cmd run android:assemble:debug`

Expected: `BUILD SUCCESSFUL` and a non-empty `android/app/build/outputs/apk/debug/app-debug.apk`. Gradle may create `%USERPROFILE%\.android\debug.keystore`; confirm it remains outside both repositories.

- [ ] **Step 7: Verify APK signature and Android metadata**

Resolve the newest installed Android build-tools directory, then run:

```powershell
$buildTools = Get-ChildItem "$env:LOCALAPPDATA\Android\Sdk\build-tools" -Directory | Sort-Object { [version]$_.Name } -Descending | Select-Object -First 1
& (Join-Path $buildTools.FullName 'apksigner.bat') verify --verbose --print-certs android\app\build\outputs\apk\debug\app-debug.apk
& (Join-Path $buildTools.FullName 'aapt.exe') dump badging android\app\build\outputs\apk\debug\app-debug.apk | Select-String "package: name='com.resqnow1.app'.*versionCode='2'.*versionName='1.1.0'"
```

Expected: signature verification succeeds and the badging command prints the exact package/version match.

- [ ] **Step 8: Verify the APK contains the freshly synchronized tracking assets**

Use .NET `System.IO.Compression.ZipFile` to open the candidate without extracting it. Resolve the one `dist/assets/RequestTracking-*.js` filename, require archive entries for `assets/public/index.html`, `assets/public/assets/<tracking filename>`, `assets/capacitor.config.json`, and `assets/capacitor.plugins.json`, and SHA-256 the tracking entry stream. Compare it with `Get-FileHash android/app/src/main/assets/public/assets/<tracking filename>`.

```powershell
Add-Type -AssemblyName System.IO.Compression.FileSystem
$trackingFiles = @(Get-ChildItem 'dist\assets' -Filter 'RequestTracking-*.js' -File)
if ($trackingFiles.Count -ne 1) { throw "Expected one tracking bundle, found $($trackingFiles.Count)." }
$trackingName = $trackingFiles[0].Name
$apkPath = (Resolve-Path 'android\app\build\outputs\apk\debug\app-debug.apk').Path
$zip = [System.IO.Compression.ZipFile]::OpenRead($apkPath)
try {
  $requiredEntries = @(
    'assets/public/index.html'
    "assets/public/assets/$trackingName"
    'assets/capacitor.config.json'
    'assets/capacitor.plugins.json'
  )
  foreach ($entryName in $requiredEntries) {
    if (-not $zip.GetEntry($entryName)) { throw "APK entry is missing: $entryName" }
  }
  $trackingEntry = $zip.GetEntry("assets/public/assets/$trackingName")
  $stream = $trackingEntry.Open()
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $archiveHash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '')
  } finally {
    $sha.Dispose()
    $stream.Dispose()
  }
} finally {
  $zip.Dispose()
}
$nativeHash = (Get-FileHash "android\app\src\main\assets\public\assets\$trackingName" -Algorithm SHA256).Hash
if ($archiveHash -ne $nativeHash) { throw 'APK tracking bundle does not match synchronized native assets.' }
```

Expected: all four entries exist and both SHA-256 values are identical.

- [ ] **Step 9: Confirm tracked source remains scoped**

Run:

```powershell
git status --short
git check-ignore android/app/src/main/assets/public android/capacitor-cordova-android-plugins android/app/build/outputs/apk/debug/app-debug.apk
git diff --exit-code -- android/app/src/main/AndroidManifest.xml android/app/src/main/java/com/resqnow1/app/MainActivity.java android/app/src/main/java/com/resqnow1/app/MyFirebaseMessagingService.java android/app/src/main/java/com/resqnow1/app/JobAlertForegroundService.java android/app/src/main/java/com/resqnow1/app/JobAlertActivity.java android/app/src/main/java/com/resqnow1/app/EmergencyNotificationHelper.java
```

Expected: no generated Capacitor/Gradle files appear as tracked changes; only planned tracked files from Task 2 are present or already committed. The manifest, `MyFirebaseMessagingService`, job-alert services/activity, emergency notification helper, and `MainActivity` remain byte-for-byte unchanged.

### Task 4: Publish the verified APK through the backend

**Files:**
- Create: `../resqnowbackend/tests/android_apk_distribution.test.js`
- Modify: `../resqnowbackend/public/downloads/resqnow.apk`

**Interfaces:**
- Consumes: Task 3 candidate `android/app/build/outputs/apk/debug/app-debug.apk` after all verification gates pass.
- Produces: the exact same bytes at the backend's existing APK path and through `/api/public/android-app/status` plus `/api/public/android-app/download`.

- [ ] **Step 1: Write the failing backend distribution test**

Create `resqnowbackend/tests/android_apk_distribution.test.js`:

```js
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import express from "express";
import publicRouter from "../routes/public.js";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

test("serves the verified Android package through status, HEAD, and GET", async (context) => {
  const expectedHash = String(process.env.EXPECTED_ANDROID_APK_SHA256 || "").trim().toLowerCase();
  assert.match(expectedHash, /^[a-f0-9]{64}$/, "EXPECTED_ANDROID_APK_SHA256 is required");

  const apkPath = path.resolve("public", "downloads", "resqnow.apk");
  const apkBytes = await readFile(apkPath);
  const apkStat = await stat(apkPath);
  assert.equal(sha256(apkBytes), expectedHash, "published APK must match the verified candidate");

  const app = express();
  app.use("/api/public", publicRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/api/public/android-app`;

  const statusResponse = await fetch(`${baseUrl}/status`);
  assert.equal(statusResponse.status, 200);
  const statusBody = await statusResponse.json();
  assert.equal(statusBody.available, true);
  assert.equal(statusBody.fileName, "resqnow.apk");
  assert.equal(statusBody.fileSize, apkStat.size);

  const headResponse = await fetch(`${baseUrl}/download`, { method: "HEAD" });
  assert.equal(headResponse.status, 200);
  assert.equal(Number(headResponse.headers.get("content-length")), apkStat.size);

  const getResponse = await fetch(`${baseUrl}/download`);
  assert.equal(getResponse.status, 200);
  assert.match(getResponse.headers.get("content-disposition") || "", /resqnow\.apk/i);
  const downloadedBytes = Buffer.from(await getResponse.arrayBuffer());
  assert.equal(sha256(downloadedBytes), expectedHash);
});
```

- [ ] **Step 2: Verify the test rejects the stale backend APK**

From `resqnowfrontend`, record the candidate hash. From `resqnowbackend`, pass only that hash into the test process:

```powershell
$candidateHash = (Get-FileHash '..\resqnowfrontend\android\app\build\outputs\apk\debug\app-debug.apk' -Algorithm SHA256).Hash.ToLowerInvariant()
$env:EXPECTED_ANDROID_APK_SHA256 = $candidateHash
node --test tests\android_apk_distribution.test.js
```

Expected: FAIL at `published APK must match the verified candidate` because the backend still contains the old package.

- [ ] **Step 3: Record and validate exact workspace-scoped paths**

Run from `resqnowfrontend`:

```powershell
$workspace = (Resolve-Path '..').Path
$candidate = (Resolve-Path 'android\app\build\outputs\apk\debug\app-debug.apk').Path
$target = (Resolve-Path '..\resqnowbackend\public\downloads').Path + '\resqnow.apk'
if (-not $candidate.StartsWith($workspace) -or -not $target.StartsWith($workspace)) { throw 'APK paths escaped the workspace.' }
if ((Get-Item $candidate).Length -le 0) { throw 'Candidate APK is empty.' }
```

Expected: both paths resolve under `E:\resqnow production code` and the candidate is non-empty.

- [ ] **Step 4: Replace the backend artifact through a verified temporary copy**

Run:

```powershell
$tempTarget = "$target.new"
Copy-Item -LiteralPath $candidate -Destination $tempTarget -Force
$candidateHash = (Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash
$tempHash = (Get-FileHash -LiteralPath $tempTarget -Algorithm SHA256).Hash
if ($candidateHash -ne $tempHash) { throw 'Temporary APK copy hash mismatch.' }
Move-Item -LiteralPath $tempTarget -Destination $target -Force
$publishedHash = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
if ($candidateHash -ne $publishedHash) { throw 'Published APK hash mismatch.' }
```

Expected: all three hashes match. The replacement is recoverable from Git until committed.

- [ ] **Step 5: Run the distribution test and backend suite without discovering the email smoke script**

Run from `resqnowbackend`:

```powershell
$candidateHash = (Get-FileHash '..\resqnowfrontend\android\app\build\outputs\apk\debug\app-debug.apk' -Algorithm SHA256).Hash.ToLowerInvariant()
$env:EXPECTED_ANDROID_APK_SHA256 = $candidateHash
node --test tests\android_apk_distribution.test.js
$testFiles = @(
  Get-ChildItem tests -Filter '*.test.js' -File
  Get-ChildItem services -Filter '*.test.js' -File
) | Where-Object { $_.Name -ne 'android_apk_distribution.test.js' } | Select-Object -ExpandProperty FullName
node --test $testFiles
npm.cmd run build
```

Expected: the distribution test passes all status/HEAD/GET assertions, all explicitly selected backend tests pass, the backend syntax build exits 0, and no email smoke script executes.

- [ ] **Step 6: Verify and commit only the backend test and APK**

Run:

```powershell
git status --short
git diff --stat
git diff --check
```

Expected: the backend repository shows only `tests/android_apk_distribution.test.js` added and `public/downloads/resqnow.apk` modified.

Then commit:

```powershell
git add tests/android_apk_distribution.test.js public/downloads/resqnow.apk
git commit -m "chore: publish current capacitor android package"
```

### Task 5: Full regression and mobile end-to-end verification

**Files:**
- Verify only: frontend tracked source and generated Android package
- Verify only: backend tracked source and published APK

**Interfaces:**
- Consumes: the synchronized frontend, candidate APK, and published backend artifact.
- Produces: fresh evidence for every success criterion and an explicit record of device/emulator availability.

- [ ] **Step 1: Run the complete frontend regression gates**

Run from `resqnowfrontend`:

```powershell
npm.cmd test
npx.cmd tsc --noEmit
npm.cmd run build
npm.cmd run mobile:verify
```

Expected: 26 Vitest files/112 tests pass, TypeScript exits 0, Vite builds, and mobile verification reports the current tracking asset. If test counts legitimately changed due to concurrent work, report the fresh counts rather than forcing these historical counts.

- [ ] **Step 2: Record the known lint baseline without expanding scope**

Run: `npm.cmd run lint`

Expected baseline: non-zero with 369 errors and 51 warnings. Compare the fresh output with the baseline and fail this task only if planned files introduce new lint findings.

- [ ] **Step 3: Test the built web app at Android viewport sizes**

Invoke the `browser:control-in-app-browser` skill, start `npm.cmd run preview -- --host 127.0.0.1 --port 4173`, and inspect these public routes at 390×844 and 412×892:

```text
/
/services
/login
/technician/login
```

For each viewport, verify the app starts, mobile navigation is reachable, primary controls are not clipped, no horizontal document overflow exists, and the console contains no uncaught application error. Use the existing `RequestTracking` Vitest integration tests as the authenticated live-tracking UI evidence; do not fabricate production customer credentials or request data.

- [ ] **Step 4: Check live backend availability and Capacitor-origin policy**

Request `https://resqnowbackend.onrender.com/health` and `/api/public/android-app/status`. Record HTTP status and response shape without exposing secrets. Confirm `capacitor.config.ts` permits the backend hostname and the packaged API bundle contains that same backend origin.

Expected: health returns 200 and status reports the deployed state. A deployment that has not yet received the local APK may still report the previous file; record that distinction and do not claim remote deployment.

- [ ] **Step 5: Detect and use a real Android target when available**

Run:

```powershell
& "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
```

If one authorized device/emulator is listed, uninstall the old mismatched package when necessary, install with `adb install android/app/build/outputs/apk/debug/app-debug.apk`, launch `com.resqnow1.app`, and inspect `adb logcat` for startup, Capacitor, Firebase, WebView, and fatal exceptions. Smoke-test launch, login entry, location permission prompt, and the current mobile shell.

If no target is listed, report the device-level smoke test as unavailable; do not represent archive/browser verification as a physical-device test.

- [ ] **Step 6: Re-run native and backend artifact verification immediately before completion**

Run:

```powershell
npm.cmd run android:test
npm.cmd run mobile:verify
```

Repeat `apksigner verify`, the `aapt dump badging` package/version assertion, and candidate-versus-published SHA-256 comparison from Tasks 3 and 4.

Expected: all checks pass with the same candidate and published hashes.

- [ ] **Step 7: Review requirements and repository state**

Read the design spec and check each Success Criterion against fresh command output. Then run `git status --short` and `git log -5 --oneline` in both repositories.

Expected: frontend contains only the planned documentation/build-tool commits with no uncommitted source changes; backend contains only the planned APK commit with no uncommitted changes.

- [ ] **Step 8: Hand off the installable artifact**

Report the final APK path, byte size, SHA-256, package ID, version code/name, signing certificate type, tests and counts, browser viewport results, backend endpoint results, and whether a real Android target was tested. State prominently that this debug certificate differs from the old APK and may require uninstalling the old app.
