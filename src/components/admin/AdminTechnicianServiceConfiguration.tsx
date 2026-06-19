import {
  ADMIN_DEFAULT_STANDARD_FIELDS,
  ADMIN_FLAT_TIRE_BASE_FIELDS,
  ADMIN_FLAT_TIRE_PUNCTURE_FIELDS,
  ADMIN_FLAT_TIRE_SUBCATEGORIES,
  ADMIN_SERVICE_LABELS,
  ADMIN_STANDARD_SERVICE_FIELDS,
  ADMIN_TOWING_FLEET_TYPES,
  ADMIN_TOWING_PRICE_FIELDS,
  ADMIN_VEHICLE_TYPES,
} from "@/config/adminTechnicianServicePricingCatalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  AdminServicePricingEntry,
  isSupportedAdminVehicleType,
  parseAdminServiceTokens,
  updateAdminServiceVehicleCategories,
} from "@/utils/adminTechnicianServiceConfiguration";
import { Edit3, Loader2, Save } from "lucide-react";

type AdminTechnicianServiceConfigurationProps = {
  servicesText: string;
  entries: AdminServicePricingEntry[];
  editing: boolean;
  saving: boolean;
  onServicesTextChange: (value: string) => void;
  onEntriesChange: (entries: AdminServicePricingEntry[]) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
};

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const formatLabel = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const serviceLabel = (value: string) =>
  ADMIN_SERVICE_LABELS[value] || formatLabel(value);

const getVehiclePricingMapKey = (serviceDomain: string) => {
  if (serviceDomain === "towing") return "towing_vehicle_pricing";
  if (serviceDomain === "flat-tire") return "flat_tire_vehicle_pricing";
  return "vehicle_pricing";
};

const valueForInput = (value: unknown) =>
  value == null ? "" : typeof value === "string" || typeof value === "number" ? value : "";

const unique = (values: string[]) => Array.from(new Set(values.filter(Boolean)));

type PriceInputProps = {
  label: string;
  value: unknown;
  disabled: boolean;
  onChange: (value: string) => void;
  className?: string;
};

const PriceInput = ({
  label,
  value,
  disabled,
  onChange,
  className,
}: PriceInputProps) => (
  <div className={className}>
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input
      type="number"
      min="0"
      value={valueForInput(value)}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      className="mt-1"
    />
  </div>
);

