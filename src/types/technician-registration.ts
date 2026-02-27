import { z } from "zod";

export const specialtiesOptions = [
  { id: "towing", label: "Towing" },
  { id: "tire-change", label: "Tire Change" },
  { id: "jump-start", label: "Jump Start" },
  { id: "fuel-delivery", label: "Fuel Delivery" },
  { id: "lockout", label: "Lockout Service" },
  { id: "winching", label: "Winching" },
];

export const regionOptions = [
  "North Tamil Nadu",
  "South Tamil Nadu",
  "East Tamil Nadu",
  "West Tamil Nadu",
  "Central Tamil Nadu"
];

export const stateOptions = [
  "Tamil Nadu"
];

// Major localities in Tamil Nadu districts
export const localityOptions: Record<string, string[]> = {
  "Chennai": [
    "T. Nagar", "Adyar", "Anna Nagar", "Velachery", "Mylapore",
    "Tambaram", "Porur", "Guindy", "Egmore", "Chromepet", "Besant Nagar",
    "Kilpauk", "Kodambakkam", "Nungambakkam", "Sholinganallur"
  ],
  "Coimbatore": [
    "Peelamedu", "RS Puram", "Singanallur", "Saibaba Colony", "Ganapathy",
    "Ramanathapuram", "Gandhipuram", "Ukkadam", "Hopes College", "Thudiyalur"
  ],
  "Madurai": [
    "Goripalayam", "Annanagar", "Teppakulam", "Arapalayam", "Pasumalai",
    "Mattuthavani", "KK Nagar", "Tirupparankundram", "Ellis Nagar", "Vilangudi"
  ],
  "Salem": [
    "Alagapuram", "Hasthampatti", "Kondalampatti", "Kitchipalayam", "Fairlands",
    "Shevapet", "Suramangalam", "Ammapet", "Gorimedu", "Kannankurichi"
  ],
  "Tiruchirappalli": [
    "Srirangam", "Thillai Nagar", "Woraiyur", "K.K. Nagar", "Thennur",
    "Palakkarai", "Cantonment", "Crawford", "Edamalaipatti Pudur", "Ariyamangalam"
  ]
};

// 1. Basic Information
const basicInfoBase = z.object({
  name: z.string().min(1, "Garage Name is required"),
  proprietor_name: z.string().min(1, "Owner Name is required"),
  phone: z.string().min(10, "Valid mobile number is required"),
  email: z.string().email("Invalid email address"),
  alternate_phone: z.string().optional(),
  whatsapp_number: z.string().min(10, "WhatsApp number is required"),
  address: z.string().min(1, "Full address is required"), // Full Address
  district: z.string().min(1, "District is required"),
  state: z.string().min(1, "State is required"),
  locality: z.string().min(1, "Area/Locality is required"), // Area/Locality
  region: z.string().optional(), // City/Town can range to this
  google_maps_link: z.string().url("Valid Google Maps link is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Confirm Password is required")
});

export const basicInfoSchema = basicInfoBase.refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// 2. Identity & Business
export const identitySchema = z.object({
  aadhaar_number: z.string().min(12, "Valid Aadhaar number is required"),
  pan_number: z.string().min(10, "Valid PAN number is required"),
  business_type: z.enum(["Individual", "Proprietorship", "Partnership"]),
  gst_number: z.string().optional(),
  trade_license_number: z.string().optional(),
});

// 3. Services Offered
export const servicesSchema = z.object({
  vehicle_types: z.object({
    two_wheeler: z.boolean().default(false),
    four_wheeler: z.boolean().default(false),
    commercial: z.boolean().default(false),
    heavy: z.boolean().default(false),
    ev: z.boolean().default(false)
  }),
  specialties: z.array(z.string()).min(1, "Select at least one service category"),
});

// 4. Roadside Assistance
export const roadsideSchema = z.object({
  serviceAreaRange: z.preprocess((val) => Number(val), z.number().min(0)), // Service radius
  response_time: z.preprocess((val) => Number(val), z.number().min(0)), // Minutes
  emergency_service: z.boolean().default(false), // On-call emergency
});

// 5. Experience
export const experienceSchema = z.object({
  experience: z.preprocess((val) => Number(val), z.number().min(0)),
  mechanic_count: z.preprocess((val) => Number(val), z.number().min(1)),
  specialization: z.object({
    bike: z.boolean().default(false),
    car: z.boolean().default(false),
    diesel: z.boolean().default(false),
    ev: z.boolean().default(false),
  }),
});

