/**
 * The admin sign-in lasts a day (resqnowbackend/middleware/auth.js). When it runs out, the
 * portal goes back to the sign-in page and, once signed in again, to the page the admin was on,
 * instead of showing "Unauthorized" on every card.
 */

/** Fired when the server refuses the admin's sign-in (a 401 from an admin call). */
export const ADMIN_SESSION_ENDED = "resqnow:admin-session-ended";

const NEXT_PAGE_KEY = "resqnow_admin_next";

function payloadOf(token: string): { exp?: unknown } | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4)));
  } catch {
    return null;
  }
}

/** True once the token's own expiry time has passed. A token without one is left to the server. */
export function adminTokenExpired(token: string | null | undefined, now = Date.now()) {
  if (!token) return false;
  const exp = Number(payloadOf(token)?.exp);
  return Number.isFinite(exp) && exp > 0 && exp * 1000 <= now;
}

export function announceAdminSessionEnded() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(ADMIN_SESSION_ENDED));
}

/** An admin page worth coming back to after signing in again; the sign-in page itself is not. */
function isReturnablePage(path: string) {
  return /^\/admin(\/|$)/.test(path) && !/^\/admin\/login(\/|$|\?)/.test(path);
}

export function rememberAdminPage(path: string) {
  if (!isReturnablePage(path)) return;
  try {
    sessionStorage.setItem(NEXT_PAGE_KEY, path);
  } catch {
    // Storage blocked: after signing in the admin lands on Today instead.
  }
}

/** The page to open after signing in, without forgetting it. */
export function peekAdminPage(fallback = "/admin/today") {
  try {
    const path = sessionStorage.getItem(NEXT_PAGE_KEY);
    return path && isReturnablePage(path) ? path : fallback;
  } catch {
    return fallback;
  }
}

/** The page to open after signing in, once; Today when there is none. */
export function takeAdminPage(fallback = "/admin/today") {
  try {
    const path = sessionStorage.getItem(NEXT_PAGE_KEY);
    sessionStorage.removeItem(NEXT_PAGE_KEY);
    return path && isReturnablePage(path) ? path : fallback;
  } catch {
    return fallback;
  }
}
