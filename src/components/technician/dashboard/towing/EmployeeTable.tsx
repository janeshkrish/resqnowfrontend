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
import type { TeamEmployee } from "@/types/towingManagement";
import ManagementStatusBadge from "./ManagementStatusBadge";

type EmployeeTableProps = {
  employees: TeamEmployee[];
  isMutating?: boolean;
  onEdit: (employee: TeamEmployee) => void;
  onDelete: (employee: TeamEmployee) => void;
};

const formatRole = (value: string) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

export default function EmployeeTable({
  employees,
  isMutating = false,
  onEdit,
  onDelete,
}: EmployeeTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee ID</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Assigned Vehicle</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {employees.map((employee) => (
          <TableRow key={employee.id}>
            <TableCell className="font-semibold text-foreground">#{employee.employee_id}</TableCell>
            <TableCell className="font-semibold">{employee.name}</TableCell>
            <TableCell>{employee.phone}</TableCell>
            <TableCell>{formatRole(employee.role)}</TableCell>
            <TableCell>{employee.assigned_vehicle_label || "Unassigned"}</TableCell>
            <TableCell>
              <ManagementStatusBadge status={employee.status} kind="employee" />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isMutating}
                  onClick={() => onEdit(employee)}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  disabled={isMutating}
                  onClick={() => onDelete(employee)}
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
