import { defineConfig, devices } from "@playwright/test";

const PORT = 5179;

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
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    serviceWorkers: "block",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: "chrome", viewport: { width: 1366, height: 860 } } },
  ],
  webServer: {
    command: `npx vite --host localhost --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_FRONTEND_ONLY: "false",
      VITE_API_URL: "http://api.e2e.test",
    },
  },
});
