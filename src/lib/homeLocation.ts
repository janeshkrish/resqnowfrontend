import { useSyncExternalStore } from "react";

export type HomeCoordinates = { lat: number; lng: number };

// The home header already asks for the customer's location; sections below it (fuel
// prices) read the same fix from here instead of requesting location a second time.
let current: HomeCoordinates | null = null;
const listeners = new Set<() => void>();

export function setHomeCoordinates(next: HomeCoordinates | null) {
  if (next && current && next.lat === current.lat && next.lng === current.lng) return;
  if (!next && !current) return;
  current = next ? { lat: next.lat, lng: next.lng } : null;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useHomeCoordinates(): HomeCoordinates | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}
