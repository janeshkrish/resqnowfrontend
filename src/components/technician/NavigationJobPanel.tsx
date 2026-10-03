import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { JobLocationBox } from "./JobCardParts";

export type NavigationArriveAction = { label: string; onClick: () => void };

/** Shown once the technician is close: a short buzz, since a rider is not watching the screen. */
function ReachedNote({ text }: { text: string }) {
  useEffect(() => {
    try {
      navigator.vibrate?.(200);
    } catch {
      // No vibration on this device: the note on screen is enough.
    }
  }, []);

  return (
    <p className="tj-nav-reached" role="status">
      <MaterialSymbol name="location_on" />
      <span data-testid="navigation-arrival-prompt">{text}</span>
    </p>
  );
}

/**
 * What the technician needs while navigating, without leaving the map: where they are
 * going, a call to the customer, and the job's own arrived step.
 */
export function NavigationJobPanel({
  stopLabel,
  address,
  landmark,
  phone,
  arrive,
  reachedText,
  busy = false,
}: {
  stopLabel: string;
  address: string;
  landmark?: string | null;
  phone?: string | null;
  /** The job's next step when it is an arrival; null when the job has none right now. */
  arrive?: NavigationArriveAction | null;
  /** Set when the technician is close enough to be asked to mark arrival. */
  reachedText?: string | null;
  busy?: boolean;
}) {
  const reached = Boolean(reachedText && arrive);

  return (
    <div className="tj tj-nav">
      {reached ? <ReachedNote text={String(reachedText)} /> : null}

      <div data-testid="navigation-destination">
        <JobLocationBox label={stopLabel} address={address} landmark={landmark} />
      </div>

      {phone || arrive ? (
        <div className={`tj-pair ${phone && arrive ? "" : "is-single"}`}>
          {phone ? (
            <a href={`tel:${phone}`} aria-label="Call customer" className="tj-act">
              <MaterialSymbol name="call" />
              Call
            </a>
          ) : null}
          {arrive ? (
            <button
              type="button"
              className={`tj-cta ${reached ? "is-near" : ""}`}
              onClick={arrive.onClick}
              disabled={busy}
            >
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <MaterialSymbol name="location_on" />}
              {arrive.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
