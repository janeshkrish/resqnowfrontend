const normalizeBaseUrl = (value: string | undefined): string => {
  const trimmed = (value ?? "").trim();
  const unquoted = trimmed.replace(/^["']|["']$/g, "");
  return unquoted.replace(/\/+$/, "");
};

export const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL);

export function getRequiredApiBaseUrl(): string {
  if (!API_BASE_URL) {
    throw new Error(
      "Missing VITE_API_URL. Set it in your root .env (e.g. VITE_API_URL=https://resqnowbackend.onrender.com)."
    );
  }
  return API_BASE_URL;
}

export function apiUrl(path: string): string {
  const base = getRequiredApiBaseUrl();
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}

export function getTechnicianToken(): string | null {
  return localStorage.getItem("resqnow_technician_token");
}

export function getAdminToken(): string | null {
  return localStorage.getItem("resqnow_admin_token");
}

export async function apiFetch(
  path: string,
  options: RequestInit & { admin?: boolean; technician?: boolean } = {}
): Promise<Response> {
  const { admin, technician, headers = {}, ...rest } = options;
  const h = new Headers(headers);
  h.set("Content-Type", "application/json");

  if (admin) {
    const t = getAdminToken();
    if (t) h.set("Authorization", `Bearer ${t}`);
  } else if (technician) {
    const t = getTechnicianToken();
    if (t) h.set("Authorization", `Bearer ${t}`);
  } else {
    // Default to User token if no specific role requested
    const t = getUserToken();
    if (t) h.set("Authorization", `Bearer ${t}`);
  }
  return fetch(apiUrl(path), { ...rest, headers: h });
}

export function setTechnicianToken(token: string | null) {
  if (token) localStorage.setItem("resqnow_technician_token", token);
  else localStorage.removeItem("resqnow_technician_token");
}

export function setAdminToken(token: string | null) {
  if (token) localStorage.setItem("resqnow_admin_token", token);
  else localStorage.removeItem("resqnow_admin_token");
}

export function getUserToken(): string | null {
  return localStorage.getItem("resqnow_user_token");
}

export function setUserToken(token: string | null) {
  if (token) localStorage.setItem("resqnow_user_token", token);
  else localStorage.removeItem("resqnow_user_token");
}

export function getUserProfile(): { id: string; name: string; email: string } | null {
  try {
    const raw = localStorage.getItem("resqnow_user_profile");
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && typeof p.id !== "undefined" && p.name && p.email ? p : null;
  } catch {
    return null;
  }
}

export function setUserProfile(profile: { id: string; name: string; email: string } | null) {
  if (profile) localStorage.setItem("resqnow_user_profile", JSON.stringify(profile));
  else localStorage.removeItem("resqnow_user_profile");
}
