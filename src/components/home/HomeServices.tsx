import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { fetchServicePrices, formatRupees } from "@/lib/homeApi";
import MaterialSymbol from "./MaterialSymbol";

const HOME_SERVICES = [
  { id: "towing", name: "Towing" },
  { id: "flat-tire", name: "Flat tyre" },
  { id: "battery", name: "Battery" },
  { id: "mechanical", name: "Mechanic" },
  { id: "fuel", name: "Fuel" },
  { id: "lockout", name: "Lockout" },
  { id: "winching", name: "Winching" },
  { id: "ev-charging", name: "EV charge" },
];

const PRICE_VEHICLE = "car";

export default function HomeServices() {
  const { data, isPending } = useQuery({
    queryKey: ["home", "service-prices", PRICE_VEHICLE],
    queryFn: ({ signal }) => fetchServicePrices(PRICE_VEHICLE, signal),
    staleTime: 5 * 60 * 1000,
  });

  const startingPrice = (id: string) => data?.services.find((entry) => entry.service === id)?.startingPrice ?? null;
  const hasAnyPrice = HOME_SERVICES.some((service) => startingPrice(service.id) != null);

  return (
    <section className="rq-h-section" aria-labelledby="rq-h-services-title">
      <div className="rq-h-head">
        <div>
          <h2 id="rq-h-services-title" className="rq-h-title">Services</h2>
          {hasAnyPrice ? (
            <span className="rq-h-sub">
              <MaterialSymbol name="payments" className="rq-symbol-sm rq-h-accent" />
              Lowest prices from our technicians · Car
            </span>
          ) : null}
        </div>
        <Link to="/services" className="rq-h-link">
          See all
          <MaterialSymbol name="chevron_right" />
        </Link>
      </div>

      <div className="rq-h-svc-grid">
        {HOME_SERVICES.map((service) => {
          const price = startingPrice(service.id);
          return (
            <Link
              key={service.id}
              to={`/request-service/${service.id}`}
              className="rq-h-svc rq-press"
              aria-label={price != null ? `${service.name}, starts from ${formatRupees(price)}` : service.name}
            >
              <span className="rq-h-svc-tile">
                <img src={`/images/home/services/${service.id}.webp`} alt="" draggable={false} loading="lazy" />
              </span>
              <span className="rq-h-svc-name">{service.name}</span>
              {price != null ? (
                <span className="rq-h-svc-from">
                  <span className="rq-h-svc-from-lbl">Starts from</span>
                  <span className="rq-h-svc-from-amt">{formatRupees(price)}</span>
                </span>
              ) : isPending ? (
                <span className="rq-h-svc-from" aria-hidden="true">
                  <span className="rq-shimmer rq-h-svc-skeleton" />
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
