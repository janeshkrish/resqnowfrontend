export type VehicleFlowType = "car" | "bike" | "commercial" | "ev";
type ServicePriceMatrix = Record<string, Partial<Record<VehicleFlowType, number>>>;

export type ServiceCatalogItem = {
  id: string;
  name: string;
  description: string;
  prices: Partial<Record<VehicleFlowType, string>>;
};

export const SERVICE_CATALOG: ServiceCatalogItem[] = [
  {
    id: "towing",
    name: "Towing Services",
    description: "Vehicle breakdown assistance with fast roadside support.",
    prices: { car: "INR 599 - INR 1499", bike: "INR 399 - INR 899", commercial: "INR 2499 - INR 5999", ev: "INR 699 - INR 1699" }
  },
  {
    id: "flat-tire",
    name: "Flat Tire Repair",
    description: "On-site puncture and tire support.",
    prices: { car: "INR 349 - INR 699", bike: "INR 99 - INR 199", commercial: "INR 999 - INR 1999", ev: "INR 299 - INR 799" }
  },
  {
    id: "battery",
    name: "Battery Jumpstart",
    description: "Quick battery jumpstart and battery health support.",
    prices: { car: "INR 399 - INR 899", bike: "INR 199 - INR 499", commercial: "INR 899 - INR 1599", ev: "INR 499 - INR 1299" }
  },
  {
    id: "mechanical",
    name: "Mechanical Issues",
    description: "Roadside diagnostics and mechanical issue handling.",
    prices: { car: "INR 499 - INR 1299", bike: "INR 499 - INR 1499", commercial: "INR 1499 - INR 2999", ev: "INR 399 - INR 1499" }
  },
  {
    id: "fuel",
    name: "Fuel Delivery",
    description: "Emergency fuel delivery to your location.",
    prices: { car: "INR 299 - INR 599", bike: "INR 99 + Fuel Cost", commercial: "INR 499 + Fuel Cost", ev: "INR 299 - INR 899" }
  },
  {
    id: "lockout",
    name: "Lockout Assistance",
    description: "Safe lockout support to regain vehicle access.",
    prices: { car: "INR 399 - INR 799", bike: "INR 199 - INR 399", commercial: "INR 699 - INR 1499", ev: "INR 399 - INR 999" }
  },
  {
    id: "winching",
    name: "Winching Services",
    description: "Vehicle recovery from difficult terrain.",
    prices: { car: "INR 599 - INR 1499", bike: "INR 399 - INR 899", commercial: "INR 1999 - INR 4999", ev: "INR 699 - INR 1699" }
  },
  {
    id: "ev-charging",
    name: "EV Portable Charger",
    description: "Emergency portable charging assistance for EVs.",
    prices: { car: "INR 499 - INR 1199", bike: "INR 299 - INR 799", commercial: "INR 899 - INR 1999", ev: "INR 299 - INR 899" }
  },
  {
    id: "other",
    name: "Other Services",
    description: "Custom roadside assistance based on your issue.",
    prices: { car: "Varies", bike: "Varies", commercial: "Varies", ev: "Varies" }
  }
];

const FALLBACK_SERVICE: ServiceCatalogItem = SERVICE_CATALOG.find((s) => s.id === "other")!;

export function getServiceCatalogItem(serviceId?: string | null): ServiceCatalogItem {
  if (!serviceId) return FALLBACK_SERVICE;
  return SERVICE_CATALOG.find((s) => s.id === serviceId) || FALLBACK_SERVICE;
}

export function getServicePriceForVehicle(
  serviceId: string | undefined,
  vehicleType: VehicleFlowType,
  serviceBasePrices?: ServicePriceMatrix | null,
  currency: string = "INR"
): string {
  if (serviceBasePrices && typeof serviceBasePrices === "object") {
    const key = String(serviceId || "other").toLowerCase();
    const matrixAmount =
      Number(serviceBasePrices?.[key]?.[vehicleType]) ||
      Number(serviceBasePrices?.other?.[vehicleType]);
    if (Number.isFinite(matrixAmount) && matrixAmount > 0) {
      return `${currency} ${Math.round(matrixAmount)}`;
    }
  }

  const service = getServiceCatalogItem(serviceId);
  return service.prices[vehicleType] || service.prices.car || "Varies";
}
