import { useState } from "react";
import { motion } from "framer-motion";
import { Star, CheckCircle2, ShieldCheck, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface ClientJobCompletionProps {
  technicianName: string;
  onSubmitReview: (rating: number, comment: string) => void;
}

const ClientJobCompletion = ({ technicianName, onSubmitReview }: ClientJobCompletionProps) => {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const completionDate = new Date().toLocaleDateString();

  const handleSubmit = () => {
    if (rating === 0) {
      toast.error("Please rate the service quality");
      return;
    }
    onSubmitReview(rating, comment);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-300 sm:items-center">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.35, type: "spring", stiffness: 120, damping: 15 }}
        className="w-full max-w-sm overflow-hidden rounded-3xl bg-card shadow-2xl ring-1 ring-slate-900/10"
        style={{ fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}
      >
        <div className="relative overflow-hidden bg-gradient-to-br from-emerald-500 via-emerald-600 to-slate-900 p-6 text-white">
          <div className="absolute right-4 top-4 rounded-lg bg-white/15 p-1.5">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-white/20 backdrop-blur-sm"
          >
            <CheckCircle2 className="h-8 w-8" />
          </motion.div>
          <h2 className="text-center text-xl font-extrabold tracking-tight">Service Completed</h2>
          <p className="mt-1 text-center text-xs font-medium uppercase tracking-[0.14em] text-white/80">
            Case closed | {completionDate}
          </p>
        </div>

        <div className="p-6">
          <div className="mb-5 rounded-2xl border border-border bg-muted/30 p-4 text-center">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Assistance provided by{" "}
              <strong className="text-foreground">{technicianName}</strong>. Share a quick rating to help us maintain
              service quality.
            </p>
          </div>

          <div className="mb-5 rounded-2xl border border-border bg-card p-4">
            <label className="mb-3 block text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Service quality
            </label>

            <div className="mb-4 flex justify-center gap-2.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className={`rounded-lg p-1 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-300 ${
                    rating >= star ? "text-amber-500 hover:scale-105" : "text-zinc-300 hover:text-zinc-400"
                  }`}
                >
                  <Star className="h-7 w-7 fill-current" strokeWidth={1.6} />
                </button>
              ))}
            </div>

            <Textarea
              placeholder="Additional comments (Optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[90px] resize-none rounded-xl border-border bg-muted/20 text-sm"
            />
          </div>

          <Button
            onClick={handleSubmit}
            className="h-11 w-full rounded-xl bg-orange-600 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-500"
          >
            Complete and return home
          </Button>

          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <ReceiptText className="h-3.5 w-3.5" />
            <span>Invoice is available in your request history.</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ClientJobCompletion;
