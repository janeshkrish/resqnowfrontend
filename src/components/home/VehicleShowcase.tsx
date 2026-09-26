import { useState } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";
import MaterialSymbol from "./MaterialSymbol";

type VehicleId = "car" | "bike" | "commercial" | "ev";

const VEHICLES: Array<{
  id: VehicleId;
  tab: string;
  icon: string;
  name: string;
  types: string;
  cta: string;
  image: string;
  imageClass: string;
  fixes: Array<{ service: string; label: string; icon: string }>;
}> = [
  {
    id: "car", tab: "Car", icon: "directions_car", name: "Cars", types: "Hatchback · Sedan · SUV", cta: "Get help for my car",
    image: "/images/vehicles/car.webp", imageClass: "is-car",
    fixes: [
      { service: "towing", label: "Towing", icon: "auto_towing" },
      { service: "flat-tire", label: "Flat tyre", icon: "tire_repair" },
      { service: "battery", label: "Battery", icon: "battery_charging_full" },
      { service: "lockout", label: "Lockout", icon: "car_lock" },
    ],
  },
  {
    id: "bike", tab: "Bike", icon: "two_wheeler", name: "Bikes", types: "Motorcycle · Scooter", cta: "Get help for my bike",
    image: "/images/vehicles/bike.webp", imageClass: "is-bike",
    fixes: [
      { service: "flat-tire", label: "Flat tyre", icon: "tire_repair" },
      { service: "fuel", label: "Fuel", icon: "local_gas_station" },
      { service: "battery", label: "Battery", icon: "battery_charging_full" },
      { service: "towing", label: "Towing", icon: "auto_towing" },
    ],
  },
  {
    id: "commercial", tab: "Truck", icon: "local_shipping", name: "Commercial", types: "Truck · Van · Bus", cta: "Get help for my truck",
    image: "/images/vehicles/truck.webp", imageClass: "is-truck",
    fixes: [
      { service: "towing", label: "Towing", icon: "auto_towing" },
      { service: "winching", label: "Winching", icon: "phishing" },
      { service: "mechanical", label: "Mechanic", icon: "car_repair" },
      { service: "flat-tire", label: "Flat tyre", icon: "tire_repair" },
    ],
  },
  {
    id: "ev", tab: "EV", icon: "electric_car", name: "Electric", types: "E-car · E-scooter", cta: "Get help for my EV",
    image: "/images/vehicles/ev.webp", imageClass: "is-ev",
    fixes: [
      { service: "ev-charging", label: "EV charge", icon: "ev_station" },
      { service: "towing", label: "Towing", icon: "auto_towing" },
      { service: "flat-tire", label: "Flat tyre", icon: "tire_repair" },
      { service: "mechanical", label: "Mechanic", icon: "car_repair" },
    ],
  },
];

export default function VehicleShowcase() {
  const [selectedId, setSelectedId] = useState<VehicleId>("car");
  const selected = VEHICLES.find((vehicle) => vehicle.id === selectedId) || VEHICLES[0];

  return (
    <section className="rq-h-section" aria-labelledby="rq-h-vehicles-title">
      <div className="rq-h-head">
        <div>
          <h2 id="rq-h-vehicles-title" className="rq-h-title">Every vehicle, covered</h2>
          <span className="rq-h-sub">Two-wheelers to heavy trucks. Pick yours.</span>
        </div>
      </div>
      <div className="rq-h-card rq-h-vehicles">
        <div className="rq-h-seg" role="tablist" aria-label="Vehicle type">
          {VEHICLES.map((vehicle) => (
            <button
              key={vehicle.id}
              type="button"
              role="tab"
              aria-selected={vehicle.id === selectedId}
              className={cn("rq-h-seg-btn", vehicle.id === selectedId && "is-on")}
              onClick={() => setSelectedId(vehicle.id)}
            >
              <MaterialSymbol name={vehicle.icon} />
              {vehicle.tab}
            </button>
          ))}
        </div>

        <div className="rq-h-stage" aria-hidden="true">
          {VEHICLES.map((vehicle) => (
            <img
              key={vehicle.id}
              src={vehicle.image}
              alt=""
              draggable={false}
              loading="lazy"
              className={cn(vehicle.imageClass, vehicle.id === selectedId && "is-on")}
            />
          ))}
        </div>

        <div className="rq-h-vehicle-copy" role="tabpanel" aria-label={selected.name}>
          <span className="rq-h-vehicle-name">{selected.name}</span>
          <span className="rq-h-vehicle-types">{selected.types}</span>
        </div>
        <div className="rq-h-chips">
          {selected.fixes.map((fix) => (
            <Link key={fix.service} to={`/request-service/${fix.service}/${selected.id}`} className="rq-h-chip rq-press">
              <MaterialSymbol name={fix.icon} className="rq-symbol-sm" />
              {fix.label}
            </Link>
          ))}
        </div>
        <Link to={`/request-service/emergency/${selected.id}`} className="rq-h-btn rq-h-btn-block rq-press">
          {selected.cta}
          <MaterialSymbol name="arrow_forward" />
        </Link>
      </div>
    </section>
  );
}
