import { Technician } from "@/types/technician";
import { API_BASE_URL } from "@/lib/api";

// Helper function to map database/API fields to our Technician type
const resolveUrl = (path: string) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (!API_BASE_URL) return cleanPath;
  const cleanBase = API_BASE_URL.endsWith("/")
    ? API_BASE_URL.substring(0, API_BASE_URL.length - 1)
    : API_BASE_URL;
  return `${cleanBase}${cleanPath}`;
};

export const mapTechnicianData = (data: any): Technician => {
  const parseMaybeJson = <T = any>(value: any, fallback: T): T => {
    if (value == null) return fallback;
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    return value as T;
  };

  const docs = parseMaybeJson<Record<string, any>>(data.documents, {});
  const parsedPricing = parseMaybeJson<Record<string, number>>(data.pricing, {});
  const parsedWorkingHours = parseMaybeJson<Record<string, any>>(data.working_hours, {});
  const parsedServiceCosts = parseMaybeJson<any>(data.service_costs, []);
  const parsedPaymentDetails = parseMaybeJson<Record<string, any>>(data.payment_details, {});
  const parsedAppReadiness = parseMaybeJson<Record<string, any>>(data.app_readiness, {});
  const mappedDocuments = {
    profile_photo: resolveUrl(docs.profile_photo),
    garage_front: resolveUrl(docs.garage_front),
    tools_photo: resolveUrl(docs.tools_photo),
    facilities_photo: resolveUrl(docs.facilities_photo),
    ...docs
  };

  return {
    id: String(data.id),
    name: data.name,
    email: data.email,
    phone: data.phone ?? "",
    address: data.address ?? "",
    region: data.region ?? "",
    district: data.district ?? "",
    state: data.state ?? "",
    locality: data.locality,
    serviceAreaRange: data.serviceAreaRange ?? data.service_area_range ?? 0,
    experience: data.experience ?? 0,
    specialties: Array.isArray(data.specialties) ? data.specialties : [],
    pricing: parsedPricing && typeof parsedPricing === "object" ? parsedPricing : {},
    verification_status: (data.verification_status || "pending") as "pending" | "verified" | "rejected",

    // Mapped missing fields
    proprietor_name: data.proprietor_name,
    aadhaar_number: data.aadhaar_number,
    pan_number: data.pan_number,
    gst_number: data.gst_number,
    resume_url: resolveUrl(data.resume_url),
    documents: mappedDocuments,
    working_hours: parsedWorkingHours,
    service_costs: parsedServiceCosts,
    payment_details: parsedPaymentDetails,
    app_readiness: parsedAppReadiness,
    vehicle_types: parseMaybeJson(data.vehicle_types, {}),
    rating: data.rating,
    jobs_completed: data.jobs_completed,
    total_earnings: data.total_earnings,
    latitude: data.latitude,
    longitude: data.longitude,
    is_active: data.is_active
  };
};
