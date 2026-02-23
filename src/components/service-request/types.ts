
export type ServiceType = {
  name: string;
  description: string;
  estimatedPrice: string;
};

export type VehicleType = {
  id: string;
  name: string;
  icon: any;
  subtypes: string[];
};

export type ServiceRequestFormData = {
  name: string;
  phone: string;
  email?: string;
  vehicleType: string;
  vehicleSubtype: string;
  vehicleModel: string;
  location: string;
  locationLat?: number;
  locationLng?: number;
  locationCoordinates?: { lat: number; lng: number };
  details: string;
  selectedTechnicianId: string | null;
  [key: string]: any; // Catch-all for service-specific fields like batteryLevel, companyName
};
