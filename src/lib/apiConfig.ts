export const PRODUCTION_API_BASE_URL = "https://resqnowbackend-production-c392.up.railway.app";
export const DEVELOPMENT_API_BASE_URL = "http://localhost:5000";

type ApiConfigurationInput = {
  apiUrl?: string;
  frontendOnly?: string;
  production: boolean;
};

/** Shared by Vite and the bundled client so build-time and runtime checks agree. */
export function resolveApiConfiguration(input: ApiConfigurationInput) {
  const flag = String(input.frontendOnly ?? "").trim().toLowerCase();
  const frontendOnlyMode = flag === "true" || flag === "1";
  if (input.production && !["", "false", "0"].includes(flag)) {
    throw new Error("Production requires VITE_FRONTEND_ONLY=false; demo mode is not supported.");
  }

  const configured = String(input.apiUrl ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/\/+$/, "");

  if (!configured) {
    if (input.production) {
      throw new Error("Missing VITE_API_URL for production. Configure the Railway API origin without /api.");
    }
    return { apiBaseUrl: frontendOnlyMode ? "" : DEVELOPMENT_API_BASE_URL, frontendOnlyMode };
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("VITE_API_URL must be an absolute HTTP(S) origin without /api.");
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username || url.password || url.search || url.hash || url.pathname !== "/"
  ) {
    throw new Error("VITE_API_URL must be an HTTP(S) origin without credentials, a path, query or fragment.");
  }
  if (input.production && url.origin !== PRODUCTION_API_BASE_URL) {
    throw new Error("Production VITE_API_URL must be the approved HTTPS Railway origin without /api.");
  }

  return { apiBaseUrl: url.origin, frontendOnlyMode };
}
