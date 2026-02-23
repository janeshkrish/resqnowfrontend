
export type VerificationStatus = "pending" | "verified" | "rejected";

export type Technician = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  region: string;
  district: string;
  state: string;
  locality?: string; // Added locality field
  serviceAreaRange: number;
  experience: number;
  specialties: string[];
  pricing: Record<string, number>;
  verification_status: VerificationStatus;
  proprietor_name?: string;
  alternate_phone?: string;
  whatsapp_number?: string;
  google_maps_link?: string;
  aadhaar_number?: string;
  pan_number?: string;
  business_type?: string;
  gst_number?: string;
  trade_license_number?: string;
  working_hours?: any;
  service_costs?: any;
  payment_details?: any;
  app_readiness?: any;
  vehicle_types?: any;
  resume_url?: string;
  documents?: any;
  rating?: number;
  jobs_completed?: number;
  total_earnings?: number;
  latitude?: number | null;
  longitude?: number | null;
  is_active?: boolean;
  is_available?: boolean;
  settings?: {
    appearance?: {
      theme?: "light" | "dark" | "system";
    };
    notifications?: {
      email_notifications?: boolean;
      push_notifications?: boolean;
    };
  };
};

export type TechnicianWithPassword = Technician & {
  password: string;
};

export interface TechnicianAuthContextType {
  technician: Technician | null;
  isAuthenticated: boolean;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<any>;
  register: (data: any) => Promise<any>;
  approveTechnician: (technicianId: string) => Promise<boolean>;
  rejectTechnician: (technicianId: string) => Promise<boolean>;
  isOnline: boolean;
  setIsOnline: (online: boolean) => void;
  logout: () => void;
}
