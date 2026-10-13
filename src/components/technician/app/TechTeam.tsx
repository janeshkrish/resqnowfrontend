import { useEffect, useState, type FormEvent } from "react";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { TechBack, TechSheet } from "@/components/technician/app/TechUi";
import { techInitials, useVehicleTypeName } from "@/lib/technicianApp";
import { useTechText } from "@/lib/technicianLanguage";
import type { TechTextKey } from "@/lib/technicianText";
import type { FleetVehicle, TeamEmployee, TeamEmployeeInput, TeamEmployeeRole, TeamEmployeeStatus } from "@/types/towingManagement";
import { cn } from "@/lib/utils";

const ROLES: TeamEmployeeRole[] = ["driver", "helper"];
const STATUSES: TeamEmployeeStatus[] = ["active", "offline"];
const UNASSIGNED = "unassigned";

const startingForm = (employee?: TeamEmployee | null) => ({
  name: employee?.name || "",
  phone: employee?.phone || "",
  role: employee?.role || ("driver" as TeamEmployeeRole),
  status: employee?.status || ("active" as TeamEmployeeStatus),
  assigned_vehicle: employee?.assigned_vehicle_id || UNASSIGNED,
});

export type TechTeamProps = {
  employees: TeamEmployee[];
  vehicles: FleetVehicle[];
  isLoading: boolean;
  isMutating: boolean;
  error?: string | null;
  dialogOpen: boolean;
  selectedEmployee?: TeamEmployee | null;
  onBack: () => void;
  onDialogOpenChange: (open: boolean) => void;
  onOpenCreate: () => void;
  onEditEmployee: (employee: TeamEmployee) => void;
  onDeleteEmployee: (employee: TeamEmployee) => Promise<void> | void;
  onRefresh: () => unknown;
  onCreateEmployee: (payload: TeamEmployeeInput) => Promise<void>;
  onUpdateEmployee: (id: string, payload: TeamEmployeeInput) => Promise<void>;
};

