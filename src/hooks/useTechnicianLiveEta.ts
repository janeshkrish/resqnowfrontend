import { useEffect, useRef, useState } from "react";

import { apiFetch } from "@/lib/api";
import { mergeLiveEta, parseLiveEta } from "@/lib/liveEta";
import { toTrafficArrival, type TrafficArrival } from "@/lib/technicianArrival";

// The backend refreshes a moving technician's ETA about every 45 seconds; asking a
// little more often keeps the screen within one refresh of it.
export const TECHNICIAN_ETA_POLL_MS = 30_000;

/**
 * The backend's ETA for the technician's own job: the same one the customer is shown,
 * traffic-aware when the backend has live traffic. Asked for only while `enabled` (the
 * technician is on the way) and the screen is visible. Null until one arrives; whether it
 * is still current is decided where it is shown (see resolveArrival).
 */
export function useTechnicianLiveEta({
  requestId,
  enabled,
}: {
  requestId: string | number | null | undefined;
  enabled: boolean;
}): TrafficArrival | null {
  const [arrival, setArrival] = useState<TrafficArrival | null>(null);
  const arrivalRef = useRef<TrafficArrival | null>(null);
  const id = requestId == null ? "" : String(requestId).trim();

  useEffect(() => {
    arrivalRef.current = null;
    setArrival(null);
    if (!enabled || !id) return;

    let cancelled = false;
    let inFlight = false;
    const load = async () => {
      if (cancelled || inFlight || document.visibilityState === "hidden") return;
      inFlight = true;
      try {
        const response = await apiFetch(
          `/api/technicians/me/active-job/eta?requestId=${encodeURIComponent(id)}`,
          { technician: true },
        );
        if (cancelled || !response.ok) return;
        const body = await response.json().catch(() => null);
        const incoming = parseLiveEta(body, id);
        // No ETA this time (switched off, or no recent position): what is on screen stays
        // until it is too old to trust.
        if (!incoming || cancelled) return;
        const current = arrivalRef.current;
        const merged = mergeLiveEta(current?.eta, incoming);
        if (merged && merged !== current?.eta) {
          const next = toTrafficArrival(merged, body?.serverTime);
          arrivalRef.current = next;
          setArrival(next);
        }
      } catch {
        // Offline or the server is unreachable: the next poll tries again.
      } finally {
        inFlight = false;
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), TECHNICIAN_ETA_POLL_MS);
    // Back from another app (Google Maps, a call): ask straight away.
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, id]);

  return arrival;
}
