import LiveTrackingMap from "@/components/user/LiveTrackingMap";
import type { TrackingFreshness } from "@/lib/liveTrackingPlayback";

type Point = { lat: number; lng: number };

type Props = {
  requestId: string;
  customer: Point;
  /** Where the technician is; null while none is assigned or their position is not known. */
  technicianAt: Point | null;
  /** How the technician is moving, as the live connection reports it. */
  motion?: {
    speed?: number | null;
    heading?: number | null;
    accuracy?: number | null;
    locationUpdatedAt?: number | null;
    sequenceId?: number | null;
  } | null;
  freshness: TrackingFreshness;
  status?: string;
  towing: boolean;
  /** The map could not be drawn; the card goes back to its drawing. */
  onUnavailable: () => void;
};

/**
 * The real live-tracking map, sized for the active request card on home. It is the same
 * map as the tracking page, fed with what the card already has from the live connection:
 * the technician glides along it as their positions arrive. It only shows; a tap on it
 * opens tracking.
 */
export default function ActiveRequestMap({ requestId, customer, technicianAt, motion, freshness, status, towing, onUnavailable }: Props) {
  return (
    <LiveTrackingMap
      variant="mini"
      techLocation={technicianAt}
      technicianSpeed={motion?.speed}
      technicianHeading={motion?.heading}
      technicianAccuracy={motion?.accuracy}
      technicianRecordedAt={motion?.locationUpdatedAt}
      technicianSequenceId={motion?.sequenceId}
      trackingFreshness={freshness}
      userLocation={customer}
      routeDestination={customer}
      trackingSessionId={requestId}
      status={status}
      showRoutePath={Boolean(technicianAt)}
      technicianVehicle={towing ? "tow" : "bike"}
      userLabel=""
      onUnavailable={onUnavailable}
      className="h-full w-full"
    />
  );
}
