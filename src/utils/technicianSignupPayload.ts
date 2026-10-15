import type { PricingRow, PricingTemplate } from "@/components/technician/DynamicPricingStep";
import { normalizeSpecialtiesForApi, normalizeVehicleTypesForApi } from "@/config/technicianNormalization";
import { buildLegacySignupPricingConfig, filterSignupPricing, getSelectedSignupVehicleTypes } from "@/utils/technicianSignupPricing";

export type SignupPayloadInput = {
  specialties?: string[];
  vehicle_types?: Record<string, boolean>;
  towing_fleet_types?: string[];
  pricing_config?: PricingRow[];
  phone?: string;
  working_hours?: { opening_time?: string; closing_time?: string; weekly_off?: string; is_24x7?: boolean };
  location?: { address?: string; latitude?: number | null; longitude?: number | null; locality?: string; city?: string; district?: string; state?: string; pincode?: string };
};

/**
 * The body the app sends when a technician signs up. The admin portal's Add technician and
 * Edit technician send this same body, so every technician's record has one shape.
 */
export function buildTechnicianSignupPayload<T extends SignupPayloadInput>(data: T, template: PricingTemplate | null, agreementAccepted: boolean) {
  const specialties = normalizeSpecialtiesForApi(data.specialties || []);
  const vehicleTypes = normalizeVehicleTypesForApi(data.vehicle_types);
  const dynamicPricing = template ? filterSignupPricing(data.pricing_config || [], template, specialties, getSelectedSignupVehicleTypes(vehicleTypes)) : [];
  const legacyPricing = buildLegacySignupPricingConfig(dynamicPricing).map((entry) => (entry.service_domain === "towing" ? { ...entry, towing_fleet_types: data.towing_fleet_types || [] } : entry));
  return {
    ...data,
    specialties,
    vehicle_types: vehicleTypes,
    pricing_config: legacyPricing,
    dynamic_pricing_config: dynamicPricing,
    technician_agreement_accepted: agreementAccepted,
    working_hours: data.working_hours?.is_24x7 ? { is_24x7: true, opening_time: "", closing_time: "", weekly_off: "None" } : data.working_hours,
    address: data.location?.address,
    latitude: data.location?.latitude,
    longitude: data.location?.longitude,
    region: data.location?.city,
    locality: data.location?.locality,
    district: data.location?.district,
    state: data.location?.state,
    service_type: data.specialties?.[0] || "other",
    service_costs: legacyPricing,
    pricing: {},
    whatsapp_number: data.phone,
  };
}
