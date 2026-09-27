import { useState } from "react";
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
import { studioImage, useVehiclePhoto } from "@/lib/vehiclePhoto";
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

/** A real photo of the model when there is one, otherwise the plain car or bike picture. */
export function VehiclePhoto({ vehicle, className }: { vehicle: Pick<Vehicle, "make" | "model" | "type">; className?: string }) {
  const { data: photo, isPending } = useVehiclePhoto(vehicle.make, vehicle.model);
  const [broken, setBroken] = useState(false);
  if (photo && !broken) {
    return (
      <span className={cn("rqg-photo is-photo", className)}>
        <img src={photo.url} alt={`${shortMake(vehicle.make)} ${vehicle.model}`} loading="lazy" draggable={false} onError={() => setBroken(true)} />
      </span>
    );
  }
  return (
    <span className={cn("rqg-photo is-studio", isPending && !broken && "is-loading", className)} aria-hidden="true">
      {isPending && !broken ? null : <img src={studioImage(vehicle.type)} alt="" draggable={false} />}
    </span>
  );
}

/** The photo's credit, which its licence requires wherever it is shown large. */
export function PhotoCredit({ vehicle }: { vehicle: Pick<Vehicle, "make" | "model"> }) {
  const { data: photo } = useVehiclePhoto(vehicle.make, vehicle.model);
  if (!photo) return null;
  return (
    <p className="rqg-credit">
      Photo: {photo.credit.author} · {photo.credit.license} ·{" "}
      <a href={photo.credit.source} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>
    </p>
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

export function HeroCard({ vehicle, onHelp, onMore }: { vehicle: Vehicle; onHelp: () => void; onMore: () => void }) {
  return (
    <article className="rqg-hero" aria-label={`${shortMake(vehicle.make)} ${vehicle.model}`}>
      <VehiclePhoto vehicle={vehicle} className="rqg-hero-photo" />
      <StatusBadge status={vehicle.status} floating />
      <div className="rqg-hero-body">
        <div className="rqg-brand">
          <BrandLogo make={vehicle.make} />
          <div>
            <p className="rqg-make">{vehicle.make}</p>
            <p className="rqg-type">{typeLabel(vehicle.type)} · most recent</p>
          </div>
        </div>
        <div className="rqg-hero-line">
          <h2 className="rqg-model">{vehicle.model}</h2>
          <NumberPlate plate={vehicle.license_plate} />
        </div>
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

export function VehicleRow({ vehicle, onOpen }: { vehicle: Vehicle; onOpen: () => void }) {
  const status = normalizeStatus(vehicle.status);
  return (
    <button type="button" className="rqg-row rq-press" onClick={onOpen} aria-label={`${shortMake(vehicle.make)} ${vehicle.model}, ${STATUS_LABELS[status]}`}>
      <span className="rqg-thumb" aria-hidden="true"><VehiclePhoto vehicle={vehicle} /></span>
      <span className="rqg-row-mid">
        <span className="rqg-row-top"><BrandLogo make={vehicle.make} size="sm" /><b>{shortMake(vehicle.make)} {vehicle.model}</b></span>
        <span className="rqg-row-meta">
          <NumberPlate plate={vehicle.license_plate} size="sm" />
          <span className={cn("rqg-row-status", `st-${status}`)}><span className="rqg-dot" aria-hidden="true" />{STATUS_LABELS[status]}</span>
        </span>
      </span>
      <MaterialSymbol name="chevron_right" className="rqg-chev" />
    </button>
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
              <PhotoCredit vehicle={vehicle} />
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
