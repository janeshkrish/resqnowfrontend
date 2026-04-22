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
import type { FleetVehicle, FleetVehicleInput, FleetVehicleStatus } from "@/types/towingManagement";

type AddVehicleFormProps = {
  initialValue?: FleetVehicle | null;
  isSubmitting?: boolean;
  onCancel: () => void;
  onSubmit: (payload: FleetVehicleInput) => Promise<void> | void;
};

const VEHICLE_TYPE_OPTIONS = [
  { value: "flatbed", label: "Flatbed" },
  { value: "wheel-lift", label: "Wheel-Lift" },
  { value: "integrated", label: "Integrated" },
  { value: "heavy-duty", label: "Heavy Duty" },
  { value: "recovery", label: "Recovery" },
  { value: "other", label: "Other" },
];

const STATUS_OPTIONS: Array<{ value: FleetVehicleStatus; label: string }> = [
  { value: "available", label: "Available" },
  { value: "busy", label: "Busy" },
  { value: "offline", label: "Offline" },
];

const getInitialState = (vehicle?: FleetVehicle | null) => ({
  vehicle_type: vehicle?.vehicle_type || "flatbed",
  vehicle_number: vehicle?.vehicle_number || "",
  capacity: vehicle?.capacity || "",
  status: vehicle?.status || ("available" as FleetVehicleStatus),
});

export default function AddVehicleForm({
  initialValue,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: AddVehicleFormProps) {
  const [formState, setFormState] = useState(getInitialState(initialValue));

  useEffect(() => {
    setFormState(getInitialState(initialValue));
  }, [initialValue]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onSubmit({
      vehicle_type: formState.vehicle_type,
      vehicle_number: formState.vehicle_number.trim().toUpperCase(),
      capacity: formState.capacity.trim() || null,
      status: formState.status,
    });
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="vehicle-type">Vehicle Type</Label>
        <Select
          value={formState.vehicle_type}
          onValueChange={(value) => setFormState((current) => ({ ...current, vehicle_type: value }))}
        >
          <SelectTrigger id="vehicle-type">
            <SelectValue placeholder="Select vehicle type" />
          </SelectTrigger>
          <SelectContent>
            {VEHICLE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="vehicle-number">Vehicle Number</Label>
        <Input
          id="vehicle-number"
          value={formState.vehicle_number}
          maxLength={64}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              vehicle_number: event.target.value,
            }))
          }
          placeholder="KA01TR1001"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="vehicle-capacity">Capacity</Label>
        <Input
          id="vehicle-capacity"
          value={formState.capacity}
          maxLength={64}
          onChange={(event) =>
            setFormState((current) => ({
              ...current,
              capacity: event.target.value,
            }))
          }
          placeholder="Optional"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="vehicle-status">Status</Label>
        <Select
          value={formState.status}
          onValueChange={(value: FleetVehicleStatus) =>
            setFormState((current) => ({ ...current, status: value }))
          }
        >
          <SelectTrigger id="vehicle-status">
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
          {isSubmitting ? "Saving..." : initialValue ? "Update Vehicle" : "Add Vehicle"}
        </Button>
      </div>
    </form>
  );
}
