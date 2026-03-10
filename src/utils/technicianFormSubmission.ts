import { toast } from "@/components/ui/sonner";
import { RegisterFormValues } from "@/types/technician-registration";
import { technicianAuthService } from "@/services/technicianAuthService";
const toNumber = (val: string | number | undefined): number => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  return 0;
};

export const submitTechnicianApplication = async (
  data: RegisterFormValues,
  resumeFile: File | null,
  onSuccess: () => void
) => {
  try {
    let resumeUrl = "";
    if (resumeFile) {
      console.warn("Resume upload to backend not implemented yet. Skipping file upload.", resumeFile.name);
      resumeUrl = "resume_upload_pending_implementation";
    }
    const p: any = data.pricing ?? {
      towing: 0, tireChange: 0, jumpStart: 0, fuelDelivery: 0, lockout: 0, winching: 0
    };
    const formattedPricing: Record<string, number> = {
      towing: toNumber(p.towing),
      tireChange: toNumber(p.tireChange),
      jumpStart: toNumber(p.jumpStart),
      fuelDelivery: toNumber(p.fuelDelivery),
      lockout: toNumber(p.lockout),
      winching: toNumber(p.winching)
    };

    // Clean and transform the data
    const registrationPayload = {
      name: data.name,
      email: data.email,
      password: data.password,
      phone: data.phone,
      proprietor_name: data.proprietor_name,
      alternate_phone: data.alternate_phone,
      whatsapp_number: data.whatsapp_number,
      address: data.address,
      region: data.region,
      district: data.district,
      state: data.state,
      locality: data.locality,
      google_maps_link: data.google_maps_link,
      aadhaar_number: data.aadhaar_number,
      pan_number: data.pan_number,
      business_type: data.business_type,
      gst_number: data.gst_number,
      trade_license_number: data.trade_license_number,
      serviceAreaRange: toNumber(data.serviceAreaRange),
      experience: toNumber(data.experience),
      specialties: data.specialties,
      working_hours: {
        opening_time: data.opening_time,
        closing_time: data.closing_time,
        weekly_off: data.weekly_off,
        service_24x7: data.service_24x7,
        night_service: data.night_service,
        night_service_start: data.night_service_start,
        night_service_end: data.night_service_end
      },
      service_costs: {
        inspection_2w: toNumber(data.inspection_2w),
        inspection_4w: toNumber(data.inspection_4w),
        inspection_adjustable: data.inspection_adjustable,
        visit_charge_base: toNumber(data.visit_charge_base),
        visit_free_distance: toNumber(data.visit_free_distance),
        visit_extra_km_charge: toNumber(data.visit_extra_km_charge),
        spare_parts_provided: data.spare_parts_provided,
        spare_parts_type: data.spare_parts_type,
        spare_parts_billed_separately: data.spare_parts_billed_separately,
        night_charge_extra: toNumber(data.night_charge_extra),
        cancellation_free: data.cancellation_free,
        cancellation_fee: toNumber(data.cancellation_fee),
        labour: {
          two_wheeler: {
            puncture_min: toNumber(data.labour_2w_puncture_min),
            puncture_max: toNumber(data.labour_2w_puncture_max),
            tubeless_min: toNumber(data.labour_2w_tubeless_min),
            tubeless_max: toNumber(data.labour_2w_tubeless_max),
            general_min: toNumber(data.labour_2w_general_min),
            general_max: toNumber(data.labour_2w_general_max)
          },
          four_wheeler: {
            puncture_min: toNumber(data.labour_4w_puncture_min),
            puncture_max: toNumber(data.labour_4w_puncture_max),
            brake_min: toNumber(data.labour_4w_brake_min),
            brake_max: toNumber(data.labour_4w_brake_max),
            general_min: toNumber(data.labour_4w_general_min),
            general_max: toNumber(data.labour_4w_general_max)
          }
        }
      },
      payment_details: {
        modes: data.modes,
        upi_id: data.upi_id,
        bank_account_number: data.bank_account_number,
        ifsc_code: data.ifsc_code,
        bank_name: data.bank_name
      },
      app_readiness: {
        smartphone_available: data.smartphone_available,
        android_phone: data.android_phone,
        language: data.language,
        comfortable_with_app: data.comfortable_with_app
      },
      vehicle_types: data.vehicle_types,
      pricing: formattedPricing,
      resume_url: resumeUrl,
      documents: {} // Add other docs here if needed
    };

    // Register technician using the service
    await technicianAuthService.register(registrationPayload as any);
    toast.success("Registered successfully. You will get a confirmation mail once admin reviews your application.");
    onSuccess();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Registration failed. Please try again.";
    toast.error(message);
    throw error;
  }
};
