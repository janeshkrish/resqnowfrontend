import React, { useState, useEffect } from "react";
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
import LocationDetector from "./LocationDetector";
import { technicianAuthService } from "@/services/technicianAuthService";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
    Loader2, ArrowRight, Check, Car, MapPin, User, Wrench, CreditCard,
    Upload, Clock, Key, AlertTriangle, Truck, Zap,
    CheckCircle2, ChevronRight, Fuel, ChevronLeft, Building2, Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
    normalizePricingConfigForApi,
    normalizeSpecialtiesForApi,
    normalizeVehicleTypesForApi,
} from "@/config/technicianNormalization";

// --- Zod Schema ---

const technicianSchema = z.object({
    // Step 0: Personal
    proprietor_name: z.string().min(2, "Name required"),
    name: z.string().min(2, "Shop Name required"),
    email: z.string().email("Invalid email"),
    password: z.string().min(6, "Min 6 chars"),
    confirmPassword: z.string(),
    phone: z.string().min(10, "Min 10 digits"),
    alternate_phone: z.string().optional(),
    location: z.object({
        address: z.string().min(5, "Address required"),
        latitude: z.number().nullable().refine(val => val !== null, "GPS Location required"),
        longitude: z.number().nullable(),
        state: z.string().min(2, "State required"),
        locality: z.string().optional(),
        city: z.string().optional(),
        district: z.string().optional(),
        pincode: z.string().optional(),
    }),
    serviceAreaRange: z.coerce.number().min(1, "Min 1 km"),
    experience: z.coerce.number().min(0, "Invalid experience"),

    // Step 1: Services
    specialties: z.array(z.string()).min(1, "Select at least one service"),
    vehicle_types: z.any().refine((data) => data && Object.values(data).some(val => val === true), {
        message: "Select at least one vehicle type"
    }),

    // Step 2: Verification
    aadhaar_number: z.string().min(12, "12 digits required").max(12),
    gst_number: z.string().optional(),
    documents: z.object({
        garage_front: z.string().optional(),
        profile_photo: z.string().optional(),
        tools_photo: z.string().optional(),
        facilities_photo: z.string().optional(),
    }),

    // Step 3: Operations
    working_hours: z.object({
        opening_time: z.string().min(1, "Required"),
        closing_time: z.string().min(1, "Required"),
        weekly_off: z.string(),
        is_24x7: z.boolean(),
    }),
    app_readiness: z.object({
        has_smartphone: z.boolean().refine(val => val === true, "Required"),
        preferred_language: z.string(),
    }),

    // Step 4: Pricing
    pricing_config: z.array(z.any()),

    // Step 5: Banking
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
        agreed: z.boolean().refine(val => val === true, "Required"),
    }),
}).refine((data) => data.password === data.confirmPassword, {
    message: "Mismatch",
    path: ["confirmPassword"],
});

type TechnicianFormValues = z.infer<typeof technicianSchema>;


// --- Constants ---

const STEPS = [
    { id: 0, title: "Personal", subtitle: "Details" },
    { id: 1, title: "Services", subtitle: "Offerings" },
    { id: 2, title: "Verify", subtitle: "Docs" },
    { id: 3, title: "Operations", subtitle: "Hours" },
    { id: 4, title: "Pricing", subtitle: "Rates" },
    { id: 5, title: "Banking", subtitle: "Payouts" },
    { id: 6, title: "Finish", subtitle: "Submit" },
];

