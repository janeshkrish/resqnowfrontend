
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import LocationDetector from "@/components/technician/LocationDetector";
import { technicianAdminService } from "@/services/technicianAdminService";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { apiUrl } from "@/lib/api";
import {
    Loader2, Check, Car, User, Wrench, CreditCard,
    Upload, Clock, FileText, Fuel, Key, AlertTriangle, Truck, Zap,
    CheckCircle2, Briefcase, MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    normalizePricingConfigForApi,
    normalizeSpecialtiesForApi,
    normalizeVehicleTypesForApi,
} from "@/config/technicianNormalization";

// --- Zod Schema (Mirrored from TechnicianSignupWizard) ---
const technicianSchema = z.object({
    // Step 0: Personal
    proprietor_name: z.string().min(2, "Technician Name is required"),
    name: z.string().min(2, "Shop Name is required"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    // confirmPassword intentionally collected but admin might not care to type twice, but schema requires it for parity
    confirmPassword: z.string(),
    phone: z.string().min(10, "Phone number must be at least 10 digits"),
    alternate_phone: z.string().optional(),
    location: z.object({
        address: z.string().min(5, "Shop Address is required"),
        latitude: z.number().nullable().refine(val => val !== null, "GPS Location is required"),
        longitude: z.number().nullable(),
        state: z.string().min(2, "State is required"),
        locality: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        pincode: z.string().optional(),
    }),
    serviceAreaRange: z.coerce.number().min(1, "Range must be at least 1 km"),
    experience: z.coerce.number().min(0, "Experience cannot be negative"),

    // Step 1: Services
    specialties: z.array(z.string()).min(1, "Select at least one service"),
    vehicle_types: z.any().refine((data) => data && Object.values(data).some(val => val === true), {
        message: "Select at least one vehicle type"
    }),

    // Step 2: Verification
    aadhaar_number: z.string().min(12, "Aadhaar must be 12 digits").max(12),
    gst_number: z.string().optional(),
    documents: z.object({
        garage_front: z.string().optional(),
        profile_photo: z.string().optional(),
        tools_photo: z.string().optional(),
        facilities_photo: z.string().optional(),
    }),

    // Step 3: Operations
    working_hours: z.object({
        opening_time: z.string().min(1, "Opening time is required"),
        closing_time: z.string().min(1, "Closing time is required"),
        weekly_off: z.string(),
        is_24x7: z.boolean(),
    }),
    app_readiness: z.object({
        has_smartphone: z.boolean().refine(val => val === true, "Smartphone is required"),
        preferred_language: z.string(),
    }),

    // Step 4: Pricing
    pricing_config: z.array(z.any()),

    // Step 5: Banking / Extras (Skipping banking strictness for admin entry usually, but schema has it optional in provided code? 
    // Actually provided schema had payment_details but I don't see it used in onSubmit payload?
    // Let's check original. It had: payment_details: z.object(...) in schema, but payload constructed for register service didn't seem to include it explicitly in my view, 
    // but spread ...data includes it.
    payment_details: z.object({
        modes: z.record(z.boolean()),
        upi_id: z.string().optional(),
        bank_account_number: z.string().optional(),
        ifsc_code: z.string().optional(),
        bank_name: z.string().optional(),
    }),

    trade_license_number: z.string().optional(),

    // Step 6: Consent
    consent: z.object({
        agreed: z.boolean().refine(val => val === true, "You must agree to the terms"),
    }),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});

type TechnicianFormValues = z.infer<typeof technicianSchema>;

const STEPS = [
    { id: 0, title: "Personal Info", icon: User },
    { id: 1, title: "Services", icon: Wrench },
    { id: 2, title: "Verification", icon: FileText },
    { id: 3, title: "Operations", icon: Clock },
    { id: 4, title: "Pricing", icon: CreditCard },
    { id: 5, title: "Banking", icon: Briefcase },
    { id: 6, title: "Finish", icon: CheckCircle2 },
];

const ALL_SERVICES = [
    { id: "Tyre / Puncture Repair", label: "Flat Tire Repair", icon: AlertTriangle, desc: "Tire change & repair" },
    { id: "Tubeless Tyre Repair", label: "Tubeless Repair", icon: AlertTriangle, desc: "Plug/Patch repair" },
    { id: "Battery Jump Start", label: "Battery Jumpstart", icon: Zap, desc: "Dead battery assistance" },
    { id: "Battery Replacement", label: "Battery Replace", icon: Zap, desc: "New battery install" },
    { id: "Towing Assistance", label: "Towing", icon: Truck, desc: "Vehicle towing service" },
    { id: "Fuel Delivery", label: "Fuel Delivery", icon: Fuel, desc: "Emergency fuel service" },
    { id: "General Servicing", label: "Mechanical Issues", icon: Wrench, desc: "General repairs & diagnostics" },
    { id: "Brake Service", label: "Brake Service", icon: Wrench, desc: "Brake pads & checks" },
    { id: "Electrical Repair", label: "Electrical", icon: Zap, desc: "Wiring & Fuses" },
    { id: "Engine Repair", label: "Engine Repair", icon: Wrench, desc: "Engine diagnostics" },
    { id: "Accident Repair", label: "Winching", icon: AlertTriangle, desc: "Vehicle recovery" },
    { id: "Lockout Assistance", label: "Lockout Assistance", icon: Key, desc: "Vehicle lockout help" },
    { id: "EV Assistance", label: "EV Charger", icon: Zap, desc: "Electric vehicle charging" },
];

const VEHICLES = [
    { id: "Two-Wheeler", label: "Bike", icon: Car, desc: "Motorcycles & Scooters" },
    { id: "Four-Wheeler", label: "Car", icon: Car, desc: "Sedans, SUVs, Hatchbacks" },
    { id: "Commercial", label: "Commercial Vehicle", icon: Truck, desc: "Trucks, Buses, Vans" },
    { id: "EV", label: "EV", icon: Zap, desc: "Electric Vehicles" },
];

// --- Components ---

const ImageUpload = ({ value, onChange, label }: { value?: string; onChange: (url: string) => void; label: string }) => {
    const [uploading, setUploading] = useState(false);
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        try {
            const res = await fetch(apiUrl("/api/upload"), { method: "POST", body: formData });
            if (!res.ok) throw new Error("Upload failed");
            const data = await res.json();
            onChange(data.url);
            toast.success("Image uploaded successfully");
        } catch (err) {
            console.error(err);
            toast.error("Failed to upload image");
        } finally {
            setUploading(false);
        }
    };
    return (
        <div className="border-2 border-dashed border-border rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-muted transition-colors relative group">
            {value ? (
                <div className="relative w-full aspect-video rounded-lg overflow-hidden">
                    <img src={value} alt="Uploaded" className="object-cover w-full h-full" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="secondary" size="sm" onClick={() => onChange("")} type="button">Remove</Button>
                    </div>
                </div>
            ) : (
                <>
                    <Upload className="w-8 h-8 text-slate-400 mb-2" />
                    <div className="font-medium text-muted-foreground text-sm">{label}</div>
                    <p className="text-xs text-slate-400 mt-1">Click to upload</p>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} disabled={uploading} />
                    {uploading && <div className="absolute inset-0 bg-card dark:bg-slate-900/80 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>}
                </>
            )}
        </div>
    );
};

