import { useEffect, useId, useState, type ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { CANCEL_REASONS, OTHER_CANCEL_REASON } from "@/lib/customerTracking";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  text: string;
  testId: string;
  children: ReactNode;
};

/** A sheet that rises from the bottom on a phone and sits in the middle on a wide screen. */
function TrackingModal({ open, onOpenChange, title, text, testId, children }: ModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="lt-scrim" />
        <DialogPrimitive.Content className="lt lt-modal" data-testid={testId}>
          <DialogPrimitive.Title className="lt-modal-title">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="lt-modal-text">{text}</DialogPrimitive.Description>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export type TrackingHelpDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onShare: () => void;
};

/** SOS: the quickest safe ways to get help for this request. */
export function TrackingHelpDialog({ open, onOpenChange, onShare }: TrackingHelpDialogProps) {
  return (
    <TrackingModal
      open={open}
      onOpenChange={onOpenChange}
      title="Safety and help"
      text="Pick the quickest safe way to get help for this request."
      testId="tracking-help"
    >
      <a className="lt-cta lt-press" href="/emergency" aria-label="Open emergency assistance">
        <MaterialSymbol name="emergency" />
        Emergency assistance
      </a>
      <a className="lt-ghost lt-press" href="/contact" aria-label="Contact ResQNow support">
        <MaterialSymbol name="support_agent" className="is-line" />
        Contact ResQNow support
      </a>
      <button
        type="button"
        className="lt-ghost lt-press"
        onClick={() => {
          onOpenChange(false);
          onShare();
        }}
      >
        <MaterialSymbol name="ios_share" className="is-line" />
        Share live tracking
      </button>
    </TrackingModal>
  );
}

export type TrackingCancelDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** One line on where the request stands, so the customer knows what they are giving up. */
  text: string;
  /** Sends the cancellation; resolves once the request has been answered. */
  onConfirm: (reason: string) => Promise<void>;
};

/** Asks why before cancelling, and keeps the request unless the customer says otherwise. */
export function TrackingCancelDialog({ open, onOpenChange, text, onConfirm }: TrackingCancelDialogProps) {
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  const [busy, setBusy] = useState(false);
  const otherId = useId();

  useEffect(() => {
    if (!open) return;
    setReason("");
    setOther("");
    setBusy(false);
  }, [open]);

  const finalReason = reason === OTHER_CANCEL_REASON ? other.trim() : reason;

  const confirm = async () => {
    if (!finalReason || busy) return;
    setBusy(true);
    try {
      await onConfirm(finalReason);
    } finally {
      setBusy(false);
    }
  };

  return (
    <TrackingModal open={open} onOpenChange={onOpenChange} title="Cancel this request?" text={text} testId="tracking-cancel">
      <fieldset className="lt-reasons">
        <legend className="sr-only">Why are you cancelling?</legend>
        {CANCEL_REASONS.map((option) => (
          <button
            key={option}
            type="button"
            className={cn("lt-reason", reason === option && "is-on")}
            aria-pressed={reason === option}
            onClick={() => setReason(option)}
          >
            <i aria-hidden="true" />
            {option}
          </button>
        ))}
      </fieldset>
      {reason === OTHER_CANCEL_REASON ? (
        <div className="lt-field">
          <label htmlFor={otherId}>Tell us why</label>
          <textarea
            id={otherId}
            value={other}
            maxLength={300}
            placeholder="A few words are enough"
            onChange={(event) => setOther(event.target.value)}
          />
        </div>
      ) : null}
      <button type="button" className="lt-cta is-dark lt-press" onClick={() => onOpenChange(false)}>
        Keep my request
      </button>
      <button type="button" className="lt-ghost is-danger lt-press" disabled={!finalReason || busy} onClick={() => void confirm()}>
        {busy ? "Cancelling…" : "Cancel request"}
      </button>
    </TrackingModal>
  );
}
