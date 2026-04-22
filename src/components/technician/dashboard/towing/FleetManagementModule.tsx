import { Plus, RefreshCcw, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { FleetVehicle, FleetVehicleInput } from "@/types/towingManagement";
import AddVehicleForm from "./AddVehicleForm";
import VehicleCard from "./VehicleCard";
import VehicleTable from "./VehicleTable";

type FleetManagementModuleProps = {
  vehicles: FleetVehicle[];
  isLoading: boolean;
  isMutating: boolean;
  error?: string | null;
  dialogOpen: boolean;
  selectedVehicle?: FleetVehicle | null;
  onDialogOpenChange: (open: boolean) => void;
  onOpenCreate: () => void;
  onEditVehicle: (vehicle: FleetVehicle) => void;
  onDeleteVehicle: (vehicle: FleetVehicle) => void;
  onRefresh: () => void;
  onCreateVehicle: (payload: FleetVehicleInput) => Promise<void>;
  onUpdateVehicle: (id: string, payload: FleetVehicleInput) => Promise<void>;
};

const SUMMARY_LABELS = [
  { key: "total", label: "Fleet Units" },
  { key: "available", label: "Available" },
  { key: "busy", label: "Busy" },
] as const;

export default function FleetManagementModule({
  vehicles,
  isLoading,
  isMutating,
  error,
  dialogOpen,
  selectedVehicle = null,
  onDialogOpenChange,
  onOpenCreate,
  onEditVehicle,
  onDeleteVehicle,
  onRefresh,
  onCreateVehicle,
  onUpdateVehicle,
}: FleetManagementModuleProps) {
  const summary = {
    total: vehicles.length,
    available: vehicles.filter((vehicle) => vehicle.status === "available").length,
    busy: vehicles.filter((vehicle) => vehicle.status === "busy").length,
  };

  const handleSubmit = async (payload: FleetVehicleInput) => {
    if (selectedVehicle) {
      await onUpdateVehicle(selectedVehicle.id, payload);
    } else {
      await onCreateVehicle(payload);
    }
    onDialogOpenChange(false);
  };

  return (
    <section id="dashboard-fleet" className="space-y-4">
      <Card className="overflow-hidden rounded-[1.75rem] border-border/70 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]">
        <CardHeader className="space-y-4 border-b border-border/60 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_55%,#dbeafe_100%)] p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
                  <Truck className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black tracking-tight text-slate-900">
                    Fleet Management
                  </CardTitle>
                  <p className="text-sm font-medium text-slate-600">
                    Track towing vehicles, availability, and future order assignment capacity.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={onRefresh} disabled={isLoading || isMutating}>
                <RefreshCcw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
              <Button onClick={onOpenCreate}>
                <Plus className="mr-2 h-4 w-4" />
                Add Vehicle
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {SUMMARY_LABELS.map((item) => (
              <div
                key={item.key}
                className="rounded-[1.25rem] border border-white/60 bg-white/80 p-4 shadow-sm backdrop-blur"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                  {summary[item.key]}
                </p>
              </div>
            ))}
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-5 md:p-6">
          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          {isLoading ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center text-sm font-medium text-muted-foreground">
              Loading fleet vehicles...
            </div>
          ) : vehicles.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
              <p className="text-base font-semibold text-slate-900">No towing vehicles added yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Add your first flatbed or wheel-lift so orders can map to real fleet capacity.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <VehicleTable
                  vehicles={vehicles}
                  isMutating={isMutating}
                  onEdit={onEditVehicle}
                  onDelete={onDeleteVehicle}
                />
              </div>

              <div className="grid gap-3 md:hidden">
                {vehicles.map((vehicle) => (
                  <VehicleCard
                    key={vehicle.id}
                    vehicle={vehicle}
                    isMutating={isMutating}
                    onEdit={onEditVehicle}
                    onDelete={onDeleteVehicle}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={onDialogOpenChange}>
        <DialogContent className="max-w-xl rounded-[1.5rem]">
          <DialogHeader>
            <DialogTitle>{selectedVehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
            <DialogDescription>
              Maintain towing fleet records without leaving the technician dashboard.
            </DialogDescription>
          </DialogHeader>

          <AddVehicleForm
            initialValue={selectedVehicle}
            isSubmitting={isMutating}
            onCancel={() => onDialogOpenChange(false)}
            onSubmit={handleSubmit}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
