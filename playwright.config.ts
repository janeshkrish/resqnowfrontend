import { defineConfig, devices } from "@playwright/test";

const PORT = 5193;

// End-to-end tests run the real app on the Vite dev server in the installed
// Chrome. Every backend call is answered by the test, and the Mappls SDK is
// replaced by e2e/fixtures/fakeMapplsSdk.js, so no keys or network are needed.
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  globalSetup: "./scripts/e2e-server.mjs",
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    // Synthetic browser checks must not wait for public font/CDN availability.
    // Keep application fonts unchanged; only this isolated Chrome run resolves
    // the external font hosts locally as unavailable.
    launchOptions: {
      args: ["--host-resolver-rules=MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND"],
    },
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1366, height: 860 } } },
  ],
});
