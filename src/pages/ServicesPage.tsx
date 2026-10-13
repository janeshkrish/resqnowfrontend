import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { useAuth } from "@/contexts/AuthContext";
import { useGeolocation } from "@/hooks/useGeolocation";
import { GARAGE_QUERY_KEY, listVehicles, vehicleTypeOf, type Vehicle } from "@/lib/garage";
import { fetchServicePrices, formatRupees } from "@/lib/homeApi";
import type { PlaceSummary } from "@/lib/placeSummary";
import { SERVICES } from "@/lib/services";
import { studioImage } from "@/lib/vehiclePhoto";
import { cn } from "@/lib/utils";

type Kind = "car" | "bike" | "commercial" | "ev";

const KINDS: { id: Kind; name: string; art: string }[] = [
  { id: "car", name: "Car", art: "/images/vehicles/car.webp" },
  { id: "bike", name: "Bike", art: "/images/vehicles/bike.webp" },
  { id: "commercial", name: "Truck", art: "/images/vehicles/truck.webp" },
  { id: "ev", name: "EV", art: "/images/vehicles/ev.webp" },
];

const PERMISSION_DENIED = 1;
const byNewest = (list: Vehicle[]) =>
  [...list].sort((a, b) => (Date.parse(b.created_at ?? "") || b.id) - (Date.parse(a.created_at ?? "") || a.id));

// Kept for this app session, so coming back to Get help shows the last place at once.
let lastKnownPlace: PlaceSummary | null = null;

