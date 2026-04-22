import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { FleetVehicle } from "@/types/towingManagement";
import ManagementStatusBadge from "./ManagementStatusBadge";

type VehicleTableProps = {
  vehicles: FleetVehicle[];
  isMutating?: boolean;
  onEdit: (vehicle: FleetVehicle) => void;
  onDelete: (vehicle: FleetVehicle) => void;
};

const formatVehicleType = (value: string) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function VehicleTable({
  vehicles,
  isMutating = false,
  onEdit,
  onDelete,
}: VehicleTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Vehicle ID</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Number</TableHead>
          <TableHead>Capacity</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {vehicles.map((vehicle) => (
          <TableRow key={vehicle.id}>
            <TableCell className="font-semibold text-foreground">#{vehicle.vehicle_id}</TableCell>
            <TableCell>{formatVehicleType(vehicle.vehicle_type)}</TableCell>
            <TableCell className="font-semibold">{vehicle.vehicle_number}</TableCell>
            <TableCell>{vehicle.capacity || "Not set"}</TableCell>
            <TableCell>
              <ManagementStatusBadge status={vehicle.status} kind="vehicle" />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isMutating}
                  onClick={() => onEdit(vehicle)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={isMutating}
                  onClick={() => onDelete(vehicle)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
