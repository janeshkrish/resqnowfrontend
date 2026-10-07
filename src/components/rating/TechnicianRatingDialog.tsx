import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

interface TechnicianRatingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  technicianId: string;
  technicianName: string;
  /** The stars already tapped on the page, so the sheet opens with them chosen. */
  initialRating?: number;
  /** What was done and when: "Towing · Maruti Swift · 1 Oct". */
  detail?: string;
  onSuccess?: () => void;
}

const WORDS = ["Tap a star", "Poor", "Fair", "Good", "Very good", "Excellent"];

/** Rating a technician after a finished request: stars, an optional note, and Send. */
const TechnicianRatingDialog = ({
  isOpen,
  onOpenChange,
  requestId,
  technicianId,
  technicianName,
  initialRating = 0,
  detail,
  onSuccess,
}: TechnicianRatingDialogProps) => {
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Each time the sheet opens it starts from the stars tapped on the page, with an empty note.
  useEffect(() => {
    if (isOpen) {
      setRating(initialRating);
      setComment("");
    }
  }, [isOpen, initialRating, requestId]);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Please provide a rating");
      return;
    }

    try {
      setIsSubmitting(true);
      const normalizedTechnicianId = Number(technicianId);
      const normalizedRequestId = Number(requestId);
      if (!Number.isFinite(normalizedTechnicianId) || normalizedTechnicianId <= 0) {
        throw new Error("Invalid technician selected for rating.");
      }
      if (!Number.isFinite(normalizedRequestId) || normalizedRequestId <= 0) {
        throw new Error("Invalid service request for rating.");
      }

      const res = await apiFetch("/api/users/reviews", {
        method: "POST",
        body: JSON.stringify({
          technician_id: normalizedTechnicianId,
          rating,
          comment,
          request_id: normalizedRequestId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || body?.message || "Failed to submit review");
      }

      toast.success(body?.message || "Thank you for your feedback!");
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to submit rating";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="rq-sheet-scrim" />
        <Dialog.Content className="rq-sheet rq-rate" aria-describedby={undefined}>
          <div className="rq-sheet-grab" aria-hidden="true" />
          <Dialog.Title className="rq-sheet-title">How was {technicianName}?</Dialog.Title>
          {detail ? <p className="rq-sheet-sub">{detail}</p> : null}
          <div className="rq-rate-stars" role="radiogroup" aria-label="Your rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={rating === star}
                aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
                className={cn("rq-rate-star", star <= rating && "is-on")}
                onClick={() => setRating(star)}
              >
                <MaterialSymbol name="star" />
              </button>
            ))}
          </div>
          <p className="rq-rate-word" aria-live="polite">{WORDS[rating]}</p>
          <textarea
            className="rq-rate-note"
            aria-label="Anything to add? You can leave this empty"
            placeholder="Anything to add? (you can skip this)"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
          <button type="button" className="rq-btn rq-btn-block rq-press" disabled={isSubmitting || rating === 0} onClick={() => void handleSubmit()}>
            {isSubmitting ? "Sending…" : "Send rating"}
          </button>
          <Dialog.Close className="rq-text-btn rq-btn-block" disabled={isSubmitting}>Not now</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default TechnicianRatingDialog;
