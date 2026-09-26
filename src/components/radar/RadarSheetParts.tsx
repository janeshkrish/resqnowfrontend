import type { ReactNode } from "react";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import {
  formatChargingPower,
  formatStationDistance,
  googleMapsDirectionsUrl,
  hasChargerDetails,
  hasCoordinates,
  operatingStatus,
  type EVChargingStation,
} from "@/lib/evCharging";
import { cn } from "@/lib/utils";
import { initialsOf } from "./initials";

/** Loading, empty, error and location prompts share one quiet card. */
export function RadarNotice({
  icon,
  title,
  body,
  tone = "neutral",
  busy = false,
  action,
}: {
  icon: string;
  title: string;
  body?: string;
  tone?: "neutral" | "warning" | "ev";
  busy?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className={cn("rq-h-card rq-radar-notice", `is-${tone}`)} role={tone === "warning" ? "alert" : "status"}>
      <span className={cn("rq-radar-notice-icon", busy && "is-busy")}>
        <MaterialSymbol name={icon} />
      </span>
      <div className="rq-radar-notice-copy">
        <p className="rq-radar-notice-title">{title}</p>
        {body ? <p className="rq-radar-notice-body">{body}</p> : null}
        {action}
      </div>
    </div>
  );
}

export function RadarSkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="rq-radar-skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rq-radar-skeleton-row">
          <span className="rq-radar-skeleton-tile" />
          <span className="rq-radar-skeleton-lines">
            <span className="rq-shimmer" />
            <span className="rq-shimmer" style={{ width: 110 }} />
          </span>
        </div>
      ))}
    </div>
  );
}

type TechnicianSummary = {
  id: string;
  name: string;
  rating: number;
  distance: number;
  aiRecommended?: boolean;
};

const ratingLabel = (rating: number) => (Number.isFinite(rating) && rating > 0 ? rating.toFixed(1) : "New");
const distanceLabel = (km: number) => (Number.isFinite(km) ? `${km.toFixed(1)} km` : "—");

export function TechnicianPick({
  technician,
  serviceLabel,
  highlights,
  etaLabel,
  onRequest,
}: {
  technician: TechnicianSummary;
  serviceLabel: string;
  highlights: string;
  etaLabel: string;
  onRequest: () => void;
}) {
  return (
    <article className="rq-h-card rq-radar-pick" aria-label={technician.name}>
      <div className="rq-radar-pick-head">
        <span className="rq-radar-avatar" aria-hidden="true">{initialsOf(technician.name)}</span>
        <div className="rq-radar-pick-copy">
          <h3 className="rq-radar-name">{technician.name}</h3>
          <p className="rq-radar-meta">
            <MaterialSymbol name="star" className="rq-symbol-xs rq-h-star" />
            {ratingLabel(technician.rating)}
            <span aria-hidden="true">·</span>
            {serviceLabel}
          </p>
        </div>
        {technician.aiRecommended ? (
          <span className="rq-radar-badge">
            <MaterialSymbol name="verified" className="rq-symbol-xs" />
            Best match
          </span>
        ) : null}
      </div>

      <dl className="rq-radar-stats">
        <div>
          <dt>Arrival</dt>
          <dd><MaterialSymbol name="schedule" className="rq-symbol-sm" />{etaLabel}</dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd><MaterialSymbol name="near_me" className="rq-symbol-sm" />{distanceLabel(technician.distance)}</dd>
        </div>
        <div>
          <dt>Partner</dt>
          <dd><MaterialSymbol name="verified_user" className="rq-symbol-sm" />Verified</dd>
        </div>
      </dl>

      {highlights ? <p className="rq-radar-highlights">{highlights}</p> : null}

      <button type="button" onClick={onRequest} className="rq-h-btn rq-h-btn-block rq-press">
        Request service
        <MaterialSymbol name="arrow_forward" className="rq-symbol-sm" />
      </button>
    </article>
  );
}

export function TechnicianRow({
  technician,
  serviceLabel,
  onSelect,
}: {
  technician: TechnicianSummary;
  serviceLabel: string;
  onSelect: () => void;
}) {
  return (
    <button type="button" onClick={onSelect} className="rq-radar-row rq-press">
      <span className="rq-radar-row-tile" aria-hidden="true">{initialsOf(technician.name)}</span>
      <span className="rq-radar-row-copy">
        <span className="rq-radar-row-name">{technician.name}</span>
        <span className="rq-radar-row-meta">
          <MaterialSymbol name="star" className="rq-symbol-xs rq-h-star" />
          {ratingLabel(technician.rating)} · {serviceLabel} · {distanceLabel(technician.distance)}
        </span>
      </span>
      <MaterialSymbol name="chevron_right" className="rq-radar-row-chevron" />
    </button>
  );
}

