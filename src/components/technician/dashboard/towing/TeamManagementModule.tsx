import { Plus, RefreshCcw, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  FleetVehicle,
  TeamEmployee,
  TeamEmployeeInput,
} from "@/types/towingManagement";
import AddEmployeeForm from "./AddEmployeeForm";
import EmployeeCard from "./EmployeeCard";
import EmployeeTable from "./EmployeeTable";

type TeamManagementModuleProps = {
  employees: TeamEmployee[];
  vehicles: FleetVehicle[];
  isLoading: boolean;
  isMutating: boolean;
  error?: string | null;
  dialogOpen: boolean;
  selectedEmployee?: TeamEmployee | null;
  onDialogOpenChange: (open: boolean) => void;
  onOpenCreate: () => void;
  onEditEmployee: (employee: TeamEmployee) => void;
  onDeleteEmployee: (employee: TeamEmployee) => void;
  onRefresh: () => void;
  onCreateEmployee: (payload: TeamEmployeeInput) => Promise<void>;
  onUpdateEmployee: (id: string, payload: TeamEmployeeInput) => Promise<void>;
};

const SUMMARY_LABELS = [
  { key: "total", label: "Team Members" },
  { key: "drivers", label: "Drivers" },
  { key: "helpers", label: "Helpers" },
] as const;

export default function TeamManagementModule({
  employees,
  vehicles,
  isLoading,
  isMutating,
  error,
  dialogOpen,
  selectedEmployee = null,
  onDialogOpenChange,
  onOpenCreate,
  onEditEmployee,
  onDeleteEmployee,
  onRefresh,
  onCreateEmployee,
  onUpdateEmployee,
}: TeamManagementModuleProps) {
  const summary = {
    total: employees.length,
    drivers: employees.filter((employee) => employee.role === "driver").length,
    helpers: employees.filter((employee) => employee.role === "helper").length,
  };

  const handleSubmit = async (payload: TeamEmployeeInput) => {
    if (selectedEmployee) {
      await onUpdateEmployee(selectedEmployee.id, payload);
    } else {
      await onCreateEmployee(payload);
    }
    onDialogOpenChange(false);
  };

  return (
    <section id="dashboard-team" className="space-y-4">
      <Card className="overflow-hidden rounded-[1.75rem] border-border/70 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]">
        <CardHeader className="space-y-4 border-b border-border/60 bg-[linear-gradient(135deg,#ecfeff_0%,#ffffff_55%,#ccfbf1_100%)] p-5 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-600/25">
                  <UsersRound className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-2xl font-black tracking-tight text-slate-900">
                    Team Management
                  </CardTitle>
                  <p className="text-sm font-medium text-slate-600">
                    Keep drivers and helpers linked to the right towing vehicles.
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
                Add Employee
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
              Loading team members...
            </div>
          ) : employees.length === 0 ? (
            <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-10 text-center">
              <p className="text-base font-semibold text-slate-900">No employees added yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Add drivers and helpers now so dispatch can map people alongside fleet vehicles.
              </p>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <EmployeeTable
                  employees={employees}
                  isMutating={isMutating}
                  onEdit={onEditEmployee}
                  onDelete={onDeleteEmployee}
                />
              </div>

              <div className="grid gap-3 md:hidden">
                {employees.map((employee) => (
                  <EmployeeCard
                    key={employee.id}
                    employee={employee}
                    isMutating={isMutating}
                    onEdit={onEditEmployee}
                    onDelete={onDeleteEmployee}
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
            <DialogTitle>{selectedEmployee ? "Edit Employee" : "Add Employee"}</DialogTitle>
            <DialogDescription>
              Keep team assignments aligned with your towing fleet capacity.
            </DialogDescription>
          </DialogHeader>

          <AddEmployeeForm
            vehicles={vehicles}
            initialValue={selectedEmployee}
            isSubmitting={isMutating}
            onCancel={() => onDialogOpenChange(false)}
            onSubmit={handleSubmit}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}
