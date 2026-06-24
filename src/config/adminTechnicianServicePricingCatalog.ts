export type AdminVehicleTypeId = "bike" | "car" | "commercial" | "ev";

export type AdminPricingFieldDefinition = {
  id: string;
  label: string;
  helper?: string;
};

export type AdminOptionDefinition = {
  id: string;
  label: string;
};

export const ADMIN_VEHICLE_TYPES: AdminOptionDefinition[] = [
  { id: "bike", label: "Bike" },
  { id: "car", label: "Car" },
  { id: "commercial", label: "Commercial" },
  { id: "ev", label: "EV" },
];

export const ADMIN_SERVICE_LABELS: Record<string, string> = {
  towing: "Towing",
  "flat-tire": "Flat Tire",
  battery: "Battery",
  lockout: "Lockout",
  fuel: "Fuel",
  mechanical: "Mechanical",
  winching: "Winching",
  "ev-charging": "EV Charging",
};

export const ADMIN_TOWING_FLEET_TYPES: AdminOptionDefinition[] = [
  { id: "flatbed", label: "Flatbed" },
  { id: "wheel-lift", label: "Wheel Lift" },
  { id: "heavy-duty-wrecker", label: "Heavy Duty Wrecker" },
];

export const ADMIN_TOWING_PRICE_FIELDS: AdminPricingFieldDefinition[] = [
  { id: "base_charge", label: "Base Charge" },
  { id: "free_distance", label: "Free Distance Up To (KM)" },
  { id: "per_km_charge", label: "Cost Per Extra KM" },
];

export const ADMIN_FLAT_TIRE_BASE_FIELDS: AdminPricingFieldDefinition[] = [
  { id: "visit_charge", label: "Visit Charge" },
  { id: "free_distance", label: "Free Distance Up To (KM)" },
  { id: "extra_km_charge", label: "Cost Per Extra KM" },
];

export const ADMIN_FLAT_TIRE_PUNCTURE_FIELDS: AdminPricingFieldDefinition[] = [
  { id: "tube_tyre_price", label: "Tube Tyre Puncture Price" },
  { id: "tubeless_price", label: "Tubeless Puncture Price" },
];

export const ADMIN_FLAT_TIRE_SUBCATEGORIES: Record<
  AdminVehicleTypeId,
  AdminOptionDefinition[]
> = {
  bike: [
    { id: "scooter", label: "Scooter" },
    { id: "commuter-bike", label: "Commuter Bike" },
    { id: "sports-bike", label: "Sports Bike" },
    { id: "premium-bike", label: "Premium Bike" },
  ],
  car: [
    { id: "hatchback", label: "Hatchback" },
    { id: "compact-suv", label: "Compact SUV" },
    { id: "sedan", label: "Sedan" },
    { id: "big-suv", label: "Big SUV" },
  ],
  commercial: [
    { id: "pickup-mini-truck", label: "Pickup / Mini Truck" },
    { id: "tempo-van", label: "Tempo / Van" },
    { id: "light-commercial", label: "Light Commercial" },
    { id: "heavy-truck", label: "Heavy Truck" },
  ],
  ev: [
    { id: "electric-scooter", label: "Electric Scooter" },
    { id: "electric-bike", label: "Electric Bike" },
    { id: "electric-car", label: "Electric Car" },
    { id: "electric-suv", label: "Electric SUV" },
  ],
};

export const ADMIN_STANDARD_SERVICE_FIELDS: Record<
  string,
  AdminPricingFieldDefinition[]
> = {
  battery: [
    { id: "service_charge", label: "Jumpstart / Service Charge" },
    { id: "visit_charge", label: "Visit Charge" },
    { id: "free_distance", label: "Free Distance Up To (KM)" },
    { id: "extra_km_charge", label: "Cost Per Extra KM" },
  ],
  lockout: [
    { id: "service_charge", label: "Unlock / Service Charge" },
    { id: "visit_charge", label: "Visit Charge" },
    { id: "free_distance", label: "Free Distance Up To (KM)" },
    { id: "extra_km_charge", label: "Cost Per Extra KM" },
  ],
  fuel: [
    { id: "delivery_charge", label: "Delivery Charge" },
    { id: "free_distance", label: "Free Distance Up To (KM)" },
    { id: "extra_km_charge", label: "Cost Per Extra KM" },
  ],
  mechanical: [
    { id: "service_charge", label: "Service Charge" },
    { id: "visit_charge", label: "Visit Charge" },
    { id: "free_distance", label: "Free Distance Up To (KM)" },
    { id: "extra_km_charge", label: "Cost Per Extra KM" },
  ],
  winching: [
    { id: "service_charge", label: "Recovery Fee" },
    { id: "visit_charge", label: "Visit Charge" },
    { id: "free_distance", label: "Free Distance Up To (KM)" },
    { id: "extra_km_charge", label: "Cost Per Extra KM" },
  ],
  "ev-charging": [
    { id: "service_charge", label: "Charging Support Fee" },
    { id: "visit_charge", label: "Visit Charge" },
    { id: "free_distance", label: "Free Distance Up To (KM)" },
    { id: "extra_km_charge", label: "Cost Per Extra KM" },
  ],
};

export const ADMIN_DEFAULT_STANDARD_FIELDS: AdminPricingFieldDefinition[] = [
  { id: "service_charge", label: "Service Charge" },
  { id: "visit_charge", label: "Visit Charge" },
  { id: "delivery_charge", label: "Delivery Charge" },
  { id: "labour_min", label: "Labour Min" },
  { id: "labour_max", label: "Labour Max" },
  { id: "free_distance", label: "Free Distance Up To (KM)" },
  { id: "extra_km_charge", label: "Cost Per Extra KM" },
];
