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
    CheckCircle2, ChevronRight, Fuel, ChevronLeft, Building2, Wallet,
    Globe, Briefcase, Smartphone
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
    normalizePricingConfigForApi,
    normalizeSpecialtiesForApi,
    normalizeVehicleTypesForApi,
} from "@/config/technicianNormalization";
import { apiUrl } from "@/lib/api";

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
            const res = await fetch(apiUrl("/api/upload"), {
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
        <div className="border border-dashed border-slate-300 rounded-lg p-3 flex flex-col items-center justify-center text-center bg-muted relative group h-28">
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
                    <div className="font-medium text-muted-foreground text-[10px] uppercase">{label}</div>
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} disabled={uploading} />
                    {uploading && <div className="absolute inset-0 bg-card dark:bg-slate-900/80 flex items-center justify-center"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>}
                </>
            )}
        </div>
    );
};

// --- SERVICE CONFIGURATION WITH FULL LOGIC ---
const ServiceConfigCard = ({ serviceName, index, register, watch, setValue }: any) => {
    const prefix = `pricing_config.${index}`;
    const getFieldName = (field: string) => `${prefix}.${field}`;
    const renderSectionHeader = (title: string) => <div className="font-bold text-xs mt-3 mb-2 text-muted-foreground/80 uppercase">{title}</div>;

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
            <CardHeader className="bg-muted py-2 px-4 border-b flex flex-row items-center gap-2">
                <Wrench className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-bold text-foreground">{serviceName}</CardTitle>
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
                                    <div key={opt} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer", isChecked(opt, getFieldName("work_included")) ? "bg-slate-800 text-white border-slate-800" : "bg-card dark:bg-slate-900 text-muted-foreground border-border")}
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
                            <div><label className="text-[10px] font-bold text-muted-foreground/80 uppercase">Visit (₹)</label><Input className="h-8" type="number" {...register(getFieldName("visit_charge"))} /></div>
                            <div><label className="text-[10px] font-bold text-muted-foreground/80 uppercase">Free Km</label><Input className="h-8" type="number" {...register(getFieldName("free_distance"))} /></div>
                            <div><label className="text-[10px] font-bold text-muted-foreground/80 uppercase">Extra/Km</label><Input className="h-8" type="number" {...register(getFieldName("extra_km_charge"))} /></div>
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
                                    <div key={opt} className={cn("px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer", isChecked(opt, getFieldName("work_included")) ? "bg-slate-800 text-white border-slate-800" : "bg-card dark:bg-slate-900 text-muted-foreground border-border")}
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
                            <div><label className="text-[10px] font-bold text-muted-foreground/80 uppercase">Base (₹)</label><Input className="h-8" type="number" {...register(getFieldName("base_charge"))} /></div>
                            <div><label className="text-[10px] font-bold text-muted-foreground/80 uppercase">Free Km</label><Input className="h-8" type="number" {...register(getFieldName("free_distance"))} /></div>
                            <div><label className="text-[10px] font-bold text-muted-foreground/80 uppercase">Per Km</label><Input className="h-8" type="number" {...register(getFieldName("per_km_charge"))} /></div>
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
    const [isTechnicianAgreementOpen, setIsTechnicianAgreementOpen] = useState(false);
    const [hasAcceptedTechnicianAgreement, setHasAcceptedTechnicianAgreement] = useState(false);
    const [showTechnicianAgreementError, setShowTechnicianAgreementError] = useState(false);
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
            if (currentStep === 6 && !hasAcceptedTechnicianAgreement) {
                setShowTechnicianAgreementError(true);
                toast.error("Please accept the ResQNow Technician Agreement.");
                return;
            }
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
        <div className="bg-muted min-h-screen text-foreground pb-24 md:pb-0">

            {/* Sticky Header: Progress Bar */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-card dark:bg-slate-900 border-b shadow-sm">
                <div className="h-14 flex items-center justify-between px-4 max-w-2xl mx-auto">
                    {currentStep > 0 ? (
                        <button onClick={handleBack} className="p-2 -ml-2 text-muted-foreground"><ChevronLeft className="w-5 h-5" /></button>
                    ) : <div className="w-9" />}

                    <div className="font-bold text-foreground text-sm">
                        {STEPS[currentStep].title} <span className="text-slate-400 font-normal">({currentStep + 1}/{STEPS.length})</span>
                    </div>

                    <div className="w-9" /> {/* Spacer */}
                </div>
                {/* Progress Line */}
                <div className="h-1 w-full bg-muted/50">
                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }} />
                </div>
            </div>

            <div className="pt-20 px-4 md:px-0 max-w-xl mx-auto">
                <div className="mb-6 animate-in fade-in slide-in-from-bottom-2">
                    <h1 className="text-3xl font-black text-foreground tracking-tight leading-tight">Apply to be a<br /><span className="text-primary">ResQNow Partner</span></h1>
                    <p className="text-sm font-medium text-muted-foreground mt-2">Join our network of elite mobile mechanics and tow truck operators. Complete the form below to get started.</p>
                </div>
                <Form {...form}>
                    <form className="space-y-6">

                        {/* STEP 0: PERSONAL */}
                        {currentStep === 0 && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5 space-y-4">
                                    <div className="pb-2 border-b border-border/50">
                                        <h3 className="font-bold text-lg">Contact Information</h3>
                                        <p className="text-xs text-muted-foreground">Basic details for your profile.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <FormField control={control} name="proprietor_name" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">Your Name</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" placeholder="e.g. John Doe" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={control} name="name" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">Shop Name</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" placeholder="e.g. John's Garage" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <div className="grid grid-cols-2 gap-3">
                                            <FormField control={control} name="phone" render={({ field }) => (
                                                <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">Mobile Number</FormLabel><FormControl><Input {...field} type="tel" className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={control} name="alternate_phone" render={({ field }) => (
                                                <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">Alt Mobile (Opt)</FormLabel><FormControl><Input {...field} type="tel" className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" /></FormControl><FormMessage /></FormItem>
                                            )} />
                                        </div>
                                        <FormField control={control} name="email" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">Email Address</FormLabel><FormControl><Input {...field} type="email" className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" placeholder="contact@example.com" /></FormControl></FormItem>
                                        )} />
                                        <div className="grid grid-cols-2 gap-3">
                                            <FormField control={control} name="password" render={({ field }) => (
                                                <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">Password</FormLabel><FormControl><Input {...field} type="password" className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={control} name="confirmPassword" render={({ field }) => (
                                                <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">Confirm Password</FormLabel><FormControl><Input {...field} type="password" className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" /></FormControl><FormMessage /></FormItem>
                                            )} />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5 space-y-4">
                                    <button
                                        type="button"
                                        onClick={() => setIsTechnicianAgreementOpen((prev) => !prev)}
                                        className="w-full flex items-center justify-between text-left"
                                    >
                                        <h3 className="font-bold text-lg">View Technician Agreement & Responsibilities</h3>
                                        <ChevronRight className={cn("w-5 h-5 text-primary transition-transform duration-300", isTechnicianAgreementOpen ? "rotate-90" : "rotate-0")} />
                                    </button>

                                    <div className={cn("overflow-hidden transition-all duration-300", isTechnicianAgreementOpen ? "max-h-[34rem] opacity-100" : "max-h-0 opacity-0")}>
                                        <div className="max-h-[30rem] overflow-y-auto rounded-xl border border-border/60 bg-muted/40 p-4 space-y-4 text-sm">
                                            <div className="space-y-2">
                                                <p className="font-bold">1. Independent Service Partner</p>
                                                <p>• You are an independent service partner.</p>
                                                <p>• You manage your own schedule.</p>
                                                <p>• You are responsible for your tools and licenses.</p>
                                                <p>• You manage your personal tax obligations.</p>
                                                <p>ResQNow provides the technology platform to connect you with customers.</p>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="font-bold">2. Professional Conduct</p>
                                                <p>You agree to:</p>
                                                <p>• Treat customers with respect and professionalism.</p>
                                                <p>• Provide services honestly and responsibly.</p>
                                                <p>• Maintain safety and proper behavior at all times.</p>
                                                <p>• Communicate clearly regarding work scope and pricing.</p>
                                                <p>Unprofessional or inappropriate behavior may lead to account review.</p>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="font-bold">3. Transparent Pricing & Payments</p>
                                                <p>To protect both you and the customer:</p>
                                                <p>• Charge only the system-approved or mutually agreed amount.</p>
                                                <p>• Inform customers before performing additional chargeable work.</p>
                                                <p>• Avoid requesting or accepting direct/offline payments to bypass the platform.</p>
                                                <p>If misuse related to payments is detected, ResQNow may:</p>
                                                <p>• Temporarily hold payouts during investigation.</p>
                                                <p>• Reverse payments in case of verified disputes.</p>
                                                <p>• Restrict or suspend account access if violations are confirmed.</p>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="font-bold">4. Responsible Use of the App</p>
                                                <p>You must:</p>
                                                <p>• Use only your registered account.</p>
                                                <p>• Keep login credentials secure.</p>
                                                <p>• Accept jobs only when genuinely available.</p>
                                                <p>• Mark jobs complete only after full service delivery.</p>
                                                <p>The following actions are considered serious violations:</p>
                                                <p>• Fake bookings or fake job completion.</p>
                                                <p>• Repeated cancellation to manipulate job allocation.</p>
                                                <p>• Diverting customers intentionally for offline service.</p>
                                                <p>• Manipulating pricing or service details.</p>
                                                <p>• Sharing or misusing customer contact information.</p>
                                                <p>Confirmed misuse may result in:</p>
                                                <p>• Temporary suspension</p>
                                                <p>• Permanent account deactivation</p>
                                                <p>• Loss of pending incentives</p>
                                                <p>• Legal action in case of fraud or criminal activity.</p>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="font-bold">5. Customer Privacy</p>
                                                <p>You agree to:</p>
                                                <p>• Use customer information only for service purposes.</p>
                                                <p>• Not store, share, or misuse personal data.</p>
                                                <p>• Obtain permission before taking photos or recordings.</p>
                                                <p>Violation of privacy standards may result in immediate suspension.</p>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="font-bold">6. Reliability & Cancellations</p>
                                                <p>• Frequent unnecessary cancellations may reduce job allocation.</p>
                                                <p>• No-show without communication may trigger account review.</p>
                                                <p>• Repeated reliability issues may result in temporary restrictions.</p>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="font-bold">7. Performance & Ratings</p>
                                                <p>If consistent complaints arise:</p>
                                                <p>• You may receive warning or guidance.</p>
                                                <p>• Continued issues may lead to temporary suspension.</p>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="font-bold">8. Account Review & Termination</p>
                                                <p>ResQNow reserves the right to suspend or terminate accounts if:</p>
                                                <p>• There is evidence of fraud.</p>
                                                <p>• Customer safety is compromised.</p>
                                                <p>• Platform policies are repeatedly violated.</p>
                                                <p>• Brand reputation is at risk.</p>
                                                <p>Serious misconduct may result in immediate termination without prior notice.</p>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="font-bold">9. Commitment to Growth</p>
                                                <p>ResQNow values honest and hardworking technicians.</p>
                                                <p>We aim to:</p>
                                                <p>• Provide fair earning opportunities.</p>
                                                <p>• Maintain a safe platform.</p>
                                                <p>• Support long-term professional growth.</p>
                                            </div>

                                            <div className="space-y-2">
                                                <p className="font-bold">10. Acceptance</p>
                                                <p>By signing below, the Technician confirms:</p>
                                                <p>• They have read and understood this Agreement.</p>
                                                <p>• They agree to comply with all terms.</p>
                                                <p>• They understand that policy violations may affect platform access.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5 space-y-4">
                                    <div className="pb-2 border-b border-border/50 flex items-center gap-2">
                                        <MapPin className="w-5 h-5 text-primary" />
                                        <div>
                                            <h3 className="font-bold text-lg leading-tight">Operating Area</h3>
                                            <p className="text-[11px] text-muted-foreground">Define your base location and service radius.</p>
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        <LocationDetector onLocationDetected={handleLocationDetected} defaultLocation={watch("location")} />
                                    </div>

                                    <div className="space-y-4 pt-2">
                                        <div className="grid grid-cols-2 gap-3">
                                            <FormField control={control} name="location.city" render={({ field }) => (
                                                <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">City/Town</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" placeholder="Auto-detected" /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={control} name="location.state" render={({ field }) => (
                                                <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">State *</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" placeholder="Required" /></FormControl><FormMessage /></FormItem>
                                            )} />
                                        </div>
                                        <FormField control={control} name="location.address" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">Full Address *</FormLabel><FormControl><Textarea {...field} placeholder="Shop Number, Street, Landmark" className="rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all min-h-[80px] resize-none" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                </div>

                                <div className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-900/20 rounded-[1.5rem] shadow-sm border border-indigo-100/50 dark:border-indigo-900/50 p-5">
                                    <div className="grid grid-cols-2 gap-5">
                                        <FormField control={control} name="experience" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase text-foreground/80 font-bold tracking-wider flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Experience (Yrs)</FormLabel><FormControl><Input {...field} type="number" className="h-12 rounded-xl font-black text-lg bg-white/60 dark:bg-black/20 border-white/40 dark:border-white/10" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={control} name="serviceAreaRange" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase text-foreground/80 font-bold tracking-wider flex items-center gap-1.5"><Globe className="w-3.5 h-3.5" /> Range (km)</FormLabel><FormControl><Input {...field} type="number" className="h-12 rounded-xl font-black text-lg bg-white/60 dark:bg-black/20 border-white/40 dark:border-white/10" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 1: SERVICES */}
                        {currentStep === 1 && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5 space-y-4">
                                    <div className="pb-2 border-b border-border/50">
                                        <h3 className="font-bold text-lg flex items-center gap-2"><Car className="w-5 h-5 text-primary" /> Vehicle Types *</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Select the vehicles you service.</p>
                                    </div>
                                    {errors.vehicle_types && <p className="text-xs text-red-500 font-medium bg-red-50 p-2 rounded">Please select at least one vehicle type.</p>}
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        {VEHICLES.map(v => (
                                            <FormField key={v.id} control={control} name={`vehicle_types.${v.id}` as any} render={({ field }) => (
                                                <FormItem className={cn("border rounded-xl p-3 flex items-center gap-3 cursor-pointer transition-all relative overflow-hidden", field.value ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-muted/30 hover:bg-muted/60")} onClick={() => { field.onChange(!field.value); trigger("vehicle_types"); }}>
                                                    {field.value ? (
                                                        <div className="bg-primary text-white rounded flex items-center justify-center w-5 h-5 shrink-0 shadow-sm"><Check className="w-3.5 h-3.5" /></div>
                                                    ) : (
                                                        <div className="border-2 border-slate-300 rounded w-5 h-5 shrink-0" />
                                                    )}
                                                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", field.value ? "bg-primary text-white shadow-sm" : "bg-muted text-slate-400")}><v.icon className="w-4 h-4" /></div>
                                                    <div className="font-semibold text-sm leading-tight text-foreground">{v.label}</div>
                                                </FormItem>
                                            )} />
                                        ))}
                                    </div>
                                </div>

                                <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5 space-y-4">
                                    <div className="pb-2 border-b border-border/50">
                                        <h3 className="font-bold text-lg flex items-center gap-2"><Wrench className="w-5 h-5 text-primary" /> Services Offered *</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Choose the specific services you provide.</p>
                                    </div>
                                    {errors.specialties && <p className="text-xs text-red-500 font-medium bg-red-50 p-2 rounded">Please select at least one service.</p>}
                                    <div className="grid grid-cols-3 gap-2 pt-2">
                                        {ALL_SERVICES.map(s => {
                                            const isSelected = selectedServices?.includes(s.id);
                                            return (
                                                <div key={s.id} onClick={() => {
                                                    const c = selectedServices || [];
                                                    setValue("specialties", c.includes(s.id) ? c.filter((x: string) => x !== s.id) : [...c, s.id], { shouldValidate: true });
                                                }}
                                                    className={cn("flex flex-col items-center justify-between p-2 rounded-xl border text-center h-28 transition-all active:scale-95 relative", isSelected ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground/80")}>
                                                    <div className="absolute top-2 right-2">
                                                        {isSelected ? (
                                                            <div className="bg-primary text-white rounded flex items-center justify-center w-4 h-4 shadow-sm"><Check className="w-3 h-3" /></div>
                                                        ) : (
                                                            <div className="border-2 border-border/70 rounded w-4 h-4" />
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
                            <div className="space-y-6 animate-in fade-in">
                                <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5 space-y-4">
                                    <div className="pb-2 border-b border-border/50">
                                        <h3 className="font-bold text-lg">Identity Verification</h3>
                                        <p className="text-xs text-muted-foreground">Required for onboarding.</p>
                                    </div>
                                    <div className="space-y-4 pt-2">
                                        <FormField control={control} name="aadhaar_number" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] font-bold uppercase text-muted-foreground/80 tracking-wider">Aadhaar Number *</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all font-mono" maxLength={12} placeholder="12-digit Aadhaar" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={control} name="gst_number" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] font-bold uppercase text-muted-foreground/80 tracking-wider">GSTIN (Optional)</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all font-mono uppercase" placeholder="GST Number" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                </div>

                                <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5 space-y-4">
                                    <div className="pb-2 border-b border-border/50">
                                        <h3 className="font-bold text-lg">Shop Photos</h3>
                                        <p className="text-xs text-muted-foreground">Upload images of your garage/setup.</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 pt-2">
                                        <FormField control={control} name="documents.garage_front" render={({ field }) => <ImageUpload label="Shop Front" value={field.value} onChange={field.onChange} />} />
                                        <FormField control={control} name="documents.profile_photo" render={({ field }) => <ImageUpload label="Profile Photo" value={field.value} onChange={field.onChange} />} />
                                        <FormField control={control} name="documents.tools_photo" render={({ field }) => <ImageUpload label="Tools / Bay" value={field.value} onChange={field.onChange} />} />
                                        <FormField control={control} name="documents.facilities_photo" render={({ field }) => <ImageUpload label="Facilities" value={field.value} onChange={field.onChange} />} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 3: OPERATIONS */}
                        {currentStep === 3 && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5 space-y-4">
                                    <div className="pb-2 border-b border-border/50">
                                        <h3 className="font-bold text-lg flex items-center gap-2"><Clock className="w-5 h-5 text-primary" /> Working Hours</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Set your standard availability.</p>
                                    </div>
                                    <div className="space-y-4 pt-2">
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField control={control} name="working_hours.opening_time" render={({ field }) => (<FormItem><FormLabel className="text-[11px] font-bold uppercase text-muted-foreground/80 tracking-wider">Open</FormLabel><FormControl><Input type="time" {...field} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" /></FormControl></FormItem>)} />
                                            <FormField control={control} name="working_hours.closing_time" render={({ field }) => (<FormItem><FormLabel className="text-[11px] font-bold uppercase text-muted-foreground/80 tracking-wider">Close</FormLabel><FormControl><Input type="time" {...field} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" /></FormControl></FormItem>)} />
                                        </div>
                                        <FormField control={control} name="working_hours.weekly_off" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[11px] font-bold uppercase text-muted-foreground/80 tracking-wider">Weekly Off</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl><SelectTrigger className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all"><SelectValue placeholder="Select Day" /></SelectTrigger></FormControl>
                                                    <SelectContent>{["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </FormItem>
                                        )} />
                                        <div className="pt-2">
                                            <FormField control={control} name="working_hours.is_24x7" render={({ field }) => (
                                                <FormItem className={cn("flex items-center gap-3 p-4 rounded-xl border transition-all cursor-pointer", field.value ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card dark:bg-slate-900")} onClick={() => field.onChange(!field.value)}>
                                                    {field.value ? (
                                                        <div className="bg-primary text-white rounded flex items-center justify-center w-5 h-5 shrink-0"><Check className="w-3.5 h-3.5" /></div>
                                                    ) : (
                                                        <div className="border-2 border-slate-300 rounded w-5 h-5 shrink-0" />
                                                    )}
                                                    <span className="text-sm font-bold text-foreground">I am available 24/7</span>
                                                </FormItem>
                                            )} />
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5 space-y-4">
                                    <div className="pb-2 border-b border-border/50">
                                        <h3 className="font-bold text-lg flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" /> Application Usage</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Preferences for the ResQNow Partner App.</p>
                                    </div>
                                    <div className="pt-2">
                                        <FormField control={control} name="app_readiness.preferred_language" render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-[11px] font-bold uppercase text-muted-foreground/80 tracking-wider">Preferred Language</FormLabel>
                                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                    <FormControl><SelectTrigger className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all font-bold"><SelectValue /></SelectTrigger></FormControl>
                                                    <SelectContent><SelectItem value="English">English</SelectItem><SelectItem value="Tamil">Tamil</SelectItem><SelectItem value="Hindi">Hindi</SelectItem></SelectContent>
                                                </Select>
                                            </FormItem>
                                        )} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 4: PRICING */}
                        {currentStep === 4 && (
                            <div className="space-y-4 animate-in fade-in">
                                <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-900/20 p-4 rounded-[1.5rem] border border-amber-200 dark:border-amber-900/50 flex items-start gap-3 shadow-sm">
                                    <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-full shrink-0"><AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" /></div>
                                    <div>
                                        <h4 className="font-bold text-amber-900 dark:text-amber-200 text-sm">Base Pricing Config</h4>
                                        <p className="text-xs text-amber-800/80 dark:text-amber-400/80 mt-0.5 leading-relaxed">Set your standard base prices. We know every job is different; you can adjust the final price after physically inspecting the vehicle.</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {selectedServices.map((s, i) => <div className="[&>div]:rounded-[1.5rem] [&>div]:shadow-sm [&>div]:border-border/60 [&_input]:h-11 [&_input]:rounded-lg [&_input]:bg-muted/50 [&_input]:border-transparent [&_input:focus]:border-primary" key={s}><ServiceConfigCard serviceName={s} index={i} register={register} watch={watch} setValue={setValue} /></div>)}
                                </div>
                            </div>
                        )}

                        {/* STEP 5: BANKING */}
                        {currentStep === 5 && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5 space-y-4">
                                    <div className="pb-2 border-b border-border/50">
                                        <h3 className="font-bold text-lg flex items-center gap-2"><Wallet className="w-5 h-5 text-primary" /> Fastest Payout</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Receive earnings directly to your UPI.</p>
                                    </div>
                                    <div className="pt-2">
                                        <FormField control={control} name="payment_details.upi_id" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] font-bold uppercase text-muted-foreground/80 tracking-wider">UPI ID</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all font-mono" placeholder="e.g. number@upi" /></FormControl></FormItem>
                                        )} />
                                    </div>
                                </div>

                                <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5 space-y-4">
                                    <div className="pb-2 border-b border-border/50 flex items-center gap-2 text-foreground">
                                        <Building2 className="w-5 h-5 text-primary" />
                                        <div>
                                            <h3 className="font-bold text-lg">Bank Details</h3>
                                            <p className="text-xs text-muted-foreground mt-1">Alternative payout method.</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 pt-2">
                                        <FormField control={control} name="payment_details.bank_name" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] font-bold uppercase text-muted-foreground/80 tracking-wider">Bank Name</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" /></FormControl></FormItem>
                                        )} />
                                        <FormField control={control} name="payment_details.bank_account_number" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] font-bold uppercase text-muted-foreground/80 tracking-wider">Account Number</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all font-mono" type="password" /></FormControl></FormItem>
                                        )} />
                                        <FormField control={control} name="payment_details.ifsc_code" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] font-bold uppercase text-muted-foreground/80 tracking-wider">IFSC Code</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all font-mono uppercase" /></FormControl></FormItem>
                                        )} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 6: FINISH */}
                        {currentStep === 6 && (
                            <div className="bg-card dark:bg-slate-900 rounded-[2rem] shadow-lg border border-border/60 p-8 text-center space-y-8 animate-in zoom-in-95 duration-500">
                                <div className="relative w-28 h-28 mx-auto">
                                    <div className="absolute inset-0 bg-green-500 blur-[30px] opacity-20 rounded-full animate-pulse"></div>
                                    <div className="relative w-full h-full bg-gradient-to-br from-green-400 to-emerald-600 rounded-full flex items-center justify-center shadow-xl shadow-green-500/20 ring-8 ring-green-50 dark:ring-green-950/30">
                                        <Check className="w-12 h-12 text-white" strokeWidth={3} />
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-foreground drop-shadow-sm mb-2">Ready to Launch</h2>
                                    <p className="text-sm font-medium text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
                                        You are one step away from joining the fastest growing roadside assistance network.
                                    </p>
                                </div>
                                <div className="bg-muted/50 p-4 rounded-2xl border border-border/50 text-left">
                                    <FormField control={control} name="consent.agreed" render={({ field }) => (
                                        <FormItem className="flex items-start gap-4">
                                            <FormControl>
                                                <Checkbox checked={field.value} onCheckedChange={field.onChange} className="w-5 h-5 mt-0.5" />
                                            </FormControl>
                                            <div className="space-y-1">
                                                <FormLabel className="font-bold text-sm text-foreground">I agree to the Terms</FormLabel>
                                                <p className="text-[10px] text-muted-foreground leading-normal">By checking this box, I confirm all provided details are accurate and agree to the ResQNow Partner Platform conditions and background verification processes.</p>
                                            </div>
                                        </FormItem>
                                    )} />
                                </div>
                            </div>
                        )}

                        {currentStep === 6 && (
                            <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5">
                                <div className="flex items-start gap-4">
                                    <Checkbox
                                        checked={hasAcceptedTechnicianAgreement}
                                        onCheckedChange={(checked) => {
                                            const isChecked = checked === true;
                                            setHasAcceptedTechnicianAgreement(isChecked);
                                            if (isChecked) {
                                                setShowTechnicianAgreementError(false);
                                            }
                                        }}
                                        className="w-5 h-5 mt-0.5"
                                    />
                                    <div className="space-y-1">
                                        <p className="font-bold text-sm text-foreground">I have read and agree to the ResQNow Technician Agreement.</p>
                                        {showTechnicianAgreementError && (
                                            <p className="text-xs text-red-500">Please accept this agreement to submit.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SPACER FOR FIXED FOOTER */}
                        <div className="h-24" />

                    </form>
                </Form>
            </div>

            {/* FIXED BOTTOM ACTION BAR */}
            <div className="fixed bottom-0 left-0 right-0 bg-card dark:bg-slate-900 border-t p-4 px-6 z-50 flex gap-4 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
                {currentStep > 0 && (
                    <Button variant="outline" onClick={handleBack} className="flex-1 h-12 rounded-xl border-slate-300 text-muted-foreground font-bold">Back</Button>
                )}
                <Button onClick={handleNext} disabled={isSubmitting} className={cn("flex-[2] h-12 rounded-xl text-lg font-bold shadow-lg shadow-primary/20", currentStep === 6 ? "bg-green-600 hover:bg-green-700" : "bg-primary hover:bg-primary/90")}>
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : (currentStep === 6 ? "Submit Application" : "Continue")}
                </Button>
            </div>
        </div>
    );
};

export default TechnicianSignupWizard;
