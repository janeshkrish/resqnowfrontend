import { Pencil, Phone, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TeamEmployee } from "@/types/towingManagement";
import ManagementStatusBadge from "./ManagementStatusBadge";

type EmployeeCardProps = {
  employee: TeamEmployee;
  isMutating?: boolean;
  onEdit: (employee: TeamEmployee) => void;
  onDelete: (employee: TeamEmployee) => void;
};

const formatRole = (value: string) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function EmployeeCard({
  employee,
  isMutating = false,
  onEdit,
  onDelete,
}: EmployeeCardProps) {
  return (
    <Card className="rounded-[1.5rem] border-border/70 shadow-sm">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
              <UserRound className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-black text-foreground">{employee.name}</p>
              <p className="text-xs font-medium text-muted-foreground">ID #{employee.employee_id}</p>
            </div>
          </div>
          <ManagementStatusBadge status={employee.status} kind="employee" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Role
            </p>
            <p className="mt-2 text-sm font-bold text-foreground">{formatRole(employee.role)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Assigned Vehicle
            </p>
            <p className="mt-2 text-sm font-bold text-foreground">
              {employee.assigned_vehicle_label || "Unassigned"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/70 px-3 py-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{employee.phone}</span>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 rounded-xl"
            disabled={isMutating}
            onClick={() => onEdit(employee)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button
            variant="outline"
            className="flex-1 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
            disabled={isMutating}
            onClick={() => onDelete(employee)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
