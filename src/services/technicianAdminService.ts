import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/sonner";

const BASE = "/api/technicians";

export const technicianAdminService = {
  createTechnician: async (payload: Record<string, unknown>) => {
    const res = await apiFetch(`${BASE}/create`, {
      method: "POST",
      admin: true,
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || "Failed to create technician");
    }
    return res.json();
  },

  approveTechnician: async (technicianId: string, reason?: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`${BASE}/${technicianId}/approve`, {
        method: "PATCH",
        admin: true,
        body: JSON.stringify({ reason: reason || "" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Failed to approve technician");
        return false;
      }
      return true;
    } catch {
      toast.error("Failed to approve technician");
      return false;
    }
  },

  rejectTechnician: async (technicianId: string, reason?: string): Promise<boolean> => {
    try {
      const res = await apiFetch(`${BASE}/${technicianId}/reject`, {
        method: "PATCH",
        admin: true,
        body: JSON.stringify({ reason: reason || "" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error || "Failed to reject technician");
        return false;
      }
      return true;
    } catch {
      toast.error("Failed to reject technician");
      return false;
    }
  },
};
