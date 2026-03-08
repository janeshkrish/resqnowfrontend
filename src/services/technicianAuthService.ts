import { Technician } from "@/types/technician";
import { apiFetch, setTechnicianToken } from "@/lib/api";

const BASE = "/api/technicians";

function mapTechnicianData(data: Record<string, unknown>): Technician {
  const settings = data.settings && typeof data.settings === "object" ? (data.settings as any) : {};
  const settingsAppearance = settings.appearance && typeof settings.appearance === "object" ? settings.appearance : {};
  const settingsNotifications = settings.notifications && typeof settings.notifications === "object" ? settings.notifications : {};

  return {
    id: String(data.id),
    role: String(data.role ?? "technician"),
    name: String(data.name),
    email: String(data.email),
    phone: String(data.phone ?? ""),
    address: String(data.address ?? ""),
    region: String(data.region ?? ""),
    district: String(data.district ?? ""),
    state: String(data.state ?? ""),
    locality: data.locality != null ? String(data.locality) : undefined,
    serviceAreaRange: Number(data.serviceAreaRange ?? data.service_area_range ?? 0),
    experience: Number(data.experience ?? 0),
    specialties: (Array.isArray(data.specialties) ? data.specialties : []) as string[],
    pricing: (data.pricing && typeof data.pricing === "object" ? data.pricing : {}) as Record<string, any>,
    verification_status: (data.verification_status as "pending" | "verified" | "rejected") || "pending",
    working_hours: (data.working_hours || {}) as any,
    service_costs: (data.service_costs || {}) as any,
    payment_details: (data.payment_details || {}) as any,
    app_readiness: (data.app_readiness || {}) as any,
    vehicle_types: (data.vehicle_types || {}) as any,
    documents: (data.documents || {}) as any,
    proprietor_name: String(data.proprietor_name || ""),
    alternate_phone: String(data.alternate_phone || ""),
    whatsapp_number: String(data.whatsapp_number || ""),
    google_maps_link: String(data.google_maps_link || ""),
    aadhaar_number: String(data.aadhaar_number || ""),
    pan_number: String(data.pan_number || ""),
    business_type: String(data.business_type || ""),
    gst_number: String(data.gst_number || ""),
    trade_license_number: String(data.trade_license_number || ""),
    rating: Number(data.rating ?? 0),
    jobs_completed: Number(data.jobs_completed ?? data.jobsCompleted ?? 0),
    total_earnings: Number(data.total_earnings ?? data.totalEarnings ?? 0),
    latitude: data.latitude != null ? Number(data.latitude) : null,
    longitude: data.longitude != null ? Number(data.longitude) : null,
    is_active: !!data.is_active,
    is_available: !!data.is_available,
    settings: {
      appearance: {
        theme: ["light", "dark", "system"].includes(String(settingsAppearance.theme || ""))
          ? (settingsAppearance.theme as "light" | "dark" | "system")
          : "system",
      },
      notifications: {
        email_notifications: !!settingsNotifications.email_notifications,
        push_notifications: !!settingsNotifications.push_notifications
      }
    }
  };
}

export const technicianAuthService = {
  fetchTechnicianProfile: async (email: string, options?: { signal?: AbortSignal }): Promise<Technician> => {
    const res = await apiFetch(`${BASE}/me`, { method: "GET", technician: true, signal: options?.signal });
    if (!res.ok) {
      if (res.status === 401) throw new Error("Session expired. Please log in again.");
      throw new Error("Technician profile not found");
    }
    const data = await res.json();
    return mapTechnicianData(data);
  },

  validateStoredTechnician: async (technicianId: string) => {
    const res = await apiFetch(`${BASE}/me`, { method: "GET", technician: true });
    if (!res.ok) return null;
    const data = await res.json();
    if (String(data.id) !== String(technicianId)) return null;
    return { verification_status: data.verification_status };
  },

  login: async (
    email: string,
    password: string,
    options?: { signal?: AbortSignal }
  ): Promise<Technician> => {
    const res = await apiFetch(
      `${BASE}/login`,
      {
        method: "POST",
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        signal: options?.signal,
        technician: true,
      }
    );
    if (!res.ok) {
      const body = await res.json().catch(() => ({} as Record<string, unknown>));
      const responseStatus = String(body.status || "").trim().toLowerCase();
      let msg = String(body.error || "").trim();
      if (!msg && res.status === 403 && responseStatus === "pending_approval") {
        msg = "Your technician account is pending admin approval. Please wait until your account is approved.";
      }
      if (!msg) {
        msg = "Login failed.";
      }
      throw new Error(msg);
    }
    const { token, technician } = await res.json();
    setTechnicianToken(token);
    return mapTechnicianData(technician);
  },

  register: async (data: any) => {
    const res = await apiFetch(`${BASE}/register`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body.error || "Registration failed. Please try again.";
      throw new Error(msg);
    }
    const responseData = await res.json();
    if (responseData.token) {
      setTechnicianToken(responseData.token);
    }
    // Merge input data with response to satisfy Technician type locally
    return {
      ...data,
      id: String(responseData.id),
      role: "technician",
      name: responseData.name,
      email: responseData.email,
      verification_status: "pending" as const,
      // Pass through all other data properties since we just registered with them
      ...data
    };
  },

  logout: async () => {
    setTechnicianToken(null);
    localStorage.removeItem("resqnow_technician");
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("resqnow_tech_last_accepted_job_id");
      sessionStorage.removeItem("resqnow_pending_job_deeplink");
      sessionStorage.removeItem("resqnow_pending_job_alert_action");
      sessionStorage.removeItem("technicianReturnUrl");
    }
    return true;
  },
};
