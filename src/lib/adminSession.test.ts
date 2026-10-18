import { afterEach, describe, expect, it, vi } from "vitest";
import { ADMIN_SESSION_ENDED, adminTokenExpired, announceAdminSessionEnded, peekAdminPage, rememberAdminPage, takeAdminPage } from "./adminSession";

const token = (payload: Record<string, unknown>) => ["e30", btoa(JSON.stringify(payload)).replace(/=+$/, ""), "sig"].join(".");
const NOW = Date.UTC(2026, 9, 18, 9, 0, 0);

describe("the admin sign-in running out", () => {
  afterEach(() => sessionStorage.clear());

  it("knows a token whose day is over", () => {
    expect(adminTokenExpired(token({ role: "admin", exp: NOW / 1000 - 60 }), NOW)).toBe(true);
    expect(adminTokenExpired(token({ role: "admin", exp: NOW / 1000 + 3600 }), NOW)).toBe(false);
  });

  it("leaves tokens without an expiry, and missing or broken ones, to the server", () => {
    expect(adminTokenExpired(token({ role: "admin" }), NOW)).toBe(false);
    expect(adminTokenExpired(null, NOW)).toBe(false);
    expect(adminTokenExpired("not-a-token", NOW)).toBe(false);
  });

  it("returns to the admin page that was open, once", () => {
    rememberAdminPage("/admin/requests?tab=live");
    expect(peekAdminPage()).toBe("/admin/requests?tab=live");
    expect(takeAdminPage()).toBe("/admin/requests?tab=live");
    expect(takeAdminPage()).toBe("/admin/today");
  });

  it("never returns to the sign-in page or outside the portal", () => {
    rememberAdminPage("/admin/login");
    expect(takeAdminPage()).toBe("/admin/today");
    rememberAdminPage("/my-garage");
    expect(takeAdminPage()).toBe("/admin/today");
  });

  it("tells the portal when the server refuses the sign-in", () => {
    const heard = vi.fn();
    window.addEventListener(ADMIN_SESSION_ENDED, heard);
    announceAdminSessionEnded();
    window.removeEventListener(ADMIN_SESSION_ENDED, heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