const ALL_SERVICES = [
    { id: "Tyre / Puncture Repair", label: "Flat Tire", icon: AlertTriangle, desc: "Tire change" },
    { id: "Tubeless Tyre Repair", label: "Tubeless", icon: AlertTriangle, desc: "Plug/Patch" },
    { id: "Battery Jump Start", label: "Jumpstart", icon: Zap, desc: "Dead battery" },
    { id: "Battery Replacement", label: "Battery", icon: Zap, desc: "New battery" },
    { id: "Towing Assistance", label: "Towing", icon: Truck, desc: "Recovery" },
    { id: "Fuel Delivery", label: "Fuel", icon: Fuel, desc: "Petrol/Diesel" },
    { id: "General Servicing", label: "Mechanic", icon: Wrench, desc: "General repairs" },
    { id: "Brake Service", label: "Brakes", icon: Wrench, desc: "Pads & Discs" },
    { id: "Electrical Repair", label: "Electrical", icon: Zap, desc: "Wiring" },
    { id: "Engine Repair", label: "Engine", icon: Wrench, desc: "Diagnostics" },
    { id: "Accident Repair", label: "Accident", icon: AlertTriangle, desc: "Recovery" },
    { id: "Lockout Assistance", label: "Lockout", icon: Key, desc: "Keys locked" },
    { id: "EV Assistance", label: "EV Help", icon: Zap, desc: "Charging" },
];

const VEHICLES = [
    { id: "Two-Wheeler", label: "M/Cycle", icon: Car },
    { id: "Four-Wheeler", label: "Car", icon: Car },
    { id: "Commercial", label: "Truck", icon: Truck },
    { id: "EV", label: "EV", icon: Zap },
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
            const res = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) throw new Error("Upload failed");

            const data = await res.json();
            onChange(data.url);
            toast.success("Uploaded!");
        } catch (err) {
            console.error(err);
            toast.error("Upload failed");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="border border-dashed border-slate-300 rounded-lg p-3 flex flex-col items-center justify-center text-center bg-slate-50 relative group h-28">
            {value ? (
                <div className="relative w-full h-full rounded overflow-hidden">
                    <img src={value} alt="Uploaded" className="object-cover w-full h-full" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="secondary" size="sm" onClick={() => onChange("")} type="button">Remove</Button>
                    </div>
                </div>
            ) : (
                <>
                    <Upload className="w-5 h-5 text-slate-400 mb-1" />
                    <div className="font-medium text-slate-700 text-[10px] uppercase">{label}</div>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} disabled={uploading} />
                    {uploading && <div className="absolute inset-0 bg-white/80 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>}
                </>
            )}
        </div>
    );
};

