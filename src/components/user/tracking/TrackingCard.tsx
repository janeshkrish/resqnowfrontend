import { useId, useState, type PointerEvent } from "react";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { toast } from "@/components/ui/sonner";
import type { TrackingHeadline, TrackingPhase, TrackingStep } from "@/lib/customerTracking";
import { cn } from "@/lib/utils";

export type TrackingLiveChip = { text: string; tone: "ok" | "warn" | "off" };

export type TrackingTechnician = {
  name: string;
  first: string;
  initials: string;
  avatarUrl?: string | null;
  phone?: string | null;
  /** e.g. "4.8 · 38 jobs · Verified" */
  meta: string;
};

export type TrackingRequestRow = {
  title: string;
  line: string;
  art: string;
  /** The total, e.g. "₹110"; null until the price is known. */
  fare: string | null;
};

export type TrackingPayActions = {
  amountLabel: string | null;
  technicianFirst: string;
  onPayOnline: () => void;
  onPayCash: () => void;
};

/** Pointer handlers that let the top of the card be dragged like the handle. */
export type TrackingDragProps = { onPointerDown?: (event: PointerEvent<HTMLElement>) => void };

function ProgressSteps({ steps, bare = false }: { steps: TrackingStep[]; bare?: boolean }) {
  return (
    <ol className={cn("lt-steps", bare && "is-bare")} aria-label={bare ? undefined : "Progress"} aria-hidden={bare || undefined}>
      {steps.map((step) => (
        <li
          key={step.label}
          className={cn("lt-step", step.state === "done" && "is-done", step.state === "now" && "is-now")}
          aria-current={!bare && step.state === "now" ? "step" : undefined}
        >
          <i aria-hidden="true" />
          <span>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

function TechnicianAvatar({ technician }: { technician: TrackingTechnician }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="lt-avatar" aria-hidden="true">
      {technician.avatarUrl && !failed ? (
        <img src={technician.avatarUrl} alt="" draggable={false} onError={() => setFailed(true)} />
      ) : (
        technician.initials
      )}
    </span>
  );
}

function RatingBlock({ onSubmit, onHome }: { onSubmit: (stars: number, comment: string) => void; onHome: () => void }) {
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const commentId = useId();

  return (
    <div className="lt-pay" data-testid="tracking-rating">
      <div className="lt-stars" role="group" aria-label="Rate your technician">
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value}
            type="button"
            className={cn("lt-star", stars >= value && "is-on")}
            aria-label={`${value} ${value === 1 ? "star" : "stars"}`}
            aria-pressed={stars >= value}
            onClick={() => setStars(value)}
          >
            <MaterialSymbol name="star" />
          </button>
        ))}
      </div>
      <div className="lt-field">
        <label htmlFor={commentId}>Anything to add? (optional)</label>
        <textarea
          id={commentId}
          value={comment}
          placeholder="Tell us how it went"
          onChange={(event) => setComment(event.target.value)}
        />
      </div>
      <button
        type="button"
        className="lt-cta is-dark lt-press"
        onClick={() => {
          if (stars === 0) {
            toast.error("Please rate the service quality");
            return;
          }
          onSubmit(stars, comment);
        }}
      >
        Send rating
      </button>
      <button type="button" className="lt-ghost lt-press" onClick={onHome}>
        Back to home
      </button>
    </div>
  );
}

export type TrackingCardProps = {
  phase: TrackingPhase;
  headline: TrackingHeadline;
  steps: TrackingStep[];
  live: TrackingLiveChip | null;
  /** Shown when the technician's position has stopped arriving. */
  notice: string | null;
  onRefresh: () => void;
  technician: TrackingTechnician | null;
  request: TrackingRequestRow | null;
  /** Opens or closes the details below the card. Left out where they are always shown. */
  details?: { open: boolean; onToggle: () => void };
  pay: TrackingPayActions | null;
  rating: { onSubmit: (stars: number, comment: string) => void } | null;
  onHome: () => void;
  /** Cancel sits on the card itself only while a technician is still being found. */
  onCancel?: () => void;
  drag?: TrackingDragProps;
};

