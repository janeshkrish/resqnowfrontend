import * as z from "zod";
import { Technician } from "@/types/technician";
import { apiFetch, setTechnicianToken } from "@/lib/api";
import { getTechnicianOperationalRole } from "@/utils/technicianRole";

const BASE = "/api/technicians";

function mapTechnicianData(data: Record<string, unknown>): Technician {
  const settings = data.settings && typeof data.settings === "object" ? (data.settings as any) : {};
  const settingsAppearance = settings.appearance && typeof settings.appearance === "object" ? settings.appearance : {};
  const settingsNotifications = settings.notifications && typeof settings.notifications === "object" ? settings.notifications : {};
  const specialties = (Array.isArray(data.specialties) ? data.specialties : []) as string[];
  const rawAccountRole = String(data.account_role ?? "").trim().toLowerCase();
  const rawRole = String(data.role ?? "").trim().toLowerCase();
  const accountRole =
    rawAccountRole === "technician" || rawAccountRole === "admin" || rawAccountRole === "user"
      ? rawAccountRole
      : rawRole === "admin" || rawRole === "user"
        ? rawRole
        : "technician";
  const serviceType = String(
    data.service_type ?? data.serviceType ?? data.operational_role ?? specialties[0] ?? data.role ?? "technician"
  ).trim() || "technician";
  const operationalRole = getTechnicianOperationalRole({
    role: String(data.operational_role ?? data.role ?? serviceType),
    operational_role: String(data.operational_role ?? ""),
    service_type: serviceType,
    specialties,
  } as Technician);

  return {
    id: String(data.id),
    role: operationalRole,
    account_role: accountRole,
    operational_role: operationalRole,
    service_type: serviceType,
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
    specialties,
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
    is_logged_in: !!data.is_logged_in,
    last_login_at: data.last_login_at ? String(data.last_login_at) : null,
    last_logout_at: data.last_logout_at ? String(data.last_logout_at) : null,
    last_seen_at: data.last_seen_at ? String(data.last_seen_at) : null,
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
      if (res.status === 404) {
        msg = "User not found.";
      } else if (res.status === 401) {
        msg = "Incorrect password. Please try again.";
      } else if (res.status === 403 && responseStatus === "pending_approval") {
        msg = "Your account is pending admin approval.";
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
    const operationalRole = getTechnicianOperationalRole({
      role: String(data?.service_type ?? data?.specialties?.[0] ?? "technician"),
      service_type: String(data?.service_type ?? data?.specialties?.[0] ?? "technician"),
      specialties: Array.isArray(data?.specialties) ? data.specialties : [],
    } as Technician);
    // Merge input data with response to satisfy Technician type locally
    return {
      ...data,
      id: String(responseData.id),
      role: operationalRole,
      account_role: "technician",
      operational_role: operationalRole,
      service_type: String(data?.service_type ?? data?.specialties?.[0] ?? operationalRole),
      name: responseData.name,
      email: responseData.email,
      verification_status: "pending" as const,
    };
  },

  heartbeat: async (metadata?: Record<string, unknown>) => {
    const res = await apiFetch(`${BASE}/activity/heartbeat`, {
      method: "POST",
      technician: true,
      body: JSON.stringify({
        source: "web",
        metadata: metadata || null,
      }),
    });
    return res.ok;
  },

  logout: async () => {
    try {
      await apiFetch(`${BASE}/logout`, {
        method: "POST",
        technician: true,
        body: JSON.stringify({
          reason: "user_logout",
          source: "web",
        }),
      });
    } catch (error) {
      console.warn("[Technician logout] backend logout tracking failed:", error);
    }

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


export const technicianSchema = z.object({
    // Step 0: Personal
    proprietor_name: z.string().min(2, "Name required"),
    name: z.string().min(2, "Shop Name required"),
    email: z.string().trim().email("Enter a valid email").or(z.literal("")),
    password: z.string().min(8, "Use at least 8 characters").or(z.literal("")),
    confirmPassword: z.string(),
    phone: z.string().min(10, "Min 10 digits"),
    alternate_phone: z.string().optional(),
    location: z.object({
        address: z.string().min(5, "Address required"),
        latitude: z.number().nullable().refine(val => val !== null, "GPS Location required"),
        longitude: z.number().nullable(),
        state: z.string().min(2, "State required"),
        locality: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        pincode: z.string().optional(),
    }),
    serviceAreaRange: z.coerce.number().min(1, "Min 1 km"),
    experience: z.coerce.number().min(0, "Invalid experience"),

    // Step 1: Services
    specialties: z.array(z.string()).min(1, "Select at least one service"),
    vehicle_types: z.record(z.boolean()).refine((data) => data && Object.values(data).some(val => val === true), {
        message: "Select at least one vehicle type"
    }),
    towing_fleet_types: z.array(z.string()).default([]),

    // Step 2: Verification
    aadhaar_number: z.string().min(12, "12 digits required").max(12),
    gst_number: z.string().optional(),
    documents: z.object({
        garage_front: z.string().optional(),
        profile_photo: z.string().optional(),
        tools_photo: z.string().optional(),
        facilities_photo: z.string().optional(),
    }),

    // Step 3: Operations
    working_hours: z.object({
        opening_time: z.string(),
        closing_time: z.string(),
        weekly_off: z.string(),
        is_24x7: z.boolean(),
    }),
    app_readiness: z.object({
        has_smartphone: z.boolean(),
        preferred_language: z.string(),
    }),

    // Step 4: Pricing
    pricing_config: z.array(z.any()),

    // Step 5: Banking
    payment_details: z.object({
        modes: z.record(z.boolean()),
        upi_id: z.string().optional(),
        bank_account_number: z.string().optional(),
        ifsc_code: z.string().optional(),
        bank_name: z.string().optional(),
    }),
    trade_license_number: z.string().optional(),

    // Step 6: Consent
    consent: z.object({
        agreed: z.boolean().refine(val => val === true, "Required"),
    }),
}).superRefine((data, ctx) => {
    if (data.email && !data.password) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "A password is required when you enter an email", path: ["password"] });
    }
    if (!data.working_hours.is_24x7) {
        for (const key of ["opening_time", "closing_time"] as const) {
            if (!data.working_hours[key]) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Choose working hours or 24/7 availability", path: ["working_hours", key] });
        }
    }
    if (data.password !== data.confirmPassword) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Mismatch",
            path: ["confirmPassword"],
        });
    }

    if (data.specialties.includes("towing") && data.towing_fleet_types.length === 0) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Select at least one tow truck type",
            path: ["towing_fleet_types"],
        });
    }
});

export type TechnicianFormValues = z.infer<typeof technicianSchema>;
