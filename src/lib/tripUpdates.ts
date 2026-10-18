import { useEffect, useMemo, useRef } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import type { TrackingPhase } from "@/lib/customerTracking";
import {
  shouldSendTripUpdate,
  tripLiveUpdate,
  type TripLiveUpdate,
  type TripLiveUpdateInput,
} from "@/lib/tripLiveUpdate";

type TripUpdatesPlugin = {
  update(options: TripLiveUpdate): Promise<void>;
  end(options: { requestId: string }): Promise<void>;
  getStatus(): Promise<{ notificationsEnabled: boolean; liveUpdatesAllowed: boolean }>;
};

/** The Android app's TripUpdatesPlugin (android/.../TripUpdatesPlugin.java). */
export const TripUpdates = registerPlugin<TripUpdatesPlugin>("TripUpdates");

/** Only the Android app has the Live Update; the website shows the tracking page alone. */
export function canShowTripUpdates() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

const LEG_PHASES: ReadonlySet<TrackingPhase> = new Set<TrackingPhase>(["way", "towing"]);

/**
 * Keeps the request's Live Update in step with the tracking card while the app runs. Pushes
 * from the server keep it going when the app is closed. It sends only when the words, the
 * chip or the bar change, so an ETA every few seconds is at most one update a minute.
 */
export function useTripLiveUpdate(input: TripLiveUpdateInput | null) {
  const leg = useRef<{ key: string; seconds: number } | null>(null);
  const sawItLive = useRef<string | null>(null);
  const lastSent = useRef<string>("");

  // The first ETA of each leg is where the bar starts for that leg.
  const legKey = input ? `${input.requestId}:${input.phase}` : "";
  if (input && LEG_PHASES.has(input.phase) && input.liveEta && leg.current?.key !== legKey) {
    leg.current = { key: legKey, seconds: input.liveEta.etaSeconds };
  }
  const legStart = input && leg.current?.key === legKey ? leg.current.seconds : null;

  const update = useMemo(
    () => (input ? tripLiveUpdate({ ...input, legStartEtaSeconds: legStart }) : null),
    // The input object is rebuilt on every render; what it says is what matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(input), legStart],
  );
  // arrivalAt moves a little with every ETA; the minutes in the words carry the change.
  const signature = update ? JSON.stringify({ ...update, arrivalAt: Math.round(update.arrivalAt / 60000) }) : "";

  useEffect(() => {
    if (!update || !canShowTripUpdates()) return;
    if (update.phase !== "rate" && update.phase !== "closed" && update.phase !== "cancelled") {
      sawItLive.current = update.requestId;
    }
    if (!shouldSendTripUpdate(update, sawItLive.current === update.requestId)) return;
    if (lastSent.current === signature) return;
    lastSent.current = signature;
    TripUpdates.update(update).catch(() => {
      // An older app without the plugin, or notifications switched off: the card still shows.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);
}