/** The customer's tracking card: what is happening, who is coming, and what to do next. */
export function TrackingCard({
  phase,
  headline,
  steps,
  live,
  notice,
  onRefresh,
  technician,
  request,
  details,
  pay,
  rating,
  onHome,
  onCancel,
  drag,
}: TrackingCardProps) {
  const requestRow = request ? (
    <>
      <span className="lt-thumb">
        <img src={request.art} alt="" draggable={false} />
      </span>
      <span className="lt-reqid">
        <b>{request.title}</b>
        <span>{request.line}</span>
      </span>
      {request.fare || details ? (
        <span className="lt-fare">
          {request.fare ? <b>{request.fare}</b> : null}
          {details ? (
            <span>
              {details.open ? "Hide" : "Details"}
              <MaterialSymbol name={details.open ? "expand_more" : "expand_less"} />
            </span>
          ) : null}
        </span>
      ) : null}
    </>
  ) : null;

  return (
    <div className="lt-pad" data-testid="tracking-card" data-phase={phase}>
      <div className={cn("lt-status", drag?.onPointerDown && "is-grab")} {...drag}>
        <div className="lt-status-top">
          <p className="lt-say" aria-live="polite">
            {headline.say}
          </p>
          {live ? (
            <span className={cn("lt-live", `is-${live.tone}`)} data-testid="tracking-freshness">
              <i aria-hidden="true" />
              {live.text}
            </span>
          ) : null}
        </div>
        <div className="lt-bigrow">
          <p className={cn("lt-big", headline.bigIsText && "is-text")} data-testid="tracking-big">
            {headline.big}
          </p>
          {headline.side ? <span className="lt-side">{headline.side}</span> : null}
        </div>
        {headline.sub ? <p className="lt-sub">{headline.sub}</p> : null}
      </div>

      {notice ? (
        <p className="lt-notice" role="status">
          <MaterialSymbol name="location_off" />
          <span>{notice}</span>
          <button type="button" className="lt-link" onClick={onRefresh}>
            Refresh
          </button>
        </p>
      ) : null}

      {phase !== "cancelled" ? <ProgressSteps steps={steps} /> : null}

      {pay ? (
        <div className="lt-pay" data-testid="tracking-pay">
          <button type="button" className="lt-cta lt-press" onClick={pay.onPayOnline}>
            <MaterialSymbol name="lock" />
            {pay.amountLabel ? `Pay ${pay.amountLabel} online` : "Pay online"}
          </button>
          <button type="button" className="lt-ghost lt-press" onClick={pay.onPayCash}>
            <MaterialSymbol name="payments" className="is-line" />
            Pay cash to {pay.technicianFirst}
          </button>
          <p className="lt-hint">Have a coupon? Add it on the next step.</p>
        </div>
      ) : null}

      {rating ? <RatingBlock onSubmit={rating.onSubmit} onHome={onHome} /> : null}

      {phase === "cancelled" || phase === "closed" ? (
        <div className="lt-pay">
          <button type="button" className="lt-cta is-dark lt-press" onClick={onHome}>
            Back to home
          </button>
        </div>
      ) : null}

      {technician && phase !== "rate" && phase !== "closed" && phase !== "cancelled" ? (
        <>
          <hr className="lt-rule" />
          <div className="lt-techrow" data-testid="tracking-technician">
            <TechnicianAvatar technician={technician} />
            <div className="lt-techid">
              <b>
                <span className="lt-name">{technician.name}</span>
                <MaterialSymbol name="verified" />
              </b>
              <span>
                <MaterialSymbol name="star" />
                {technician.meta}
              </span>
            </div>
            {technician.phone ? (
              <>
                <a className="lt-icon lt-press" href={`sms:${technician.phone}`} aria-label={`Message ${technician.first}`}>
                  <MaterialSymbol name="chat" className="is-line" />
                </a>
                <a className="lt-icon is-dark lt-press" href={`tel:${technician.phone}`} aria-label={`Call ${technician.first}`}>
                  <MaterialSymbol name="call" />
                </a>
              </>
            ) : null}
          </div>
        </>
      ) : null}

      {request && phase !== "rate" && phase !== "closed" && phase !== "cancelled" ? (
        details ? (
          <button
            type="button"
            className="lt-req lt-press"
            data-testid="tracking-request"
            aria-expanded={details.open}
            aria-label={`${details.open ? "Hide" : "Show"} request details`}
            onClick={details.onToggle}
          >
            {requestRow}
          </button>
        ) : (
          <div className="lt-req" data-testid="tracking-request">
            {requestRow}
          </div>
        )
      ) : null}

      {onCancel ? (
        <button type="button" className="lt-ghost is-danger lt-press" onClick={onCancel}>
          Cancel request
        </button>
      ) : null}
    </div>
  );
}

export type TrackingStripProps = {
  headline: Pick<TrackingHeadline, "big" | "bigIsText" | "side" | "sub">;
  steps: TrackingStep[];
  /** The dot before the second line: green while live, amber when the position is old. */
  dot: "ok" | "warn" | null;
  call: { phone: string; first: string } | null;
  pay: { onPayOnline: () => void } | null;
  onExpand: () => void;
  drag?: TrackingDragProps;
};

