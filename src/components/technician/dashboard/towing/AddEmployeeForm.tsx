import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  FleetVehicle,
  TeamEmployee,
  TeamEmployeeInput,
  TeamEmployeeRole,
  TeamEmployeeStatus,
} from "@/types/towingManagement";

type AddEmployeeFormProps = {
  vehicles: FleetVehicle[];
  initialValue?: TeamEmployee | null;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (payload: TeamEmployeeInput) => Promise<void> | void;
};

const ROLE_OPTIONS: Array<{ value: TeamEmployeeRole; label: string }> = [
  { value: "driver", label: "Driver" },
  { value: "helper", label: "Helper" },
];

const STATUS_OPTIONS: Array<{ value: TeamEmployeeStatus; label: string }> = [
  { value: "active", label: "Active" },
  { value: "offline", label: "Offline" },
];

const getInitialState = (employee?: TeamEmployee | null) => ({
  name: employee?.name || "",
  phone: employee?.phone || "",
  role: employee?.role || ("driver" as TeamEmployeeRole),
  status: employee?.status || ("active" as TeamEmployeeStatus),
  assigned_vehicle: employee?.assigned_vehicle_id || "unassigned",
});

const formatVehicleLabel = (vehicle: FleetVehicle) =>
  `${vehicle.vehicle_number} (${String(vehicle.vehicle_type || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase())})`;

export default function AddEmployeeForm({
  vehicles,
  initialValue,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: AddEmployeeFormProps) {
  const [formState, setFormState] = useState(getInitialState(initialValue));

  useEffect(() => {
    setFormState(getInitialState(initialValue));
  }, [initialValue]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({
      name: formState.name.trim(),
      phone: formState.phone.trim(),
      role: formState.role,
      status: formState.status,
      assigned_vehicle:
        formState.assigned_vehicle === "unassigned" ? null : formState.assigned_vehicle,
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="employee-name">Name</Label>
        <Input
          id="employee-name"
          value={formState.name}
          maxLength={255}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              name: event.target.value,
            }))
          }
          placeholder="Employee name"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="employee-phone">Phone</Label>
        <Input
          id="employee-phone"
          value={formState.phone}
          maxLength={50}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              phone: event.target.value,
            }))
          }
          placeholder="+91 9876500011"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="employee-role">Role</Label>
        <Select
          value={formState.role}
          onValueChange={(value: TeamEmployeeRole) =>
            setFormState((current) => ({ ...current, role: value }))
          }
        >
          <SelectTrigger id="employee-role">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="employee-vehicle">Assigned Vehicle</Label>
        <Select
          value={formState.assigned_vehicle}
          onValueChange={(value) =>
            setFormState((current) => ({ ...current, assigned_vehicle: value }))
          }
        >
          <SelectTrigger id="employee-vehicle">
            <SelectValue placeholder="Select vehicle" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {vehicles.map((vehicle) => (
              <SelectItem key={vehicle.id} value={vehicle.id}>
                {formatVehicleLabel(vehicle)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="employee-status">Status</Label>
        <Select
          value={formState.status}
          onValueChange={(value: TeamEmployeeStatus) =>
            setFormState((current) => ({ ...current, status: value }))
          }
        >
          <SelectTrigger id="employee-status">
            <SelectValue placeholder="Select status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving..." : initialValue ? "Update Employee" : "Add Employee"}
        </Button>
      </div>
    </form>
  );
}
