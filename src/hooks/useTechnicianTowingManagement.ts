import { useCallback, useEffect, useMemo, useState } from "react";
import { technicianTowingManagementService } from "@/services/technicianTowingManagementService";
import type {
  FleetVehicle,
  FleetVehicleInput,
  TeamEmployee,
  TeamEmployeeInput,
  TowingManagementState,
} from "@/types/towingManagement";

const initialState: TowingManagementState = {
  vehicles: [],
  employees: [],
  isVehiclesLoading: false,
  isEmployeesLoading: false,
  isMutating: false,
  vehicleError: null,
  employeeError: null,
};

export function useTechnicianTowingManagement(enabled: boolean) {
  const [state, setState] = useState<TowingManagementState>(initialState);

  const loadVehicles = useCallback(async () => {
    if (!enabled) return [];
    setState((current) => ({
      ...current,
      isVehiclesLoading: true,
      vehicleError: null,
    }));

    try {
      const vehicles = await technicianTowingManagementService.listVehicles();
      setState((current) => ({
        ...current,
        vehicles,
        isVehiclesLoading: false,
      }));
      return vehicles;
    } catch (error) {
      setState((current) => ({
        ...current,
        isVehiclesLoading: false,
        vehicleError: error instanceof Error ? error.message : "Failed to fetch fleet vehicles.",
      }));
      return [];
    }
  }, [enabled]);

  const loadEmployees = useCallback(async () => {
    if (!enabled) return [];
    setState((current) => ({
      ...current,
      isEmployeesLoading: true,
      employeeError: null,
    }));

    try {
      const employees = await technicianTowingManagementService.listEmployees();
      setState((current) => ({
        ...current,
        employees,
        isEmployeesLoading: false,
      }));
      return employees;
    } catch (error) {
      setState((current) => ({
        ...current,
        isEmployeesLoading: false,
        employeeError: error instanceof Error ? error.message : "Failed to fetch team members.",
      }));
      return [];
    }
  }, [enabled]);

  const refreshAll = useCallback(async () => {
    if (!enabled) return;
    await Promise.all([loadVehicles(), loadEmployees()]);
  }, [enabled, loadEmployees, loadVehicles]);

  useEffect(() => {
    if (!enabled) {
      setState(initialState);
      return;
    }
    void refreshAll();
  }, [enabled, refreshAll]);

  const mutate = useCallback(
    async <T,>(action: () => Promise<T>) => {
      setState((current) => ({ ...current, isMutating: true }));
      try {
        const result = await action();
        await refreshAll();
        return result;
      } finally {
        setState((current) => ({ ...current, isMutating: false }));
      }
    },
    [refreshAll]
  );

  const api = useMemo(
    () => ({
      refreshAll,
      refreshVehicles: loadVehicles,
      refreshEmployees: loadEmployees,
      createVehicle: (input: FleetVehicleInput) =>
        mutate(() => technicianTowingManagementService.createVehicle(input)),
      updateVehicle: (id: string, input: FleetVehicleInput) =>
        mutate(() => technicianTowingManagementService.updateVehicle(id, input)),
      deleteVehicle: (id: string) =>
        mutate(async () => {
          await technicianTowingManagementService.deleteVehicle(id);
        }),
      createEmployee: (input: TeamEmployeeInput) =>
        mutate(() => technicianTowingManagementService.createEmployee(input)),
      updateEmployee: (id: string, input: TeamEmployeeInput) =>
        mutate(() => technicianTowingManagementService.updateEmployee(id, input)),
      deleteEmployee: (id: string) =>
        mutate(async () => {
          await technicianTowingManagementService.deleteEmployee(id);
        }),
    }),
    [loadEmployees, loadVehicles, mutate, refreshAll]
  );

  return {
    ...state,
    ...api,
    vehiclesById: state.vehicles.reduce<Record<string, FleetVehicle>>((accumulator, vehicle) => {
      accumulator[vehicle.id] = vehicle;
      return accumulator;
    }, {}),
    employeesById: state.employees.reduce<Record<string, TeamEmployee>>((accumulator, employee) => {
      accumulator[employee.id] = employee;
      return accumulator;
    }, {}),
  };
}
