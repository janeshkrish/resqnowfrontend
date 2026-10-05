import type { TrackingPhase } from "@/lib/customerTracking";
import { cn } from "@/lib/utils";
import MaterialSymbol from "./MaterialSymbol";

type Props = {
  phase: TrackingPhase;
  /** How far along the line the technician is: 0 is the start, 1 is at the vehicle. */
  progress: number;
  /** What the technician rides; picks the picture in their disc. */
  vehicle: "bike" | "tow";
  /** The picture of the customer's own vehicle, at the end of the line. */
  art: string;
};

/**
 * The request's progress as one slim line: the technician rides it to the customer's
 * vehicle. A dot searches the line while a technician is being found; the disc rides it
 * while they travel, gets a tick on arrival, and turns into a spanner while the work is
 * done. It is a picture only: the words beside it say the same thing.
 */
export default function ActiveRequestTrip({ phase, progress, vehicle, art }: Props) {
  const searching = phase === "search";
  const moving = phase === "way";
  const working = phase === "working";
  // The customer's vehicle keeps its hazard light on until help reaches it.
  const waiting = searching || phase === "accepted" || moving;
  const share = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  // The line runs from 6px in to 54px short of the right edge, where the vehicle stands.
  const along = `(100% - 60px) * ${share.toFixed(3)}`;

  return (
    <div className="rq-ht-trip" data-testid="home-request-trip" data-phase={phase} data-progress={share.toFixed(2)} aria-hidden="true">
      <span className={cn("rq-ht-rail", searching && "is-faint")} />
      {moving ? <span className="rq-ht-flow" /> : null}
      {searching ? <span className="rq-ht-seek" /> : <span className="rq-ht-done" style={{ width: `calc(${along})` }} />}
      <span className={cn("rq-ht-from", searching && "is-seek")} />
      <span className="rq-ht-veh">
        <img src={art} alt="" draggable={false} />
        {waiting ? <i className="rq-ht-hazard" /> : null}
      </span>
      {searching ? null : (
        <span className="rq-ht-rider" data-testid="home-request-trip-rider" style={{ left: `calc(6px + ${along})` }}>
          <span className={cn("rq-ht-disc", working && "is-work")}>
            {moving ? <i className="rq-ht-halo" /> : null}
            <MaterialSymbol name={working ? "build" : vehicle === "tow" ? "auto_towing" : "two_wheeler"} />
            {phase === "arrived" ? (
              <span className="rq-ht-ok" data-testid="home-request-trip-arrived">
                <MaterialSymbol name="check" />
              </span>
            ) : null}
          </span>
        </span>
      )}
    </div>
  );
}