export default function AdminTechnicianServiceConfiguration({
  servicesText,
  entries,
  editing,
  saving,
  onServicesTextChange,
  onEntriesChange,
  onEdit,
  onCancel,
  onSave,
}: AdminTechnicianServiceConfigurationProps) {
  const parsedServices = parseAdminServiceTokens(servicesText);

  const updateEntry = (
    entryIndex: number,
    updater: (entry: AdminServicePricingEntry) => AdminServicePricingEntry
  ) => {
    onEntriesChange(
      entries.map((entry, index) =>
        index === entryIndex ? updater(clone(entry)) : entry
      )
    );
  };

  const updateVehiclePricing = (
    entryIndex: number,
    vehicleType: string,
    field: string,
    value: string
  ) => {
    updateEntry(entryIndex, (entry) => {
      const mapKey = getVehiclePricingMapKey(entry.service_domain);
      const pricingMap = { ...(entry[mapKey] || {}) };
      pricingMap[vehicleType] = {
        ...(pricingMap[vehicleType] || {}),
        [field]: value,
      };
      return { ...entry, [mapKey]: pricingMap };
    });
  };

  const updateTowingFleetPricing = (
    entryIndex: number,
    vehicleType: string,
    fleetType: string,
    field: string,
    value: string
  ) => {
    updateEntry(entryIndex, (entry) => {
      const pricingMap = { ...(entry.towing_vehicle_pricing || {}) };
      const vehiclePricing = { ...(pricingMap[vehicleType] || {}) };
      const fleetPricing = { ...(vehiclePricing.fleet_pricing || {}) };
      fleetPricing[fleetType] = {
        ...(fleetPricing[fleetType] || {}),
        [field]: value,
      };
      vehiclePricing.fleet_pricing = fleetPricing;
      pricingMap[vehicleType] = vehiclePricing;
      return { ...entry, towing_vehicle_pricing: pricingMap };
    });
  };

  const updateFlatTireSubcategory = (
    entryIndex: number,
    vehicleType: string,
    subcategoryId: string,
    field: string,
    value: string
  ) => {
    updateEntry(entryIndex, (entry) => {
      const pricingMap = { ...(entry.flat_tire_vehicle_pricing || {}) };
      const vehiclePricing = { ...(pricingMap[vehicleType] || {}) };
      const subcategories = { ...(vehiclePricing.subcategories || {}) };
      subcategories[subcategoryId] = {
        ...(subcategories[subcategoryId] || { label: formatLabel(subcategoryId) }),
        [field]: value,
      };
      vehiclePricing.subcategories = subcategories;
      pricingMap[vehicleType] = vehiclePricing;
      return { ...entry, flat_tire_vehicle_pricing: pricingMap };
    });
  };

  const toggleVehicleType = (
    entryIndex: number,
    vehicleType: string,
    checked: boolean
  ) => {
    updateEntry(entryIndex, (entry) => {
      const nextVehicles = checked
        ? unique([...entry.vehicle_categories, vehicleType])
        : entry.vehicle_categories.filter((value) => value !== vehicleType);
      return updateAdminServiceVehicleCategories(entry, nextVehicles);
    });
  };

  const toggleTowingFleetType = (
    entryIndex: number,
    fleetType: string,
    checked: boolean
  ) => {
    updateEntry(entryIndex, (entry) => ({
      ...entry,
      towing_fleet_types: checked
        ? unique([...(entry.towing_fleet_types || []), fleetType])
        : (entry.towing_fleet_types || []).filter((value) => value !== fleetType),
    }));
  };

  const toggleFlatTireSubcategory = (
    entryIndex: number,
    vehicleType: string,
    subcategoryId: string,
    label: string,
    checked: boolean
  ) => {
    updateEntry(entryIndex, (entry) => {
      const pricingMap = { ...(entry.flat_tire_vehicle_pricing || {}) };
      const vehiclePricing = { ...(pricingMap[vehicleType] || {}) };
      const selected = new Set<string>(vehiclePricing.selected_subcategories || []);
      if (checked) selected.add(subcategoryId);
      else selected.delete(subcategoryId);

      vehiclePricing.selected_subcategories = Array.from(selected);
      vehiclePricing.subcategories = {
        ...(vehiclePricing.subcategories || {}),
        [subcategoryId]: {
          label,
          ...(vehiclePricing.subcategories?.[subcategoryId] || {}),
        },
      };
      pricingMap[vehicleType] = vehiclePricing;
      return { ...entry, flat_tire_vehicle_pricing: pricingMap };
    });
  };

  const renderVehicleSelector = (
    entry: AdminServicePricingEntry,
    entryIndex: number
  ) => (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Vehicle Categories</p>
      <div className="flex flex-wrap gap-3">
        {ADMIN_VEHICLE_TYPES.map((vehicleType) => (
          <Label
            key={vehicleType.id}
            className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <Checkbox
              checked={entry.vehicle_categories.includes(vehicleType.id)}
              onCheckedChange={(checked) =>
                toggleVehicleType(entryIndex, vehicleType.id, checked === true)
              }
              disabled={!editing || saving}
            />
            {vehicleType.label}
          </Label>
        ))}
      </div>
    </div>
  );

  const renderTowingPricing = (
    entry: AdminServicePricingEntry,
    entryIndex: number
  ) => {
    const selectedFleetTypes = entry.towing_fleet_types || [];

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Towing Fleet Types</p>
          <div className="flex flex-wrap gap-3">
            {ADMIN_TOWING_FLEET_TYPES.map((fleetType) => (
              <Label
                key={fleetType.id}
                className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
              >
                <Checkbox
                  checked={selectedFleetTypes.includes(fleetType.id)}
                  onCheckedChange={(checked) =>
                    toggleTowingFleetType(entryIndex, fleetType.id, checked === true)
                  }
                  disabled={!editing || saving}
                />
                {fleetType.label}
              </Label>
            ))}
          </div>
        </div>

        {selectedFleetTypes.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            Select at least one fleet type to enter towing pricing.
          </div>
        ) : null}

        {entry.vehicle_categories.map((vehicleType) => {
          const vehiclePricing = entry.towing_vehicle_pricing?.[vehicleType] || {};
          return (
            <div key={vehicleType} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-medium">{formatLabel(vehicleType)}</p>
                <Badge variant="outline">Towing</Badge>
              </div>
              <div className="space-y-4">
                {selectedFleetTypes.map((fleetType) => {
                  const fleetPricing = vehiclePricing.fleet_pricing?.[fleetType] || {};
                  return (
                    <div key={fleetType} className="rounded-md bg-muted/40 p-3">
                      <p className="mb-3 text-sm font-medium">{formatLabel(fleetType)}</p>
                      <div className="grid gap-3 md:grid-cols-3">
                        {ADMIN_TOWING_PRICE_FIELDS.map((field) => (
                          <PriceInput
                            key={field.id}
                            label={field.label}
                            value={fleetPricing[field.id]}
                            disabled={!editing || saving}
                            onChange={(value) =>
                              updateTowingFleetPricing(
                                entryIndex,
                                vehicleType,
                                fleetType,
                                field.id,
                                value
                              )
                            }
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderFlatTirePricing = (
    entry: AdminServicePricingEntry,
    entryIndex: number
  ) => (
    <div className="space-y-4">
      <div className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
        Customer estimate uses visit charge + selected puncture price for the requested vehicle.
      </div>
      {entry.vehicle_categories.map((vehicleType) => {
        if (!isSupportedAdminVehicleType(vehicleType)) return null;
        const vehiclePricing =
          entry.flat_tire_vehicle_pricing?.[vehicleType] || {};
        const selectedSubcategories = new Set<string>(
          vehiclePricing.selected_subcategories || []
        );
        const configuredOptions = Object.entries(
          vehiclePricing.subcategories || {}
        ).map(([id, value]) => ({
          id,
          label: String((value as Record<string, unknown>)?.label || formatLabel(id)),
        }));
        const options = [
          ...ADMIN_FLAT_TIRE_SUBCATEGORIES[vehicleType],
          ...configuredOptions.filter(
            (option) =>
              !ADMIN_FLAT_TIRE_SUBCATEGORIES[vehicleType].some(
                (catalogOption) => catalogOption.id === option.id
              )
          ),
        ];

        return (
          <div key={vehicleType} className="rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="font-medium">{formatLabel(vehicleType)}</p>
              <Badge variant="outline">Flat Tire</Badge>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {ADMIN_FLAT_TIRE_BASE_FIELDS.map((field) => (
                <PriceInput
                  key={field.id}
                  label={field.label}
                  value={vehiclePricing[field.id]}
                  disabled={!editing || saving}
                  onChange={(value) =>
                    updateVehiclePricing(entryIndex, vehicleType, field.id, value)
                  }
                />
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Puncture Subcategories
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {options.map((subcategory) => {
                  const selected = selectedSubcategories.has(subcategory.id);
                  const subcategoryPricing =
                    vehiclePricing.subcategories?.[subcategory.id] || {};
                  return (
                    <div
                      key={subcategory.id}
                      className={cn(
                        "rounded-md border p-3",
                        selected ? "bg-muted/40" : "bg-background"
                      )}
                    >
                      <Label className="flex items-center gap-2 text-sm">
                        <Checkbox
                          checked={selected}
                          onCheckedChange={(checked) =>
                            toggleFlatTireSubcategory(
                              entryIndex,
                              vehicleType,
                              subcategory.id,
                              subcategory.label,
                              checked === true
                            )
                          }
                          disabled={!editing || saving}
                        />
                        {subcategory.label}
                      </Label>
                      {selected ? (
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          {ADMIN_FLAT_TIRE_PUNCTURE_FIELDS.map((field) => (
                            <PriceInput
                              key={field.id}
                              label={field.label}
                              value={subcategoryPricing[field.id]}
                              disabled={!editing || saving}
                              onChange={(value) =>
                                updateFlatTireSubcategory(
                                  entryIndex,
                                  vehicleType,
                                  subcategory.id,
                                  field.id,
                                  value
                                )
                              }
                            />
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderStandardPricing = (
    entry: AdminServicePricingEntry,
    entryIndex: number
  ) => {
    const fields =
      ADMIN_STANDARD_SERVICE_FIELDS[entry.service_domain] ||
      ADMIN_DEFAULT_STANDARD_FIELDS;

    return (
      <div className="space-y-4">
        {entry.vehicle_categories.map((vehicleType) => {
          const vehiclePricing = entry.vehicle_pricing?.[vehicleType] || {};
          return (
            <div key={vehicleType} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-medium">{formatLabel(vehicleType)}</p>
                <Badge variant="outline">{serviceLabel(entry.service_domain)}</Badge>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                {fields.map((field) => (
                  <PriceInput
                    key={field.id}
                    label={field.label}
                    value={vehiclePricing[field.id]}
                    disabled={!editing || saving}
                    onChange={(value) =>
                      updateVehiclePricing(entryIndex, vehicleType, field.id, value)
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderEntryPricing = (
    entry: AdminServicePricingEntry,
    entryIndex: number
  ) => {
    if (entry.vehicle_categories.length === 0) {
      return (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Select one or more vehicle categories to enter this service pricing.
        </div>
      );
    }

    if (entry.service_domain === "towing") {
      return renderTowingPricing(entry, entryIndex);
    }
    if (entry.service_domain === "flat-tire") {
      return renderFlatTirePricing(entry, entryIndex);
    }
    return renderStandardPricing(entry, entryIndex);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Service Configuration</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Add services in the comma-separated field. Pricing cards appear for each service.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!editing ? (
              <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                <Edit3 className="mr-2 h-4 w-4" data-icon />
                Edit Pricing
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onCancel}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={onSave} disabled={saving}>
                  {saving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" data-icon />
                  ) : (
                    <Save className="mr-2 h-4 w-4" data-icon />
                  )}
                  Save Pricing
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <Label className="text-sm text-muted-foreground">
            Services (comma separated)
          </Label>
          <Input
            className="mt-1"
            value={servicesText}
            onChange={(event) => onServicesTextChange(event.target.value)}
            placeholder="flat-tire, battery, fuel"
            disabled={!editing || saving}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {parsedServices.length > 0 ? (
            parsedServices.map((service) => (
              <Badge key={service} variant="secondary">
                {serviceLabel(service)}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">
              No service selected.
            </span>
          )}
        </div>

        {entries.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No service pricing configured. Enter a service and save pricing to configure it.
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map((entry, entryIndex) => (
              <div
                key={`${entry.service_domain}-${entryIndex}`}
                className="rounded-xl border p-4"
              >
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-base font-semibold">
                      {serviceLabel(entry.service_domain)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {entry.service_domain === "flat-tire"
                        ? "Puncture pricing is stored per vehicle and subcategory."
                        : entry.service_domain === "towing"
                          ? "Towing pricing is stored per vehicle and fleet type."
                          : "Pricing is stored per vehicle category."}
                    </p>
                  </div>
                  <Badge variant="outline">{entry.service_domain}</Badge>
                </div>

                <div className="space-y-4">
                  {renderVehicleSelector(entry, entryIndex)}
                  {renderEntryPricing(entry, entryIndex)}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
