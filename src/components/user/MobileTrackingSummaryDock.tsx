import { useRef, useState, type PointerEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CreditCard,
  Map,
  MessageSquare,
  Phone,
  RefreshCw,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Star,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { TrackingFreshness } from "@/lib/liveTrackingPlayback";

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
  vehicleLabel?: string | null;
};

export type MobileTrackingPaymentAction = {
  amountLabel: string;
  onPayOnline: () => void;
};

export type MobileTrackingTimelineStep = {
  label: string;
  caption: string;
  complete: boolean;
  active: boolean;
};

export type MobileTrackingServiceSummary = {
  title: string;
  detail: string;
  amountLabel: string;
  guaranteeLabel?: string | null;
};

export type MobileTrackingSummaryDockProps = {
  summary: MobileTrackingSummary;
  technician?: MobileTrackingTechnician | null;
  isConnected: boolean;
  trackingFreshness?: TrackingFreshness;
  isMapFocus: boolean;
  paymentAction?: MobileTrackingPaymentAction | null;
  timeline?: readonly MobileTrackingTimelineStep[];
  serviceSummary?: MobileTrackingServiceSummary | null;
  canCancel?: boolean;
  onRefresh?: () => void;
  onEmergency?: () => void;
  onShare?: () => void;
  onRequestCancellation?: () => void;
  onDragStart?: (event: PointerEvent<HTMLElement>) => void;
  onShowMap: () => void;
  onShowDetails: () => void;
};

const defaultTimeline: readonly MobileTrackingTimelineStep[] = [
  { label: "Accepted", caption: "Confirmed", complete: true, active: false },
  { label: "On the way", caption: "Live route", complete: false, active: true },
  { label: "Arrived", caption: "Next", complete: false, active: false },
];

const freshnessClassNames: Record<TrackingFreshness, string> = {
  LIVE: "border-emerald-100 bg-emerald-50 text-emerald-700",
  UPDATING: "border-sky-100 bg-sky-50 text-sky-700",
  DELAYED: "border-amber-100 bg-amber-50 text-amber-700",
  RECONNECTING: "border-slate-200 bg-slate-50 text-slate-700",
  OFFLINE: "border-slate-200 bg-slate-100 text-slate-600",
};

const freshnessLabels: Record<TrackingFreshness, string> = {
  LIVE: "Live",
  UPDATING: "Updating",
  DELAYED: "Delayed",
  RECONNECTING: "Reconnecting",
  OFFLINE: "Offline",
};

