import React, { useState, useEffect, useId, useRef } from "react";
import { useForm, type FieldPath } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import LocationDetector, { type LocationState } from "./LocationDetector";
import DynamicPricingStep, { type PricingTemplate } from "./DynamicPricingStep";
import { technicianAuthService, technicianSchema, type TechnicianFormValues } from "@/services/technicianAuthService";
import { technicianAdminService } from "@/services/technicianAdminService";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import {
    Loader2, ArrowRight, Check, Car, MapPin, Wrench, CreditCard, ImagePlus, X,
    Clock, Truck,
    CheckCircle2, ChevronRight, Building2, Wallet,
    Globe, Briefcase, Smartphone, Bus, Pencil
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    normalizeSpecialtiesForApi,
    normalizeVehicleTypesForApi,
} from "@/config/technicianNormalization";
import { apiFetch, apiUrl } from "@/lib/api";
import {
    getSelectedSignupVehicleTypes,
    buildLegacySignupPricingConfig, filterSignupPricing, getSignupPricingError,
    SIGNUP_VEHICLES, SIGNUP_SERVICES,
} from "@/utils/technicianSignupPricing";

// --- Constants ---

const STEPS = [
    { id: 0, title: "Personal", subtitle: "Details" },
    { id: 1, title: "Services", subtitle: "Offerings" },
    { id: 2, title: "Verify", subtitle: "Docs" },
    { id: 3, title: "Operations", subtitle: "Hours" },
    { id: 4, title: "Pricing", subtitle: "Rates" },
    { id: 5, title: "Banking", subtitle: "Payouts" },
    { id: 6, title: "Preview", subtitle: "Review" },
    { id: 7, title: "Finish", subtitle: "Submit" },
];

const TOWING_FLEET_TYPES = [
    {
        id: "flatbed",
        label: "Flatbed Trucks",
        icon: Car,
        description: "For luxury and damaged cars",
    },
    {
        id: "wheel-lift",
        label: "Front-Lift / Wheel-Lift Trucks",
        icon: Truck,
        description: "For rapid urban towing",
    },
    {
        id: "heavy-duty-wrecker",
        label: "Heavy-Duty Wreckers",
        icon: Bus,
        description: "For commercial vehicles",
    },
] as const;

const toggleArrayValue = (values: string[], nextValue: string) =>
    values.includes(nextValue) ? values.filter((value) => value !== nextValue) : [...values, nextValue];


// --- Components ---

function TechnicianImageUpload({ value, onChange, label, onUploadStateChange }: { value?: string; onChange: (url: string) => void; label: string; onUploadStateChange?: (label: string, uploading: boolean) => void }) {
  const id = useId();
  const [uploading, setUploading] = useState(false);
  const [localPreview, setLocalPreview] = useState('');
  const [previewError, setPreviewError] = useState(false);
  const previewRef = useRef('');
  const uploadRef = useRef<AbortController | null>(null);
  useEffect(() => () => { if (previewRef.current) URL.revokeObjectURL(previewRef.current); uploadRef.current?.abort(); }, []);

  const clearPreview = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = ''; setLocalPreview(''); setPreviewError(false);
  };
  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please choose an image.'); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error('Choose an image smaller than 10 MB.'); return; }
    clearPreview();
    previewRef.current = URL.createObjectURL(file); setLocalPreview(previewRef.current);
    setUploading(true);
    onUploadStateChange?.(label, true);
    const controller = new AbortController(); uploadRef.current = controller;
    const body = new FormData(); body.append('file', file);
    try {
      const response = await fetch(apiUrl('/api/upload'), { method: 'POST', body, signal: controller.signal });
      const data = await response.json();
      if (!response.ok || typeof data.url !== 'string' || !data.url) throw new Error('Upload failed');
      // Store the original backend resource path; use the local preview immediately.
      onChange(data.url); toast.success(`${label} uploaded`);
    } catch (error) {
      if (!controller.signal.aborted) { clearPreview(); toast.error(error instanceof Error ? error.message : 'Upload failed. Please try again.'); }
    } finally { if (!controller.signal.aborted) { setUploading(false); onUploadStateChange?.(label, false); } }
  };
  const src = localPreview || (value ? (/^(https?:|blob:|data:)/.test(value) ? value : apiUrl(value)) : '');
  return <div className={`rq-upload ${src ? 'has-image' : ''}`}>
    <label htmlFor={id} className="rq-upload-target">
      {src && !previewError ? <img src={src} alt={`${label} preview`} onError={() => setPreviewError(true)} /> : <span className="rq-upload-placeholder"><ImagePlus size={22} /><strong>{label}</strong><small>{previewError ? 'Preview unavailable · replace photo' : 'Tap to add a photo'}</small></span>}
      {src && <span className="rq-upload-caption"><Check size={12} />{label}</span>}
      <input id={id} type="file" accept="image/*" aria-label={`Upload ${label}`} onChange={upload} disabled={uploading} />
    </label>
    {src && !uploading && <button type="button" className="rq-upload-remove" aria-label={`Remove ${label}`} onClick={() => { clearPreview(); onChange(''); }}><X size={14} /></button>}
    {uploading && <div className="rq-upload-busy" role="status"><Loader2 size={20} className="animate-spin" />Uploading…</div>}
  </div>;
}

