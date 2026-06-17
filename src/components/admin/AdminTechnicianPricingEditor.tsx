import React from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bus, Car, Bike, Zap, Truck, Wrench } from "lucide-react";

export interface AdminTechnicianPricingEditorProps {
  serviceCosts: any[];
  onChange: (serviceCosts: any[]) => void;
}

const VEHICLE_ICONS: Record<string, any> = {
  bike: Bike,
  car: Car,
  commercial: Bus,
  ev: Zap,
};

const formatLabel = (value: string) =>
  String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function AdminTechnicianPricingEditor({
  serviceCosts,
  onChange,
}: AdminTechnicianPricingEditorProps) {
  
  const updateServiceCost = (index: number, newConfig: any) => {
    const next = [...(serviceCosts || [])];
    next[index] = newConfig;
    onChange(next);
  };

  if (!serviceCosts || !serviceCosts.length) {
    return (
      <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
        No structured pricing configuration found for this technician.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {serviceCosts.map((config, index) => {
        const domain = config.service_domain || config.service_name;
        if (!domain) return null;

        const categories = config.vehicle_categories || [];

        return (
          <Card key={`${domain}-${index}`} className="border-border shadow-sm">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Wrench className="h-5 w-5 text-primary" />
                  {formatLabel(domain)} Pricing
                </CardTitle>
                <div className="flex gap-2">
                  {categories.map((cat: string) => (
                    <Badge key={cat} variant="outline" className="capitalize">
                      {cat}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {categories.length === 0 && (
                <p className="text-sm text-muted-foreground">No vehicle categories selected.</p>
              )}

              {categories.map((vType: string) => {
                const Icon = VEHICLE_ICONS[vType] || Car;

                return (
                  <div key={vType} className="rounded-xl border p-4 space-y-4 bg-card">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <div className="rounded-full bg-primary/10 p-2 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <h4 className="font-semibold text-foreground capitalize">{vType}</h4>
                    </div>

                    {/* TOWING PRICING */}
                    {domain === "towing" && (
                      <div className="space-y-4">
                        {(config.towing_fleet_types || []).map((fleetType: string) => {
                          const valPath = config.towing_vehicle_pricing?.[vType]?.fleet_pricing?.[fleetType] || {};
                          return (
                            <div key={fleetType} className="rounded-lg bg-muted/20 p-3 border border-border/50">
                              <div className="mb-3 flex items-center gap-2">
                                <Truck className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium text-sm">{formatLabel(fleetType)}</span>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground">Base Charge</Label>
                                  <Input 
                                    type="number" 
                                    value={valPath.base_charge ?? ""}
                                    onChange={(e) => {
                                      const next = JSON.parse(JSON.stringify(config));
                                      if (!next.towing_vehicle_pricing) next.towing_vehicle_pricing = {};
                                      if (!next.towing_vehicle_pricing[vType]) next.towing_vehicle_pricing[vType] = { fleet_pricing: {} };
                                      if (!next.towing_vehicle_pricing[vType].fleet_pricing) next.towing_vehicle_pricing[vType].fleet_pricing = {};
                                      if (!next.towing_vehicle_pricing[vType].fleet_pricing[fleetType]) next.towing_vehicle_pricing[vType].fleet_pricing[fleetType] = {};
                                      next.towing_vehicle_pricing[vType].fleet_pricing[fleetType].base_charge = e.target.value === "" ? null : Number(e.target.value);
                                      updateServiceCost(index, next);
                                    }}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground">Free Distance (km)</Label>
                                  <Input 
                                    type="number" 
                                    value={valPath.free_distance ?? ""}
                                    onChange={(e) => {
                                      const next = JSON.parse(JSON.stringify(config));
                                      if (!next.towing_vehicle_pricing) next.towing_vehicle_pricing = {};
                                      if (!next.towing_vehicle_pricing[vType]) next.towing_vehicle_pricing[vType] = { fleet_pricing: {} };
                                      if (!next.towing_vehicle_pricing[vType].fleet_pricing) next.towing_vehicle_pricing[vType].fleet_pricing = {};
                                      if (!next.towing_vehicle_pricing[vType].fleet_pricing[fleetType]) next.towing_vehicle_pricing[vType].fleet_pricing[fleetType] = {};
                                      next.towing_vehicle_pricing[vType].fleet_pricing[fleetType].free_distance = e.target.value === "" ? null : Number(e.target.value);
                                      updateServiceCost(index, next);
                                    }}
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-xs text-muted-foreground">Cost per KM</Label>
                                  <Input 
                                    type="number" 
                                    value={valPath.extra_km_charge ?? ""}
                                    onChange={(e) => {
                                      const next = JSON.parse(JSON.stringify(config));
                                      if (!next.towing_vehicle_pricing) next.towing_vehicle_pricing = {};
                                      if (!next.towing_vehicle_pricing[vType]) next.towing_vehicle_pricing[vType] = { fleet_pricing: {} };
                                      if (!next.towing_vehicle_pricing[vType].fleet_pricing) next.towing_vehicle_pricing[vType].fleet_pricing = {};
                                      if (!next.towing_vehicle_pricing[vType].fleet_pricing[fleetType]) next.towing_vehicle_pricing[vType].fleet_pricing[fleetType] = {};
                                      next.towing_vehicle_pricing[vType].fleet_pricing[fleetType].extra_km_charge = e.target.value === "" ? null : Number(e.target.value);
                                      updateServiceCost(index, next);
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* FLAT TIRE PRICING */}
                    {domain === "flat-tire" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Visit Charge</Label>
                            <Input 
                              type="number" 
                              value={config.flat_tire_vehicle_pricing?.[vType]?.visit_charge ?? ""}
                              onChange={(e) => {
                                const next = JSON.parse(JSON.stringify(config));
                                if (!next.flat_tire_vehicle_pricing) next.flat_tire_vehicle_pricing = {};
                                if (!next.flat_tire_vehicle_pricing[vType]) next.flat_tire_vehicle_pricing[vType] = {};
                                next.flat_tire_vehicle_pricing[vType].visit_charge = e.target.value === "" ? null : Number(e.target.value);
                                updateServiceCost(index, next);
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Free Distance (km)</Label>
                            <Input 
                              type="number" 
                              value={config.flat_tire_vehicle_pricing?.[vType]?.free_distance ?? ""}
                              onChange={(e) => {
                                const next = JSON.parse(JSON.stringify(config));
                                if (!next.flat_tire_vehicle_pricing) next.flat_tire_vehicle_pricing = {};
                                if (!next.flat_tire_vehicle_pricing[vType]) next.flat_tire_vehicle_pricing[vType] = {};
                                next.flat_tire_vehicle_pricing[vType].free_distance = e.target.value === "" ? null : Number(e.target.value);
                                updateServiceCost(index, next);
                              }}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Cost per KM</Label>
                            <Input 
                              type="number" 
                              value={config.flat_tire_vehicle_pricing?.[vType]?.extra_km_charge ?? ""}
                              onChange={(e) => {
                                const next = JSON.parse(JSON.stringify(config));
                                if (!next.flat_tire_vehicle_pricing) next.flat_tire_vehicle_pricing = {};
                                if (!next.flat_tire_vehicle_pricing[vType]) next.flat_tire_vehicle_pricing[vType] = {};
                                next.flat_tire_vehicle_pricing[vType].extra_km_charge = e.target.value === "" ? null : Number(e.target.value);
                                updateServiceCost(index, next);
                              }}
                            />
                          </div>
                        </div>

                        {config.flat_tire_vehicle_pricing?.[vType]?.selected_subcategories?.length > 0 && (
                          <div className="mt-4 space-y-3">
                            <Label className="text-sm font-semibold">Subcategory Tyre Pricing</Label>
                            {config.flat_tire_vehicle_pricing[vType].selected_subcategories.map((sub: string) => {
                              const p = config.flat_tire_vehicle_pricing[vType].tyre_pricing?.[sub] || {};
                              return (
                                <div key={sub} className="flex flex-col sm:flex-row gap-3 items-end p-3 rounded bg-muted/10 border border-border/50">
                                  <div className="w-full sm:w-1/3">
                                    <span className="text-sm font-medium">{formatLabel(sub)}</span>
                                  </div>
                                  <div className="w-full sm:w-1/3 space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Repair Charge</Label>
                                    <Input 
                                      type="number"
                                      value={p.repair ?? ""}
                                      onChange={(e) => {
                                        const next = JSON.parse(JSON.stringify(config));
                                        if (!next.flat_tire_vehicle_pricing[vType].tyre_pricing) next.flat_tire_vehicle_pricing[vType].tyre_pricing = {};
                                        if (!next.flat_tire_vehicle_pricing[vType].tyre_pricing[sub]) next.flat_tire_vehicle_pricing[vType].tyre_pricing[sub] = {};
                                        next.flat_tire_vehicle_pricing[vType].tyre_pricing[sub].repair = e.target.value === "" ? null : Number(e.target.value);
                                        updateServiceCost(index, next);
                                      }}
                                    />
                                  </div>
                                  <div className="w-full sm:w-1/3 space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Replacement Charge</Label>
                                    <Input 
                                      type="number"
                                      value={p.replacement ?? ""}
                                      onChange={(e) => {
                                        const next = JSON.parse(JSON.stringify(config));
                                        if (!next.flat_tire_vehicle_pricing[vType].tyre_pricing) next.flat_tire_vehicle_pricing[vType].tyre_pricing = {};
                                        if (!next.flat_tire_vehicle_pricing[vType].tyre_pricing[sub]) next.flat_tire_vehicle_pricing[vType].tyre_pricing[sub] = {};
                                        next.flat_tire_vehicle_pricing[vType].tyre_pricing[sub].replacement = e.target.value === "" ? null : Number(e.target.value);
                                        updateServiceCost(index, next);
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* GENERAL PRICING */}
                    {domain !== "towing" && domain !== "flat-tire" && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[
                          { key: "visit_charge", label: "Visit Charge" },
                          { key: "service_charge", label: "Service Charge" },
                          { key: "extra_km_charge", label: "Cost per KM" },
                          { key: "free_distance", label: "Free Distance (km)" },
                        ].map((field) => (
                          <div key={field.key} className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{field.label}</Label>
                            <Input 
                              type="number" 
                              value={config.vehicle_pricing?.[vType]?.[field.key] ?? ""}
                              onChange={(e) => {
                                const next = JSON.parse(JSON.stringify(config));
                                if (!next.vehicle_pricing) next.vehicle_pricing = {};
                                if (!next.vehicle_pricing[vType]) next.vehicle_pricing[vType] = {};
                                next.vehicle_pricing[vType][field.key] = e.target.value === "" ? null : Number(e.target.value);
                                updateServiceCost(index, next);
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
