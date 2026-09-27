import { forwardRef, useState, type ReactNode } from "react";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { cn } from "@/lib/utils";

export type Logo = { logo?: string | null; photo?: string | null; initials: string };

/** A brand logo, the technician's own photo, or their initials when there is neither. */
export function LogoTile({ logo, photo, initials, size = "md" }: Logo & { size?: "xs" | "md" | "lg" }) {
  const [failed, setFailed] = useState(false);
  const src = failed ? null : logo || photo || null;
  return (
    <span
      aria-hidden="true"
      className={cn("rqr-logo", size !== "md" && `rqr-logo--${size}`, src && logo && "rqr-logo--brand", src && !logo && "rqr-logo--photo")}
    >
      {src ? <img src={src} alt="" loading="lazy" draggable={false} onError={() => setFailed(true)} /> : initials}
    </span>
  );
}

export type TechnicianView = Logo & {
  id: string;
  name: string;
  sub: string;
  rating: string;
  jobs: number;
  etaMinutes: number;
  km: string;
  services: string[];
  vehicles: Array<{ label: string; icon: string }>;
};

export type StationView = Logo & {
  id: string;
  name: string;
  sub?: string;
  status: { text: string; tone: "open" | "closed" | "none" };
  km: string;
  directionsUrl: string;
};

export type EvView = StationView & {
  /** Where the charger is, e.g. the building or mall it sits in. */
  area?: string;
  kw: string | null;
  connectors: string[];
  chargingTypes: string[];
  points: number | null;
  address?: string;
  phone?: string;
};

export type FuelView = StationView & {
  area?: string;
  address?: string;
  phone?: string;
  prices: Array<{ label: string; value: string; change: number | null }>;
};

const statusClass = (tone: StationView["status"]["tone"]) =>
  cn("rqr-pill", tone === "open" && "rqr-pill--open", tone === "closed" && "rqr-pill--closed");

function Directions({ href, name }: { href: string; name: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rqr-dirs rq-press"
      aria-label={`Directions to ${name} in Google Maps`}
      onClick={(event) => event.stopPropagation()}
    >
      <MaterialSymbol name="directions" className="rq-symbol-sm" />
      Directions
    </a>
  );
}

type CardProps = { selected: boolean; onSelect: () => void };

export const TechnicianCard = forwardRef<HTMLElement, CardProps & { technician: TechnicianView }>(
  function TechnicianCard({ technician: t, selected, onSelect }, ref) {
    return (
      <article ref={ref} className={cn("rqr-card", selected && "is-sel")} aria-label={t.name}>
        <button type="button" className="rqr-card__select" onClick={onSelect} aria-label={`Open ${t.name}'s profile`} />
        <div className="rqr-card__top">
          <LogoTile logo={null} photo={t.photo} initials={t.initials} />
          <div className="rqr-card__id">
            <p className="rqr-card__name">{t.name}<MaterialSymbol name="verified" className="rq-symbol-sm" /></p>
            <p className="rqr-card__sub">{t.sub}</p>
          </div>
          <span className="rqr-rate"><MaterialSymbol name="star" className="rq-symbol-xs" />{t.rating}</span>
        </div>
        <dl className="rqr-stats">
          <div><dt>away</dt><dd className="is-hot">{t.etaMinutes} min</dd></div>
          <div><dt>distance</dt><dd>{t.km}</dd></div>
          <div><dt>jobs done</dt><dd>{t.jobs}</dd></div>
        </dl>
        <div className="rqr-tags">{t.services.slice(0, 3).map((s) => <span key={s} className="rqr-tag">{s}</span>)}</div>
      </article>
    );
  },
);