function MobileTrackingSummaryDock({
  summary,
  technician,
  isConnected,
  trackingFreshness,
  isMapFocus,
  paymentAction,
  timeline = defaultTimeline,
  serviceSummary,
  canCancel = false,
  onRefresh,
  onEmergency,
  onShare,
  onRequestCancellation,
  onDragStart,
  onShowMap,
  onShowDetails,
}: MobileTrackingSummaryDockProps) {
  const freshness = trackingFreshness ?? (isConnected ? "LIVE" : "RECONNECTING");
  const freshnessLabel = freshnessLabels[freshness];
  const sliderRef = useRef<HTMLDivElement | null>(null);
  const [sliderOffset, setSliderOffset] = useState(0);
  const sliderPointerRef = useRef<number | null>(null);

  const updateSlider = (clientX: number) => {
    const bounds = sliderRef.current?.getBoundingClientRect();
    if (!bounds) return;

    const maxOffset = Math.max(0, bounds.width - 48);
    const nextOffset = Math.max(0, Math.min(maxOffset, clientX - bounds.left - 24));
    setSliderOffset(nextOffset);

    if (maxOffset > 0 && nextOffset / maxOffset >= 0.84) {
      sliderPointerRef.current = null;
      setSliderOffset(0);
      onRequestCancellation?.();
    }
  };

  const endSlider = () => {
    sliderPointerRef.current = null;
    setSliderOffset(0);
  };

  return (
    <section
      data-testid="mobile-tracking-summary"
      aria-live="polite"
      className="pointer-events-auto overflow-hidden rounded-t-[28px] border border-slate-200/90 bg-slate-50 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_34px_rgba(15,23,42,0.13)]"
    >
      <div className="flex justify-center bg-white pt-2.5 touch-none" onPointerDown={onDragStart}>
        <span aria-hidden="true" className="h-1.5 w-11 rounded-full bg-slate-200" />
      </div>

      <div className="border-b border-slate-100 bg-white px-4 pb-3 pt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              {summary.eyebrow}
            </p>
            <p className="mt-0.5 truncate text-[21px] font-black leading-tight text-slate-950">
              {summary.value}
              {freshness === "LIVE" ? <span className="ml-1.5 text-emerald-500">•</span> : null}
            </p>
            <p className="mt-0.5 truncate text-sm font-medium text-slate-500">{summary.detail}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onRefresh}
              aria-label="Refresh live tracking"
              className="h-9 rounded-xl border-slate-200 px-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
              Refresh
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onShowMap}
              aria-label="Show more map"
              className="h-9 w-9 rounded-xl text-slate-600 hover:bg-slate-100"
            >
              <Map className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      <div data-testid="mobile-tracking-timeline" className="border-b border-slate-100 bg-white px-5 py-3.5">
        <div className="relative flex items-start justify-between">
          <span aria-hidden="true" className="absolute left-[11%] right-[11%] top-[7px] h-0.5 bg-slate-200" />
          <span
            aria-hidden="true"
            className="absolute left-[11%] top-[7px] h-0.5 bg-gradient-to-r from-emerald-500 via-red-500 to-red-500 transition-[width] duration-300"
            style={{ width: `${Math.max(0, Math.min(78, ((timeline.findIndex((step) => step.active) + 1) / Math.max(1, timeline.length - 1)) * 78))}%` }}
          />
          {timeline.slice(0, 3).map((step) => (
            <div key={step.label} className="relative z-10 flex min-w-0 flex-1 flex-col items-center text-center">
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full border-2 border-white shadow-sm",
                  step.complete ? "bg-emerald-500" : step.active ? "bg-red-500 ring-2 ring-red-100" : "bg-slate-300",
                )}
              >
                {step.complete ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
              </span>
              <span className={cn("mt-1.5 text-[11px] font-bold", step.active ? "text-red-600" : "text-slate-500")}>
                {step.label}
              </span>
              <span className="mt-0.5 text-[10px] font-medium leading-tight text-slate-400">{step.caption}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 px-4 py-3">
        {technician ? (
          <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <Avatar className="h-12 w-12 border-2 border-white shadow-sm">
                <AvatarImage src={technician.avatarUrl ?? undefined} alt={technician.name} />
                <AvatarFallback className="bg-red-50 text-sm font-black text-red-600">
                  {technician.name.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-[16px] font-black leading-tight text-slate-900">{technician.name}</p>
                  <span className="inline-flex shrink-0 items-center gap-0.5 text-xs font-bold text-amber-600">
                    <Star className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                    {technician.ratingLabel}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                  {technician.vehicleLabel || `${technician.completedJobs} completed jobs`}
                </p>
              </div>
              <div className="flex flex-col items-center rounded-xl border border-emerald-100 bg-emerald-50 px-2 py-1.5 text-emerald-700">
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                <span className="mt-0.5 text-center text-[8px] font-black uppercase leading-tight">Verified ResQNow partner</span>
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              {technician.phone ? (
                <a
                  href={`tel:${technician.phone}`}
                  aria-label="Call technician"
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-red-500 px-3 text-sm font-black text-white shadow-[0_8px_18px_rgba(220,38,38,0.22)] transition hover:from-red-700 hover:to-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                >
                  <Phone className="h-4 w-4" aria-hidden="true" />
                  Call Partner
                </a>
              ) : null}
              {technician.phone ? (
                <a
                  href={`sms:${technician.phone}`}
                  aria-label="Message technician"
                  className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                >
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onShare}
                aria-label="Share tracking link"
                className="h-11 w-11 shrink-0 rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                <Share2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </article>
        ) : null}

        {serviceSummary ? (
          <article className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-600">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-800">{serviceSummary.title}</p>
                <p className="mt-0.5 truncate text-xs text-slate-500">{serviceSummary.detail}</p>
              </div>
              {serviceSummary.guaranteeLabel ? (
                <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-1 text-[10px] font-bold text-emerald-700">
                  {serviceSummary.guaranteeLabel}
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-500">
              <span>Final amount</span>
              <span className="font-mono text-base font-black text-slate-900">{serviceSummary.amountLabel}</span>
            </div>
          </article>
        ) : null}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onEmergency}
            aria-label="Open emergency support"
            className="flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-red-100 bg-red-50 px-2 text-xs font-bold text-red-700 transition hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
          >
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            SOS & support
          </button>
          <span className={cn("inline-flex h-10 shrink-0 items-center rounded-xl border px-2.5 text-xs font-bold", freshnessClassNames[freshness])}>
            {freshnessLabel}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onShowDetails}
            aria-label="View service details"
            className="h-10 shrink-0 rounded-xl px-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            {isMapFocus ? "Details" : summary.journeyLabel}
            {isMapFocus ? <ChevronUp className="ml-1 h-3.5 w-3.5" /> : <ChevronDown className="ml-1 h-3.5 w-3.5" />}
          </Button>
        </div>

        {paymentAction ? (
          <Button
            type="button"
            onClick={paymentAction.onPayOnline}
            aria-label={`Pay ${paymentAction.amountLabel} online`}
            className="h-11 w-full rounded-xl bg-red-600 text-sm font-black text-white shadow-[0_8px_18px_rgba(220,38,38,0.2)] hover:bg-red-700"
          >
            <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
            Pay online · {paymentAction.amountLabel}
          </Button>
        ) : null}

        {canCancel ? (
          <div
            ref={sliderRef}
            role="presentation"
            className="relative flex h-12 items-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 px-12"
            onPointerMove={(event) => {
              if (sliderPointerRef.current === event.pointerId) updateSlider(event.clientX);
            }}
            onPointerUp={endSlider}
            onPointerCancel={endSlider}
          >
            <span className="w-full text-center text-xs font-black uppercase tracking-[0.08em] text-slate-500">Slide to cancel</span>
            <button
              type="button"
              aria-label="Slide to cancel request"
              className="absolute left-1 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-white text-red-600 shadow-md transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
              style={{ transform: `translateX(${sliderOffset}px)` }}
              onPointerDown={(event) => {
                sliderPointerRef.current = event.pointerId;
                event.currentTarget.setPointerCapture?.(event.pointerId);
                updateSlider(event.clientX);
              }}
              onPointerUp={endSlider}
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" className="sr-only" onClick={onRequestCancellation} aria-label="Cancel request">
              Cancel request
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default MobileTrackingSummaryDock;
