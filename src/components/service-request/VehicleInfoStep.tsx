import { useEffect, useMemo, useState } from "react";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { ServiceRequestFormData, VehicleType } from "./types";
import { Bike, Car, Check, ChevronRight, Clock3, Home, LayoutGrid, ShieldCheck, Truck } from "lucide-react";
import {
  getBikeBrands,
  getBrandModels,
  getCarBrands,
  getCommercialBrands,
  getEVBrands,
  VehicleBrand,
} from "../../data/indianVehicles";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { Vehicle } from "../MyGarage";
import { getBrandLogoSrc, handleBrandLogoError } from "@/lib/brandLogo";
import { cn } from "@/lib/utils";

const vehicleTypes: VehicleType[] = [
  {
    id: "car",
    name: "Cars",
    icon: Car,
    subtypes: ["SUV", "Hatchback", "Sedan", "MPV", "Other Cars"],
  },
  {
    id: "bike",
    name: "Motorcycles/Bikes",
    icon: Bike,
    subtypes: ["Sport Bike", "Cruiser", "Commuter", "Scooter", "Other Bikes"],
  },
  {
    id: "commercial",
    name: "Commercial Vehicles",
    icon: Truck,
    subtypes: ["Truck", "Van", "Bus", "Construction Vehicle", "Other Commercial"],
  },
  {
    id: "ev",
    name: "Electric Vehicles",
    icon: Car,
    subtypes: ["Electric Cars", "Electric Bikes", "Electric Scooters", "Electric Auto"],
  },
];

interface VehicleInfoStepProps {
  formData: ServiceRequestFormData;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onVehicleTypeSelect: (type: string) => void;
  onVehicleSubtypeSelect: (subtype: string) => void;
  onGarageVehicleSelected?: () => void;
  hideCategorySelection?: boolean;
}

interface ExtendedFormData extends ServiceRequestFormData {
  vehicleBrand?: string;
}

const heroCopy: Record<string, { title: string; description: string }> = {
  car: {
    title: "Tell us about your vehicle",
    description: "This helps us provide the right service & expert.",
  },
  bike: {
    title: "Tell us about your two-wheeler",
    description: "We will route the right roadside expert for your bike instantly.",
  },
  commercial: {
    title: "Tell us about your vehicle",
    description: "Share the vehicle profile so we can dispatch the right heavy-duty technician.",
  },
  ev: {
    title: "Tell us about your EV",
    description: "We will connect you with verified EV support in the fastest possible time.",
  },
};

const getBrandsByVehicleType = (type: string): VehicleBrand[] => {
  if (type === "car") return getCarBrands();
  if (type === "bike") return getBikeBrands();
  if (type === "commercial") return getCommercialBrands();
  if (type === "ev") return getEVBrands();
  return [];
};

const emitInputChange = (
  name: string,
  value: string,
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void,
) => {
  const event = {
    target: { name, value },
  } as React.ChangeEvent<HTMLInputElement>;

  onInputChange(event);
};

const formatBrandName = (brandName: string) =>
  String(brandName || "")
    .replace(/\s+(Cars|Motorcycles|MotoCorp|Motors|Motor|Energy)$/i, "")
    .replace(/\s*\/\s*Yezdi$/i, "")
    .trim();

