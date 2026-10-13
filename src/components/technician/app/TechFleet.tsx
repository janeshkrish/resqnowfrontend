import { useEffect, useState, type FormEvent } from "react";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { TechBack, TechSheet } from "@/components/technician/app/TechUi";
import { serviceArt } from "@/lib/services";
import { TOW_VEHICLE_TYPES as VEHICLE_TYPES, useVehicleTypeName } from "@/lib/technicianApp";
import { useTechText } from "@/lib/technicianLanguage";
import type { TechTextKey } from "@/lib/technicianText";
import type { FleetVehicle, FleetVehicleInput, FleetVehicleStatus } from "@/types/towingManagement";
import { cn } from "@/lib/utils";

const VEHICLE_STATUSES: FleetVehicleStatus[] = ["available", "busy", "offline"];

const STATUS_LOOK: Record<FleetVehicleStatus, { icon: string; tone: string }> = {
  available: { icon: "check_circle", tone: "is-ok" },
  busy: { icon: "build", tone: "is-wait" },
  offline: { icon: "block", tone: "is-off" },
};

const startingForm = (vehicle?: FleetVehicle | null) => ({
  vehicle_type: vehicle?.vehicle_type || "flatbed",
  vehicle_number: vehicle?.vehicle_number || "",
  capacity: vehicle?.capacity || "",
  status: vehicle?.status || ("available" as FleetVehicleStatus),
});

export type TechFleetProps = {
  vehicles: FleetVehicle[];
  isLoading: boolean;
  isMutating: boolean;
  error?: string | null;
  dialogOpen: boolean;
  selectedVehicle?: FleetVehicle | null;
  onBack: () => void;
  onDialogOpenChange: (open: boolean) => void;
  onOpenCreate: () => void;
  onEditVehicle: (vehicle: FleetVehicle) => void;
  onDeleteVehicle: (vehicle: FleetVehicle) => Promise<void> | void;
  onRefresh: () => unknown;
  onCreateVehicle: (payload: FleetVehicleInput) => Promise<void>;
  onUpdateVehicle: (id: string, payload: FleetVehicleInput) => Promise<void>;
};