/** The card shrunk to a strip, so the map has the screen but the time and Call stay in reach. */
export function TrackingStrip({ headline, steps, dot, call, pay, onExpand, drag }: TrackingStripProps) {
  return (
    <>
      <div className="lt-mini-row">
        <button type="button" className="lt-mini-main" aria-label="Show the full card" onClick={onExpand} {...drag}>
          <span className="lt-mini-top">
            <span className={cn("lt-mini-big", headline.bigIsText && "is-text")}>{headline.big}</span>
            {headline.side ? <span className="lt-mini-side">{headline.side}</span> : null}
          </span>
          <span className="lt-mini-sub">
            {dot ? <i className={dot === "warn" ? "is-late" : undefined} aria-hidden="true" /> : null}
            <span>{headline.sub}</span>
          </span>
        </button>
        {call && !pay ? (
          <a className="lt-icon is-dark lt-press" href={`tel:${call.phone}`} aria-label={`Call ${call.first}`}>
            <MaterialSymbol name="call" />
          </a>
        ) : null}
        {pay ? (
          <button type="button" className="lt-cta lt-mini-pay lt-press" onClick={pay.onPayOnline}>
            Pay
          </button>
        ) : null}
      </div>
      <ProgressSteps steps={steps} bare />
    </>
  );
}

export type TrackingBill = {
  rows: Array<{ label: string; value: string }>;
  total: string;
  note: string;
};

export type TrackingDetailsProps = {
  place: {
    title: string;
    pickupLabel: string;
    address: string;
    drop: { label: string; address: string } | null;
  };
  bill: TrackingBill | null;
  onShare: () => void;
  onHelp: () => void;
  /** Cancel is offered here once a technician has accepted, until they set off. */
  onCancel?: () => void;
  /** Said in place of Cancel once the technician has set off. */
  cancelClosedNote: string | null;
  requestLine: string;
};

/** Everything behind the card: where help is going, the bill, and ways to get help. */
export function TrackingDetails({ place, bill, onShare, onHelp, onCancel, cancelClosedNote, requestLine }: TrackingDetailsProps) {
  return (
    <div className="lt-details" data-testid="tracking-details">
      <div className="lt-band" aria-hidden="true" />
      <div className="lt-pad">
        <h3 className="lt-h">{place.title}</h3>
        <div className="lt-box">
          <div className="lt-stop">
            <span className="lt-dot" aria-hidden="true" />
            <div className="lt-stopid">
              <small>{place.pickupLabel}</small>
              <span>{place.address}</span>
            </div>
          </div>
          {place.drop ? (
            <div className="lt-stop is-drop">
              <span className="lt-sq" aria-hidden="true" />
              <div className="lt-stopid">
                <small>{place.drop.label}</small>
                <span>{place.drop.address}</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {bill ? (
        <>
          <div className="lt-band" aria-hidden="true" />
          <div className="lt-pad" data-testid="tracking-bill">
            <h3 className="lt-h">Your bill</h3>
            <dl className="lt-bill">
              {bill.rows.map((row) => (
                <div key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
              <div className="is-total">
                <dt>Total</dt>
                <dd>{bill.total}</dd>
              </div>
            </dl>
            <p className="lt-note">
              <MaterialSymbol name="verified_user" />
              {bill.note}
            </p>
          </div>
        </>
      ) : null}

      <div className="lt-band" aria-hidden="true" />
      <div className="lt-pad">
        <ul className="lt-list">
          <li>
            <button type="button" className="lt-row" onClick={onShare}>
              <MaterialSymbol name="ios_share" className="is-line" />
              <span>Share live tracking</span>
              <MaterialSymbol name="chevron_right" />
            </button>
          </li>
          <li>
            <button type="button" className="lt-row is-sos" onClick={onHelp}>
              <MaterialSymbol name="emergency" />
              <span>Safety and emergency help</span>
              <MaterialSymbol name="chevron_right" />
            </button>
          </li>
          <li>
            <a className="lt-row" href="/contact">
              <MaterialSymbol name="support_agent" className="is-line" />
              <span>Contact ResQNow support</span>
              <MaterialSymbol name="chevron_right" />
            </a>
          </li>
        </ul>
        <div className="lt-foot">
          {onCancel ? (
            <button type="button" className="lt-ghost is-danger lt-press" onClick={onCancel}>
              Cancel request
            </button>
          ) : null}
          {cancelClosedNote ? (
            <p className="lt-closed" data-testid="tracking-cancel-closed">
              {cancelClosedNote}
            </p>
          ) : null}
          <p className="lt-id">{requestLine}</p>
        </div>
      </div>
    </div>
  );
}
