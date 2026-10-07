import { useRef, useState, type PointerEvent } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as AlertDialog from "@radix-ui/react-alert-dialog";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { getBrandLogoSrc } from "@/lib/brandLogo";
import {
  STATUS_LABELS,
  brandFor,
  initialsOf,
  normalizeStatus,
  shortMake,
  vehicleTypeOf,
  type Vehicle,
  type VehicleStatus,
} from "@/lib/garage";
import { kindOf, savedSince, type HelpHistory } from "@/lib/garageShow";
import { studioImage } from "@/lib/vehiclePhoto";
import { cn } from "@/lib/utils";

/** The brand's logo, or its initials when we have no logo for it. */
export function BrandLogo({ make, size = "md" }: { make: string; size?: "sm" | "md" | "lg" | "tile" }) {
  const brand = brandFor(make);
  const [failed, setFailed] = useState(false);
  const src = brand?.logo && !failed ? getBrandLogoSrc(brand.logo) : null;
  return (
    <span className={cn("rqg-logo", size !== "md" && `rqg-logo--${size}`, !src && "is-initials")} aria-hidden="true">
      {src ? <img src={src} alt="" draggable={false} onError={() => setFailed(true)} /> : initialsOf(brand?.name ?? make)}
    </span>
  );
}

/** The app's studio picture of a car or a bike. */
export function VehiclePhoto({ vehicle, className }: { vehicle: { type: string; make?: string; model?: string }; className?: string }) {
  return (
    <span className={cn("rqg-photo is-studio", className)} aria-hidden="true">
      <img src={studioImage(vehicle.type)} alt="" draggable={false} />
    </span>
  );
}

export function NumberPlate({ plate, size = "md" }: { plate?: string | null; size?: "sm" | "md" | "lg" }) {
  if (!plate) {
    return size === "sm" ? <span className="rqg-noplate-sm">No plate</span> : (
      <span className="rqg-noplate"><MaterialSymbol name="pin" className="rq-symbol-sm" />No number plate added</span>
    );
  }
  return (
    <span className={cn("rqg-plate", size !== "md" && `rqg-plate--${size}`)} aria-label={`Number plate ${plate}`}>
      <span className="rqg-plate-ind" aria-hidden="true"><span className="rqg-chakra" />IND</span>
      <span className="rqg-plate-num">{plate}</span>
    </span>
  );
}

export function StatusBadge({ status, floating = false }: { status?: string; floating?: boolean }) {
  const value = normalizeStatus(status);
  return (
    <span className={cn("rqg-status", `st-${value}`, floating && "is-floating")}>
      <span className="rqg-dot" aria-hidden="true" />
      {STATUS_LABELS[value]}
    </span>
  );
}

const typeLabel = (type: string) => (vehicleTypeOf(type) === "bike" ? "Bike" : "Car");

const kindClass = (type: string) => (vehicleTypeOf(type) === "bike" ? "is-bike" : "is-car");

/**
 * The bay: the vehicle on show stands side-on on a turning platform, with its model name behind it.
 * Swiping the bay shows the next or the previous vehicle; the one leaving drives off as the next drives in.
 */
