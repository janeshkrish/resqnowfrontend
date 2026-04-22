import { Pencil, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { FleetVehicle } from "@/types/towingManagement";
import ManagementStatusBadge from "./ManagementStatusBadge";

type VehicleCardProps = {
  vehicle: FleetVehicle;
  isMutating?: boolean;
  onEdit: (vehicle: FleetVehicle) => void;
  onDelete: (vehicle: FleetVehicle) => void;
};

const formatVehicleType = (value: string) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function VehicleCard({
  vehicle,
  isMutating = false,
  onEdit,
  onDelete,
}: VehicleCardProps) {
  return (
    <Card className="rounded-[1.5rem] border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground">{formatVehicleType(vehicle.vehicle_type)}</p>
              <p className="text-xs font-medium text-muted-foreground">ID #{vehicle.vehicle_id}</p>
            </div>
          </div>
          <ManagementStatusBadge status={vehicle.status} kind="vehicle" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Number
            </p>
            <p className="mt-2 text-sm font-bold text-foreground">{vehicle.vehicle_number}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Capacity
            </p>
            <p className="mt-2 text-sm font-bold text-foreground">{vehicle.capacity || "Not set"}</p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            disabled={isMutating}
            onClick={() => onEdit(vehicle)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            className="flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={isMutating}
            onClick={() => onDelete(vehicle)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
