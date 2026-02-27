
import { LucideIcon } from "lucide-react";

export type ServiceDetails = {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
  details: string;
  features: string[];
  process: string[];
};

export type VehicleCategory = {
  id: string;
  name: string;
  icon: LucideIcon;
  subtypes?: string[];
};
