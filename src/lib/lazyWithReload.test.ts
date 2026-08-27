import { describe, expect, it } from "vitest";
import { claimChunkReload, isChunkLoadFailure } from "./lazyWithReload";

describe("isChunkLoadFailure", () => {
  it.each([
    new TypeError("Failed to fetch dynamically imported module: /assets/RequestTracking.js"),
    new Error("Loading chunk RequestTracking failed"),
    new Error("Importing a module script failed"),
    new Error("Unable to preload CSS for /assets/app.css"),
  ])("recognizes stale deployment asset failures", (error) => {
    expect(isChunkLoadFailure(error)).toBe(true);
  });

  it("does not hide ordinary runtime bugs behind a reload", () => {
    expect(
      isChunkLoadFailure(new ReferenceError("requestServiceType is not defined")),
    ).toBe(false);
  });
});

describe("claimChunkReload", () => {
  it("allows one reload for the same failed chunk within the guard window", () => {
    window.sessionStorage.clear();
    const error = new TypeError(
      "Failed to fetch dynamically imported module: /assets/RequestTracking-old.js",
    );

    expect(claimChunkReload(error, "/service-tracking/123", window.sessionStorage, 1_000)).toBe(true);
    expect(claimChunkReload(error, "/service-tracking/123", window.sessionStorage, 2_000)).toBe(false);
  });

  it("allows recovery for a different chunk fingerprint", () => {
    window.sessionStorage.clear();

    expect(
      claimChunkReload(
        new Error("Loading chunk RequestTracking-old failed"),
        "/service-tracking/123",
        window.sessionStorage,
        1_000,
      ),
    ).toBe(true);
    expect(
      claimChunkReload(
        new Error("Loading chunk TechnicianDashboard-old failed"),
        "/technician/dashboard",
        window.sessionStorage,
        2_000,
      ),
    ).toBe(true);
  });
});
