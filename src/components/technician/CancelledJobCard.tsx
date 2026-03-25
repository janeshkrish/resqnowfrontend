import { AlertTriangle, MapPin, ReceiptText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CancelledJobDetails {
  id: string;
  contactName?: string | null;
  address?: string | null;
  cancellationReason?: string | null;
  serviceType?: string | null;
}

interface CancelledJobCardProps {
  job: CancelledJobDetails;
  onViewDetails?: (job: CancelledJobDetails) => void;
  className?: string;
}

const CancelledJobCard = ({
  job,
  onViewDetails,
  className,
}: CancelledJobCardProps) => {
  const customerLabel = String(job.contactName || "").trim() || "The customer";
  const serviceLabel = String(job.serviceType || "").trim().replace(/-/g, " ") || "Roadside assistance";
  const locationLabel = String(job.address || "").trim() || "Location details are not available.";
  const reasonLabel = String(job.cancellationReason || "").trim();

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-[2rem] border border-red-200 bg-gradient-to-br from-red-50 via-white to-rose-50 shadow-xl shadow-red-100/60",
        className
      )}
    >
      <div className="border-b border-red-100 bg-red-50/80 px-6 py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-red-700">Job Update</p>
              <h2 className="mt-1 text-2xl font-black tracking-tight text-red-950">Job Cancelled</h2>
              <p className="mt-1 text-sm font-medium text-red-900/80">
                {customerLabel} has cancelled this job.
              </p>
            </div>
          </div>

          <Badge className="rounded-full border border-red-200 bg-white text-red-700 hover:bg-white">
            Cancelled
          </Badge>
        </div>
      </div>

      <CardContent className="space-y-4 p-6">
        <div className="rounded-2xl border border-red-100 bg-white/90 p-4 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-500">Service</p>
          <p className="mt-1 text-base font-bold capitalize text-foreground">{serviceLabel}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              <ReceiptText className="h-4 w-4 text-red-500" />
              Request ID
            </div>
            <p className="mt-2 text-sm font-black text-foreground">#{job.id}</p>
          </div>

          <div className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              <MapPin className="h-4 w-4 text-red-500" />
              Location
            </div>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground">{locationLabel}</p>
          </div>
        </div>

        {reasonLabel ? (
          <div className="rounded-2xl border border-red-100 bg-red-50/70 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-600">
              Cancellation Reason
            </p>
            <p className="mt-2 text-sm font-medium leading-relaxed text-red-900">{reasonLabel}</p>
          </div>
        ) : null}

        <Button
          type="button"
          onClick={() => onViewDetails?.(job)}
          className="h-12 w-full rounded-2xl bg-red-600 text-base font-black tracking-wide text-white hover:bg-red-700"
        >
          View Details
        </Button>
      </CardContent>
    </Card>
  );
};

export default CancelledJobCard;