export function VehicleBay({
  vehicle, previous, position, total, history, onHelp, onMore, onSwipe,
}: {
  vehicle: Vehicle;
  /** The vehicle that was on show before this one, so it can be seen driving off. */
  previous: Vehicle | null;
  position: number;
  total: number;
  /** Null until the customer's requests have loaded. */
  history: HelpHistory | null;
  onHelp: () => void;
  onMore: () => void;
  onSwipe: (step: 1 | -1) => void;
}) {
  const status = normalizeStatus(vehicle.status);
  const kind = kindOf(vehicle);
  const since = savedSince(vehicle.created_at);
  const pressedAt = useRef<number | null>(null);
  const release = (event: PointerEvent<HTMLElement>) => {
    const from = pressedAt.current;
    pressedAt.current = null;
    if (from == null) return;
    const moved = event.clientX - from;
    if (Math.abs(moved) > 40) onSwipe(moved < 0 ? 1 : -1);
  };

  return (
    <article
      className="rqg-show"
      aria-label={`${shortMake(vehicle.make)} ${vehicle.model}, ${STATUS_LABELS[status]}`}
      onPointerDown={(event) => { pressedAt.current = event.clientX; }}
      onPointerUp={release}
      onPointerCancel={() => { pressedAt.current = null; }}
    >
      {/* Keyed by the vehicle, so each one arrives with its own drive-in. */}
      <div key={vehicle.id} className={cn("rqg-bay", `is-${status}`, previous && "has-leaving")}>
        <span className="rqg-bay-word" aria-hidden="true"><span>{vehicle.model}</span></span>
        <span className="rqg-bay-beam" aria-hidden="true" />
        <span className="rqg-bay-beam is-two" aria-hidden="true" />
        <span className="rqg-bay-disc" aria-hidden="true" />
        <span className="rqg-bay-ring" aria-hidden="true" />
        <span className="rqg-bay-streaks" aria-hidden="true"><i /><i /><i /></span>
        {previous ? (
          <span className={cn("rqg-bay-car is-out", kindClass(previous.type))} aria-hidden="true">
            <img src={studioImage(previous.type)} alt="" draggable={false} />
          </span>
        ) : null}
        {status === "maintenance" ? (
          <>
            <span className="rqg-bay-lift" aria-hidden="true"><i /><i /></span>
            <span className="rqg-bay-tool" aria-hidden="true"><MaterialSymbol name="build" /></span>
          </>
        ) : null}
        <span className={cn("rqg-bay-car is-in", kindClass(vehicle.type))} aria-hidden="true">
          <img src={studioImage(vehicle.type)} alt="" draggable={false} />
        </span>
        {total > 1 ? <span className="rqg-bay-count" aria-hidden="true">{position} / {total}</span> : null}
        <StatusBadge status={vehicle.status} floating />
        {vehicle.license_plate ? <NumberPlate plate={vehicle.license_plate} size="lg" /> : null}
      </div>
      <div className="rqg-show-body">
        <div className="rqg-show-brand">
          <BrandLogo make={vehicle.make} size="sm" />
          <span className="rqg-show-make">{vehicle.make}</span>
          <span className="rqg-tag">{kind.label}</span>
          {kind.noLongerSold ? <span className="rqg-tag is-old">No longer sold</span> : null}
        </div>
        <h2 className="rqg-show-model">{vehicle.model}</h2>
        <dl className="rqg-spec">
          <div><dt>In garage</dt><dd>{since ?? "—"}</dd></div>
          <div>
            <dt>Helped</dt>
            <dd>
              {history == null ? "—" : history.times > 0 && history.times < 10 ? (
                <>
                  <span className="rqg-roll" aria-hidden="true">
                    <b style={{ transform: `translateY(-${history.times * 18}px)` }}>0<br />1<br />2<br />3<br />4<br />5<br />6<br />7<br />8<br />9</b>
                  </span>
                  <span aria-hidden="true">{history.times === 1 ? "time" : "times"}</span>
                  <span className="sr-only">{history.times} {history.times === 1 ? "time" : "times"}</span>
                </>
              ) : history.times > 0 ? `${history.times} times` : "Not yet"}
            </dd>
          </div>
          <div><dt>Last help</dt><dd>{history == null ? "—" : history.last ?? "None yet"}</dd></div>
        </dl>
        <div className="rqg-hero-actions">
          <button type="button" className="rqg-btn rqg-grow rq-press" onClick={onHelp}>
            <MaterialSymbol name="car_repair" />Get help for this {typeLabel(vehicle.type).toLowerCase()}
          </button>
          <button type="button" className="rqg-more rq-press" aria-label={`More for ${vehicle.model}`} onClick={onMore}>
            <MaterialSymbol name="more_horiz" />
          </button>
        </div>
      </div>
    </article>
  );
}