// 6. Working Hours
export const workingHoursSchema = z.object({
  opening_time: z.string().min(1, "Opening time is required"),
  closing_time: z.string().min(1, "Closing time is required"),
  weekly_off: z.string().optional(),
  service_24x7: z.boolean().default(false),
  night_service: z.boolean().default(false),
  night_service_start: z.string().optional(),
  night_service_end: z.string().optional(),
});

// 7. Service Costs
export const serviceCostsSchema = z.object({
  inspection_2w: z.preprocess((val) => Number(val), z.number().min(0)),
  inspection_4w: z.preprocess((val) => Number(val), z.number().min(0)),
  inspection_adjustable: z.boolean().default(false),
  visit_charge_base: z.preprocess((val) => Number(val), z.number().min(0)),
  visit_free_distance: z.preprocess((val) => Number(val), z.number().min(0)),
  visit_extra_km_charge: z.preprocess((val) => Number(val), z.number().min(0)),

  labour_2w_puncture_min: z.preprocess((val) => Number(val), z.number().min(0)),
  labour_2w_puncture_max: z.preprocess((val) => Number(val), z.number().min(0)),
  labour_2w_tubeless_min: z.preprocess((val) => Number(val), z.number().min(0)),
  labour_2w_tubeless_max: z.preprocess((val) => Number(val), z.number().min(0)),
  labour_2w_general_min: z.preprocess((val) => Number(val), z.number().min(0)),
  labour_2w_general_max: z.preprocess((val) => Number(val), z.number().min(0)),

  labour_4w_puncture_min: z.preprocess((val) => Number(val), z.number().min(0)),
  labour_4w_puncture_max: z.preprocess((val) => Number(val), z.number().min(0)),
  labour_4w_brake_min: z.preprocess((val) => Number(val), z.number().min(0)),
  labour_4w_brake_max: z.preprocess((val) => Number(val), z.number().min(0)),
  labour_4w_general_min: z.preprocess((val) => Number(val), z.number().min(0)),
  labour_4w_general_max: z.preprocess((val) => Number(val), z.number().min(0)),

  spare_parts_provided: z.boolean().default(false),
  spare_parts_type: z.enum(["Genuine", "Aftermarket", "Both"]).optional(),
  spare_parts_billed_separately: z.boolean().default(true),

  night_charge_extra: z.preprocess((val) => Number(val), z.number().min(0)),
  cancellation_free: z.boolean().default(true),
  cancellation_fee: z.preprocess((val) => Number(val), z.number().min(0)),
});

// 8. Payment Details
export const paymentSchema = z.object({
  modes: z.object({
    cash: z.boolean().default(false),
    upi: z.boolean().default(false),
    bank_transfer: z.boolean().default(false),
  }),
  upi_id: z.string().optional(),
  bank_account_number: z.string().optional(),
  ifsc_code: z.string().optional(),
  bank_name: z.string().optional(),
});

// 9. App Readiness
export const appReadinessSchema = z.object({
  smartphone_available: z.boolean().default(false),
  android_phone: z.boolean().default(false),
  language: z.enum(["Tamil", "Hindi", "English", "Others"]),
  comfortable_with_app: z.enum(["Yes", "Need Training"]),
});

// 11. Agreement
export const agreementSchema = z.object({
  agreed_to_terms: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the terms and declarations" }),
  }),
});

// Combined Schema for Submission
export const technicianRegistrationSchema = basicInfoBase
  .merge(identitySchema)
  .merge(servicesSchema)
  .merge(roadsideSchema)
  .merge(experienceSchema)
  .merge(workingHoursSchema)
  .merge(serviceCostsSchema)
  .merge(paymentSchema)
  .merge(appReadinessSchema)
  .merge(agreementSchema)
  // Add placeholder for file objects which are handled separately or via state
  .extend({
    // We don't validate File objects here deepy, just layout
    pricing: z.record(z.number()).optional(), // Backward comp fallback
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export type RegisterFormValues = z.infer<typeof technicianRegistrationSchema>;

export const tamilNaduDistricts = [
  "Ariyalur", "Chengalpattu", "Chennai", "Coimbatore", "Cuddalore",
  "Dharmapuri", "Dindigul", "Erode", "Kallakurichi", "Kanchipuram",
  "Kanyakumari", "Karur", "Krishnagiri", "Madurai", "Mayiladuthurai",
  "Nagapattinam", "Namakkal", "Nilgiris", "Perambalur", "Pudukkottai",
  "Ramanathapuram", "Ranipet", "Salem", "Sivaganga", "Tenkasi",
  "Thanjavur", "Theni", "Thoothukudi", "Tiruchirappalli", "Tirunelveli",
  "Tirupathur", "Tiruppur", "Tiruvallur", "Tiruvannamalai", "Tiruvarur",
  "Vellore", "Viluppuram", "Virudhunagar"
];
