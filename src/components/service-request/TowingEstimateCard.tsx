import MaterialSymbol from "@/components/home/MaterialSymbol";
import { cn } from "@/lib/utils";

type TowingEstimateCardProps = {
  estimate?: any;
  loading?: boolean;
  error?: string | null;
  warning?: string | null;
  emptyText?: string;
};

const TRUCK_LABELS: Record<string, string> = {
  flatbed: "Flatbed truck", "wheel-lift": "Wheel-lift truck", "heavy-duty-wrecker": "Heavy recovery truck",
};

/** Route information only: the selected technician determines the price after acceptance. */
export default function TowingEstimateCard({ estimate, loading, error, warning, emptyText = "Set pick up and drop to check the route" }: TowingEstimateCardProps) {
  const quote = estimate?.quote || estimate;
  const breakdown = quote?.pricing_breakdown || estimate?.pricingBreakdown || null;
  const distanceKm = Number(quote?.distance_km ?? estimate?.distanceKm ?? breakdown?.distance_km);
  const truck = TRUCK_LABELS[String(breakdown?.tow_truck_type || quote?.tow_truck_type || "")] ?? null;

  if (error || warning) {
    return (
      <div className={cn("rqf-callout", error ? "red" : "amber")} role={error ? "alert" : "note"}>
        <MaterialSymbol name={error ? "error" : "info"} />
        <p>{error || warning}</p>
      </div>
    );
  }

  if (!quote) {
    return (
      <div className="rqf-fare is-empty" aria-live="polite">
        <MaterialSymbol name={loading ? "progress_activity" : "route"} className={loading ? "rqf-spin" : undefined} />
        {loading ? "Checking the towing route…" : emptyText}
      </div>
    );
  }

  return (
    <div className="rqf-fare" aria-live="polite">
      <div className="rqf-fare-top">
        <MaterialSymbol name="route" />
        <span className="rqf-fare-id">
          <small>Towing route{Number.isFinite(distanceKm) && distanceKm > 0 ? ` · ${distanceKm.toFixed(1)} km` : ""}{truck ? ` · ${truck}` : ""}</small>
          <b>Price shown after a technician accepts</b>
        </span>
      </div>
    </div>
  );
}