function SignupPreviewSection({ title, step, onEdit, children }: { title: string; step: number; onEdit: (step: number) => void; children: React.ReactNode }) {
    return <section className="rq-signup-card rq-review-section">
        <div className="rq-review-heading"><h2>{title}</h2><button type="button" className="rq-text-button" aria-label={`Edit ${title}`} onClick={() => onEdit(step)}><Pencil size={12} />Edit</button></div>
        {children}
    </section>;
}

function SignupPreviewDetail({ label, value }: { label: string; value?: React.ReactNode }) {
    return <div><dt>{label}</dt><dd>{value === "" || value == null ? "Not provided" : value}</dd></div>;
}

function TechnicianApplicationPreview({ data, template, onEdit }: { data: TechnicianFormValues; template: PricingTemplate | null; onEdit: (step: number) => void }) {
    const vehicles = getSelectedSignupVehicleTypes(data.vehicle_types);
    const rows = template ? filterSignupPricing(data.pricing_config, template, data.specialties, vehicles) : [];
    const documentLabels = [{ key: "garage_front", label: "Shop Front" }, { key: "profile_photo", label: "Profile Photo" }, { key: "tools_photo", label: "Tools / Bay" }, { key: "facilities_photo", label: "Facilities" }] as const;
    const paymentModes = Object.entries(data.payment_details.modes).filter(([, enabled]) => enabled).map(([mode]) => mode === "upi" ? "UPI" : mode.charAt(0).toUpperCase() + mode.slice(1).replace(/_/g, " "));
    const amount = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return <div className="space-y-6" data-testid="signup-application-preview">
        <SignupPreviewSection title="Personal details" step={0} onEdit={onEdit}>
            <dl className="rq-review-grid">
                <SignupPreviewDetail label="Your name" value={data.proprietor_name} />
                <SignupPreviewDetail label="Shop name" value={data.name} />
                <SignupPreviewDetail label="Mobile number" value={data.phone} />
                <SignupPreviewDetail label="Alternate mobile" value={data.alternate_phone} />
                <SignupPreviewDetail label="Email address" value={data.email} />
                <SignupPreviewDetail label="Password" value={data.password ? "Set (hidden)" : "Not set"} />
                <SignupPreviewDetail label="Address" value={data.location.address} />
                <SignupPreviewDetail label="Locality" value={data.location.locality} />
                <SignupPreviewDetail label="City / town" value={data.location.city} />
                <SignupPreviewDetail label="District" value={data.location.district} />
                <SignupPreviewDetail label="State" value={data.location.state} />
                <SignupPreviewDetail label="Pincode" value={data.location.pincode} />
                <SignupPreviewDetail label="GPS location" value={data.location.latitude != null && data.location.longitude != null ? `${data.location.latitude}, ${data.location.longitude}` : ""} />
                <SignupPreviewDetail label="Experience" value={`${data.experience} years`} />
                <SignupPreviewDetail label="Service range" value={`${data.serviceAreaRange} km`} />
            </dl>
        </SignupPreviewSection>
        <SignupPreviewSection title="Services" step={1} onEdit={onEdit}>
            <dl className="rq-review-grid">
                <SignupPreviewDetail label="Vehicle types" value={SIGNUP_VEHICLES.filter(vehicle => vehicles.includes(vehicle.id)).map(vehicle => vehicle.label).join(" · ")} />
                <SignupPreviewDetail label="Services offered" value={data.specialties.map(service => SIGNUP_SERVICES.find(item => item.id === service)?.label || service).join(" · ")} />
                {data.specialties.includes("towing") && <SignupPreviewDetail label="Towing fleet" value={data.towing_fleet_types.map(fleet => TOWING_FLEET_TYPES.find(item => item.id === fleet)?.label || fleet).join(" · ")} />}
            </dl>
        </SignupPreviewSection>
        <SignupPreviewSection title="Verification" step={2} onEdit={onEdit}>
            <dl className="rq-review-grid"><SignupPreviewDetail label="Aadhaar number" value={data.aadhaar_number} /><SignupPreviewDetail label="GSTIN" value={data.gst_number} /></dl>
            <div className="rq-review-documents">{documentLabels.map(({ key, label }) => {
                const value = data.documents[key];
                const src = value && (/^(https?:|blob:|data:)/.test(value) ? value : apiUrl(value));
                return <figure key={key}>{src ? <img src={src} alt={`${label} application preview`} /> : <div className="rq-review-document-empty"><ImagePlus size={20} /><span>Not added</span></div>}<figcaption>{label}</figcaption></figure>;
            })}</div>
        </SignupPreviewSection>
        <SignupPreviewSection title="Operations" step={3} onEdit={onEdit}>
            <dl className="rq-review-grid">
                <SignupPreviewDetail label="Availability" value={data.working_hours.is_24x7 ? "24 × 7" : "Scheduled hours"} />
                {!data.working_hours.is_24x7 && <><SignupPreviewDetail label="Open" value={data.working_hours.opening_time} /><SignupPreviewDetail label="Close" value={data.working_hours.closing_time} /><SignupPreviewDetail label="Weekly off" value={data.working_hours.weekly_off} /></>}
                <SignupPreviewDetail label="Preferred language" value={data.app_readiness.preferred_language} />
            </dl>
        </SignupPreviewSection>
        <SignupPreviewSection title="Pricing" step={4} onEdit={onEdit}>
            {data.specialties.map(service => <div className="rq-review-pricing-group" key={service}>
                <h3>{SIGNUP_SERVICES.find(item => item.id === service)?.label || service}</h3>
                {vehicles.map(vehicle => {
                    const vehicleRows = rows.filter(row => row.pricing_json.service_domain === service && row.pricing_json.vehicle_type === vehicle);
                    const vehicleLabel = SIGNUP_VEHICLES.find(item => item.id === vehicle)?.label || vehicle;
                    return vehicleRows.length ? vehicleRows.map(row => <div className="rq-review-pricing-row" key={`${vehicle}:${row.pricing_json.vehicle_subtype}`}>
                        <h4>{vehicleLabel} · {row.pricing_json.vehicle_subtype_label}</h4>
                        <dl className="rq-review-grid">{template?.pricingFields.filter(field => String(field.service_id) === String(row.service_id)).map(field => {
                            const raw = row.pricing_json[field.field_key];
                            const value = raw === "" || raw == null || !Number.isFinite(Number(raw)) ? "Not set" : /distance|free_km/i.test(field.field_key) ? `${raw} km` : amount.format(Number(raw));
                            return <SignupPreviewDetail key={field.id} label={field.field_label} value={value} />;
                        })}</dl>
                    </div>) : <p className="rq-review-missing" key={vehicle}>{vehicleLabel} · Pricing not added</p>;
                })}
            </div>)}
        </SignupPreviewSection>
        <SignupPreviewSection title="Banking" step={5} onEdit={onEdit}>
            <dl className="rq-review-grid">
                <SignupPreviewDetail label="Payout methods" value={paymentModes.join(" · ")} />
                <SignupPreviewDetail label="UPI ID" value={data.payment_details.upi_id} />
                <SignupPreviewDetail label="Bank name" value={data.payment_details.bank_name} />
                <SignupPreviewDetail label="Account number" value={data.payment_details.bank_account_number} />
                <SignupPreviewDetail label="IFSC code" value={data.payment_details.ifsc_code} />
            </dl>
        </SignupPreviewSection>
    </div>;
}

