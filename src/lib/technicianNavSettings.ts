import { useEffect, useSyncExternalStore } from "react";

import { apiFetch } from "@/lib/api";

/** The technician's choices for the bar at the bottom, as saved in their settings. */
export type TechnicianNavSettings = { enabled: boolean; autoHide: boolean };

let state: TechnicianNavSettings = { enabled: true, autoHide: true };
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** Called when the technician flips a switch, so the bar follows at once. */
export function setTechnicianNavSettings(next: Partial<TechnicianNavSettings>) {
  const merged = { ...state, ...next };
  if (merged.enabled === state.enabled && merged.autoHide === state.autoHide) return;
  state = merged;
  listeners.forEach((listener) => listener());
}

/** Reads the saved choices again from the server; the bar stays as it was if that fails. */
export async function loadTechnicianNavSettings() {
  try {
    const res = await apiFetch("/api/technicians/me/settings", { technician: true });
    if (!res.ok) return;
    const settings = await res.json();
    const navigation = settings?.navigation || {};
    setTechnicianNavSettings({
      enabled: navigation.mobile_bottom_nav_enabled !== false,
      autoHide: navigation.auto_hide_bottom_nav !== false,
    });
  } catch {
    // Keep what is showing.
  }
}

export function useTechnicianNavSettings() {
  const settings = useSyncExternalStore(subscribe, () => state, () => state);
  useEffect(() => {
    void loadTechnicianNavSettings();
  }, []);
  return settings;
}