/** Where help is going: the same place the home header shows. Tapping it looks again. */
function HelpPlace() {
  const { place, address, error, errorCode, requestLocation } = useGeolocation();
  const [cached] = useState<PlaceSummary | null>(() => lastKnownPlace);
  const found: PlaceSummary | null = place ?? (address ? { title: "Current location", subtitle: address } : null);
  const shown = found ?? (error ? null : cached);
  const denied = errorCode === PERMISSION_DENIED;

  useEffect(() => { requestLocation(); }, [requestLocation]);
  useEffect(() => {
    if (found) lastKnownPlace = found;
    // `found` is rebuilt every render; place and address are its real inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [place, address]);

  const lookAgain = async () => {
    if (!shown && error && denied && Capacitor.isNativePlatform()) await Geolocation.requestPermissions().catch(() => undefined);
    requestLocation();
  };

  const label = shown
    ? `Help comes to ${shown.title}${shown.subtitle ? `, ${shown.subtitle}` : ""}. Tap to refresh.`
    : error
      ? denied ? "Location is off. Tap to turn on location." : "Couldn’t find your location. Tap to try again."
      : "Finding your location";

  return (
    <button type="button" className="rq-gh-place rq-press" onClick={() => void lookAgain()} aria-label={label}>
      {shown ? (
        <>
          <span className="rq-gh-place-name"><MaterialSymbol name="near_me" />{shown.title}<MaterialSymbol name="expand_more" className="rq-gh-place-more" /></span>
          {shown.subtitle ? <span className="rq-gh-place-line">{shown.subtitle}</span> : null}
        </>
      ) : error ? (
        <>
          <span className="rq-gh-place-name"><MaterialSymbol name="location_off" />{denied ? "Location is off" : "Couldn’t find you"}</span>
          <span className="rq-gh-place-line is-action">{denied ? "Tap to turn on location" : "Tap to try again"}</span>
        </>
      ) : (
        <>
          <span className="rq-gh-place-name"><MaterialSymbol name="my_location" className="rq-breathe" />Finding your location…</span>
          <span className="rq-gh-place-line"><span className="rq-shimmer rq-gh-skel" /></span>
        </>
      )}
    </button>
  );
}

/**
 * Get help (/services): pick the vehicle, then what's wrong. A customer's saved vehicles come first;
 * every service shows the lowest price our technicians charge for that kind of vehicle.
 */
export default function ServicesPage() {
  const { user } = useAuth();
  const garageQuery = useQuery({ queryKey: GARAGE_QUERY_KEY, queryFn: listVehicles, enabled: Boolean(user?.id) });
  const garage = byNewest(garageQuery.data ?? []);

  // Which list the row shows, and what is picked in each.
  const [list, setList] = useState<"garage" | "kinds">("garage");
  const [savedId, setSavedId] = useState<number | null>(null);
  const [kind, setKind] = useState<Kind>("car");

  const showGarage = list === "garage" && garage.length > 0;
  const saved = showGarage ? garage.find((vehicle) => vehicle.id === savedId) ?? garage[0] : null;
  const family: Kind = saved ? vehicleTypeOf(saved.type) : kind;
  const whose = saved ? saved.model : KINDS.find((entry) => entry.id === family)!.name;

  const prices = useQuery({
    queryKey: ["home", "service-prices", family],
    queryFn: ({ signal }) => fetchServicePrices(family, signal),
    staleTime: 5 * 60 * 1000,
  });
  const priceOf = (id: string) => prices.data?.services.find((entry) => entry.service === id)?.startingPrice ?? null;

  // Charging is for electric vehicles only, and they take no fuel.
  const services = SERVICES.filter((service) => (service.id === "ev-charging" ? family === "ev" : service.id !== "fuel" || family !== "ev"));
  // Two large tiles: towing, and the next most-asked for this kind of vehicle. The rest follow in threes.
  const top = services.filter((service) => service.id === "towing" || service.id === (family === "ev" ? "ev-charging" : "flat-tire"));
  const rest = services.filter((service) => !top.includes(service));
  const hasAnyPrice = services.some((service) => priceOf(service.id) != null);
  const formPath = (serviceId: string) => `/request-service/${serviceId}/${family}${saved ? `?vehicle=${encodeURIComponent(String(saved.id))}` : ""}`;

  const price = (id: string) => {
    const value = priceOf(id);
    if (value != null) return <span className="rq-gh-price">from<b>{formatRupees(value)}</b></span>;
    return prices.isPending ? <span className="rq-gh-price" aria-hidden="true"><span className="rq-shimmer rq-gh-skel" /></span> : null;
  };
  const tileLabel = (name: string, id: string) => {
    const value = priceOf(id);
    return `${name} for your ${saved ? saved.model : whose.toLowerCase()}${value != null ? `, from ${formatRupees(value)}` : ""}`;
  };

  return (
    <div className="rq-pg rq-gh">
      <div className="rq-pg-in">
        <div className="rq-gh-top">
          <HelpPlace />
          <Link to="/request-service/emergency" className="rq-gh-sos rq-press" aria-label="SOS, request emergency help">
            <MaterialSymbol name="call" />SOS
          </Link>
        </div>
        <h1 className="rq-pg-h1">Get help</h1>

        <div className={cn("rq-gh-rail", !showGarage && "is-kinds")} role="radiogroup" aria-label="Your vehicle">
          {user?.id && garageQuery.isPending ? (
            <>
              <span className="rq-shimmer rq-gh-veh-skel" /><span className="rq-shimmer rq-gh-veh-skel" /><span className="rq-shimmer rq-gh-veh-skel" />
            </>
          ) : showGarage && saved ? (
            <>
              {garage.map((vehicle) => {
                const on = vehicle.id === saved.id;
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    className={cn("rq-gh-veh rq-press", on && "is-on")}
                    aria-label={`${vehicle.model}${vehicle.license_plate ? `, ${vehicle.license_plate}` : ""}`}
                    onClick={() => setSavedId(vehicle.id)}
                  >
                    {on ? <span className="rq-gh-tick" aria-hidden="true"><MaterialSymbol name="check" /></span> : null}
                    <img src={studioImage(vehicle.type)} alt="" draggable={false} />
                    <span className="rq-gh-veh-text"><b>{vehicle.model}</b><span>{vehicle.license_plate || "No plate"}</span></span>
                  </button>
                );
              })}
              <button type="button" className="rq-gh-veh is-switch rq-press" onClick={() => setList("kinds")}>
                <MaterialSymbol name="add" />Other
              </button>
            </>
          ) : (
            <>
              {KINDS.map((entry) => {
                const on = entry.id === family;
                return (
                  <button key={entry.id} type="button" role="radio" aria-checked={on} className={cn("rq-gh-veh is-kind rq-press", on && "is-on")} onClick={() => setKind(entry.id)}>
                    {on ? <span className="rq-gh-tick" aria-hidden="true"><MaterialSymbol name="check" /></span> : null}
                    <img src={entry.art} alt="" draggable={false} />{entry.name}
                  </button>
                );
              })}
              {garage.length > 0 ? (
                <button type="button" className="rq-gh-veh is-switch is-tall rq-press" onClick={() => setList("garage")}>
                  <MaterialSymbol name="garage_home" />My garage
                </button>
              ) : null}
            </>
          )}
        </div>
        {user?.id && garageQuery.isSuccess && garage.length === 0 ? (
          <p className="rq-gh-tip"><MaterialSymbol name="bolt" /><span>Save your vehicle once and pick it here in one tap.</span><Link to="/my-garage/add">Save</Link></p>
        ) : null}

        <div className="rq-gh-head">
          <h2 className="rq-pg-h2">What’s wrong?</h2>
          {hasAnyPrice ? (
            <p className="rq-gh-sub"><MaterialSymbol name="payments" />Lowest prices from our technicians · {whose}</p>
          ) : null}
        </div>
        <div className="rq-gh-two">
          {top.map((service) => (
            <Link key={service.id} to={formPath(service.id)} className="rq-gh-big rq-press" aria-label={tileLabel(service.name, service.id)}>
              <b>{service.name}</b>
              <span className="rq-gh-say">{service.say}</span>
              {price(service.id)}
              <img src={`/images/home/services/${service.id}.webp`} alt="" draggable={false} />
            </Link>
          ))}
        </div>
        <div className="rq-gh-three">
          {rest.map((service) => (
            <Link key={service.id} to={formPath(service.id)} className="rq-gh-sm rq-press" aria-label={tileLabel(service.name, service.id)}>
              <span className="rq-gh-tile"><img src={`/images/home/services/${service.id}.webp`} alt="" draggable={false} loading="lazy" /></span>
              <b>{service.name}</b>
              {price(service.id)}
            </Link>
          ))}
          <Link to={formPath("other")} className="rq-gh-sm rq-press" aria-label="Something else: tell us what happened">
            <span className="rq-gh-tile"><MaterialSymbol name="help" /></span>
            <b>Something else</b>
            <span className="rq-gh-price">Tell us</span>
          </Link>
        </div>

        <aside className="rq-gh-soon" aria-label="AI Vehicle Health, coming soon">
          <span className="rq-gh-soon-tag"><MaterialSymbol name="schedule" />Coming soon</span>
          <b>AI Vehicle Health</b>
          <span className="rq-gh-soon-text">Spots trouble before it leaves you stuck.</span>
          <span className="rq-gh-pulse" aria-hidden="true"><MaterialSymbol name="monitor_heart" /></span>
          <img src="/images/vehicles/car.webp" alt="" draggable={false} loading="lazy" />
        </aside>

        <p className="rq-gh-promise"><MaterialSymbol name="verified_user" />You see the price before you confirm, and pay only after the work is done.</p>
      </div>
    </div>
  );
}