function OperatingStatus({ station }: { station: EVChargingStation }) {
  const status = operatingStatus(station);
  const hours = station.openingHours?.[0];
  if (status) {
    return (
      <span className={cn("rq-radar-pill", status === "open" ? "is-open" : "is-closed")}>
        <i aria-hidden="true" />
        {status === "open" ? "Open" : "Closed"}
        {hours ? <span className="rq-radar-pill-extra">· {hours}</span> : null}
      </span>
    );
  }
  return (
    <span className="rq-radar-pill">
      <MaterialSymbol name="schedule" className="rq-symbol-xs" />
      {hours ? `Hours: ${hours}` : "Operating hours unavailable"}
    </span>
  );
}

export function EvStationCard({ station }: { station: EVChargingStation }) {
  const distance = formatStationDistance(station.distance);
  const power = formatChargingPower(station.chargingPower);
  const specs = [
    station.connectorTypes?.length
      ? { icon: "electrical_services", label: "Connectors", value: station.connectorTypes.join(" · ") }
      : null,
    station.chargingTypes?.length
      ? { icon: "bolt", label: "Charging", value: station.chargingTypes.join(" · ") }
      : null,
    power ? { icon: "battery_charging_full", label: "Power", value: `Up to ${power}` } : null,
    station.chargingSlots
      ? {
          icon: "ev_station",
          label: "Charge points",
          value: `${station.chargingSlots} charging point${station.chargingSlots === 1 ? "" : "s"}`,
        }
      : null,
  ].filter((spec): spec is { icon: string; label: string; value: string } => spec !== null);

  return (
    <article className="rq-h-card rq-radar-ev" aria-label={station.name}>
      <div className="rq-radar-pick-head">
        <span className="rq-radar-ev-icon" aria-hidden="true">
          <MaterialSymbol name="ev_station" />
        </span>
        <div className="rq-radar-pick-copy">
          <h3 className="rq-radar-name">{station.name}</h3>
          {distance || station.provider ? (
            <p className="rq-radar-meta">{[distance, station.provider].filter(Boolean).join(" · ")}</p>
          ) : null}
        </div>
      </div>

      <div className="rq-radar-pills">
        <OperatingStatus station={station} />
        {/* Open hours never mean a charger is free; we have no live occupancy data. */}
        <span className="rq-radar-pill is-muted">
          <MaterialSymbol name="info" className="rq-symbol-xs" />
          Availability: Unknown
        </span>
      </div>

      {hasChargerDetails(station) ? (
        <dl className="rq-radar-specs">
          {specs.map((spec) => (
            <div key={spec.label}>
              <dt>
                <MaterialSymbol name={spec.icon} className="rq-symbol-sm" />
                {spec.label}
              </dt>
              <dd>{spec.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="rq-radar-specs-empty">Connector information unavailable</p>
      )}

      {station.address ? (
        <p className="rq-radar-address">
          <MaterialSymbol name="location_on" className="rq-symbol-sm" />
          {station.address}
        </p>
      ) : null}

      <div className="rq-radar-actions">
        <a
          href={googleMapsDirectionsUrl(station)}
          target="_blank"
          rel="noopener noreferrer"
          className="rq-h-btn rq-radar-navigate rq-press"
          aria-label={`Navigate to ${station.name} in Google Maps`}
        >
          <MaterialSymbol name="directions" />
          Navigate
        </a>
        {station.phone ? (
          <a href={`tel:${station.phone}`} className="rq-radar-call rq-press" aria-label={`Call ${station.name}`}>
            <MaterialSymbol name="call" />
          </a>
        ) : null}
      </div>
      {!hasCoordinates(station) ? (
        <p className="rq-h-note">Mappls has no map pin for this station, so Google Maps will look it up by name.</p>
      ) : null}
    </article>
  );
}

export function EvStationRow({ station, onSelect }: { station: EVChargingStation; onSelect: () => void }) {
  const status = operatingStatus(station);
  const meta = [
    formatStationDistance(station.distance),
    status === "open" ? "Open" : status === "closed" ? "Closed" : null,
    station.connectorTypes?.slice(0, 2).join(", "),
  ].filter(Boolean);
  return (
    <button type="button" onClick={onSelect} className="rq-radar-row rq-press">
      <span className="rq-radar-row-tile is-ev" aria-hidden="true">
        <MaterialSymbol name="ev_station" />
      </span>
      <span className="rq-radar-row-copy">
        <span className="rq-radar-row-name">{station.name}</span>
        {meta.length ? <span className="rq-radar-row-meta">{meta.join(" · ")}</span> : null}
      </span>
      <MaterialSymbol name="chevron_right" className="rq-radar-row-chevron" />
    </button>
  );
}
