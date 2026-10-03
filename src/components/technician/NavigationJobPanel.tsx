import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { JobLocationBox } from "./JobCardParts";

export type NavigationArriveAction = { label: string; onClick: () => void };

/** A hand-over to another navigation app, and what the technician should know before using it. */
export type NavigationHandOver = { href: string; note?: string | null };

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
 * going, a call to the customer, Google Maps for those who prefer it, and the job's own
 * arrived step.
 */
export function NavigationJobPanel({
  stopLabel,
  address,
  landmark,
  phone,
  googleMaps,
  arrive,
  reachedText,
  busy = false,
}: {
  stopLabel: string;
  address: string;
  landmark?: string | null;
  phone?: string | null;
  /** Opens Google Maps to the same destination; this screen stays open to come back to. */
  googleMaps?: NavigationHandOver | null;
  /** The job's next step when it is an arrival; null when the job has none right now. */
  arrive?: NavigationArriveAction | null;
  /** Set when the technician is close enough to be asked to mark arrival. */
  reachedText?: string | null;
  busy?: boolean;
}) {
  const reached = Boolean(reachedText && arrive);

  const callButton = phone ? (
    <a href={`tel:${phone}`} aria-label="Call customer" className="tj-act">
      <MaterialSymbol name="call" />
      Call
    </a>
  ) : null;
  const arriveButton = arrive ? (
    <button type="button" className={`tj-cta ${reached ? "is-near" : ""}`} onClick={arrive.onClick} disabled={busy}>
      {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <MaterialSymbol name="location_on" />}
      {arrive.label}
    </button>
  ) : null;

  return (
    <div className="tj tj-nav">
      {reached ? <ReachedNote text={String(reachedText)} /> : null}

      <div data-testid="navigation-destination">
        <JobLocationBox label={stopLabel} address={address} landmark={landmark} />
      </div>

      {googleMaps ? (
        <>
          {/* The smaller choices share a row; the job's own step keeps the full width below. */}
          <div className={`tj-pair is-even ${callButton ? "" : "is-single"}`}>
            {callButton}
            <a
              href={googleMaps.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open in Google Maps"
              className="tj-act"
            >
              <MaterialSymbol name="directions" />
              Google Maps
            </a>
          </div>
          {googleMaps.note ? <p className="tj-nav-note">{googleMaps.note}</p> : null}
          {arriveButton}
        </>
      ) : callButton || arriveButton ? (
        <div className={`tj-pair ${callButton && arriveButton ? "" : "is-single"}`}>
          {callButton}
          {arriveButton}
        </div>
      ) : null}
    </div>
  );
}