/** Every saved vehicle in a row; tapping one puts it on show. */
export function VehicleChips({ vehicles, shownId, onShow }: { vehicles: Vehicle[]; shownId: number; onShow: (vehicle: Vehicle) => void }) {
  return (
    <div className="rqg-rail" role="tablist" aria-label="Your vehicles">
      {vehicles.map((vehicle) => {
        const status = normalizeStatus(vehicle.status);
        const on = vehicle.id === shownId;
        return (
          <button
            key={vehicle.id}
            type="button"
            role="tab"
            aria-selected={on}
            className={cn("rqg-chip rq-press", on && "is-on")}
            aria-label={`${shortMake(vehicle.make)} ${vehicle.model}, ${STATUS_LABELS[status]}`}
            onClick={() => onShow(vehicle)}
          >
            {on ? <span className="rqg-chip-tick" aria-hidden="true"><MaterialSymbol name="check" /></span> : null}
            <BrandLogo make={vehicle.make} size="sm" />
            <span className="rqg-chip-text">
              <b>{vehicle.model}</b>
              <span className={cn("rqg-row-status", `st-${status}`)}><span className="rqg-dot" aria-hidden="true" />{STATUS_LABELS[status]}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

const STATUSES: VehicleStatus[] = ["ready", "maintenance", "inactive"];

export function VehicleSheet({
  vehicle, onClose, onHelp, onStatus, onRemove,
}: {
  vehicle: Vehicle | null;
  onClose: () => void;
  onHelp: (vehicle: Vehicle) => void;
  onStatus: (vehicle: Vehicle, status: VehicleStatus) => void;
  onRemove: (vehicle: Vehicle) => void;
}) {
  const status = normalizeStatus(vehicle?.status);
  return (
    <Dialog.Root open={Boolean(vehicle)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="rqg-scrim" />
        <Dialog.Content className="rqg-sheet" aria-describedby={undefined}>
          {vehicle ? (
            <>
              <div className="rqg-grab" aria-hidden="true" />
              <div className="rqg-sheet-head">
                <BrandLogo make={vehicle.make} size="lg" />
                <div className="rqg-sheet-id">
                  <p className="rqg-make">{vehicle.make} · {typeLabel(vehicle.type)}</p>
                  <Dialog.Title className="rqg-sheet-model">{vehicle.model}</Dialog.Title>
                </div>
                <Dialog.Close className="rqg-icon-btn rq-press" aria-label="Close"><MaterialSymbol name="close" /></Dialog.Close>
              </div>
              <div className="rqg-sheet-art">
                <VehiclePhoto vehicle={vehicle} />
                <NumberPlate plate={vehicle.license_plate} />
              </div>
              <button type="button" className="rqg-btn rqg-block rq-press" onClick={() => onHelp(vehicle)}>
                <MaterialSymbol name="car_repair" />Get help for this {typeLabel(vehicle.type).toLowerCase()}
              </button>
              <p className="rqg-label" id="rqg-status-label">Status</p>
              <div className="rqg-seg" role="radiogroup" aria-labelledby="rqg-status-label">
                {STATUSES.map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={status === value}
                    className={cn("rqg-seg-btn", status === value && "is-on")}
                    onClick={() => { if (status !== value) onStatus(vehicle, value); }}
                  >
                    {STATUS_LABELS[value]}
                  </button>
                ))}
              </div>
              <button type="button" className="rqg-danger-link rq-press" onClick={() => onRemove(vehicle)}>
                <MaterialSymbol name="delete" />Remove from garage
              </button>
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function RemoveDialog({
  vehicle, busy, onCancel, onConfirm,
}: { vehicle: Vehicle | null; busy: boolean; onCancel: () => void; onConfirm: (vehicle: Vehicle) => void }) {
  return (
    <AlertDialog.Root open={Boolean(vehicle)} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="rqg-scrim" />
        <AlertDialog.Content className="rqg-dialog">
          <span className="rqg-dialog-ic" aria-hidden="true"><MaterialSymbol name="delete" /></span>
          <AlertDialog.Title className="rqg-dialog-title">
            Remove {vehicle ? `${shortMake(vehicle.make)} ${vehicle.model}` : "this vehicle"}?
          </AlertDialog.Title>
          <AlertDialog.Description className="rqg-dialog-text">
            It won’t show up when you ask for help. You can add it again anytime.
          </AlertDialog.Description>
          <div className="rqg-dialog-actions">
            <AlertDialog.Cancel className="rqg-btn rqg-soft rq-press">Keep it</AlertDialog.Cancel>
            <button type="button" className="rqg-btn rqg-danger rq-press" disabled={busy} onClick={() => vehicle && onConfirm(vehicle)}>
              {busy ? "Removing…" : "Remove"}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

export function EmptyGarage({ onAdd }: { onAdd: () => void }) {
  return (
    <>
      <div className="rqg-head">
        <p className="rqg-kicker">My garage</p>
        <h1 className="rqg-h1">No vehicles <em>yet</em></h1>
        <p className="rqg-sub">Save your car or bike once. When you need help, pick it in one tap instead of typing its details.</p>
      </div>
      <div className="rqg-empty-art" aria-hidden="true">
        <span className="rqg-empty-floor" />
        <img className="rqg-empty-car" src={studioImage("car")} alt="" draggable={false} />
        <img className="rqg-empty-bike" src={studioImage("bike")} alt="" draggable={false} />
      </div>
      <div className="rqg-benefits">
        <p className="rqg-benefit"><span className="rqg-benefit-ic"><MaterialSymbol name="bolt" /></span><span><b>Faster requests</b>Make, model and number plate fill in for you.</span></p>
        <p className="rqg-benefit"><span className="rqg-benefit-ic"><MaterialSymbol name="engineering" /></span><span><b>The right technician</b>They know what they are coming to before they set off.</span></p>
      </div>
      <button type="button" className="rqg-btn rqg-block rq-press rqg-empty-cta" onClick={onAdd}>
        <MaterialSymbol name="add" />Add your first vehicle
      </button>
    </>
  );
}