/** A towing operator's drivers and helpers: calling one, changing or removing them, and adding another. */
export default function TechTeam({
  employees,
  vehicles,
  isLoading,
  isMutating,
  error,
  dialogOpen,
  selectedEmployee = null,
  onBack,
  onDialogOpenChange,
  onOpenCreate,
  onEditEmployee,
  onDeleteEmployee,
  onRefresh,
  onCreateEmployee,
  onUpdateEmployee,
}: TechTeamProps) {
  const { t } = useTechText();
  const typeName = useVehicleTypeName();
  const [form, setForm] = useState(startingForm(selectedEmployee));
  const working = employees.filter((employee) => employee.status === "active").length;

  useEffect(() => {
    if (dialogOpen) setForm(startingForm(selectedEmployee));
  }, [dialogOpen, selectedEmployee]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload: TeamEmployeeInput = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      role: form.role,
      status: form.status,
      assigned_vehicle: form.assigned_vehicle === UNASSIGNED ? null : form.assigned_vehicle,
    };
    try {
      if (selectedEmployee) await onUpdateEmployee(selectedEmployee.id, payload);
      else await onCreateEmployee(payload);
      onDialogOpenChange(false);
    } catch {
      // The reason has been shown; the sheet stays open to try again.
    }
  };

  return (
    <div id="dashboard-team" data-testid="technician-team">
      <TechBack onClick={onBack} />
      <div className="tp-head">
        <h1 className="tp-h1 tp-pj">{t("team.title")}</h1>
        <button type="button" className="tp-round tp-press" aria-label={t("common.loadAgain")} disabled={isLoading || isMutating} onClick={() => void onRefresh()}>
          <MaterialSymbol name="refresh" />
        </button>
      </div>
      <p className="tp-sub">{t("team.sub", { n: employees.length, m: working })}</p>

      {error ? <p className="tp-error" role="alert">{error}</p> : null}

      <div className="tp-list" style={{ marginTop: 14 }}>
        {isLoading ? (
          <p className="tp-empty">{t("team.loading")}</p>
        ) : employees.length === 0 ? (
          <p className="tp-empty"><b>{t("team.noneTitle")}</b>{t("team.noneSub")}</p>
        ) : (
          employees.map((employee) => {
            const vehicle = employee.assigned_vehicle?.vehicle_number || employee.assigned_vehicle_label || t("team.noVehicle");
            return (
              <div key={employee.id} className="tp-person" data-testid="team-person">
                <div className="tp-person-top">
                  <span className="tp-face" aria-hidden="true">{techInitials(employee.name)}</span>
                  <span className="tp-text">
                    <b>{employee.name}</b>
                    <span>{t(`team.role.${employee.role}` as TechTextKey)} · {vehicle}</span>
                  </span>
                  <span className={cn("tp-state", employee.status === "active" ? "is-ok" : "is-off")}>
                    {t(`team.status.${employee.status}` as TechTextKey)}
                  </span>
                </div>
                <div className="tp-two">
                  <a className="tp-pill is-call tp-press" href={`tel:${String(employee.phone || "").replace(/\s+/g, "")}`} aria-label={t("team.callName", { name: employee.name })}>
                    <MaterialSymbol name="call" />
                    {t("common.call")}
                  </a>
                  <button type="button" className="tp-pill is-soft tp-press" disabled={isMutating} onClick={() => onEditEmployee(employee)}>
                    {t("common.change")}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <button type="button" className="tp-big is-ink tp-press" style={{ marginTop: 14 }} onClick={onOpenCreate}>
        <MaterialSymbol name="add" />
        {t("team.add")}
      </button>

      <TechSheet open={dialogOpen} onClose={() => onDialogOpenChange(false)} title={t(selectedEmployee ? "team.editTitle" : "team.addTitle")}>
        <form onSubmit={submit}>
          <label className="tp-field">
            <small>{t("team.name")}</small>
            <span className="tp-input">
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                maxLength={255}
                autoComplete="name"
                required
              />
            </span>
          </label>
          <label className="tp-field">
            <small>{t("team.phone")}</small>
            <span className="tp-input">
              <MaterialSymbol name="call" />
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                placeholder="+91 98765 00011"
                maxLength={50}
                required
              />
            </span>
          </label>
          <fieldset className="tp-field">
            <legend>{t("team.job")}</legend>
            <div className="tp-chips" role="radiogroup" aria-label={t("team.job")}>
              {ROLES.map((role) => (
                <button
                  key={role}
                  type="button"
                  role="radio"
                  aria-checked={form.role === role}
                  className={cn("tp-chip tp-press", form.role === role && "is-on")}
                  onClick={() => setForm((current) => ({ ...current, role }))}
                >
                  {t(`team.role.${role}` as TechTextKey)}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="tp-field">
            <small>{t("team.vehicle")}</small>
            <span className="tp-input">
              <select value={form.assigned_vehicle} onChange={(event) => setForm((current) => ({ ...current, assigned_vehicle: event.target.value }))}>
                <option value={UNASSIGNED}>{t("team.unassigned")}</option>
                {vehicles.map((vehicle) => (
                  <option key={vehicle.id} value={vehicle.id}>
                    {vehicle.vehicle_number} · {typeName(vehicle.vehicle_type)}
                  </option>
                ))}
              </select>
              <MaterialSymbol name="expand_more" />
            </span>
          </label>
          <fieldset className="tp-field">
            <legend>{t("team.statusLabel")}</legend>
            <div className="tp-chips" role="radiogroup" aria-label={t("team.statusLabel")}>
              {STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  role="radio"
                  aria-checked={form.status === status}
                  className={cn("tp-chip tp-press", form.status === status && "is-on")}
                  onClick={() => setForm((current) => ({ ...current, status }))}
                >
                  {t(`team.status.${status}` as TechTextKey)}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="tp-big tp-press" style={{ marginTop: 18 }} disabled={isMutating}>
            {isMutating ? t("common.saving") : t("common.save")}
          </button>
          {selectedEmployee ? (
            <button type="button" className="tp-remove" disabled={isMutating} onClick={() => void onDeleteEmployee(selectedEmployee)}>
              <MaterialSymbol name="delete" />
              {t("team.remove")}
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
