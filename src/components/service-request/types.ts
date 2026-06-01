
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

export type LocationSelection = {
  address: string;
  lat: number;
  lng: number;
  placeId?: string | null;
  formatted_address?: string;
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
  locationPlaceId?: string | null;
  locationPlace?: LocationSelection | null;
  dropLocation?: string;
  dropLat?: number;
  dropLng?: number;
  dropLocationCoordinates?: { lat: number; lng: number };
  dropPlaceId?: string | null;
  dropPlace?: LocationSelection | null;
  routeDistanceKm?: number;
  estimatedDuration?: number;
  pricingBreakdown?: Record<string, any> | null;
  finalEstimatedPrice?: number | null;
  details: string;
  selectedTechnicianId: string | null;
  [key: string]: any; // Catch-all for service-specific fields like batteryLevel, companyName
};