/** A towing operator's vehicles: each one, changing or removing it, and adding another. */
export default function TechFleet({
  vehicles,
  isLoading,
  isMutating,
  error,
  dialogOpen,
  selectedVehicle = null,
  onBack,
  onDialogOpenChange,
  onOpenCreate,
  onEditVehicle,
  onDeleteVehicle,
  onRefresh,
  onCreateVehicle,
  onUpdateVehicle,
}: TechFleetProps) {
  const { t } = useTechText();
  const typeName = useVehicleTypeName();
  const [form, setForm] = useState(startingForm(selectedVehicle));
  const art = serviceArt("towing");
  const free = vehicles.filter((vehicle) => vehicle.status === "available").length;

  useEffect(() => {
    if (dialogOpen) setForm(startingForm(selectedVehicle));
  }, [dialogOpen, selectedVehicle]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: FleetVehicleInput = {
      vehicle_type: form.vehicle_type,
      vehicle_number: form.vehicle_number.trim().toUpperCase(),
      capacity: form.capacity.trim() || null,
      status: form.status,
    };
    try {
      if (selectedVehicle) await onUpdateVehicle(selectedVehicle.id, payload);
      else await onCreateVehicle(payload);
      onDialogOpenChange(false);
    } catch {
      // The reason has been shown; the sheet stays open to try again.
    }
  };

  // A kind saved before the list existed stays choosable while that vehicle is being changed.
  const kinds = (VEHICLE_TYPES as readonly string[]).includes(form.vehicle_type) ? [...VEHICLE_TYPES] : [...VEHICLE_TYPES, form.vehicle_type];

  return (
    <div id="dashboard-fleet" data-testid="technician-fleet">
      <TechBack onClick={onBack} />
      <div className="tp-head">
        <h1 className="tp-h1 tp-pj">{t("fleet.title")}</h1>
        <button type="button" className="tp-round tp-press" aria-label={t("common.loadAgain")} disabled={isLoading || isMutating} onClick={() => void onRefresh()}>
          <MaterialSymbol name="refresh" />
        </button>
      </div>
      <p className="tp-sub">{t("fleet.sub", { n: vehicles.length, m: free })}</p>

      {error ? <p className="tp-error" role="alert">{error}</p> : null}

      <div className="tp-list" style={{ marginTop: 14 }}>
        {isLoading ? (
          <p className="tp-empty">{t("fleet.loading")}</p>
        ) : vehicles.length === 0 ? (
          <p className="tp-empty"><b>{t("fleet.noneTitle")}</b>{t("fleet.noneSub")}</p>
        ) : (
          vehicles.map((vehicle) => {
            const look = STATUS_LOOK[vehicle.status] ?? STATUS_LOOK.offline;
            const more = [vehicle.vehicle_id ? `#${vehicle.vehicle_id}` : "", vehicle.capacity || ""].filter(Boolean).join(" · ");
            return (
              <div key={vehicle.id} className="tp-row" style={{ minHeight: 104 }} data-testid="fleet-vehicle">
                <span className="tp-veh-art" aria-hidden="true">
                  {art ? <img src={art} alt="" draggable={false} /> : <MaterialSymbol name="auto_towing" />}
                </span>
                <span className="tp-text">
                  <b>{typeName(vehicle.vehicle_type)}</b>
                  <span className="tp-plate">{vehicle.vehicle_number}</span>
                  {more ? <span style={{ marginTop: 4 }}>{more}</span> : null}
                </span>
                <span className="tp-side">
                  <span className={cn("tp-state", look.tone)}>
                    <MaterialSymbol name={look.icon} />
                    {t(`fleet.status.${vehicle.status}` as TechTextKey)}
                  </span>
                  <button type="button" className="tp-pill is-soft tp-press" disabled={isMutating} onClick={() => onEditVehicle(vehicle)}>
                    {t("common.change")}
                  </button>
                </span>
              </div>
            );
          })
        )}
      </div>

      <button type="button" className="tp-big is-ink tp-press" style={{ marginTop: 14 }} onClick={onOpenCreate}>
        <MaterialSymbol name="add" />
        {t("fleet.add")}
      </button>

      <TechSheet open={dialogOpen} onClose={() => onDialogOpenChange(false)} title={t(selectedVehicle ? "fleet.editTitle" : "fleet.addTitle")}>
        <form onSubmit={submit}>
          <fieldset className="tp-field">
            <legend>{t("fleet.kind")}</legend>
            <div className="tp-chips" role="radiogroup" aria-label={t("fleet.kind")}>
              {kinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  role="radio"
                  aria-checked={form.vehicle_type === kind}
                  className={cn("tp-chip tp-press", form.vehicle_type === kind && "is-on")}
                  onClick={() => setForm((current) => ({ ...current, vehicle_type: kind }))}
                >
                  {typeName(kind)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="tp-field">
            <small>{t("fleet.plate")}</small>
            <span className="tp-input">
              <input
                value={form.vehicle_number}
                onChange={(event) => setForm((current) => ({ ...current, vehicle_number: event.target.value }))}
                placeholder="TN 37 TR 1001"
                maxLength={64}
                autoCapitalize="characters"
                required
              />
            </span>
          </label>
          <label className="tp-field">
            <small>{t("fleet.carries")}</small>
            <span className="tp-input">
              <input
                value={form.capacity}
                onChange={(event) => setForm((current) => ({ ...current, capacity: event.target.value }))}
                placeholder={t("fleet.carriesPlaceholder")}
                maxLength={64}
              />
            </span>
          </label>
          <fieldset className="tp-field">
            <legend>{t("fleet.statusLabel")}</legend>
            <div className="tp-chips" role="radiogroup" aria-label={t("fleet.statusLabel")}>
              {VEHICLE_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  role="radio"
                  aria-checked={form.status === status}
                  className={cn("tp-chip tp-press", form.status === status && "is-on")}
                  onClick={() => setForm((current) => ({ ...current, status }))}
                >
                  {t(`fleet.status.${status}` as TechTextKey)}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="tp-big tp-press" style={{ marginTop: 18 }} disabled={isMutating}>
            {isMutating ? t("common.saving") : t("fleet.save")}
          </button>
          {selectedVehicle ? (
            <button type="button" className="tp-remove" disabled={isMutating} onClick={() => void onDeleteVehicle(selectedVehicle)}>
              <MaterialSymbol name="delete" />
              {t("fleet.remove")}
            </button>
          ) : (
            <button type="button" className="tp-remove" disabled={isMutating} onClick={() => onDialogOpenChange(false)}>
              {t("common.cancel")}
            </button>
          )}
        </form>
      </TechSheet>
    </div>
  );
}
