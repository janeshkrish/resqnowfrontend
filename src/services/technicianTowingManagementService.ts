import { apiFetch, readJsonSafely } from "@/lib/api";
import type {
  FleetVehicle,
  FleetVehicleInput,
  TeamEmployee,
  TeamEmployeeInput,
} from "@/types/towingManagement";

const VEHICLES_BASE = "/api/technicians/vehicles";
const EMPLOYEES_BASE = "/api/technicians/employees";

async function readResponseOrThrow<T>(response: Response, fallbackMessage: string) {
  const payload = await readJsonSafely<{ error?: string } & T>(response);
  if (!response.ok) {
    throw new Error(String(payload?.error || fallbackMessage));
  }
  return payload as T;
}

export const technicianTowingManagementService = {
  async listVehicles(): Promise<FleetVehicle[]> {
    const response = await apiFetch(VEHICLES_BASE, { technician: true });
    return readResponseOrThrow<FleetVehicle[]>(response, "Failed to fetch fleet vehicles.");
  },

  async createVehicle(input: FleetVehicleInput): Promise<FleetVehicle> {
    const response = await apiFetch(VEHICLES_BASE, {
      method: "POST",
      technician: true,
      body: JSON.stringify(input),
    });
    return readResponseOrThrow<FleetVehicle>(response, "Failed to add fleet vehicle.");
  },

  async updateVehicle(id: string, input: FleetVehicleInput): Promise<FleetVehicle> {
    const response = await apiFetch(`${VEHICLES_BASE}/${id}`, {
      method: "PATCH",
      technician: true,
      body: JSON.stringify(input),
    });
    return readResponseOrThrow<FleetVehicle>(response, "Failed to update fleet vehicle.");
  },

  async deleteVehicle(id: string): Promise<void> {
    const response = await apiFetch(`${VEHICLES_BASE}/${id}`, {
      method: "DELETE",
      technician: true,
    });
    await readResponseOrThrow<{ success: boolean }>(response, "Failed to delete fleet vehicle.");
  },

  async listEmployees(): Promise<TeamEmployee[]> {
    const response = await apiFetch(EMPLOYEES_BASE, { technician: true });
    return readResponseOrThrow<TeamEmployee[]>(response, "Failed to fetch team members.");
  },

  async createEmployee(input: TeamEmployeeInput): Promise<TeamEmployee> {
    const response = await apiFetch(EMPLOYEES_BASE, {
      method: "POST",
      technician: true,
      body: JSON.stringify(input),
    });
    return readResponseOrThrow<TeamEmployee>(response, "Failed to add team member.");
  },

  async updateEmployee(id: string, input: TeamEmployeeInput): Promise<TeamEmployee> {
    const response = await apiFetch(`${EMPLOYEES_BASE}/${id}`, {
      method: "PATCH",
      technician: true,
      body: JSON.stringify(input),
    });
    return readResponseOrThrow<TeamEmployee>(response, "Failed to update team member.");
  },

  async deleteEmployee(id: string): Promise<void> {
    const response = await apiFetch(`${EMPLOYEES_BASE}/${id}`, {
      method: "DELETE",
      technician: true,
    });
    await readResponseOrThrow<{ success: boolean }>(response, "Failed to delete team member.");
  },
};
