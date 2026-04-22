export type FleetVehicleStatus = "available" | "busy" | "offline";

export type FleetVehicle = {
  id: string;
  vehicle_id: string;
  technician_id?: string;
  vehicle_type: string;
  vehicle_number: string;
  capacity?: string | null;
  status: FleetVehicleStatus;
  created_at?: string;
  updated_at?: string;
};

export type FleetVehicleInput = {
  vehicle_type: string;
  vehicle_number: string;
  capacity?: string | null;
  status?: FleetVehicleStatus;
};

export type TeamEmployeeRole = "driver" | "helper";
export type TeamEmployeeStatus = "active" | "offline";

export type TeamEmployee = {
  id: string;
  employee_id: string;
  technician_id?: string;
  name: string;
  phone: string;
  role: TeamEmployeeRole;
  status: TeamEmployeeStatus;
  assigned_vehicle_id?: string | null;
  assigned_vehicle?: {
    id: string;
    vehicle_id: string;
    vehicle_number: string;
    vehicle_type: string;
  } | null;
  assigned_vehicle_label?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type TeamEmployeeInput = {
  name: string;
  phone: string;
  role: TeamEmployeeRole;
  status?: TeamEmployeeStatus;
  assigned_vehicle?: string | null;
};

export type TowingManagementState = {
  vehicles: FleetVehicle[];
  employees: TeamEmployee[];
  isVehiclesLoading: boolean;
  isEmployeesLoading: boolean;
  isMutating: boolean;
  vehicleError: string | null;
  employeeError: string | null;
};
