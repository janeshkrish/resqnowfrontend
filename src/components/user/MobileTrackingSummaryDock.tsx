import {
  ChevronDown,
  ChevronUp,
  CreditCard,
  Map,
  MessageSquare,
  Phone,
  Star,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";

export type MobileTrackingSummary = {
  eyebrow: string;
  value: string;
  detail: string;
  journeyLabel: string;
};

export type MobileTrackingTechnician = {
  name: string;
  avatarUrl?: string | null;
  phone?: string | null;
  ratingLabel: string;
  completedJobs: number;
};

export type MobileTrackingPaymentAction = {
  amountLabel: string;
  onPayOnline: () => void;
};

export interface MobileTrackingSummaryDockProps {
  summary: MobileTrackingSummary;
  technician?: MobileTrackingTechnician | null;
  isConnected: boolean;
  isMapFocus: boolean;
  paymentAction?: MobileTrackingPaymentAction | null;
  onShowMap: () => void;
  onShowDetails: () => void;
}

const MobileTrackingSummaryDock = ({
  summary,
  technician,
  isConnected,
  isMapFocus,
  paymentAction,
  onShowMap,
  onShowDetails,
}: MobileTrackingSummaryDockProps) => (
  <section
    data-testid="mobile-tracking-summary"
    aria-live="polite"
    className="space-y-3 bg-white px-4 pb-4 pt-3"
  >
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onShowMap}
        aria-label="Show more map"
        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition-colors hover:bg-slate-100"
      >
        <Map className="h-4 w-4" />
      </button>
      <span
        className={cn(
          "rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.1em]",
          isConnected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
        )}
      >
        {isConnected ? "Live" : "Reconnecting"}
      </span>
      <button
        type="button"
        onClick={onShowDetails}
        aria-label="View service details"
        className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary px-3 text-xs font-extrabold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Details
        {isMapFocus ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
    </div>

    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-primary">
          {summary.eyebrow}
        </p>
        <p className="mt-1 text-2xl font-black tracking-tight text-slate-950">{summary.value}</p>
        <p className="mt-1 truncate text-xs font-medium text-slate-500">{summary.detail}</p>
      </div>
    </div>

    {technician && (
      <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
        <Avatar className="h-11 w-11 shrink-0 ring-2 ring-white shadow-sm">
          <AvatarImage src={technician.avatarUrl || undefined} />
          <AvatarFallback className="bg-slate-200 text-sm font-bold text-slate-700">
            {technician.name[0] || "T"}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-slate-900">{technician.name}</p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-bold text-slate-800">{technician.ratingLabel}</span>
            <span className="text-slate-300">|</span>
            <span>{technician.completedJobs} jobs</span>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            size="icon"
            variant="outline"
            className="h-11 w-11 rounded-full border-slate-200 text-slate-700 hover:bg-white"
            asChild
          >
            <a href={`sms:${technician.phone || ""}`} aria-label="Message technician">
              <MessageSquare className="h-4 w-4" />
            </a>
          </Button>
          <Button
            size="icon"
            className="h-11 w-11 rounded-full bg-slate-900 text-white shadow-md shadow-slate-900/20 hover:bg-slate-800"
            asChild
          >
            <a href={`tel:${technician.phone || ""}`} aria-label="Call technician">
              <Phone className="h-4 w-4 fill-current" />
            </a>
          </Button>
        </div>
      </div>
    )}

    <button
      type="button"
      onClick={onShowDetails}
      aria-label="Open journey details"
      className="flex min-h-11 w-full items-center justify-between rounded-xl bg-slate-50 px-3 text-left text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100"
    >
      <span>{summary.journeyLabel}</span>
      <ChevronUp className="h-4 w-4 text-primary" />
    </button>

    {paymentAction && (
      <Button
        type="button"
        onClick={paymentAction.onPayOnline}
        aria-label={`Pay ${paymentAction.amountLabel} online`}
        className="h-11 w-full rounded-xl bg-primary text-sm font-extrabold text-primary-foreground shadow-md shadow-primary/25 hover:bg-primary/90"
      >
        <CreditCard className="mr-2 h-4 w-4" />
        Pay {paymentAction.amountLabel}
      </Button>
    )}
  </section>
);

export default MobileTrackingSummaryDock;
