
import type { ComponentType } from "react";
import type { LucideIcon, LucideProps } from "lucide-react";

export type ServiceDetails = {
  id: string;
  name: string;
  icon: ComponentType<LucideProps>;
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