// --- SERVICE CONFIGURATION WITH FULL LOGIC ---
const ServiceConfigCard = ({ serviceName, index, register, watch, setValue }: any) => {
    const prefix = `pricing_config.${index}`;
    const getFieldName = (field: string) => `${prefix}.${field}`;
    const renderSectionHeader = (title: string) => <div className="font-bold text-xs mt-3 mb-2 text-slate-500 uppercase">{title}</div>;

    // Helper to sync array checkboxes
    const handleCheckboxArray = (option: string, fieldName: string) => {
        const currentList = watch(fieldName) || [];
        const exists = currentList.includes(option);
        if (exists) {
            setValue(fieldName, currentList.filter((x: string) => x !== option));
        } else {
            setValue(fieldName, [...currentList, option]);
        }
    };

    const isChecked = (option: string, fieldName: string) => (watch(fieldName) || []).includes(option);

    return (
        <Card className="mb-4 border shadow-sm">
            <CardHeader className="bg-slate-50 py-2 px-4 border-b flex flex-row items-center gap-2">
                <Wrench className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-bold text-slate-800">{serviceName}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
                <input type="hidden" {...register(getFieldName("service_name"))} value={serviceName} />

                {/* --- 1. TYRE / PUNCTURE REPAIR --- */}
                {serviceName === "Tyre / Puncture Repair" && (
                    <>
                        <div>
                            {renderSectionHeader("Includes")}
                            <div className="flex flex-wrap gap-2">
                                {["Tube puncture repair", "Valve replacement", "Wheel removal"].map(opt => (
                                    <div key={opt} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer", isChecked(opt, getFieldName("work_included")) ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200")}
                                        onClick={() => handleCheckboxArray(opt, getFieldName("work_included"))}>
                                        {opt}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                            <div><label className="text-xs font-semibold">2W Charge (₹)</label><div className="flex gap-1"><Input placeholder="Min" className="h-8 text-xs" {...register(getFieldName("price_2w_min"))} /><Input placeholder="Max" className="h-8 text-xs" {...register(getFieldName("price_2w_max"))} /></div></div>
                            <div><label className="text-xs font-semibold">4W Charge (₹)</label><div className="flex gap-1"><Input placeholder="Min" className="h-8 text-xs" {...register(getFieldName("price_4w_min"))} /><Input placeholder="Max" className="h-8 text-xs" {...register(getFieldName("price_4w_max"))} /></div></div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mt-2">
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Visit (₹)</label><Input className="h-8" type="number" {...register(getFieldName("visit_charge"))} /></div>
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Free Km</label><Input className="h-8" type="number" {...register(getFieldName("free_distance"))} /></div>
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Extra/Km</label><Input className="h-8" type="number" {...register(getFieldName("extra_km_charge"))} /></div>
                        </div>
                    </>
                )}

                {/* --- 2. TUBELESS REPAIR --- */}
                {serviceName === "Tubeless Tyre Repair" && (
                    <>
                        <div>
                            {renderSectionHeader("Type")}
                            <div className="flex gap-2">
                                {["Plug repair", "Patch repair"].map(opt => (
                                    <div key={opt} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer", isChecked(opt, getFieldName("work_included")) ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200")}
                                        onClick={() => handleCheckboxArray(opt, getFieldName("work_included"))}>
                                        {opt}
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-xs font-semibold">Per Puncture (₹)</label><Input className="h-9" type="number" {...register(getFieldName("per_puncture_charge"))} /></div>
                            <div><label className="text-xs font-semibold">Night Extra (₹)</label><Input className="h-9" type="number" {...register(getFieldName("night_charge"))} /></div>
                        </div>
                    </>
                )}

                {/* --- 3. JUMPSTART --- */}
                {serviceName === "Battery Jump Start" && (
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs font-semibold">Service Fee (₹)</label><Input className="h-9" type="number" {...register(getFieldName("service_charge"))} /></div>
                        <div><label className="text-xs font-semibold">Visit Charge (₹)</label><Input className="h-9" type="number" {...register(getFieldName("visit_charge"))} /></div>
                    </div>
                )}

                {/* --- 5. TOWING --- */}
                {serviceName === "Towing Assistance" && (
                    <>
                        <div className="grid grid-cols-3 gap-2">
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Base (₹)</label><Input className="h-8" type="number" {...register(getFieldName("base_charge"))} /></div>
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Free Km</label><Input className="h-8" type="number" {...register(getFieldName("free_distance"))} /></div>
                            <div><label className="text-[10px] font-bold text-slate-500 uppercase">Per Km</label><Input className="h-8" type="number" {...register(getFieldName("per_km_charge"))} /></div>
                        </div>
                        <div className="mt-2">
                            <label className="text-xs font-semibold">Pricing Class</label>
                            <Select onValueChange={(v) => setValue(getFieldName("vehicle_type_pricing"), v)}>
                                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent><SelectItem value="2w">Two Wheeler</SelectItem><SelectItem value="4w">Four Wheeler</SelectItem><SelectItem value="commercial">Commercial</SelectItem></SelectContent>
                            </Select>
                        </div>
                    </>
                )}

                {/* --- 6. FUEL --- */}
                {serviceName === "Fuel Delivery" && (
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs font-semibold">Delivery Fee (₹)</label><Input className="h-9" type="number" {...register(getFieldName("delivery_charge"))} /></div>
                        <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded flex items-center">Fuel cost charged at actuals.</div>
                    </div>
                )}

                {/* --- DEFAULT / GENERIC (Used for General Servicing, etc) --- */}
                {!["Tyre / Puncture Repair", "Tubeless Tyre Repair", "Battery Jump Start", "Towing Assistance", "Fuel Delivery"].includes(serviceName) && (
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-xs font-semibold">Min Labour (₹)</label><Input type="number" {...register(getFieldName("labour_min"))} className="h-9" /></div>
                        <div><label className="text-xs font-semibold">Max Labour (₹)</label><Input type="number" {...register(getFieldName("labour_max"))} className="h-9" /></div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};


// --- Main Layout ---

const TechnicianSignupWizard = () => {
    const [currentStep, setCurrentStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    const form = useForm<TechnicianFormValues>({
        resolver: zodResolver(technicianSchema),
        mode: "onChange",
        defaultValues: {
            name: "", proprietor_name: "", phone: "", alternate_phone: "", email: "", password: "", confirmPassword: "",
            location: { latitude: null, longitude: null, address: "", locality: "", city: "", district: "", state: "", pincode: "" },
            serviceAreaRange: 10, experience: 0,
            aadhaar_number: "", gst_number: "",
            vehicle_types: {},
            specialties: [],
            pricing_config: [],
            working_hours: { opening_time: "09:00", closing_time: "20:00", weekly_off: "Sunday", is_24x7: false },
            payment_details: { modes: { cash: true }, upi_id: "", bank_name: "", bank_account_number: "", ifsc_code: "" },
            app_readiness: { has_smartphone: false, preferred_language: "English" },
            documents: { garage_front: "", profile_photo: "", tools_photo: "", facilities_photo: "" },
            consent: { agreed: false }
        }
    });

    const { control, watch, setValue, trigger, register, formState: { errors } } = form;
    const selectedServices = watch("specialties");

    const handleLocationDetected = React.useCallback((loc: any) => {
        setValue("location", loc);
    }, [setValue]);

    // Scroll to top on step change
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [currentStep]);

    const handleNext = async () => {
        let fields: any[] = [];
        if (currentStep === 0) fields = ["proprietor_name", "name", "email", "password", "phone", "location", "experience", "serviceAreaRange"];
        if (currentStep === 1) fields = ["specialties", "vehicle_types"];
        if (currentStep === 2) fields = ["aadhaar_number", "documents"];
        if (currentStep === 6) fields = ["consent"];

        const isValid = await trigger(fields);
        if (isValid) {
            if (currentStep < STEPS.length - 1) setCurrentStep(prev => prev + 1);
            else await onSubmit(form.getValues());
        } else {
            console.log("Validation Errors:", errors);
            toast.error("Please fill required fields.");
        }
    };

    const handleBack = () => setCurrentStep(prev => Math.max(0, prev - 1));

    const onSubmit = async (data: any) => {
        setIsSubmitting(true);
        try {
            if (data.password !== data.confirmPassword) { toast.error("Password mismatch"); return; }
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
                whatsapp_number: data.whatsapp_number || data.phone
            };
            await technicianAuthService.register(payload);
            toast.success("Submitted!");
            navigate("/technician/login");
        } catch (error: any) {
            toast.error(error.message || "Failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-slate-50 min-h-screen text-slate-900 pb-24 md:pb-0">

            {/* Sticky Header: Progress Bar */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-white border-b shadow-sm">
                <div className="h-14 flex items-center justify-between px-4 max-w-2xl mx-auto">
                    {currentStep > 0 ? (
                        <button onClick={handleBack} className="p-2 -ml-2 text-slate-600"><ChevronLeft className="w-5 h-5" /></button>
                    ) : <div className="w-9" />}

                    <div className="font-bold text-slate-800 text-sm">
                        {STEPS[currentStep].title} <span className="text-slate-400 font-normal">({currentStep + 1}/{STEPS.length})</span>
                    </div>

                    <div className="w-9" /> {/* Spacer */}
                </div>
                {/* Progress Line */}
                <div className="h-1 w-full bg-slate-100">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }} />
                </div>
            </div>

            <div className="pt-20 px-4 md:px-0 max-w-xl mx-auto">
                <Form {...form}>
                    <form className="space-y-6">

                        {/* STEP 0: PERSONAL */}
                        {currentStep === 0 && (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="space-y-3">
                                    <FormField control={control} name="proprietor_name" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs uppercase text-slate-500 font-bold">Your Name</FormLabel><FormControl><Input {...field} className="h-11 bg-white" placeholder="e.g. John Doe" /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <FormField control={control} name="name" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs uppercase text-slate-500 font-bold">Shop Name</FormLabel><FormControl><Input {...field} className="h-11 bg-white" placeholder="e.g. John's Garage" /></FormControl><FormMessage /></FormItem>
                                    )} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField control={control} name="phone" render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs uppercase text-slate-500 font-bold">Mobile</FormLabel><FormControl><Input {...field} type="tel" className="h-11 bg-white" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={control} name="alternate_phone" render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs uppercase text-slate-500 font-bold">Aleternate (Opt)</FormLabel><FormControl><Input {...field} type="tel" className="h-11 bg-white" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField control={control} name="password" render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs uppercase text-slate-500 font-bold">Password</FormLabel><FormControl><Input {...field} type="password" className="h-11 bg-white" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={control} name="confirmPassword" render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs uppercase text-slate-500 font-bold">Confirm</FormLabel><FormControl><Input {...field} type="password" className="h-11 bg-white" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                    <FormField control={control} name="email" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs uppercase text-slate-500 font-bold">Email (Optional)</FormLabel><FormControl><Input {...field} type="email" className="h-11 bg-white" /></FormControl></FormItem>
                                    )} />
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                    <LocationDetector onLocationDetected={handleLocationDetected} defaultLocation={watch("location")} />
                                    <div className="grid grid-cols-2 gap-3">
                                        <FormField control={control} name="location.city" render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs uppercase text-slate-500 font-bold">City/Town</FormLabel><FormControl><Input {...field} className="h-11 bg-white" placeholder="Auto-detected" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={control} name="location.state" render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs uppercase text-slate-500 font-bold">State *</FormLabel><FormControl><Input {...field} className="h-11 bg-white" placeholder="Required" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                    <FormField control={control} name="location.address" render={({ field }) => (
                                        <FormItem><FormLabel className="text-xs uppercase text-slate-500 font-bold">Full Address *</FormLabel><FormControl><Textarea {...field} placeholder="Shop Number, Street, Landmark" className="bg-white min-h-[80px]" /></FormControl><FormMessage /></FormItem>
                                    )} />

                                    <div className="rounded-xl border border-slate-200 bg-white p-4 grid grid-cols-2 gap-4">
                                        <FormField control={control} name="experience" render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs uppercase text-slate-500 font-bold">Experience (Yrs)</FormLabel><FormControl><Input {...field} type="number" className="h-11 bg-white" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={control} name="serviceAreaRange" render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs uppercase text-slate-500 font-bold">Range (km)</FormLabel><FormControl><Input {...field} type="number" className="h-11 bg-white" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 1: SERVICES */}
                        {currentStep === 1 && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="space-y-3">
                                    <h3 className="font-bold text-slate-900 flex items-center gap-2"><Car className="w-5 h-5 text-primary" /> Vehicle Types *</h3>
                                    {errors.vehicle_types && <p className="text-xs text-red-500 font-medium">Please select at least one vehicle type.</p>}
                                    <div className="grid grid-cols-2 gap-3">
                                        {VEHICLES.map(v => (
                                            <FormField key={v.id} control={control} name={`vehicle_types.${v.id}` as any} render={({ field }) => (
                                                <FormItem className={cn("border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all relative overflow-hidden", field.value ? "border-primary bg-primary/5" : "border-slate-200 bg-white")} onClick={() => { field.onChange(!field.value); trigger("vehicle_types"); }}>
                                                    {field.value ? (
                                                        <div className="bg-primary text-white rounded flex items-center justify-center w-5 h-5 shrink-0"><Check className="w-3.5 h-3.5" /></div>
                                                    ) : (
                                                        <div className="border-2 border-slate-300 rounded w-5 h-5 shrink-0" />
                                                    )}
                                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", field.value ? "bg-primary text-white" : "bg-slate-100 text-slate-400")}><v.icon className="w-4 h-4" /></div>
                                                    <div className="font-semibold text-sm leading-tight">{v.label}</div>
                                                </FormItem>
                                            )} />
                                        ))}
                                    </div>
                                </div>
                                <Separator />
                                <div className="space-y-3">
                                    <h3 className="font-bold text-slate-900 flex items-center gap-2"><Wrench className="w-5 h-5 text-primary" /> Services Offered *</h3>
                                    {errors.specialties && <p className="text-xs text-red-500 font-medium">Please select at least one service.</p>}
                                    <div className="grid grid-cols-3 gap-2">
                                        {ALL_SERVICES.map(s => {
                                            const isSelected = selectedServices?.includes(s.id);
                                            return (
                                                <div key={s.id} onClick={() => {
                                                    const c = selectedServices || [];
                                                    setValue("specialties", c.includes(s.id) ? c.filter((x: string) => x !== s.id) : [...c, s.id], { shouldValidate: true });
                                                }}
                                                    className={cn("flex flex-col items-center justify-between p-2 rounded-xl border text-center h-28 transition-all active:scale-95 relative", isSelected ? "border-primary bg-primary/5 text-primary" : "border-slate-200 bg-white text-slate-500")}>
                                                    <div className="absolute top-2 right-2">
                                                        {isSelected ? (
                                                            <div className="bg-primary text-white rounded flex items-center justify-center w-4 h-4"><Check className="w-3 h-3" /></div>
                                                        ) : (
                                                            <div className="border-2 border-slate-200 rounded w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1 flex items-center justify-center pt-2"><s.icon className="w-6 h-6" /></div>
                                                    <div className="text-[10px] font-bold leading-tight pb-1 w-full px-1">{s.label}</div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: DOCS */}
                        {currentStep === 2 && (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="grid grid-cols-2 gap-3">
                                    <FormField control={control} name="documents.garage_front" render={({ field }) => <ImageUpload label="Shop Front" value={field.value} onChange={field.onChange} />} />
                                    <FormField control={control} name="documents.profile_photo" render={({ field }) => <ImageUpload label="Profile Photo" value={field.value} onChange={field.onChange} />} />
                                    <FormField control={control} name="documents.tools_photo" render={({ field }) => <ImageUpload label="Tools / Bay" value={field.value} onChange={field.onChange} />} />
                                    <FormField control={control} name="documents.facilities_photo" render={({ field }) => <ImageUpload label="Facilities" value={field.value} onChange={field.onChange} />} />
                                </div>
                                <FormField control={control} name="aadhaar_number" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs font-bold uppercase text-slate-500">Aadhaar Number</FormLabel><FormControl><Input {...field} className="h-11 bg-white" maxLength={12} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={control} name="gst_number" render={({ field }) => (
                                    <FormItem><FormLabel className="text-xs font-bold uppercase text-slate-500">GSTIN (Optional)</FormLabel><FormControl><Input {...field} className="h-11 bg-white" /></FormControl><FormMessage /></FormItem>
                                )} />
                            </div>
                        )}

                        {/* STEP 3: OPERATIONS */}
                        {currentStep === 3 && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={control} name="working_hours.opening_time" render={({ field }) => (<FormItem><FormLabel>Open</FormLabel><FormControl><Input type="time" {...field} className="h-11 bg-white" /></FormControl></FormItem>)} />
                                    <FormField control={control} name="working_hours.closing_time" render={({ field }) => (<FormItem><FormLabel>Close</FormLabel><FormControl><Input type="time" {...field} className="h-11 bg-white" /></FormControl></FormItem>)} />
                                </div>
                                <FormField control={control} name="working_hours.weekly_off" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Weekly Off</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger className="h-11 bg-white"><SelectValue placeholder="Select Day" /></SelectTrigger></FormControl>
                                            <SelectContent>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                                        </Select>
                                    </FormItem>
                                )} />
                                <div className="grid grid-cols-2 gap-4">
                                    <FormField control={control} name="working_hours.is_24x7" render={({ field }) => (
                                        <FormItem className="flex items-center gap-3 p-3 bg-white rounded-xl border">
                                            <Checkbox checked={field.value} onCheckedChange={field.onChange} className="w-5 h-5" />
                                            <span className="text-sm font-medium">24/7 Service</span>
                                        </FormItem>
                                    )} />
                                    <FormField control={control} name="app_readiness.preferred_language" render={({ field }) => (
                                        <FormItem>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl><SelectTrigger className="h-12 bg-white border-0 shadow-none p-0 px-2"><div className="flex items-center gap-2"><span className="text-xs uppercase text-slate-500 font-bold">Lang:</span> <SelectValue /></div></SelectTrigger></FormControl>
                                                <SelectContent><SelectItem value="English">English</SelectItem><SelectItem value="Tamil">Tamil</SelectItem><SelectItem value="Hindi">Hindi</SelectItem></SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                </div>
                            </div>
                        )}

                        {/* STEP 4: PRICING - RESTORED LOGIC */}
                        {currentStep === 4 && (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-100 text-xs text-yellow-800">
                                    Set your <strong>base prices</strong> below. You can adjust final price after inspecting vehicle.
                                </div>
                                {selectedServices.map((s, i) => <ServiceConfigCard key={s} serviceName={s} index={i} register={register} watch={watch} setValue={setValue} />)}
                            </div>
                        )}

                        {/* STEP 5: BANKING - RESTORED FIELDS */}
                        {currentStep === 5 && (
                            <div className="space-y-6 animate-in fade-in">
                                <FormField control={control} name="payment_details.upi_id" render={({ field }) => (
                                    <FormItem><FormLabel>UPI ID</FormLabel><FormControl><Input {...field} className="h-11 bg-white" placeholder="e.g. number@upi" /></FormControl></FormItem>
                                )} />

                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-slate-800 font-bold border-b pb-2"><Building2 className="w-4 h-4" /> Bank Details (For Payouts)</div>
                                    <div className="grid grid-cols-1 gap-4">
                                        <FormField control={control} name="payment_details.bank_name" render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs uppercase text-slate-500 font-bold">Bank Name</FormLabel><FormControl><Input {...field} className="h-11 bg-white" /></FormControl></FormItem>
                                        )} />
                                        <FormField control={control} name="payment_details.bank_account_number" render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs uppercase text-slate-500 font-bold">Account Number</FormLabel><FormControl><Input {...field} className="h-11 bg-white" type="password" /></FormControl></FormItem>
                                        )} />
                                        <FormField control={control} name="payment_details.ifsc_code" render={({ field }) => (
                                            <FormItem><FormLabel className="text-xs uppercase text-slate-500 font-bold">IFSC Code</FormLabel><FormControl><Input {...field} className="h-11 bg-white" /></FormControl></FormItem>
                                        )} />
                                    </div>
                                </div>
                            </div>
                        )}


                        {/* STEP 6: FINISH */}
                        {currentStep === 6 && (
                            <div className="text-center py-10 space-y-6">
                                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto animate-bounce"><Check className="w-10 h-10" /></div>
                                <h2 className="text-2xl font-bold">Application Ready</h2>
                                <p className="text-slate-500">By clicking submit, you agree to our Partner Terms & Conditions.</p>
                                <FormField control={control} name="consent.agreed" render={({ field }) => (
                                    <FormItem className="flex items-center justify-center gap-2">
                                        <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                                        <FormLabel className="pb-0">I Agree to Terms</FormLabel>
                                    </FormItem>
                                )} />
                            </div>
                        )}

                        {/* SPACER FOR FIXED FOOTER */}
                        <div className="h-24" />

                    </form>
                </Form>
            </div>

            {/* FIXED BOTTOM ACTION BAR */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 px-6 z-50 flex gap-4 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                {currentStep > 0 && (
                    <Button variant="outline" onClick={handleBack} className="flex-1 h-12 rounded-xl border-slate-300 text-slate-600 font-bold">Back</Button>
                )}
                <Button onClick={handleNext} disabled={isSubmitting} className={cn("flex-[2] h-12 rounded-xl text-lg font-bold shadow-lg shadow-primary/20", currentStep === 6 ? "bg-green-600 hover:bg-green-700" : "bg-primary hover:bg-primary/90")}>
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (currentStep === 6 ? "Submit Application" : "Continue")}
                </Button>
            </div>
        </div>
    );
};

export default TechnicianSignupWizard;