export const EvCard = forwardRef<HTMLElement, CardProps & { station: EvView }>(function EvCard({ station: e, selected, onSelect }, ref) {
  return (
    <article ref={ref} className={cn("rqr-card", selected && "is-sel")} aria-label={e.name}>
      <button type="button" className="rqr-card__select" onClick={onSelect} aria-label={`Open details for ${e.name}`} />
      <div className="rqr-card__top">
        <LogoTile {...e} />
        <div className="rqr-card__id">
          <p className="rqr-card__name">{e.name}</p>
          <span className={statusClass(e.status.tone)}>{e.status.text}</span>
        </div>
      </div>
      <div className="rqr-card__row">
        {e.kw ? <span className="rqr-kw"><b>{e.kw}</b><small>kW max</small></span> : <span className="rqr-card__sub">Charger details not listed</span>}
        <span className="rqr-tags">{e.connectors.slice(0, 2).map((c) => <span key={c} className="rqr-tag"><MaterialSymbol name="electrical_services" className="rq-symbol-xs" />{c}</span>)}</span>
      </div>
      <div className="rqr-card__row">
        <Directions href={e.directionsUrl} name={e.name} />
        <span className="rqr-dist"><MaterialSymbol name="near_me" className="rq-symbol-xs" />{[e.km, e.area].filter(Boolean).join(" · ")}</span>
      </div>
    </article>
  );
});

function PriceChip({ price: p }: { price: FuelView["prices"][number] }) {
  return (
    <span className="rqr-price">
      <small>{p.label}</small>
      <b>
        {p.value}
        {p.change !== null ? (
          <span className={cn("rqr-chg", p.change > 0 ? "rqr-chg--up" : p.change < 0 ? "rqr-chg--down" : "rqr-chg--flat")}>
            <MaterialSymbol name={p.change > 0 ? "arrow_drop_up" : p.change < 0 ? "arrow_drop_down" : "remove"} />
            {p.change ? Math.abs(p.change).toFixed(2) : ""}
          </span>
        ) : null}
      </b>
    </span>
  );
}

export const FuelCard = forwardRef<HTMLElement, CardProps & { station: FuelView }>(function FuelCard({ station: f, selected, onSelect }, ref) {
  return (
    <article ref={ref} className={cn("rqr-card", selected && "is-sel")} aria-label={f.name}>
      <button type="button" className="rqr-card__select" onClick={onSelect} aria-label={`Open details for ${f.name}`} />
      <div className="rqr-card__top">
        <LogoTile {...f} />
        <div className="rqr-card__id">
          <p className="rqr-card__name">{f.name}</p>
          <span className={statusClass(f.status.tone)}>{f.status.text}</span>
        </div>
      </div>
      {f.prices.length ? (
        <div className="rqr-prices">{f.prices.map((p) => <PriceChip key={p.label} price={p} />)}</div>
      ) : (
        <p className="rqr-card__sub">Prices aren’t available for this city yet</p>
      )}
      <div className="rqr-card__row">
        <Directions href={f.directionsUrl} name={f.name} />
        <span className="rqr-dist"><MaterialSymbol name="near_me" className="rq-symbol-xs" />{[f.km, f.area].filter(Boolean).join(" · ")}</span>
      </div>
    </article>
  );
});

export type RowView = Logo & { id: string; name: string; meta: string; value: string; valueSub: string; hot?: boolean };

export function PeekCard({ row }: { row: RowView }) {
  return (
    <div className="rqr-peek" aria-label={`${row.name}. Tap to show the full card.`}>
      <LogoTile logo={row.logo} photo={row.photo} initials={row.initials} />
      <span className="rqr-peek__mid"><b>{row.name}</b><small>{row.meta}</small></span>
      <span className="rqr-peek__val"><b className={cn(row.hot && "is-hot")}>{row.value}</b><small>{row.valueSub}</small></span>
      <span className="rqr-peek__up" aria-hidden="true"><MaterialSymbol name="expand_less" /></span>
    </div>
  );
}

export function PlaceRow({ row, onSelect }: { row: RowView; onSelect: () => void }) {
  return (
    <button type="button" className="rqr-arow rq-press" onClick={onSelect}>
      <LogoTile logo={row.logo} photo={row.photo} initials={row.initials} />
      <span className="rqr-arow__mid"><b>{row.name}</b><small>{row.meta}</small></span>
      <span className="rqr-arow__val"><b className={cn(row.hot && "is-hot")}>{row.value}</b><small>{row.valueSub}</small></span>
    </button>
  );
}

