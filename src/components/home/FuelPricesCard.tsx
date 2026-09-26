import { useQuery } from "@tanstack/react-query";

import { fetchFuelPrices, formatRupees, type FuelPrice, type FuelType } from "@/lib/homeApi";
import { useHomeCoordinates } from "@/lib/homeLocation";
import { cn } from "@/lib/utils";
import MaterialSymbol from "./MaterialSymbol";

const FUEL_ICONS: Record<FuelType, string> = {
  petrol: "local_gas_station",
  diesel: "oil_barrel",
  cng: "propane_tank",
  ev: "ev_station",
};

const UNIT_LABELS: Record<string, string> = { litre: "per litre", kg: "per kg", kwh: "per kWh" };

function formatAsOf(asOf?: string, stale?: boolean) {
  if (!asOf) return "";
  const date = new Date(`${asOf}T00:00:00+05:30`);
  if (Number.isNaN(date.getTime())) return "";
  const label = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(date);
  return stale ? `Last updated ${label}` : `Today, ${label}`;
}

function PriceChange({ change }: { change: number | null }) {
  if (change == null) return null;
  if (change === 0) return <span className="rq-h-delta is-flat">No change</span>;
  const up = change > 0;
  return (
    <span className={cn("rq-h-delta", up ? "is-up" : "is-down")} aria-label={`${up ? "Up" : "Down"} ${formatRupees(Math.abs(change), { exact: true })} since yesterday`}>
      <MaterialSymbol name={up ? "arrow_drop_up" : "arrow_drop_down"} />
      {Math.abs(change).toFixed(2)}
    </span>
  );
}

function FuelCell({ entry }: { entry: FuelPrice }) {
  return (
    <div className="rq-h-fuel">
      <div className="rq-h-fuel-top">
        <span className="rq-h-fuel-ic">
          <MaterialSymbol name={FUEL_ICONS[entry.fuel] || "local_gas_station"} />
        </span>
        <span className="rq-h-fuel-name">
          <span>{entry.label}</span>
          <span className="rq-h-fuel-unit">{UNIT_LABELS[entry.unit] || `per ${entry.unit}`}</span>
        </span>
      </div>
      <div className="rq-h-fuel-row">
        <span className="rq-h-fuel-price">{formatRupees(entry.price, { exact: true })}</span>
        <PriceChange change={entry.change} />
      </div>
    </div>
  );
}

/** Today's fuel prices for the customer's area. Hidden until location and prices are known. */
export default function FuelPricesCard() {
  const coords = useHomeCoordinates();
  // Round the fix so small GPS jitter shares one cached response.
  const lat = coords ? Math.round(coords.lat * 100) / 100 : null;
  const lng = coords ? Math.round(coords.lng * 100) / 100 : null;

  const { data } = useQuery({
    queryKey: ["home", "fuel-prices", lat, lng],
    queryFn: ({ signal }) => fetchFuelPrices({ lat: lat as number, lng: lng as number }, signal),
    enabled: lat != null && lng != null,
    staleTime: 15 * 60 * 1000,
    retry: 1,
  });

  const prices = data?.available ? data.prices || [] : [];
  if (!prices.length) return null;

  const place = [data?.location?.area, data?.location?.state].filter(Boolean).join(", ");

  return (
    <section className="rq-h-section" aria-labelledby="rq-h-fuel-title">
      <div className="rq-h-head">
        <div>
          <h2 id="rq-h-fuel-title" className="rq-h-title">Fuel prices today</h2>
          <span className="rq-h-sub">
            <MaterialSymbol name="location_on" className="rq-symbol-sm rq-h-accent" />
            {[place, formatAsOf(data?.asOf, data?.stale)].filter(Boolean).join(" · ")}
          </span>
        </div>
      </div>
      <div className={cn("rq-h-card rq-h-fuel-grid", prices.length === 1 && "is-single")}>
        {prices.map((entry) => <FuelCell key={entry.fuel} entry={entry} />)}
      </div>
      <p className="rq-h-note">Updated daily for your location. Prices can vary slightly by pump.</p>
    </section>
  );
}
