# Release-quality verification

This is a prerequisite gate, not permission to deploy, sign an APK or publish an update.
Use Node22 and an isolated checkout with no non-example root .env files.
The runner checks filenames before any Vite environment loading; it never reads private values.
It discards inherited application credentials/Node preload options and supplies synthetic
Firebase/API settings with app updates disabled. Never put production credentials here.

## Frontend

Run npm ci --ignore-scripts, then
node node_modules/@playwright/test/cli.js install --with-deps chrome and npm run release:check.
On Windows set TEMP and TMP to an owned directory on a drive with sufficient space first.
Do not share the checkout or edit sources during the run.

The command requires, in order:

1. TypeScript with unchanged application compiler flags and zero diagnostics.
2. Every scripts/*.test.mjs Node test, with no skipped/todo/cancelled cases.
3. Every application unit test under src, with fresh JSON evidence and no skipped cases.
4. The complete default e2e suite, phone and desktop, no filtering or retries.
5. A production Vite build using synthetic settings, never a distributable production APK.

The Vite global setup owns its server directly on localhost5193 and closes it at teardown.
It refuses an occupied port instead of reusing or terminating another server.
This avoids the Windows shell-process teardown hang without changing app behavior.
The only permitted browser skips are existing explicitly documented viewport-inapplicable
cases in the runner. Each requires a passing counterpart on the other project.
Unexpected skips, missing reports, worker errors, flaky/expected-failure results,
zero tests or a nonzero child status fail closed before the build.

Fresh reports and summary.json are written under ignored output/quality/runs/<unique-id>/.
Never reuse an older report as a successful current run. Do not upload traces containing
real authentication or customer data. The gate turns traces off.

The reusable Verify frontend workflow has read-only repository permissions and pinned
actions. It installs Chrome and invokes this same command; no signing, OIDC or deployment
permissions/secrets are supplied. Branch protection and requiring the check are owner
settings, not enabled by committing this file.

Separate real-API analytics/native acceptance checks remain separate acceptance work:
this default browser gate exercises synthetic mocked APIs, not a production backend,
microphone hardware, Android installation, staging TiDB or updater publication.
Hosted CI still needs a real run after an authorized push.