function DetailTop({ logo, title, sub, onClose, verified }: { logo: ReactNode; title: string; sub: string; onClose: () => void; verified?: boolean }) {
  return (
    <div className="rqr-detail__top">
      {logo}
      <div className="rqr-detail__id">
        <h2 className="rqr-detail__name pj">{title}{verified ? <MaterialSymbol name="verified" className="rq-symbol-sm" /> : null}</h2>
        <p className="rqr-detail__sub">{sub}</p>
      </div>
      <button type="button" className="rqr-icon-btn rq-press" onClick={onClose} aria-label="Close"><MaterialSymbol name="close" /></button>
    </div>
  );
}

function Tile({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="rqr-tile">
      <span className="rqr-tile__ic"><MaterialSymbol name={icon} className="rq-symbol-sm" /></span>
      <b>{value}</b>
      <small>{label}</small>
    </div>
  );
}

/** A technician's public profile. The radar only shows who is nearby; booking happens through Get help. */
export function TechnicianProfile({ technician: t, onClose }: { technician: TechnicianView; onClose: () => void }) {
  return (
    <section className="rqr-detail" aria-label={`${t.name} profile`}>
      <DetailTop logo={<LogoTile logo={null} photo={t.photo} initials={t.initials} size="lg" />} title={t.name} sub={t.sub} onClose={onClose} verified />
      <div className="rqr-pills">
        <span className="rqr-rate"><MaterialSymbol name="star" className="rq-symbol-xs" />{t.rating} rating</span>
        <span className="rqr-pill">{t.jobs} jobs done</span>
        <span className="rqr-pill rqr-pill--open"><span className="rq-h-live-dot" aria-hidden="true" />Online now</span>
      </div>
      <div className="rqr-tiles">
        <Tile icon="schedule" value={`${t.etaMinutes} min`} label="could reach you" />
        <Tile icon="near_me" value={t.km} label="from you" />
        <Tile icon="workspace_premium" value="Verified" label="ResQNow partner" />
      </div>
      {t.services.length ? (
        <>
          <p className="rqr-sec">Services</p>
          <div className="rqr-chips">{t.services.map((s) => <span key={s} className="rqr-tag rqr-tag--lg">{s}</span>)}</div>
        </>
      ) : null}
      {t.vehicles.length ? (
        <>
          <p className="rqr-sec">Vehicles</p>
          <div className="rqr-chips">{t.vehicles.map((v) => <span key={v.label} className="rqr-tag rqr-tag--lg"><MaterialSymbol name={v.icon} className="rq-symbol-sm" />{v.label}</span>)}</div>
        </>
      ) : null}
      <p className="rqr-note"><MaterialSymbol name="info" className="rq-symbol-sm" />Live radar shows who is working near you. To get help, tap Get help and we match the right technician for your problem.</p>
    </section>
  );
}

export function StationDetail({ station: e, onClose }: { station: EvView; onClose: () => void }) {
  const hasSpecs = Boolean(e.kw || e.points || e.connectors.length || e.chargingTypes.length);
  return (
    <section className="rqr-detail" aria-label={`${e.name} details`}>
      <DetailTop logo={<LogoTile {...e} size="lg" />} title={e.name} sub={e.sub || "EV charging station"} onClose={onClose} />
      <div className="rqr-pills">
        <span className={statusClass(e.status.tone)}>{e.status.text}</span>
        <span className="rqr-pill"><MaterialSymbol name="near_me" className="rq-symbol-xs" />{e.km} away</span>
        <span className="rqr-pill rqr-pill--dash"><MaterialSymbol name="info" className="rq-symbol-xs" />Availability unknown</span>
      </div>
      {hasSpecs ? (
        <div className="rqr-tiles">
          {e.kw ? <Tile icon="bolt" value={`${e.kw} kW`} label="max power" /> : null}
          {e.points ? <Tile icon="ev_station" value={String(e.points)} label="charge points" /> : null}
          {e.chargingTypes.length ? <Tile icon="electrical_services" value={e.chargingTypes.join(" · ")} label="charging" /> : null}
        </div>
      ) : (
        <p className="rqr-note"><MaterialSymbol name="electrical_services" className="rq-symbol-sm" />Connector information unavailable for this station.</p>
      )}
      {e.connectors.length ? (
        <>
          <p className="rqr-sec">Connectors</p>
          <div className="rqr-chips">{e.connectors.map((c) => <span key={c} className="rqr-plug"><span className="rqr-plug__ic"><MaterialSymbol name="electrical_services" className="rq-symbol-sm" /></span>{c}</span>)}</div>
        </>
      ) : null}
      {e.address ? <p className="rqr-address"><MaterialSymbol name="location_on" className="rq-symbol-sm" />{e.address}</p> : null}
      <div className="rqr-actions">
        <a href={e.directionsUrl} target="_blank" rel="noopener noreferrer" className="rq-h-btn rqr-grow rq-press" aria-label={`Directions to ${e.name} in Google Maps`}>
          <MaterialSymbol name="directions" />Directions in Google Maps
        </a>
        {e.phone ? <a href={`tel:${e.phone}`} className="rqr-icon-btn rqr-icon-btn--lg rq-press" aria-label={`Call ${e.name}`}><MaterialSymbol name="call" /></a> : null}
      </div>
      <p className="rqr-note">
        <MaterialSymbol name="info" className="rq-symbol-sm" />
        {e.status.tone === "none" ? "" : "Open means the station is operating. "}The network doesn’t share whether a charger is free right now.
      </p>
    </section>
  );
}

