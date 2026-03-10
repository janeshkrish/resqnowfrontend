
export type Technician = {
  id: string;
  name: string;
  avatar?: string;
  rating: number;
  price?: number | null;
  currency?: string;
  distance: string;
  estimatedArrival: string;
  completedJobs: number;
  specialties: string[];
  verified: boolean;
  badges?: string[];
};
