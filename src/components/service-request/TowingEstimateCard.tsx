import { AlertCircle, Clock, Gauge, Loader2, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type TowingEstimateCardProps = {
  estimate?: any;
  loading?: boolean;
  error?: string | null;
  warning?: string | null;
};

const money = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "INR 0";
  return `INR ${Math.round(parsed).toLocaleString("en-IN")}`;
};

const numberText = (value: unknown, suffix = "") => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return "--";
  return `${parsed.toFixed(parsed >= 10 ? 1 : 2)}${suffix}`;
};

function SkeletonEstimate() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-4 rounded-full bg-slate-200/80" />
      ))}
      <div className="h-10 rounded-xl bg-slate-200/80" />
    </div>
  );
}

export default function TowingEstimateCard({ estimate, loading, error, warning }: TowingEstimateCardProps) {
  const quote = estimate?.quote || estimate;
  const breakdown = quote?.pricing_breakdown || estimate?.pricingBreakdown || {};
  const distanceKm = quote?.distance_km ?? estimate?.distanceKm ?? breakdown.distance_km;
  const duration = quote?.estimated_duration ?? estimate?.estimatedDuration ?? breakdown.estimated_duration_minutes;
  const finalPrice = quote?.final_estimated_price ?? estimate?.finalEstimatedPrice ?? breakdown.final_estimated_price;
  const showSkeleton = loading && !quote && !error && !warning;

  return (
    <>
      {(loading || error || warning || quote) && (
        <div
          className={cn(
            "rounded-2xl border bg-white p-4 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.45)]",
            error ? "border-rose-200" : warning ? "border-amber-200" : "border-slate-200"
          )}
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Verified towing estimate
              </div>
              <h4 className="mt-1 text-lg font-black tracking-tight text-slate-950">Live fare preview</h4>
            </div>
            {loading && <Loader2 className="h-5 w-5 animate-spin text-slate-500" />}
          </div>

          {showSkeleton ? (
            <SkeletonEstimate />
          ) : error ? (
            <div className="flex gap-3 rounded-xl bg-rose-50 p-3 text-sm font-semibold text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : warning ? (
            <div className="flex gap-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{warning}</span>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Gauge className="h-4 w-4" />
                    Distance
                  </div>
                  <div className="mt-1 text-xl font-black text-slate-950">{numberText(distanceKm, " km")}</div>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <Clock className="h-4 w-4" />
                    Route ETA
                  </div>
                  <div className="mt-1 text-xl font-black text-slate-950">{Math.round(Number(duration || 0)) || "--"} min</div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <FareRow label="Base towing charge" value={money(breakdown.base_towing_charge)} />
                <FareRow label="Distance charge" value={money(breakdown.distance_charge)} />
                <FareRow label="Night charge" value={money(breakdown.night_charge)} />
                <FareRow label="Surge multiplier" value={`${Number(breakdown.surge_multiplier || 1).toFixed(2)}x`} />
                <FareRow label="Taxes" value={money(breakdown.tax_amount)} />
                <FareRow label="Platform fee" value={money(breakdown.platform_fee)} />
                <FareRow label="Payment fee" value={money(breakdown.payment_fee)} />
              </div>

              <div className="rounded-2xl bg-slate-950 p-4 text-white">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
                      <Zap className="h-4 w-4" />
                      Estimated total
                    </div>
                    <div className="mt-1 text-2xl font-black">{money(finalPrice)}</div>
                  </div>
                  <div className="text-right text-[11px] font-semibold leading-tight text-slate-300">
                    Rechecked at booking
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function FareRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-slate-900">{value}</span>
    </div>
  );
}