const TechnicianSignupWizard = ({ variant = "public" }: { variant?: "public" | "admin" }) => {
    const isAdmin = variant === "admin";
    const mainRef = useRef<HTMLElement>(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [isEditingPreview, setIsEditingPreview] = useState(false);
    const [pricingTemplate, setPricingTemplate] = useState<PricingTemplate | null>(null);
    const [pricingLoading, setPricingLoading] = useState(true);
    const [pricingLoadError, setPricingLoadError] = useState("");
    const [pricingError, setPricingError] = useState("");
    const loadPricing = React.useCallback(async () => {
        setPricingLoading(true); setPricingLoadError("");
        try {
            const response = await apiFetch("/api/technicians/pricing-template");
            if (!response.ok) throw new Error("Could not load pricing options");
            const data = await response.json();
            if (![data.services, data.categories, data.pricingFields].every(Array.isArray)) throw new Error("Invalid pricing options");
            setPricingTemplate({ ...data, subcategories: data.subcategories || [] });
        } catch { setPricingLoadError("We couldn't load pricing options. Please try again."); }
        finally { setPricingLoading(false); }
    }, []);

    useEffect(() => { void loadPricing(); }, [loadPricing]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [uploadingDocuments, setUploadingDocuments] = useState<string[]>([]);
    const handleUploadStateChange = React.useCallback((label: string, uploading: boolean) => {
        setUploadingDocuments(previous => uploading ? [...new Set([...previous, label])] : previous.filter(item => item !== label));
    }, []);
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
            vehicle_types: { bike: false, car: false, commercial: false, ev: false },
            specialties: [],
            towing_fleet_types: [],
            pricing_config: [],
            working_hours: { opening_time: "", closing_time: "", weekly_off: "None", is_24x7: false },
            payment_details: { modes: { cash: true }, upi_id: "", bank_name: "", bank_account_number: "", ifsc_code: "" },
            app_readiness: { has_smartphone: false, preferred_language: "English" },
            documents: { garage_front: "", profile_photo: "", tools_photo: "", facilities_photo: "" },
            consent: { agreed: false },
        }
    });

    const { control, watch, setValue, trigger, formState: { errors } } = form;
    const selectedServices = watch("specialties") || [];
    const selectedVehicleTypeMap = watch("vehicle_types");
    const selectedVehicleTypes = getSelectedSignupVehicleTypes(selectedVehicleTypeMap);
    const towingFleetTypes = watch("towing_fleet_types") || [];
    const pricingValue = watch("pricing_config") || [];
    const hours = watch("working_hours");
    const emailEntered = Boolean(watch("email")?.trim());
    const hasScheduledHours = Boolean(hours.opening_time || hours.closing_time);
    const consentAgreed = watch("consent.agreed");

    const handleLocationDetected = React.useCallback((loc: LocationState) => {
        setValue("location", loc);
    }, [setValue]);

    // Scroll to top on step change
    useEffect(() => {
        if (isAdmin && mainRef.current) mainRef.current.scrollTop = 0;
        else window.scrollTo(0, 0);
    }, [currentStep, isAdmin]);

    const handleNext = async () => {
        if (uploadingDocuments.length) { toast.error("Please wait for your photos to finish uploading."); return; }
        let fields: FieldPath<TechnicianFormValues>[] = [];
        if (currentStep === 0) fields = ["proprietor_name", "name", "email", "password", "confirmPassword", "phone", "location", "experience", "serviceAreaRange"];
        if (currentStep === 1) fields = ["specialties", "vehicle_types", "towing_fleet_types"];
        if (currentStep === 2) fields = ["aadhaar_number", "documents"];
        if (currentStep === 3) fields = ["working_hours", "app_readiness"];
        if (currentStep === 4 || currentStep === 6 || currentStep === 7) {
            const message = !pricingTemplate || pricingLoadError ? "Please load the pricing options before continuing." : getSignupPricingError(filterSignupPricing(form.getValues("pricing_config"), pricingTemplate, selectedServices, selectedVehicleTypes), pricingTemplate, selectedServices, selectedVehicleTypes);
            setPricingError(message || "");
            if (message) { toast.error(message); return; }
        }
        if (currentStep === 6) fields = ["proprietor_name", "name", "email", "password", "confirmPassword", "phone", "alternate_phone", "location", "experience", "serviceAreaRange", "specialties", "vehicle_types", "towing_fleet_types", "aadhaar_number", "gst_number", "documents", "working_hours", "app_readiness", "pricing_config", "payment_details"];
        if (currentStep === 7) fields = ["consent"];

        const isValid = await trigger(fields);
        if (isValid) {
            if (currentStep === 7 && !hasAcceptedTechnicianAgreement) {
                setShowTechnicianAgreementError(true);
                toast.error("Please accept the ResQNow Technician Agreement.");
                return;
            }
            if (isEditingPreview) { setIsEditingPreview(false); setCurrentStep(6); }
            else if (currentStep < STEPS.length - 1) setCurrentStep(prev => prev + 1);
            else {
                const allValid = await trigger();
                if (!allValid) { toast.error("Please check the required details in your application."); return; }
                await onSubmit(form.getValues());
            }
        } else {
            console.log("Validation Errors:", errors);
            toast.error("Please fill required fields.");
        }
    };

    const handleBack = () => {
        if (uploadingDocuments.length) return;
        if (isEditingPreview) { setIsEditingPreview(false); setCurrentStep(6); }
        else setCurrentStep(prev => Math.max(0, prev - 1));
    };

    const onSubmit = async (data: TechnicianFormValues) => {
        setIsSubmitting(true);
        try {
            if (data.password !== data.confirmPassword) { toast.error("Password mismatch"); return; }
            const normalizedSpecialties = normalizeSpecialtiesForApi(data.specialties);
            const normalizedVehicleTypes = normalizeVehicleTypesForApi(data.vehicle_types);
            const filteredPricing = pricingTemplate ? filterSignupPricing(data.pricing_config, pricingTemplate, normalizedSpecialties, getSelectedSignupVehicleTypes(normalizedVehicleTypes)) : [];
            const legacyPricing = buildLegacySignupPricingConfig(filteredPricing).map(entry => entry.service_domain === "towing" ? { ...entry, towing_fleet_types: towingFleetTypes } : entry);
            const payload = {
                ...data,
                specialties: normalizedSpecialties,
                vehicle_types: normalizedVehicleTypes,
                pricing_config: legacyPricing,
                dynamic_pricing_config: filteredPricing,
                technician_agreement_accepted: hasAcceptedTechnicianAgreement,
                working_hours: data.working_hours.is_24x7 ? { is_24x7: true, opening_time: "", closing_time: "", weekly_off: "None" } : data.working_hours,
                address: data.location.address,
                latitude: data.location.latitude,
                longitude: data.location.longitude,
                region: data.location.city,
                locality: data.location.locality,
                district: data.location.district,
                state: data.location.state,
                service_type: data.specialties[0] || "other",
                service_costs: legacyPricing,
                pricing: {},
                whatsapp_number: data.phone
            };

            if (isAdmin) {
                await technicianAdminService.createTechnician({ ...payload, status: "pending" });
                toast.success("Technician created successfully!");
                navigate("/admin/technicians");
            } else {
                await technicianAuthService.register(payload);
                toast.success("Submitted!");
                navigate("/technician/login");
            }
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "Registration failed. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={cn("rq-signup", isAdmin && "rq-signup--admin")}>
            {!isAdmin && <header className="rq-signup-header">
                <a href="/" aria-label="ResQNow home"><img src="/images/resqnow-wordmark.png" alt="ResQNow" /></a>
                <span className="rq-signup-header-label">PARTNER REGISTRATION</span>
                <a href="/technician/login">Already a partner? <strong>Log in <ArrowRight size={14} /></strong></a>
            </header>}
            <div className="rq-signup-layout">
                <aside className="rq-signup-sidebar">
                    <div className="rq-signup-kicker">{isAdmin ? "ADD TECHNICIAN" : "LET'S GET YOU STARTED"}</div>
                    <h2>{isAdmin ? "Technician onboarding" : <>Your skills.<br />Our network.</>}</h2>
                    <p>{isAdmin ? "Complete the registration details, then review before adding the technician." : "Help drivers get back on the road. Build your business with ResQNow."}</p>
                    <nav aria-label="Registration progress">
                        {STEPS.map((step, index) => <button type="button" key={step.id} disabled={index > currentStep || uploadingDocuments.length > 0} onClick={() => { setIsEditingPreview(false); setCurrentStep(index); }}
                            aria-current={index === currentStep ? "step" : undefined} className={index === currentStep ? "is-current" : index < currentStep ? "is-complete" : ""}>
                            <span>{index < currentStep ? <Check size={15} /> : String(index + 1).padStart(2, "0")}</span>
                            <div><strong>{step.title}</strong><small>{step.subtitle}</small></div>
                            {index === currentStep && <ChevronRight size={15} />}
                        </button>)}
                    </nav>
                    <div className="rq-signup-sidebar-note"><CheckCircle2 size={18} /><span>Your details are kept secure.<br />Our team reviews every application.</span></div>
                </aside>
                <main ref={mainRef} className="rq-signup-main">
                    <div className="rq-signup-mobile-progress"><span>Step {currentStep + 1} of {STEPS.length} · {STEPS[currentStep].title}</span><div><i style={{ width: ((currentStep + 1) / STEPS.length * 100) + "%" }} /></div></div>
                    <div className="rq-signup-intro">
                        <span className="rq-signup-kicker">STEP {String(currentStep + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}</span>
                        <h1>{["Let's get to know you.", "What do you work on?", "A little proof. A lot of trust.", "Your hours. Your choice.", "Your expertise. Your rates.", "Let's set up your payouts.", "Review your application.", "You're almost on the road."][currentStep]}</h1>
                        <p>{["Tell us about yourself and your workshop. Fields marked * are required.", "Choose the vehicles and services you can confidently support.", "Help us verify your identity and get to know your workshop.", "Tell drivers when you're available to help.", "Set prices for the services and vehicles you selected. One type at a time.", "Add your preferred payout details for the jobs you complete.", "Check your details below. Use Edit on any section to make a change.", "Review your details and accept both agreements to send your application."][currentStep]}</p>
                    </div>
                <Form {...form}>
                    <form className="space-y-6" onSubmit={event => { event.preventDefault(); void handleNext(); }}>

                        {/* STEP 0: PERSONAL */}
                        {currentStep === 0 && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5 space-y-4">
                                    <div className="pb-2 border-b border-border/50">
                                        <h3 className="font-bold text-lg">Personal & contact details</h3>
                                        <p className="text-xs text-muted-foreground">Email and password are optional. If you add an email, a password is required.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <FormField control={control} name="proprietor_name" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">Your Name *</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" placeholder="Your full name" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={control} name="name" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">Shop Name *</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" placeholder="e.g. John's Garage" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <div className="grid grid-cols-2 gap-3">
                                            <FormField control={control} name="phone" render={({ field }) => (
                                                <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">Mobile Number *</FormLabel><FormControl><Input {...field} type="tel" className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={control} name="alternate_phone" render={({ field }) => (
                                                <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">Alt Mobile (Opt)</FormLabel><FormControl><Input {...field} type="tel" className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" /></FormControl><FormMessage /></FormItem>
                                            )} />
                                        </div>
                                        <FormField control={control} name="email" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">Email Address <span className="rq-optional">Optional</span></FormLabel><FormControl><Input {...field} type="email" className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" placeholder="contact@example.com" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <div className="grid grid-cols-2 gap-3">
                                            <FormField control={control} name="password" render={({ field }) => (
                                                <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">Password {emailEntered ? "*" : <span className="rq-optional">Optional</span>}</FormLabel><FormControl><Input {...field} type="password" autoComplete="new-password" placeholder="At least 8 characters" className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" /></FormControl><FormMessage /></FormItem>
                                            )} />
                                            <FormField control={control} name="confirmPassword" render={({ field }) => (
                                                <FormItem><FormLabel className="text-[11px] uppercase text-muted-foreground/80 font-bold tracking-wider">Confirm Password {watch("password") ? "*" : <span className="rq-optional">Optional</span>}</FormLabel><FormControl><Input {...field} type="password" className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" /></FormControl><FormMessage /></FormItem>
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

                                <div className="bg-gradient-to-br from-indigo-50 to-red-50 dark:from-indigo-950/30 dark:to-red-900/20 rounded-[1.5rem] shadow-sm border border-indigo-100/50 dark:border-indigo-900/50 p-5">
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
                                        {SIGNUP_VEHICLES.map(v => <FormField key={v.id} control={control} name={`vehicle_types.${v.id}`} render={({ field }) => (
                                            <button type="button" aria-label={v.label} aria-pressed={Boolean(field.value)} className={cn("rq-choice rq-vehicle-choice", field.value && "is-selected")}
                                                onClick={() => { field.onChange(!field.value); void trigger("vehicle_types"); }}>
                                                <img src={v.image} alt="" /><span><strong>{v.label}</strong><small>{v.description}</small></span>
                                                <i>{field.value && <Check size={12} />}</i>
                                            </button>
                                        )} />)}
                                    </div>
                                </div>

                                <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5 space-y-4">
                                    <div className="pb-2 border-b border-border/50">
                                        <h3 className="font-bold text-lg flex items-center gap-2"><Wrench className="w-5 h-5 text-primary" /> Services Offered *</h3>
                                        <p className="text-xs text-muted-foreground mt-1">Choose the specific services you provide.</p>
                                    </div>
                                    {errors.specialties && <p className="text-xs text-red-500 font-medium bg-red-50 p-2 rounded">Please select at least one service.</p>}
                                    <div className="grid grid-cols-3 gap-2 pt-2">
                                        {SIGNUP_SERVICES.map(s => <button type="button" key={s.id} aria-label={s.label} aria-pressed={selectedServices.includes(s.id)}
                                            className={cn("rq-choice rq-service-choice", selectedServices.includes(s.id) && "is-selected")}
                                            onClick={() => setValue("specialties", toggleArrayValue(selectedServices, s.id), { shouldValidate: true, shouldDirty: true })}>
                                            <img src={`/images/home/services/${s.id}.webp`} alt="" /><strong>{s.label}</strong><i>{selectedServices.includes(s.id) && <Check size={12} />}</i>
                                        </button>)}
                                    </div>
                                </div>

                                {selectedServices.includes("towing") && (
                                    <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5 space-y-4">
                                        <div className="pb-2 border-b border-border/50">
                                            <h3 className="font-bold text-lg flex items-center gap-2"><Truck className="w-5 h-5 text-primary" /> Tow Truck Fleet *</h3>
                                            <p className="text-xs text-muted-foreground mt-1">What kind of tow trucks do you have in your fleet? Tap all that apply.</p>
                                        </div>
                                        {errors.towing_fleet_types && (
                                            <p className="text-xs text-red-500 font-medium bg-red-50 p-2 rounded">
                                                Please select at least one tow truck type.
                                            </p>
                                        )}
                                        <div className="grid gap-3 pt-2 md:grid-cols-3">
                                            {TOWING_FLEET_TYPES.map((fleetType) => {
                                                const isSelected = towingFleetTypes.includes(fleetType.id);
                                                const FleetIcon = fleetType.icon;

                                                return (
                                                    <button
                                                        key={fleetType.id}
                                                        type="button"
                                                        onClick={() => {
                                                            setValue(
                                                                "towing_fleet_types",
                                                                toggleArrayValue(towingFleetTypes, fleetType.id),
                                                                { shouldDirty: true, shouldValidate: true }
                                                            );
                                                            trigger("towing_fleet_types");
                                                        }}
                                                        className={cn(
                                                            "rounded-2xl border p-4 text-left transition-all",
                                                            isSelected
                                                                ? "border-primary bg-primary/5 shadow-sm"
                                                                : "border-border bg-muted/20 hover:bg-muted/60"
                                                        )}
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className={cn(
                                                                "flex h-11 w-11 items-center justify-center rounded-full",
                                                                isSelected ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                                                            )}>
                                                                <FleetIcon className="h-5 w-5" />
                                                            </div>
                                                            {isSelected ? (
                                                                <div className="flex h-5 w-5 items-center justify-center rounded bg-primary text-white">
                                                                    <Check className="h-3.5 w-3.5" />
                                                                </div>
                                                            ) : (
                                                                <div className="h-5 w-5 rounded border-2 border-border" />
                                                            )}
                                                        </div>
                                                        <p className="mt-3 text-sm font-semibold text-foreground">{fleetType.label}</p>
                                                        <p className="mt-1 text-xs text-muted-foreground">{fleetType.description}</p>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
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
                                    <div className="rq-upload-grid">
                                        <FormField control={control} name="documents.garage_front" render={({ field }) => <TechnicianImageUpload label="Shop Front" value={field.value} onChange={field.onChange} onUploadStateChange={handleUploadStateChange} />} />
                                        <FormField control={control} name="documents.profile_photo" render={({ field }) => <TechnicianImageUpload label="Profile Photo" value={field.value} onChange={field.onChange} onUploadStateChange={handleUploadStateChange} />} />
                                        <FormField control={control} name="documents.tools_photo" render={({ field }) => <TechnicianImageUpload label="Tools / Bay" value={field.value} onChange={field.onChange} onUploadStateChange={handleUploadStateChange} />} />
                                        <FormField control={control} name="documents.facilities_photo" render={({ field }) => <TechnicianImageUpload label="Facilities" value={field.value} onChange={field.onChange} onUploadStateChange={handleUploadStateChange} />} />
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
                                        <p className="text-xs text-muted-foreground mt-1">Choose fixed working hours or round-the-clock availability.</p>
                                    </div>
                                    <div className="space-y-4 pt-2">
                                        <div className={cn("grid grid-cols-2 gap-4", hours.is_24x7 && "opacity-40")}>
                                            <FormField control={control} name="working_hours.opening_time" render={({ field }) => (<FormItem><FormLabel className="text-[11px] font-bold uppercase text-muted-foreground/80 tracking-wider">Open</FormLabel><FormControl><Input type="time" {...field} disabled={hours.is_24x7} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" /></FormControl><FormMessage /></FormItem>)} />
                                            <FormField control={control} name="working_hours.closing_time" render={({ field }) => (<FormItem><FormLabel className="text-[11px] font-bold uppercase text-muted-foreground/80 tracking-wider">Close</FormLabel><FormControl><Input type="time" {...field} disabled={hours.is_24x7} className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all" /></FormControl><FormMessage /></FormItem>)} />
                                        </div>
                                        <FormField control={control} name="working_hours.weekly_off" render={({ field }) => (
                                            <FormItem className={hours.is_24x7 ? "opacity-40" : ""}>
                                                <FormLabel className="text-[11px] font-bold uppercase text-muted-foreground/80 tracking-wider">Weekly Off</FormLabel>
                                                <Select onValueChange={field.onChange} value={field.value} disabled={hours.is_24x7}>
                                                    <FormControl><SelectTrigger className="h-12 rounded-xl bg-muted/50 border-transparent focus:border-primary focus:bg-card focus:ring-4 focus:ring-primary/10 transition-all"><SelectValue placeholder="Select Day" /></SelectTrigger></FormControl>
                                                    <SelectContent>{["None", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                                                </Select>
                                            </FormItem>
                                        )} />
                                        <div className="pt-2">
                                            {hasScheduledHours && <button type="button" className="rq-text-button" onClick={() => { setValue("working_hours.opening_time", ""); setValue("working_hours.closing_time", ""); setValue("working_hours.weekly_off", "None"); }}>Clear hours to choose 24/7</button>}
                                            <FormField control={control} name="working_hours.is_24x7" render={({ field }) => (
                                                <FormItem className={cn("rq-availability", field.value && "is-selected", hasScheduledHours && "is-disabled")}>
                                                    <FormControl><Checkbox checked={field.value} onCheckedChange={checked => field.onChange(checked === true)} disabled={hasScheduledHours} /></FormControl>
                                                    <div><FormLabel>I am available 24 × 7</FormLabel><p>Ready to help, any day and any time.</p></div>
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
                                <div className="rq-signup-tip"><CreditCard size={19} /><div><strong>Clear prices. Confident customers.</strong><p>Only your selected services and vehicles appear below. Enter amounts in rupees.</p></div></div>
                                {pricingLoading ? <div className="rq-signup-card rq-loading"><Loader2 className="animate-spin" /> Loading pricing options…</div> : pricingTemplate && <DynamicPricingStep
                                    {...pricingTemplate} selectedServiceIds={selectedServices} selectedVehicleTypes={selectedVehicleTypes}
                                    value={pricingValue} onChange={data => { setValue("pricing_config", data, { shouldDirty: true }); setPricingError(""); }} />}
                                {pricingLoadError && <p className="rq-signup-error" role="alert">{pricingLoadError}</p>}
                                {!pricingLoading && <button type="button" className="rq-text-button" onClick={() => void loadPricing()}>Reload pricing options</button>}
                                {pricingError && <p className="rq-signup-error" role="alert">{pricingError}</p>}
                            </div>
                        )}

                        {/* STEP 5: PAYOUTS */}
                        {currentStep === 5 && (
                            <div className="space-y-6 animate-in fade-in">
                                <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] shadow-sm border border-border/60 p-5 space-y-4">
                                    <div className="pb-2 border-b border-border/50 flex items-center gap-2 text-foreground">
                                        <Wallet className="w-5 h-5 text-primary" />
                                        <div>
                                            <h3 className="font-bold text-lg">Payout Methods</h3>
                                            <p className="text-xs text-muted-foreground mt-1">How you receive your earnings.</p>
                                        </div>
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

                        {/* STEP 6: APPLICATION PREVIEW */}
                        {currentStep === 6 && (
                            <div className="space-y-6">
                                {pricingError && <p className="rq-signup-error" role="alert">{pricingError}</p>}
                                <TechnicianApplicationPreview data={form.getValues()} template={pricingTemplate} onEdit={step => { setPricingError(""); setIsEditingPreview(true); setCurrentStep(step); }} />
                            </div>
                        )}

                        {/* STEP 7: FINISH */}
                        {currentStep === 7 && (
                            <div className="bg-card dark:bg-slate-900 rounded-[2rem] shadow-lg border border-border/60 p-8 text-center space-y-8 animate-in zoom-in-95 duration-500">
                                <div className="relative w-28 h-28 mx-auto">
                                    <div className="absolute inset-0 bg-primary blur-[30px] opacity-10 rounded-full"></div>
                                    <div className="relative w-full h-full bg-primary rounded-full flex items-center justify-center shadow-xl shadow-primary/10 ring-8 ring-red-50">
                                        <Check className="w-12 h-12 text-white" strokeWidth={3} />
                                    </div>
                                </div>
                                <div>
                                    <h2 className="text-3xl font-black text-foreground drop-shadow-sm mb-2">Ready when you are.</h2>
                                    <p className="text-sm font-medium text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
                                        Your application will be reviewed by our team. We’ll contact you on your registered phone number.
                                    </p>
                                </div>
                                <div className="rq-consent-container" data-testid="signup-consents">
                                    <FormField control={control} name="consent.agreed" render={({ field }) => (
                                        <FormItem className="flex items-start gap-4">
                                            <FormControl>
                                                <Checkbox checked={field.value} onCheckedChange={field.onChange} className="w-5 h-5 mt-0.5" />
                                            </FormControl>
                                            <div className="space-y-1">
                                                <FormLabel className="font-bold text-sm text-foreground">I confirm my details and agree to the Terms *</FormLabel>
                                                <p className="text-[10px] text-muted-foreground leading-normal">By checking this box, I confirm all provided details are accurate and agree to the ResQNow Partner Platform conditions and background verification processes.</p>
                                                <FormMessage />
                                            </div>
                                        </FormItem>
                                    )} />
                                    <div className="rq-consent-divider" />
                                    <div className="flex items-start gap-4">
                                        <Checkbox id="technician-agreement" checked={hasAcceptedTechnicianAgreement} onCheckedChange={checked => { setHasAcceptedTechnicianAgreement(checked === true); setShowTechnicianAgreementError(false); }} />
                                        <div><Label htmlFor="technician-agreement">I have read and agree to the ResQNow Technician Agreement *</Label>
                                            <button type="button" className="rq-text-button" onClick={() => { setCurrentStep(0); setIsTechnicianAgreementOpen(true); }}>Read technician agreement <ArrowRight size={12} /></button>
                                            {showTechnicianAgreementError && <p className="rq-signup-error">Please accept the technician agreement.</p>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SPACER FOR THE PUBLIC FORM'S FIXED FOOTER */}
                        {!isAdmin && <div className="h-24" />}

                    </form>
                </Form>
                </main>
            </div>

            {/* FIXED BOTTOM ACTION BAR */}
            <div className="rq-signup-footer">
                {isAdmin && <span className="rq-signup-footer-progress">Step {currentStep + 1} of {STEPS.length}<strong>{STEPS[currentStep].title}</strong></span>}
                {(currentStep > 0 || isEditingPreview) && (
                    <Button variant="outline" onClick={handleBack} disabled={uploadingDocuments.length > 0 || isSubmitting} className="flex-1 h-12 rounded-xl border-slate-300 text-muted-foreground font-bold">{isEditingPreview ? "Back to preview" : "Back"}</Button>
                )}
                <Button type="button" onClick={handleNext} disabled={isSubmitting || uploadingDocuments.length > 0 || (currentStep === 7 && (!consentAgreed || !hasAcceptedTechnicianAgreement))} className="flex-[2] h-12 rounded-xl text-lg font-bold shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90">
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : uploadingDocuments.length ? "Uploading photos…" : isEditingPreview ? "Save & return to preview" : (currentStep === 7 ? (isAdmin ? "Add Technician" : "Submit Application") : "Continue")}
                </Button>
            </div>
        </div>
    );
};

export default TechnicianSignupWizard;