export function FuelDetail({ station: f, area, onClose }: { station: FuelView; area?: string; onClose: () => void }) {
  return (
    <section className="rqr-detail" aria-label={`${f.name} details`}>
      <DetailTop logo={<LogoTile {...f} size="lg" />} title={f.name} sub={f.sub || "Fuel pump"} onClose={onClose} />
      <div className="rqr-pills">
        <span className={statusClass(f.status.tone)}>{f.status.text}</span>
        <span className="rqr-pill"><MaterialSymbol name="near_me" className="rq-symbol-xs" />{f.km} away</span>
      </div>
      {f.prices.length ? (
        <>
          <p className="rqr-sec">Today’s prices</p>
          <div className="rqr-prices rqr-prices--lg">{f.prices.map((p) => <PriceChip key={p.label} price={p} />)}</div>
        </>
      ) : (
        <p className="rqr-note"><MaterialSymbol name="info" className="rq-symbol-sm" />Prices aren’t available for this city yet.</p>
      )}
      {f.address ? <p className="rqr-address"><MaterialSymbol name="location_on" className="rq-symbol-sm" />{f.address}</p> : null}
      <div className="rqr-actions">
        <a href={f.directionsUrl} target="_blank" rel="noopener noreferrer" className="rq-h-btn rqr-grow rq-press" aria-label={`Directions to ${f.name} in Google Maps`}>
          <MaterialSymbol name="directions" />Directions in Google Maps
        </a>
        {f.phone ? <a href={`tel:${f.phone}`} className="rqr-icon-btn rqr-icon-btn--lg rq-press" aria-label={`Call ${f.name}`}><MaterialSymbol name="call" /></a> : null}
      </div>
      {f.prices.length ? (
        <p className="rqr-note"><MaterialSymbol name="info" className="rq-symbol-sm" />These are today’s city prices{area ? ` for ${area}` : ""}. The pump’s own price can differ slightly.</p>
      ) : null}
    </section>
  );
}

export function RadarMessage({ icon, title, body, action, tone = "neutral" }: { icon: string; title: string; body: string; action?: ReactNode; tone?: "neutral" | "error" }) {
  return (
    <div className="rqr-msg" role={tone === "error" ? "alert" : "status"}>
      <span className={cn("rqr-msg__ic", tone === "error" && "is-error")}><MaterialSymbol name={icon} /></span>
      <h3 className="pj">{title}</h3>
      <p>{body}</p>
      {action ? <div className="rqr-msg__actions">{action}</div> : null}
    </div>
  );
}

export function CardSkeletons() {
  return (
    <div className="rqr-carousel" aria-hidden="true">
      {[0, 1].map((i) => (
        <div key={i} className="rqr-card rqr-card--skel">
          <span className="rqr-skel" style={{ width: 52, height: 52, borderRadius: 16 }} />
          <span className="rqr-skel" style={{ width: 160 - i * 20, height: 12 }} />
          <span className="rqr-skel" style={{ width: 110, height: 10 }} />
          <span className="rqr-skel" style={{ width: 120, height: 34, borderRadius: 12 }} />
        </div>
      ))}
    </div>
  );
}