const ServiceConfigCard = ({ serviceName, index, register, watch, setValue }: any) => {
    const prefix = `pricing_config.${index}`;
    const getFieldName = (field: string) => `${prefix}.${field}`;
    const renderSectionHeader = (title: string) => <div className="font-semibold text-xs mt-3 mb-2 text-muted-foreground/80 uppercase tracking-wider">{title}</div>;

    return (
        <Card className="mb-6 border-l-4 border-l-red-500 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted py-3 border-b flex flex-row items-center gap-3">
                <Wrench className="w-5 h-5 text-red-500" />
                <CardTitle className="text-base font-bold text-foreground">{serviceName}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
                <input type="hidden" {...register(getFieldName("service_name"))} value={serviceName} />

                {/* === SERVICE 1: TYRE / PUNCTURE REPAIR === */}
                {serviceName === "Tyre / Puncture Repair" && (
                    <>
                        <div>
                            {renderSectionHeader("What work will be done (Select all that apply)")}
                            <div className="flex flex-wrap gap-3">
                                {["Tube puncture repair", "Valve replacement", "Wheel removal & refit"].map(opt => {
                                    const currentList = watch(getFieldName("work_included")) || [];
                                    const checked = currentList.includes(opt);
                                    return (
                                        <div key={opt} className="flex items-center space-x-2">
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={(c) => {
                                                    const willAdd = !!c;
                                                    const has = currentList.includes(opt);
                                                    if (willAdd && !has) {
                                                        setValue(getFieldName("work_included"), [...currentList, opt]);
                                                    } else if (!willAdd && has) {
                                                        setValue(getFieldName("work_included"), currentList.filter((x: string) => x !== opt));
                                                    }
                                                }}
                                            />
                                            <label className="text-sm text-muted-foreground">{opt}</label>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-muted p-3 rounded">
                                <div className="text-sm font-semibold mb-2">Two-Wheeler Service Charge</div>
                                <div className="flex gap-2">
                                    <Input type="number" placeholder="Min ₹" {...register(getFieldName("price_2w_min"))} className="bg-card dark:bg-slate-900" />
                                    <Input type="number" placeholder="Max ₹" {...register(getFieldName("price_2w_max"))} className="bg-card dark:bg-slate-900" />
                                </div>
                            </div>
                            <div className="bg-muted p-3 rounded">
                                <div className="text-sm font-semibold mb-2">Four-Wheeler Service Charge</div>
                                <div className="flex gap-2">
                                    <Input type="number" placeholder="Min ₹" {...register(getFieldName("price_4w_min"))} className="bg-card dark:bg-slate-900" />
                                    <Input type="number" placeholder="Max ₹" {...register(getFieldName("price_4w_max"))} className="bg-card dark:bg-slate-900" />
                                </div>
                            </div>
                        </div>
                        <div>
                            {renderSectionHeader("Visit & Inspection Charges")}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="space-y-1"><label className="text-xs">Base Visit (₹)</label><Input type="number" {...register(getFieldName("visit_charge"))} /></div>
                                <div className="space-y-1"><label className="text-xs">Free Dist (km)</label><Input type="number" {...register(getFieldName("free_distance"))} /></div>
                                <div className="space-y-1"><label className="text-xs">Extra/km (₹)</label><Input type="number" {...register(getFieldName("extra_km_charge"))} /></div>
                                <div className="space-y-1"><label className="text-xs">Inspection (₹)</label><Input type="number" {...register(getFieldName("inspection_charge"))} /></div>
                            </div>
                            <div className="mt-2 flex items-center gap-2">
                                <label className="text-sm">Night Service Extra (₹ or %):</label>
                                <Input className="w-24 h-8" {...register(getFieldName("night_charge"))} placeholder="100" />
                            </div>
                        </div>
                    </>
                )}

                {/* === SERVICE 2: TUBELESS TYRE REPAIR === */}
                {serviceName === "Tubeless Tyre Repair" && (
                    <>
                        <div>
                            {renderSectionHeader("Work Included")}
                            <div className="flex gap-3">
                                {["Plug repair", "Patch repair", "Air refill"].map(opt => (
                                    <div key={opt} className="flex items-center space-x-2">
                                        <Checkbox onCheckedChange={(c) => {
                                            const current = watch(getFieldName("work_included")) || [];
                                            setValue(getFieldName("work_included"), c ? [...current, opt] : current.filter((x: string) => x !== opt));
                                        }} />
                                        <label className="text-sm">{opt}</label>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-medium">Per Puncture Charge (₹)</label><Input type="number" {...register(getFieldName("per_puncture_charge"))} /></div>
                            <div><label className="text-sm font-medium">Emergency/Night Charge</label><Input {...register(getFieldName("night_charge"))} placeholder="₹ or %" /></div>
                        </div>
                    </>
                )}

                {/* === SERVICE 3: BATTERY JUMP START === */}
                {serviceName === "Battery Jump Start" && (
                    <>
                        <div>
                            {renderSectionHeader("Work Included")}
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center space-x-2"><Checkbox checked disabled /><label className="text-sm">Battery voltage check</label></div>
                                <div className="flex items-center space-x-2"><Checkbox checked disabled /><label className="text-sm">Jump start using cables</label></div>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1"><label className="text-xs font-semibold">Service (Fixed ₹)</label><Input type="number" {...register(getFieldName("service_charge"))} /></div>
                            <div className="space-y-1"><label className="text-xs font-semibold">Visit Charge (₹)</label><Input type="number" {...register(getFieldName("visit_charge"))} /></div>
                            <div className="space-y-1"><label className="text-xs font-semibold">Night Charge (₹)</label><Input type="number" {...register(getFieldName("night_charge"))} /></div>
                        </div>
                    </>
                )}

                {/* === SERVICE 4: BATTERY REPLACEMENT === */}
                {serviceName === "Battery Replacement" && (
                    <>
                        <div>{renderSectionHeader("Work Included")}<p className="text-sm text-muted-foreground">Testing, Removal, Installation</p></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-medium">Labour Charge (₹)</label><Input type="number" {...register(getFieldName("labour_charge"))} /></div>
                            <div className="bg-yellow-50 p-2 rounded border border-yellow-100 flex items-center justify-center text-xs text-yellow-800 font-medium">
                                Battery Cost Charged Separately (Mandatory)
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                            {(() => {
                                const cur = watch(getFieldName("disposal_included"));
                                return (
                                    <Checkbox checked={!!cur} onCheckedChange={(c) => { if (cur !== c) setValue(getFieldName("disposal_included"), c); }} />
                                );
                            })()}
                            <label className="text-sm">Disposal of old battery included?</label>
                        </div>
                    </>
                )}

                {/* === SERVICE 5: TOWING ASSISTANCE === */}
                {serviceName === "Towing Assistance" && (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="space-y-1"><label className="text-xs">Base Charge (₹)</label><Input type="number" {...register(getFieldName("base_charge"))} /></div>
                            <div className="space-y-1"><label className="text-xs">Free Dist (km)</label><Input type="number" {...register(getFieldName("free_distance"))} /></div>
                            <div className="space-y-1"><label className="text-xs">Extra/km (₹)</label><Input type="number" {...register(getFieldName("per_km_charge"))} /></div>
                            <div className="space-y-1"><label className="text-xs">Night Extra (₹)</label><Input type="number" {...register(getFieldName("night_charge"))} /></div>
                        </div>
                        <div className="mt-3">
                            <label className="text-sm font-bold">Vehicle Type Pricing For:</label>
                            <Select onValueChange={(v) => setValue(getFieldName("vehicle_type_pricing"), v)}>
                                <SelectTrigger className="mt-1"><SelectValue placeholder="Select Vehicle Class" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="2w">Two Wheeler</SelectItem>
                                    <SelectItem value="4w">Four Wheeler</SelectItem>
                                    <SelectItem value="commercial">Commercial</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </>
                )}

                {/* === SERVICE 6: FUEL DELIVERY === */}
                {serviceName === "Fuel Delivery" && (
                    <>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-medium">Delivery Charge (₹)</label><Input type="number" {...register(getFieldName("delivery_charge"))} /></div>
                            <div className="bg-yellow-50 p-2 rounded border border-yellow-100 flex items-center justify-center text-xs text-yellow-800 font-medium">
                                Fuel Cost Charged Actuals (Mandatory)
                            </div>
                        </div>
                        <div className="mt-2">
                            <label className="text-sm font-medium">Fuel Types Supported:</label>
                            <div className="flex gap-4 mt-1">
                                <div className="flex items-center space-x-2">{(() => { const cur = watch(getFieldName("fuel_petrol")); return <Checkbox checked={!!cur} onCheckedChange={(c) => { if (cur !== c) setValue(getFieldName("fuel_petrol"), c); }} /> })()}<label className="text-sm">Petrol</label></div>
                                <div className="flex items-center space-x-2">{(() => { const cur = watch(getFieldName("fuel_diesel")); return <Checkbox checked={!!cur} onCheckedChange={(c) => { if (cur !== c) setValue(getFieldName("fuel_diesel"), c); }} /> })()}<label className="text-sm">Diesel</label></div>
                            </div>
                        </div>
                    </>
                )}

                {/* === SERVICE 7: GENERAL SERVICING === */}
                {serviceName === "General Servicing" && (
                    <>
                        <div>{renderSectionHeader("Includes")}<p className="text-sm text-muted-foreground">Oil check, Chain lubrication, Basic inspection</p></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium">Labour Range (₹)</label>
                                <div className="flex gap-2">
                                    <Input type="number" placeholder="Min" {...register(getFieldName("labour_min"))} />
                                    <Input type="number" placeholder="Max" {...register(getFieldName("labour_max"))} />
                                </div>
                            </div>
                            <div className="bg-muted p-2 rounded flex items-center justify-center text-xs text-muted-foreground">
                                Spare Parts Charged Separately
                            </div>
                        </div>
                    </>
                )}

                {/* === SERVICE 8: BRAKE SERVICE === */}
                {serviceName === "Brake Service" && (
                    <>
                        <div>{renderSectionHeader("Includes")}<p className="text-sm text-muted-foreground">Brake inspection, Pad replacement</p></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-medium">Labour Charge Range (₹)</label><div className="flex gap-2"><Input placeholder="Min" {...register(getFieldName("labour_min"))} /><Input placeholder="Max" {...register(getFieldName("labour_max"))} /></div></div>
                            <div className="bg-muted p-2 rounded flex items-center justify-center text-xs text-muted-foreground">
                                Spare Parts Charged Separately
                            </div>
                        </div>
                    </>
                )}

                {/* === SERVICE 9: ELECTRICAL REPAIR === */}
                {serviceName === "Electrical Repair" && (
                    <>
                        <div>{renderSectionHeader("Includes")}<p className="text-sm text-muted-foreground">Wiring repair, Fuse replacement</p></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-medium">Inspection Charge (₹)</label><Input type="number" {...register(getFieldName("inspection_charge"))} /></div>
                            <div><label className="text-sm font-medium">Labour Range (₹)</label><div className="flex gap-2"><Input placeholder="Min" {...register(getFieldName("labour_min"))} /><Input placeholder="Max" {...register(getFieldName("labour_max"))} /></div></div>
                        </div>
                    </>
                )}

                {/* === SERVICE 10: ENGINE REPAIR === */}
                {serviceName === "Engine Repair" && (
                    <>
                        <div>{renderSectionHeader("Includes")}<p className="text-sm text-muted-foreground">Engine diagnostics</p></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-medium">Inspection Charge (₹)</label><Input type="number" {...register(getFieldName("inspection_charge"))} /></div>
                            <div><label className="text-sm font-medium">Labour Range (₹)</label><div className="flex gap-2"><Input placeholder="Min" {...register(getFieldName("labour_min"))} /><Input placeholder="Max" {...register(getFieldName("labour_max"))} /></div></div>
                        </div>
                        <div className="mt-2 text-xs bg-red-50 text-red-600 p-2 rounded border border-red-100">Major repair charged after approval (Mandatory)</div>
                    </>
                )}

                {/* === SERVICE 11: ACCIDENT REPAIR === */}
                {serviceName === "Accident Repair" && (
                    <>
                        <div>{renderSectionHeader("Includes")}<p className="text-sm text-muted-foreground">Damage inspection</p></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-medium">Inspection Charge (₹)</label><Input type="number" {...register(getFieldName("inspection_charge"))} /></div>
                            <div><label className="text-sm font-medium">Labour Charge (₹)</label><Input type="number" {...register(getFieldName("labour_charge"))} /></div>
                        </div>
                        <div className="mt-2 text-xs text-muted-foreground/80">Final cost after inspection only</div>
                    </>
                )}

                {/* === SERVICE 12: EV ASSISTANCE === */}
                {serviceName === "EV Assistance" && (
                    <>
                        <div>{renderSectionHeader("Includes")}<p className="text-sm text-muted-foreground">EV diagnostics, Charging assistance</p></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-medium">Service Charge (₹)</label><Input type="number" {...register(getFieldName("service_charge"))} /></div>
                            <div><label className="text-sm font-medium">Vehicle Brand (Optional)</label><Input {...register(getFieldName("brand_supported"))} placeholder="e.g. Ather, Ola" /></div>
                        </div>
                    </>
                )}

                {/* === LOCKOUT ASSISTANCE (Default Fallback) === */}
                {serviceName === "Lockout Assistance" && (
                    <>
                        <div>{renderSectionHeader("Includes")}<p className="text-sm text-muted-foreground">Safe vehicle entry</p></div>
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-sm font-medium">Service Charge (₹)</label><Input type="number" {...register(getFieldName("service_charge"))} /></div>
                            <div><label className="text-sm font-medium">Night/Emergency (₹)</label><Input type="number" {...register(getFieldName("night_charge"))} /></div>
                        </div>
                    </>
                )}

            </CardContent>
        </Card>
    );
};


const AdminAddTechnicianWizard = () => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<TechnicianFormValues>({
        resolver: zodResolver(technicianSchema),
        defaultValues: {
            name: "", proprietor_name: "", phone: "", alternate_phone: "", email: "", password: "Password@123", confirmPassword: "Password@123",
            location: { latitude: null, longitude: null, address: "", locality: "", city: "", district: "", state: "", pincode: "" },
            serviceAreaRange: 10, experience: 0,
            aadhaar_number: "", gst_number: "",
            vehicle_types: {},
            specialties: [],
            pricing_config: [],
            working_hours: { opening_time: "09:00", closing_time: "20:00", weekly_off: "Sunday", is_24x7: false },
            payment_details: { modes: { cash: true }, upi_id: "" },
            app_readiness: { has_smartphone: true, preferred_language: "English" }, // defaulted for admin ease
            documents: { garage_front: "", profile_photo: "", tools_photo: "", facilities_photo: "" },
            consent: { agreed: true } // defaulted for admin
        }
    });

    const { control, trigger, formState: { errors }, watch, setValue, register } = form;
    const selectedServices = watch("specialties");

    const handleNext = async () => {
        let fieldsToValidate: any[] = [];
        if (currentStep === 0) fieldsToValidate = ["proprietor_name", "name", "email", "password", "confirmPassword", "phone", "location", "serviceAreaRange", "experience"];
        if (currentStep === 1) fieldsToValidate = ["specialties", "vehicle_types"];
        if (currentStep === 2) fieldsToValidate = ["aadhaar_number", "documents"];
        if (currentStep === 3) fieldsToValidate = ["working_hours", "app_readiness"];
        // Step 4 is pricing (dynamic), Step 5 is banking
        if (currentStep === 6) fieldsToValidate = ["consent"];

        const isValid = await trigger(fieldsToValidate);
        if (isValid) {
            if (currentStep < STEPS.length - 1) {
                setCurrentStep(prev => prev + 1);
            } else {
                onSubmit(form.getValues());
            }
        } else {
            console.log("Errors", errors);
            toast.error("Please fix validation errors");
        }
    };

    const onSubmit = async (data: any) => {
        setIsSubmitting(true);
        try {
            // Admin creation logic
            const normalizedSpecialties = normalizeSpecialtiesForApi(data.specialties);
            const normalizedVehicleTypes = normalizeVehicleTypesForApi(data.vehicle_types);
            const normalizedPricingConfig = normalizePricingConfigForApi(data.pricing_config);
            const payload = {
                ...data,
                specialties: normalizedSpecialties,
                vehicle_types: normalizedVehicleTypes,
                address: data.location.address,
                latitude: data.location.latitude,
                longitude: data.location.longitude,
                region: data.location.city,
                locality: data.location.locality,
                district: data.location.district,
                state: data.location.state,
                service_type: normalizedSpecialties[0] || "other",
                service_costs: normalizedPricingConfig,
                pricing: normalizedPricingConfig,
                whatsapp_number: data.whatsapp_number || data.phone,
                status: 'pending'
            };

            await technicianAdminService.createTechnician(payload);
            toast.success("Technician created successfully!");
            navigate("/admin/technicians");
        } catch (error: any) {
            toast.error(error.message || "Failed to create");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLocationDetected = (loc: any) => setValue("location", loc);

    const progressPercentage = ((currentStep + 0.5) / STEPS.length) * 100;

    return (
        <div className="flex h-[calc(100vh-theme(spacing.24))] w-full bg-card dark:bg-slate-900 rounded-lg shadow-sm border overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-muted border-r flex flex-row relative">
                {/* Dynamic Progress Bar - Red */}
                <div className="w-1.5 h-full bg-border absolute left-0 top-0 bottom-0 z-20">
                    <div
                        className="w-full bg-red-500 transition-all duration-500 ease-in-out"
                        style={{ height: `${Math.max(5, progressPercentage)}%` }}
                    />
                </div>

                <div className="flex-1 p-6 pl-8 flex flex-col overflow-y-auto">
                    <div className="mb-8">
                        <h2 className="text-lg font-bold text-foreground">Onboarding</h2>
                        <p className="text-xs text-muted-foreground/80">Add a new technician</p>
                    </div>

                    <div className="space-y-1 relative">
                        <div className="absolute left-3.5 top-2 bottom-4 w-0.5 bg-border -z-10" />
                        {STEPS.map((step, idx) => {
                            const isActive = currentStep === idx;
                            const isCompleted = currentStep > idx;
                            const Icon = step.icon;
                            return (
                                <div key={idx} className="flex items-center gap-3 py-3 cursor-pointer" onClick={() => setCurrentStep(idx)}>
                                    <div className={cn(
                                        "w-7 h-7 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-colors z-10",
                                        isActive ? "border-blue-600 bg-blue-600 text-white" :
                                            isCompleted ? "border-green-500 bg-green-500 text-white" :
                                                "border-slate-300 bg-card dark:bg-slate-900 text-muted-foreground/80"
                                    )}>
                                        {isCompleted ? <Check className="w-3 h-3" /> : (idx + 1)}
                                    </div>
                                    <div className={cn("text-sm font-medium transition-colors", isActive ? "text-blue-700" : "text-muted-foreground")}>
                                        {step.title}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-8 bg-card dark:bg-slate-900">
                <div className="max-w-4xl mx-auto">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-foreground">{STEPS[currentStep].title}</h1>
                    </div>

                    <Form {...form}>
                        <div className="space-y-6">

                            {/* STEP 0: PERSONAL */}
                            {currentStep === 0 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={control} name="proprietor_name" render={({ field }) => (
                                            <FormItem><FormLabel>Technician Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={control} name="name" render={({ field }) => (
                                            <FormItem><FormLabel>Shop Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={control} name="email" render={({ field }) => (
                                            <FormItem><FormLabel>Email *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={control} name="phone" render={({ field }) => (
                                            <FormItem><FormLabel>Phone *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={control} name="password" render={({ field }) => (
                                            <FormItem><FormLabel>Password *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={control} name="confirmPassword" render={({ field }) => (
                                            <FormItem><FormLabel>Confirm Password *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>

                                    <Separator />
                                    <h3 className="font-semibold flex items-center gap-2"><MapPin className="w-4 h-4" /> Location</h3>
                                    <LocationDetector onLocationDetected={handleLocationDetected} defaultLocation={watch("location")} />
                                    <FormField control={control} name="location.address" render={({ field }) => (
                                        <FormItem><FormLabel>Address *</FormLabel><FormControl><Textarea {...field} /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <div className="grid grid-cols-3 gap-4">
                                        <FormField control={control} name="location.state" render={({ field }) => (<FormItem><FormLabel>State *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                                        <FormField control={control} name="serviceAreaRange" render={({ field }) => (<FormItem><FormLabel>Range (km) *</FormLabel><FormControl><Input {...field} type="number" /></FormControl></FormItem>)} />
                                        <FormField control={control} name="experience" render={({ field }) => (<FormItem><FormLabel>Experience (Yrs)</FormLabel><FormControl><Input {...field} type="number" /></FormControl></FormItem>)} />
                                    </div>
                                </div>
                            )}

                            {/* STEP 1: SERVICES */}
                            {currentStep === 1 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <h3 className="font-semibold">Services Offered</h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        {ALL_SERVICES.map(s => (
                                            <FormField key={s.id} control={control} name="specialties" render={({ field }) => (
                                                <FormItem className={cn("border rounded p-3 cursor-pointer flex flex-col items-center text-center gap-2 hover:bg-muted", field.value?.includes(s.id) && "border-blue-500 bg-blue-50")} onClick={() => { const val = field.value || []; field.onChange(val.includes(s.id) ? val.filter((x: string) => x !== s.id) : [...val, s.id]) }}>
                                                    <s.icon className={cn("w-6 h-6", field.value?.includes(s.id) ? "text-blue-500" : "text-slate-400")} />
                                                    <span className="text-xs font-medium">{s.label}</span>
                                                </FormItem>
                                            )} />
                                        ))}
                                    </div>
                                    <Separator />
                                    <h3 className="font-semibold">Vehicle Types</h3>
                                    <div className="grid grid-cols-4 gap-3">
                                        {VEHICLES.map(v => (
                                            <FormField key={v.id} control={control} name={`vehicle_types.${v.id}` as any} render={({ field }) => (
                                                <FormItem className={cn("border rounded p-3 cursor-pointer flex flex-col items-center text-center gap-2", field.value && "border-blue-500 bg-blue-50")} onClick={() => field.onChange(!field.value)}>
                                                    <v.icon className={cn("w-6 h-6", field.value ? "text-blue-500" : "text-slate-400")} />
                                                    <span className="text-xs font-medium">{v.label}</span>
                                                </FormItem>
                                            )} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* STEP 2: VERIFICATION */}
                            {currentStep === 2 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <div className="grid grid-cols-2 gap-6">
                                        <FormField control={control} name="documents.garage_front" render={({ field }) => (
                                            <FormItem><ImageUpload label="Shop Front Image *" value={field.value} onChange={field.onChange} /></FormItem>
                                        )} />
                                        <FormField control={control} name="documents.profile_photo" render={({ field }) => (
                                            <FormItem><ImageUpload label="Profile Photo *" value={field.value} onChange={field.onChange} /></FormItem>
                                        )} />
                                    </div>
                                    <FormField control={control} name="aadhaar_number" render={({ field }) => (<FormItem><FormLabel>Aadhaar Number *</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                                    <FormField control={control} name="gst_number" render={({ field }) => (<FormItem><FormLabel>GSTIN</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                                </div>
                            )}

                            {/* STEP 3: OPERATIONS */}
                            {currentStep === 3 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField control={control} name="working_hours.opening_time" render={({ field }) => (<FormItem><FormLabel>Opening Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>)} />
                                        <FormField control={control} name="working_hours.closing_time" render={({ field }) => (<FormItem><FormLabel>Closing Time</FormLabel><FormControl><Input type="time" {...field} /></FormControl></FormItem>)} />
                                    </div>
                                    <FormField control={control} name="working_hours.is_24x7" render={({ field }) => (
                                        <FormItem className="flex items-center gap-2 border p-4 rounded"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="m-0">24x7 Service Available</FormLabel></FormItem>
                                    )} />
                                    <FormField control={control} name="app_readiness.has_smartphone" render={({ field }) => (
                                        <FormItem className="flex items-center gap-2 border p-4 rounded"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="m-0">Has Smartphone (Android)</FormLabel></FormItem>
                                    )} />
                                </div>
                            )}

                            {/* STEP 4: PRICING */}
                            {currentStep === 4 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-sm text-yellow-800 flex items-start gap-3">
                                        <AlertTriangle className="w-5 h-5 shrink-0" />
                                        <div><strong>Critical Step:</strong> Configure detailed pricing for each service. Customers see this as "Starting From".</div>
                                    </div>
                                    {selectedServices && selectedServices.map((s: string, idx: number) => (
                                        <ServiceConfigCard key={s} serviceName={s} index={idx} register={register} watch={watch} setValue={setValue} />
                                    ))}
                                    {(!selectedServices || selectedServices.length === 0) && <div className="text-center text-slate-400 py-10">No Services Selected</div>}
                                </div>
                            )}

                            {/* STEP 5: BANKING */}
                            {currentStep === 5 && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                    <Card>
                                        <CardHeader><CardTitle>Payment Collection</CardTitle><CardDescription>Select how you want to receive payments</CardDescription></CardHeader>
                                        <CardContent className="space-y-6">
                                            <div className="flex gap-4">
                                                {['cash', 'upi', 'bank_transfer'].map(mode => (
                                                    <FormField key={mode} control={control} name={`payment_details.modes.${mode}` as any} render={({ field }) => (
                                                        <FormItem className="border rounded-lg p-4 flex-1 text-center bg-card dark:bg-slate-900 shadow-sm border-border">
                                                            <FormControl>
                                                                <div className="flex flex-col items-center gap-3 cursor-pointer" onClick={(e) => {
                                                                    // Prevent double toggle if clicking directly on checkbox
                                                                    if ((e.target as any).type !== 'checkbox') {
                                                                        field.onChange(!field.value);
                                                                    }
                                                                }}>
                                                                    <Checkbox
                                                                        checked={!!field.value}
                                                                        onCheckedChange={(checked) => field.onChange(checked)}
                                                                        className="h-5 w-5 rounded-full"
                                                                    />
                                                                    <div className="uppercase font-bold text-xs text-muted-foreground">{mode.replace('_', ' ')}</div>
                                                                </div>
                                                            </FormControl>
                                                        </FormItem>
                                                    )} />
                                                ))}
                                            </div>
                                            <Separator />
                                            <div className="space-y-4">
                                                <h3 className="text-sm font-semibold text-muted-foreground">Bank Details (For Payouts)</h3>
                                                <div className="grid md:grid-cols-2 gap-6">
                                                    <FormField control={control} name="payment_details.bank_name" render={({ field }) => (<FormItem><FormLabel>Bank Name</FormLabel><FormControl><Input {...field} placeholder="e.g. HDFC Bank" /></FormControl></FormItem>)} />
                                                    <FormField control={control} name="payment_details.bank_account_number" render={({ field }) => (<FormItem><FormLabel>Account Number</FormLabel><FormControl><Input {...field} type="password" /></FormControl></FormItem>)} />
                                                    <FormField control={control} name="payment_details.ifsc_code" render={({ field }) => (<FormItem><FormLabel>IFSC Code</FormLabel><FormControl><Input {...field} placeholder="e.g. HDFC0001234" /></FormControl></FormItem>)} />
                                                    <FormField control={control} name="payment_details.upi_id" render={({ field }) => (<FormItem><FormLabel>UPI ID (Optional)</FormLabel><FormControl><Input {...field} placeholder="user@upi" /></FormControl></FormItem>)} />
                                                </div>
                                                <FormField control={control} name="trade_license_number" render={({ field }) => (<FormItem><FormLabel>Trade License / PAN (Verification)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>)} />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            )}

                            {/* STEP 6: FINISH */}
                            {currentStep === 6 && (
                                <div className="text-center py-10 animate-in fade-in slide-in-from-right-4">
                                    <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
                                    <h2 className="text-2xl font-bold">Ready to Submit</h2>
                                    <p className="text-muted-foreground/80 mb-8">Review the details and create the technician.</p>

                                    <FormField control={control} name="consent.agreed" render={({ field }) => (
                                        <FormItem className="flex items-center justify-center gap-2"><FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl><FormLabel className="m-0">I verify that these details are correct</FormLabel></FormItem>
                                    )} />
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-6 border-t mt-8">
                                <Button variant="outline" type="button" onClick={() => setCurrentStep(p => Math.max(0, p - 1))} disabled={currentStep === 0}>Back</Button>
                                {currentStep === STEPS.length - 1 ? (
                                    <Button onClick={form.handleSubmit(onSubmit)} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">{isSubmitting ? "Creating..." : "Create Technician"}</Button>
                                ) : (
                                    <Button type="button" onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">Continue</Button>
                                )}
                            </div>
                        </div>
                    </Form>
                </div>
            </div>
        </div>
    );
};

export default AdminAddTechnicianWizard;
