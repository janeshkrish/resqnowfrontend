import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const RAILWAY = "https://resqnowbackend-production-c392.up.railway.app";
let previousFetch: typeof window.fetch;

beforeEach(() => {
  previousFetch = window.fetch;
  vi.resetModules();
  vi.stubEnv("PROD", true);
  vi.stubEnv("MODE", "production");
  vi.stubEnv("VITE_API_URL", RAILWAY);
  vi.stubEnv("VITE_FRONTEND_ONLY", "false");
});

afterEach(() => {
  window.fetch = previousFetch;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("production backend configuration", () => {
  it("uses Railway for REST, Axios and the shared socket/native endpoint helpers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}"));
    vi.stubGlobal("fetch", fetchMock);
    const api = await import("./api");
    expect(api.FRONTEND_ONLY_MODE).toBe(false);
    expect(api.getRequiredApiBaseUrl()).toBe(RAILWAY);
    expect(api.apiUrl("/api/technicians/me/location")).toBe(`${RAILWAY}/api/technicians/me/location`);
    await api.apiFetch("/api/public/stats");
    expect(fetchMock).toHaveBeenCalledWith(`${RAILWAY}/api/public/stats`, expect.any(Object));

    const { adminApi } = await import("@/pages/adminExtended/api/adminExtendedApi");
    const { rootApi } = await import("@/pages/adminPortal/api/portalApi");
    expect(adminApi.defaults.baseURL).toBe(`${RAILWAY}/api/admin`);
    expect(rootApi.defaults.baseURL).toBe(`${RAILWAY}/api`);
  });

  it("normalizes an explicitly configured origin with quotes and trailing slashes", async () => {
    vi.stubEnv("VITE_API_URL", ` "${RAILWAY}///" `);
    const { API_BASE_URL } = await import("./api");
    expect(API_BASE_URL).toBe(RAILWAY);
  });

  it.each([
    ["missing", ""],
    ["relative", "/api"],
    ["malformed", "not-a-url"],
    ["old Render", "https://resqnowbackend.onrender.com"],
    ["HTTP", "http://resqnowbackend-production-c392.up.railway.app"],
    ["localhost", "http://localhost:5000"],
    ["API suffix", `${RAILWAY}/api`],
    ["credentials", "https://user:password@resqnowbackend-production-c392.up.railway.app"],
    ["query", `${RAILWAY}?mode=test`],
    ["fragment", `${RAILWAY}#test`],
  ])("rejects a %s production API URL before requests can be sent", async (_label, value) => {
    vi.stubEnv("VITE_API_URL", value);
    await expect(import("./api")).rejects.toThrow(/VITE_API_URL/);
  });

  it.each(["true", "1"])("rejects production demo mode (%s)", async (value) => {
    vi.stubEnv("VITE_FRONTEND_ONLY", value);
    await expect(import("./api")).rejects.toThrow(/VITE_FRONTEND_ONLY/);
  });
});

describe("local development", () => {
  beforeEach(() => {
    vi.stubEnv("PROD", false);
    vi.stubEnv("MODE", "development");
  });

  it("uses the documented local backend when no URL is configured", async () => {
    vi.stubEnv("VITE_API_URL", "");
    const { API_BASE_URL } = await import("./api");
    expect(API_BASE_URL).toBe("http://localhost:5000");
  });

  it("preserves an explicitly configured LAN backend", async () => {
    vi.stubEnv("VITE_API_URL", "http://192.168.1.20:5000/");
    const { apiUrl } = await import("./api");
    expect(apiUrl("/api/public/stats")).toBe("http://192.168.1.20:5000/api/public/stats");
  });

  it("preserves explicitly enabled local demo mode", async () => {
    vi.stubEnv("VITE_API_URL", "");
    vi.stubEnv("VITE_FRONTEND_ONLY", "true");
    const { FRONTEND_ONLY_MODE, apiUrl } = await import("./api");
    expect(FRONTEND_ONLY_MODE).toBe(true);
    expect(apiUrl("/api/users/login")).toBe("/api/users/login");
  });
});
