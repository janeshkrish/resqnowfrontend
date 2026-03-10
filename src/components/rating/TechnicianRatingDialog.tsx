import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

interface TechnicianRatingDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  requestId: string;
  technicianId: string;
  technicianName: string;
  onSuccess?: () => void;
}

const TechnicianRatingDialog = ({
  isOpen,
  onOpenChange,
  requestId,
  technicianId,
  technicianName,
  onSuccess,
}: TechnicianRatingDialogProps) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);

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
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate Technician</DialogTitle>
          <DialogDescription>
            How was your experience with {technicianName}?
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-6 space-y-4">
          <div className="flex items-center space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`transition-all focus:outline-none ${star <= (hoveredRating || rating)
                    ? "text-yellow-400 transform scale-110"
                    : "text-gray-300"
                  }`}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
              >
                <Star className="w-8 h-8 fill-current" />
              </button>
            ))}
          </div>
          <p className="text-sm font-medium text-muted-foreground">
            {rating === 0 ? "Select a rating" :
              rating === 1 ? "Poor" :
                rating === 2 ? "Fair" :
                  rating === 3 ? "Good" :
                    rating === 4 ? "Very Good" : "Excellent"}
          </p>
        </div>

        <div className="space-y-2">
          <Textarea
            placeholder="Share details about your experience (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[100px]"
          />
        </div>

        <DialogFooter className="sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || rating === 0}
          >

            {isSubmitting ? "Submitting..." : "Submit Review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TechnicianRatingDialog;