const toTitle = (value: string) =>
  String(value || "")
    .trim()
    .replace(/[_-]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const getBodyTypeIcon = (vehicleType: string, subtype: string) => {
  const normalizedSubtype = subtype.toLowerCase();

  if (vehicleType === "bike") return Bike;
  if (vehicleType === "commercial") return Truck;
  if (normalizedSubtype.includes("mpv") || normalizedSubtype.includes("van")) return Truck;
  return Car;
};

const VehicleHeroIllustration = () => {
  return (
    <div className="w-[128px] sm:w-[168px] md:w-[190px]">
      <svg viewBox="0 0 240 170" className="h-auto w-full" role="img" aria-label="Tow truck carrying a vehicle">
        <defs>
          <linearGradient id="vehicleHeroSkyline" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#DCE8F6" />
            <stop offset="100%" stopColor="#EFF4FA" />
          </linearGradient>
          <linearGradient id="vehicleHeroTruckCab" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#DDE6F0" />
          </linearGradient>
          <linearGradient id="vehicleHeroRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#FF4D49" />
            <stop offset="100%" stopColor="#E53935" />
          </linearGradient>
        </defs>

        <g opacity="0.95">
          <path d="M14 112h18V74H14zm26 38h14V60H40zm20 0h15V82H60zm22 0h20V46H82zm28 0h16V68h-16zm24 0h18V36h-18zm26 0h14V82h-14zm22 0h16V62h-16z" fill="url(#vehicleHeroSkyline)" />
          <path d="M0 150h240" stroke="#E7EDF5" strokeWidth="3" strokeLinecap="round" />
          <path d="M24 54c0-7 5-12 12-12s12 5 12 12c0 7-12 20-12 20S24 61 24 54z" fill="#FF7A7A" />
          <circle cx="36" cy="54" r="4" fill="#FFFFFF" />
        </g>

        <g transform="translate(40 88)">
          <ellipse cx="82" cy="44" rx="82" ry="10" fill="#E6EDF5" />
          <path d="M26 8h94l8 18H18z" fill="#4B5565" />
          <path d="M124 -4h18c10 0 18 8 18 18v20h-36z" fill="url(#vehicleHeroTruckCab)" stroke="#BBC8D6" strokeWidth="2" />
          <path d="M128 2h16c7 0 13 6 13 13v8h-29z" fill="#D9E3EF" />
          <path d="M6 14 24 -4h6l-12 18z" fill="#8B97A5" />
          <path d="M20 -4 12 26" stroke="#8B97A5" strokeWidth="5" strokeLinecap="round" />
          <circle cx="54" cy="38" r="14" fill="#243244" />
          <circle cx="54" cy="38" r="6" fill="#D7E1EC" />
          <circle cx="136" cy="38" r="14" fill="#243244" />
          <circle cx="136" cy="38" r="6" fill="#D7E1EC" />
          <g transform="translate(76 -12)">
            <path d="M0 18h56l6 14H-4z" fill="url(#vehicleHeroRed)" />
            <path d="M10 4h30c8 0 15 5 18 14H4C5 11 7 8 10 4z" fill="url(#vehicleHeroRed)" />
            <path d="M13 7h13c5 0 8 3 10 8H9c1-4 2-6 4-8z" fill="#EAF0F7" />
            <path d="M30 7h12c4 0 8 3 10 8H28c0-4 1-6 2-8z" fill="#EAF0F7" />
            <circle cx="12" cy="32" r="8" fill="#202938" />
            <circle cx="48" cy="32" r="8" fill="#202938" />
          </g>
        </g>
      </svg>
    </div>
  );
};

const VehicleInfoStep = ({
  formData,
  onInputChange,
  onVehicleTypeSelect,
  onVehicleSubtypeSelect,
  hideCategorySelection = false,
}: VehicleInfoStepProps) => {
  const extendedFormData = formData as ExtendedFormData;
  const { user } = useAuth();

  const [selectedBrand, setSelectedBrand] = useState<string>("");
  const [availableBrands, setAvailableBrands] = useState<VehicleBrand[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [garageVehicles, setGarageVehicles] = useState<Vehicle[]>([]);
  const [showMoreTypes, setShowMoreTypes] = useState(false);

  const currentVehicleType = formData.vehicleType || "car";
  const currentVehicleDefinition = vehicleTypes.find((type) => type.id === currentVehicleType);
  const currentHeroCopy = heroCopy[currentVehicleType] || heroCopy.car;
  const primarySubtypes = currentVehicleDefinition?.subtypes.slice(0, 4) || [];
  const additionalSubtypes = currentVehicleDefinition?.subtypes.slice(4) || [];
  const selectedBrandMeta = availableBrands.find((brand) => brand.id === selectedBrand) || null;
  const selectedBrandLabel = useMemo(
    () => formatBrandName(selectedBrandMeta?.name || extendedFormData.vehicleBrand || ""),
    [extendedFormData.vehicleBrand, selectedBrandMeta],
  );
  const resolvedModelValue = useMemo(() => {
    if (availableModels.includes(formData.vehicleModel)) return formData.vehicleModel;

    const matchedModel = availableModels.find((model) =>
      String(formData.vehicleModel || "").toLowerCase().includes(model.toLowerCase()),
    );

    return matchedModel || "";
  }, [availableModels, formData.vehicleModel]);

  useEffect(() => {
    const nextBrands = getBrandsByVehicleType(currentVehicleType);
    setAvailableBrands(nextBrands);

    const presetBrand = extendedFormData.vehicleBrand || "";
    const matchedBrand = nextBrands.find(
      (brand) =>
        brand.id === presetBrand ||
        brand.name.toLowerCase() === presetBrand.toLowerCase() ||
        formatBrandName(brand.name).toLowerCase() === presetBrand.toLowerCase(),
    );

    if (matchedBrand) {
      setSelectedBrand(matchedBrand.id);
      setAvailableModels(getBrandModels(matchedBrand.id));
    } else {
      setSelectedBrand("");
      setAvailableModels([]);
    }
  }, [currentVehicleType, extendedFormData.vehicleBrand]);

  useEffect(() => {
    if (!user?.id) return;

    apiFetch(`/api/vehicles`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setGarageVehicles(Array.isArray(data) ? data : []))
      .catch((err) => console.error(err));
  }, [user]);

  const handleVehicleTypeChange = (type: string) => {
    onVehicleTypeSelect(type);
    onVehicleSubtypeSelect("");
    emitInputChange("vehicleBrand", "", onInputChange);
    emitInputChange("vehicleModel", "", onInputChange);
    setSelectedBrand("");
    setAvailableModels([]);
    setShowMoreTypes(false);
  };

  const handleBrandChange = (brandId: string) => {
    const matchedBrand = availableBrands.find((brand) => brand.id === brandId);
    setSelectedBrand(brandId);
    setAvailableModels(getBrandModels(brandId));
    emitInputChange("vehicleBrand", matchedBrand?.name || brandId, onInputChange);
    emitInputChange("vehicleModel", "", onInputChange);
  };

  const handleModelChange = (model: string) => {
    emitInputChange("vehicleModel", model, onInputChange);
  };

  const handleGarageSelect = (vehicleId: string) => {
    const vehicle = garageVehicles.find((entry) => String(entry.id) === vehicleId);
    if (!vehicle) return;

    const normalizedVehicleType = hideCategorySelection ? currentVehicleType : vehicle.type;
    const brandsForVehicle = getBrandsByVehicleType(normalizedVehicleType);
    const matchedBrand = brandsForVehicle.find(
      (brand) =>
        brand.name.toLowerCase() === vehicle.make.toLowerCase() ||
        formatBrandName(brand.name).toLowerCase() === formatBrandName(vehicle.make).toLowerCase(),
    );

    onVehicleTypeSelect(normalizedVehicleType);
    emitInputChange("vehicleBrand", matchedBrand?.name || vehicle.make, onInputChange);
    emitInputChange("vehicleModel", vehicle.model, onInputChange);
    onVehicleSubtypeSelect(
      normalizedVehicleType === "car"
        ? "Other Cars"
        : normalizedVehicleType === "bike"
          ? "Other Bikes"
          : normalizedVehicleType === "commercial"
            ? "Other Commercial"
            : "Electric Cars",
    );

    setSelectedBrand(matchedBrand?.id || "");
    setAvailableModels(matchedBrand ? getBrandModels(matchedBrand.id) : []);
    setShowMoreTypes(false);
  };

  return (
    <div className="animate-in fade-in-50 duration-500">
      {!hideCategorySelection && (
        <section className="px-4 pb-2 pt-3 md:px-0 md:pt-0">
          <div className="mb-4 md:mb-5">
            <p className="text-sm font-black tracking-tight text-foreground">Select vehicle category</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Choose the category so we can tailor the rest of the request quickly.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4 md:gap-3">
            {vehicleTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => handleVehicleTypeChange(type.id)}
                className={cn(
                  "rounded-[1rem] border px-4 py-3.5 text-left transition-all duration-200 active:scale-[0.98] md:rounded-[1.2rem] md:p-4",
                  formData.vehicleType === type.id
                    ? "border-primary bg-red-50 shadow-[0_14px_28px_-24px_rgba(229,57,53,0.7)]"
                    : "border-slate-200 bg-white shadow-[0_12px_24px_-28px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-26px_rgba(15,23,42,0.22)]",
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl md:h-11 md:w-11 md:rounded-2xl",
                    formData.vehicleType === type.id ? "bg-white text-primary" : "bg-slate-50 text-slate-700",
                  )}
                >
                  <type.icon className="h-5 w-5" />
                </div>
                <p className="mt-2.5 text-sm font-bold text-foreground">{type.name}</p>
              </button>
            ))}
          </div>
        </section>
      )}

      {currentVehicleType && (
        <>
          <section className="px-4 pb-5 pt-3 md:px-0 md:pb-7">
            <div className="grid grid-cols-[minmax(0,1fr)_128px] items-center gap-2.5 border-b border-slate-100 pb-5 md:grid-cols-[1.15fr_0.85fr] md:gap-3 md:pb-7">
              <div className="min-w-0">
                <h2 className="max-w-[9ch] text-[1.78rem] font-black leading-[1.05] tracking-tight text-[#0B1F3A] md:max-w-[220px] md:text-[2.25rem]">
                  {currentHeroCopy.title}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500 md:mt-3 md:text-[1.05rem] md:leading-[1.8]">
                  {currentHeroCopy.description}
                </p>
              </div>
              <div className="flex justify-end self-end">
                <VehicleHeroIllustration />
              </div>
            </div>
          </section>

          <div className="space-y-5 px-4 pb-28 md:space-y-8 md:px-0 md:pb-4">
            <section className="space-y-2.5 md:space-y-3">
              <div>
                <h3 className="text-[0.95rem] font-black tracking-tight text-[#0B1F3A] md:text-[1.05rem]">Quick select from garage</h3>
              </div>

              <Select onValueChange={handleGarageSelect}>
                <SelectTrigger className="h-16 rounded-[1rem] border border-slate-200 bg-white px-4 text-left shadow-[0_14px_28px_-28px_rgba(15,23,42,0.18)] hover:border-slate-300 focus:ring-2 focus:ring-primary/15 md:h-[88px] md:rounded-[1.2rem] md:px-5">
                  <div className="flex w-full items-center gap-3 md:gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-primary md:h-12 md:w-12 md:rounded-2xl">
                      <Home className="h-[18px] w-[18px] md:h-5 md:w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <SelectValue placeholder="Choose a saved vehicle" />
                    </div>
                  </div>
                </SelectTrigger>
                <SelectContent className="rounded-2xl border-slate-200">
                  {garageVehicles.length > 0 ? (
                    garageVehicles
                      .filter((vehicle) => !hideCategorySelection || vehicle.type === currentVehicleType)
                      .map((vehicle) => (
                        <SelectItem
                          key={vehicle.id}
                          value={String(vehicle.id)}
                          textValue={`${formatBrandName(vehicle.make)} ${vehicle.model}${vehicle.license_plate ? ` - ${vehicle.license_plate}` : ""}`}
                          className="py-3"
                        >
                          {formatBrandName(vehicle.make)} {vehicle.model}
                          {vehicle.license_plate ? ` • ${vehicle.license_plate}` : ""}
                        </SelectItem>
                      ))
                  ) : (
                    <SelectItem value="no-saved-vehicles" disabled className="py-3 text-slate-400">
                      No saved vehicles yet
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </section>

            <section className="space-y-3 md:space-y-4">
              <div>
                <h3 className="text-[0.95rem] font-black tracking-tight text-[#0B1F3A] md:text-[1.05rem]">Body type</h3>
              </div>

              <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                {primarySubtypes.map((subtype) => {
                  const Icon = getBodyTypeIcon(currentVehicleType, subtype);
                  const isSelected = formData.vehicleSubtype === subtype;

                  return (
                    <button
                      key={subtype}
                      type="button"
                      onClick={() => onVehicleSubtypeSelect(subtype)}
                      className={cn(
                        "relative flex min-h-[76px] items-center gap-3 rounded-[1rem] border px-3.5 py-3 text-left transition-all duration-200 active:scale-[0.985] md:min-h-[112px] md:gap-4 md:rounded-[1.2rem] md:px-5 md:py-4",
                        isSelected
                          ? "border-primary bg-[linear-gradient(180deg,rgba(229,57,53,0.06),rgba(229,57,53,0.02))] shadow-[0_18px_30px_-24px_rgba(229,57,53,0.5)]"
                          : "border-slate-200 bg-white shadow-[0_12px_24px_-28px_rgba(15,23,42,0.18)] hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-24px_rgba(15,23,42,0.22)]",
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-full md:h-12 md:w-12",
                          isSelected ? "bg-white text-primary shadow-sm" : "bg-slate-50 text-[#0B1F3A]",
                        )}
                      >
                        <Icon className="h-[18px] w-[18px] md:h-5 md:w-5" />
                      </div>

                      <span className="pr-6 text-[0.95rem] font-semibold leading-tight tracking-tight text-[#0B1F3A] md:pr-7 md:text-[1.02rem] md:font-medium">
                        {toTitle(subtype)}
                      </span>

                      {isSelected && (
                        <span className="absolute right-3.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-primary text-white shadow-[0_18px_28px_-24px_rgba(229,57,53,0.85)] md:right-5 md:h-10 md:w-10">
                          <Check className="h-3.5 w-3.5 md:h-5 md:w-5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {additionalSubtypes.length > 0 && (
                <div className="space-y-2.5 md:space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowMoreTypes((current) => !current)}
                    className="flex min-h-[56px] w-full items-center justify-between rounded-[1rem] border border-slate-200 bg-white px-3.5 py-3 text-left shadow-[0_12px_24px_-28px_rgba(15,23,42,0.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_30px_-24px_rgba(15,23,42,0.22)] active:scale-[0.985] md:min-h-[96px] md:rounded-[1.2rem] md:px-5 md:py-4"
                  >
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-50 text-[#0B1F3A] md:h-12 md:w-12">
                        <LayoutGrid className="h-[18px] w-[18px] md:h-5 md:w-5" />
                      </div>
                      <span className="text-[0.95rem] font-semibold tracking-tight text-[#0B1F3A] md:text-[1.02rem] md:font-medium">
                        More vehicle types
                      </span>
                    </div>
                    <ChevronRight
                      className={cn(
                        "h-4 w-4 text-slate-400 transition-transform duration-200 md:h-5 md:w-5",
                        showMoreTypes && "rotate-90",
                      )}
                    />
                  </button>

                  {showMoreTypes && (
                    <div className="grid grid-cols-2 gap-2.5 md:gap-3">
                      {additionalSubtypes.map((subtype) => {
                        const Icon = getBodyTypeIcon(currentVehicleType, subtype);
                        const isSelected = formData.vehicleSubtype === subtype;

                        return (
                          <button
                            key={subtype}
                            type="button"
                            onClick={() => onVehicleSubtypeSelect(subtype)}
                            className={cn(
                              "flex min-h-[70px] items-center gap-3 rounded-[1rem] border px-3.5 py-3 text-left transition-all duration-200 active:scale-[0.985] md:min-h-[96px] md:rounded-[1.15rem] md:px-4",
                              isSelected
                                ? "border-primary bg-red-50 shadow-[0_18px_30px_-24px_rgba(229,57,53,0.45)]"
                                : "border-slate-200 bg-white shadow-[0_12px_24px_-28px_rgba(15,23,42,0.18)]",
                            )}
                          >
                            <div
                              className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-full md:h-10 md:w-10",
                                isSelected ? "bg-white text-primary" : "bg-slate-50 text-[#0B1F3A]",
                              )}
                            >
                              <Icon className="h-[18px] w-[18px]" />
                            </div>
                            <span className="text-[0.9rem] font-medium leading-tight text-[#0B1F3A]">{toTitle(subtype)}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="space-y-3 md:space-y-4">
              <div>
                <h3 className="text-[0.95rem] font-black tracking-tight text-[#0B1F3A] md:text-[1.05rem]">Vehicle make &amp; model</h3>
              </div>

              <div className="space-y-3">
                <div>
                  <Label className="mb-1.5 block text-[0.82rem] font-medium text-slate-500 md:mb-2 md:text-sm">Make</Label>
                  <Select value={selectedBrand} onValueChange={handleBrandChange}>
                    <SelectTrigger className="h-16 rounded-[1rem] border border-slate-200 bg-white px-4 shadow-[0_14px_28px_-28px_rgba(15,23,42,0.18)] hover:border-slate-300 focus:ring-2 focus:ring-primary/15 md:h-[74px] md:rounded-[1.2rem] md:px-5">
                      <span className="sr-only">
                        <SelectValue placeholder="Select make" />
                      </span>
                      <div className="flex w-full items-center gap-3 md:gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(229,57,53,0.14)] md:h-11 md:w-11 md:rounded-2xl">
                          {selectedBrandMeta ? (
                            <img
                              src={getBrandLogoSrc(selectedBrandMeta.logo)}
                              alt={selectedBrandMeta.name}
                              className="h-6 w-6 object-contain md:h-7 md:w-7"
                              onError={handleBrandLogoError}
                            />
                          ) : (
                            <Car className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                          {selectedBrandLabel ? (
                            <span className="block truncate text-sm font-medium text-[#0B1F3A] md:text-base">
                              {selectedBrandLabel}
                            </span>
                          ) : (
                            <span className="block truncate text-sm text-slate-400 md:text-base">
                              Select make
                            </span>
                          )}
                        </div>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200">
                      {availableBrands.map((brand) => (
                        <SelectItem key={brand.id} value={brand.id} textValue={formatBrandName(brand.name)} className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
                              <img
                                src={getBrandLogoSrc(brand.logo)}
                                alt={brand.name}
                                className="h-5 w-5 object-contain"
                                onError={handleBrandLogoError}
                              />
                            </div>
                            <span>{formatBrandName(brand.name)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="mb-1.5 block text-[0.82rem] font-medium text-slate-500 md:mb-2 md:text-sm">Model</Label>
                  <Select value={resolvedModelValue} onValueChange={handleModelChange} disabled={!selectedBrand}>
                    <SelectTrigger className="h-16 rounded-[1rem] border border-slate-200 bg-white px-4 shadow-[0_14px_28px_-28px_rgba(15,23,42,0.18)] hover:border-slate-300 focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-70 md:h-[74px] md:rounded-[1.2rem] md:px-5">
                      <div className="flex w-full items-center justify-between gap-4 text-left">
                        <div className="min-w-0 flex-1">
                          <SelectValue placeholder={selectedBrand ? "Select model" : "Choose make first"} />
                        </div>
                      </div>
                    </SelectTrigger>
                    <SelectContent className="rounded-2xl border-slate-200">
                      {availableModels.map((model) => (
                        <SelectItem key={model} value={model} className="py-3">
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="rounded-[1.15rem] bg-white px-3.5 py-3.5 shadow-[0_24px_44px_-36px_rgba(15,23,42,0.3)] md:rounded-[1.45rem] md:px-4 md:py-4">
              <div className="grid grid-cols-2 gap-0">
                <div className="flex items-center gap-2.5 pr-3 md:gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 md:h-12 md:w-12">
                    <Clock3 className="h-[18px] w-[18px] md:h-5 md:w-5" />
                  </div>
                  <div>
                    <p className="text-[0.72rem] text-slate-500 md:text-[0.9rem]">Fastest arrival</p>
                    <p className="text-[0.98rem] font-black text-emerald-600 md:text-[1.1rem]">14 - 19 mins</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 border-l border-slate-100 pl-3 md:gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600 md:h-12 md:w-12">
                    <ShieldCheck className="h-[18px] w-[18px] md:h-5 md:w-5" />
                  </div>
                  <div>
                    <p className="text-[0.72rem] text-slate-500 md:text-[0.9rem]">Verified technicians</p>
                    <p className="text-[0.98rem] font-black text-red-600 md:text-[1.1rem]">100% Safe</p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
};

export default VehicleInfoStep;
