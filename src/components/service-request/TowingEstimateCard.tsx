import { useState } from "react";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { cn } from "@/lib/utils";

type TowingEstimateCardProps = {
  estimate?: any;
  loading?: boolean;
  error?: string | null;
  warning?: string | null;
  /** Shown before pick up and drop are both set. */
  emptyText?: string;
};

const rupees = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `₹${Math.round(parsed).toLocaleString("en-IN")}` : "—";
};

const SIZE_LABELS: Record<string, string> = {
  hatchback: "Hatchback", sedan: "Sedan", suv: "SUV", luxury_car: "Luxury car", scooter: "Scooter",
  bike: "Bike", truck: "Truck", ev: "EV", car: "Car",
};

const TRUCK_LABELS: Record<string, string> = {
  flatbed: "Flatbed truck", "wheel-lift": "Wheel-lift truck", "heavy-duty-wrecker": "Heavy recovery truck",
};

/** The towing fare from the server's quote, with the breakdown one tap away. */
export default function TowingEstimateCard({ estimate, loading, error, warning, emptyText = "Set pick up and drop to see the fare" }: TowingEstimateCardProps) {
  const [open, setOpen] = useState(false);
  const quote = estimate?.quote || estimate;
  const breakdown = quote?.pricing_breakdown || estimate?.pricingBreakdown || null;
  const distanceKm = Number(quote?.distance_km ?? estimate?.distanceKm ?? breakdown?.distance_km);
  const total = quote?.final_estimated_price ?? estimate?.finalEstimatedPrice ?? breakdown?.final_estimated_price;
  const truck = TRUCK_LABELS[String(breakdown?.tow_truck_type || quote?.tow_truck_type || "")] ?? null;

  if (error || warning) {
    return (
      <div className={cn("rqf-callout", error ? "red" : "amber")} role={error ? "alert" : "note"}>
        <MaterialSymbol name={error ? "error" : "info"} />
        <p>{error || warning}</p>
      </div>
    );
  }

  if (!quote || total == null) {
    return (
      <div className="rqf-fare is-empty" aria-live="polite">
        <MaterialSymbol name={loading ? "progress_activity" : "receipt_long"} className={loading ? "rqf-spin" : undefined} />
        {loading ? "Working out the fare…" : emptyText}
      </div>
    );
  }

  const included = Number(breakdown?.included_km || 0);
  const extraKm = Number.isFinite(distanceKm) ? Math.max(0, distanceKm - included) : 0;
  const size = SIZE_LABELS[String(breakdown?.vehicle_category || "")] ?? null;
  const multiplier = Number(breakdown?.vehicle_multiplier || 1);
  const subtotal = Number(breakdown?.subtotal_before_factors || 0);
  const rows: Array<[string, string, string?]> = [];
  if (breakdown) {
    rows.push([included ? `Towing (first ${included} km)` : "Towing", rupees(breakdown.base_towing_charge)]);
    if (Number(breakdown.distance_charge) > 0) rows.push([`Extra ${extraKm.toFixed(1)} km × ₹${Number(breakdown.per_km_rate || 0)}`, rupees(breakdown.distance_charge)]);
    if (Number(breakdown.night_charge) > 0) rows.push(["Night charge", rupees(breakdown.night_charge)]);
    if (multiplier !== 1 && subtotal > 0) rows.push([`${size ?? "Vehicle"} size ×${multiplier.toFixed(2)}`, `+${rupees(subtotal * (multiplier - 1))}`, "size"]);
    if (Number(breakdown.surge_multiplier || 1) > 1) rows.push(["Busy time", `×${Number(breakdown.surge_multiplier).toFixed(2)}`]);
    if (Number(breakdown.tax_amount) > 0) rows.push(["Taxes", rupees(breakdown.tax_amount)]);
    if (Number(breakdown.platform_fee) > 0) rows.push(["Platform fee", rupees(breakdown.platform_fee)]);
    if (Number(breakdown.payment_fee) > 0) rows.push(["UPI payment fee", rupees(breakdown.payment_fee)]);
  }

  return (
    <div className="rqf-fare" aria-live="polite">
      <div className="rqf-fare-top">
        <MaterialSymbol name="receipt_long" />
        <span className="rqf-fare-id">
          <small>Fare estimate{Number.isFinite(distanceKm) ? ` · ${distanceKm.toFixed(1)} km` : ""}{truck ? ` · ${truck}` : ""}</small>
          <b>{rupees(total)}</b>
        </span>
        {rows.length ? (
          <button type="button" className="rqf-change rq-press" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {open ? "Hide" : "Details"}
          </button>
        ) : null}
      </div>
      {open ? (
        <div className="rqf-fare-rows">
          {rows.map(([label, value, tone]) => (
            <div key={label} className={cn("rqf-fare-row", tone)}><span>{label}</span><b>{value}</b></div>
          ))}
          <p className="rqf-fare-note">Checked again when you book. Pay after the drop.</p>
        </div>
      ) : null}
    </div>
  );
}
