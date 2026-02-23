import React, { useState } from "react";
import { toast } from "sonner";
import { useForm, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  technicianRegistrationSchema,
  RegisterFormValues
} from "@/types/technician-registration";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Step 1: Basic Info
const BasicInfoStep = () => {
  const { control } = useFormContext();
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control} name="name" render={({ field }) => (
          <FormItem>
            <FormLabel>Garage / Workshop Name</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={control} name="proprietor_name" render={({ field }) => (
          <FormItem>
            <FormLabel>Owner / Proprietor Name</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control} name="phone" render={({ field }) => (
          <FormItem>
            <FormLabel>Primary Mobile Number</FormLabel>
            <FormControl><Input {...field} type="tel" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={control} name="alternate_phone" render={({ field }) => (
          <FormItem>
            <FormLabel>Alternate Mobile (Optional)</FormLabel>
            <FormControl><Input {...field} type="tel" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control} name="whatsapp_number" render={({ field }) => (
          <FormItem>
            <FormLabel>WhatsApp Number</FormLabel>
            <FormControl><Input {...field} type="tel" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={control} name="email" render={({ field }) => (
          <FormItem>
            <FormLabel>Email ID (Optional)</FormLabel>
            <FormControl><Input {...field} type="email" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <Separator className="my-2" />
      <h3 className="font-semibold">Address Details</h3>

      <FormField control={control} name="address" render={({ field }) => (
        <FormItem>
          <FormLabel>Full Address (Door No / Street)</FormLabel>
          <FormControl><Textarea {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control} name="locality" render={({ field }) => (
          <FormItem>
            <FormLabel>Area / Locality</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={control} name="region" render={({ field }) => (
          <FormItem>
            <FormLabel>City / Town</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control} name="district" render={({ field }) => (
          <FormItem>
            <FormLabel>District</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={control} name="state" render={({ field }) => (
          <FormItem>
            <FormLabel>State</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <FormField control={control} name="google_maps_link" render={({ field }) => (
        <FormItem>
          <FormLabel>Google Maps Location Link</FormLabel>
          <FormControl><Input {...field} placeholder="https://maps.google.com/..." /></FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <Separator className="my-2" />
      <h3 className="font-semibold">Security</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control} name="password" render={({ field }) => (
          <FormItem>
            <FormLabel>Password</FormLabel>
            <FormControl><Input {...field} type="password" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={control} name="confirmPassword" render={({ field }) => (
          <FormItem>
            <FormLabel>Confirm Password</FormLabel>
            <FormControl><Input {...field} type="password" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
    </div>
  );
};

// Step 2: Identity & Services
const IdentityServicesStep = () => {
  const { control } = useFormContext();
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Identity & Verification</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control} name="aadhaar_number" render={({ field }) => (
          <FormItem>
            <FormLabel>Aadhaar Number</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={control} name="pan_number" render={({ field }) => (
          <FormItem>
            <FormLabel>PAN Number</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <FormField control={control} name="business_type" render={({ field }) => (
        <FormItem>
          <FormLabel>Business Type</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger>
                <SelectValue placeholder="Select business type" />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="Individual">Individual</SelectItem>
              <SelectItem value="Proprietorship">Proprietorship</SelectItem>
              <SelectItem value="Partnership">Partnership</SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control} name="gst_number" render={({ field }) => (
          <FormItem>
            <FormLabel>GST Number (Optional)</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={control} name="trade_license_number" render={({ field }) => (
          <FormItem>
            <FormLabel>Trade License (Optional)</FormLabel>
            <FormControl><Input {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <Separator />

      <h3 className="text-lg font-medium">Services Offered</h3>
      <div className="space-y-3">
        <FormLabel>Vehicle Types Supported</FormLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['two_wheeler', 'four_wheeler', 'commercial', 'heavy', 'ev'].map((type) => (
            <FormField key={type} control={control} name={`vehicle_types.${type}`} render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-3">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel className="capitalize">{type.replace('_', ' ')}</FormLabel>
                </div>
              </FormItem>
            )} />
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <FormLabel>Service Capabilities</FormLabel>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {[
            "Roadside puncture repair", "Tubeless puncture repair", "Battery jump-start",
            "Towing arrangement", "General servicing", "Engine repair",
            "Electrical work", "Brake & suspension", "Accident repair", "Spare parts replacement"
          ].map((service) => (
            <FormField key={service} control={control} name="specialties" render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value?.includes(service)}
                    onCheckedChange={(checked) => {
                      return checked
                        ? field.onChange([...(field.value || []), service])
                        : field.onChange(field.value?.filter((value: string) => value !== service))
                    }}
                  />
                </FormControl>
                <FormLabel className="font-normal text-sm">{service}</FormLabel>
              </FormItem>
            )} />
          ))}
        </div>
        <FormMessage />
      </div>

      <Separator />
      <h3 className="text-lg font-medium">Experience & Team</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control} name="experience" render={({ field }) => (
          <FormItem>
            <FormLabel>Years of Experience</FormLabel>
            <FormControl><Input type="number" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name="mechanic_count" render={({ field }) => (
          <FormItem>
            <FormLabel>Number of Mechanics</FormLabel>
            <FormControl><Input type="number" {...field} /></FormControl>
          </FormItem>
        )} />
      </div>

      <div className="space-y-3">
        <FormLabel>Specialization</FormLabel>
        <div className="flex gap-4">
          {['bike', 'car', 'diesel', 'ev'].map((spec) => (
            <FormField key={spec} control={control} name={`specialization.${spec}`} render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <FormLabel className="capitalize">{spec}</FormLabel>
              </FormItem>
            )} />
          ))}
        </div>
      </div>
    </div>
  );
};

// Step 3: Operations & Availability
const OperationsStep = () => {
  const { control } = useFormContext();
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Working Hours & Availability</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField control={control} name="opening_time" render={({ field }) => (
          <FormItem>
            <FormLabel>Opening Time</FormLabel>
            <FormControl><Input type="time" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={control} name="closing_time" render={({ field }) => (
          <FormItem>
            <FormLabel>Closing Time</FormLabel>
            <FormControl><Input type="time" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>

      <FormField control={control} name="weekly_off" render={({ field }) => (
        <FormItem>
          <FormLabel>Weekly Off (Day)</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger><SelectValue placeholder="Select day" /></SelectTrigger>
            </FormControl>
            <SelectContent>
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                <SelectItem key={day} value={day}>{day}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormItem>
      )} />

      <div className="flex gap-6">
        <FormField control={control} name="service_24x7" render={({ field }) => (
          <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded border p-3">
            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            <FormLabel>24x7 Service Available</FormLabel>
          </FormItem>
        )} />
        <FormField control={control} name="night_service" render={({ field }) => (
          <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded border p-3">
            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            <FormLabel>Night Service Available</FormLabel>
          </FormItem>
        )} />
      </div>

      <Separator />
      <h3 className="text-lg font-medium">Roadside Assistance Config</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FormField control={control} name="serviceAreaRange" render={({ field }) => (
          <FormItem>
            <FormLabel>Service Radius (km)</FormLabel>
            <FormControl><Input type="number" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name="response_time" render={({ field }) => (
          <FormItem>
            <FormLabel>Avg Response Time (mins)</FormLabel>
            <FormControl><Input type="number" {...field} /></FormControl>
          </FormItem>
        )} />
        <FormField control={control} name="emergency_service" render={({ field }) => (
          <FormItem className="flex flex-row items-center space-x-2 space-y-0 mt-8">
            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            <FormLabel>On-call Emergency?</FormLabel>
          </FormItem>
        )} />
      </div>
    </div>
  )
}

// Step 4: Costs
const CostsStep = () => {
  const { control } = useFormContext();
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Service Costs (Important)</h3>
      <Card className="p-4 bg-slate-50">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField control={control} name="inspection_2w" render={({ field }) => (
            <FormItem>
              <FormLabel>2-Wheeler Inspection Charge (₹)</FormLabel>
              <FormControl><Input type="number" {...field} /></FormControl>
            </FormItem>
          )} />
          <FormField control={control} name="inspection_4w" render={({ field }) => (
            <FormItem>
              <FormLabel>4-Wheeler Inspection Charge (₹)</FormLabel>
              <FormControl><Input type="number" {...field} /></FormControl>
            </FormItem>
          )} />
        </div>
        <FormField control={control} name="inspection_adjustable" render={({ field }) => (
          <FormItem className="flex flex-row items-center space-x-2 space-y-0 mt-2">
            <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
            <FormLabel>Inspection charge adjustable in final bill?</FormLabel>
          </FormItem>
        )} />
      </Card>

      <Card className="p-4 bg-slate-50">
        <FormLabel className="block mb-2 font-bold">Roadside Visit Charges</FormLabel>
        <div className="grid grid-cols-3 gap-4">
          <FormField control={control} name="visit_charge_base" render={({ field }) => (
            <FormItem>
              <FormLabel>Base Charge (₹)</FormLabel>
              <FormControl><Input type="number" {...field} /></FormControl>
            </FormItem>
          )} />
          <FormField control={control} name="visit_free_distance" render={({ field }) => (
            <FormItem>
              <FormLabel>Free Dist (km)</FormLabel>
              <FormControl><Input type="number" {...field} /></FormControl>
            </FormItem>
          )} />
          <FormField control={control} name="visit_extra_km_charge" render={({ field }) => (
            <FormItem>
              <FormLabel>Extra/km (₹)</FormLabel>
              <FormControl><Input type="number" {...field} /></FormControl>
            </FormItem>
          )} />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">2-Wheeler Puncture</h4>
          <div className="flex gap-2">
            <FormField control={control} name="labour_2w_puncture_min" render={({ field }) => (
              <Input placeholder="Min" type="number" {...field} />
            )} />
            <FormField control={control} name="labour_2w_puncture_max" render={({ field }) => (
              <Input placeholder="Max" type="number" {...field} />
            )} />
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">4-Wheeler Puncture</h4>
          <div className="flex gap-2">
            <FormField control={control} name="labour_4w_puncture_min" render={({ field }) => (
              <Input placeholder="Min" type="number" {...field} />
            )} />
            <FormField control={control} name="labour_4w_puncture_max" render={({ field }) => (
              <Input placeholder="Max" type="number" {...field} />
            )} />
          </div>
        </div>
      </div>
    </div>
  )
}

// Step 5: Payment & Final
const PaymentStep = ({ resumeFile, setResumeFile }: { resumeFile: File | null, setResumeFile: (f: File | null) => void }) => {
  const { control } = useFormContext();
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-medium">Payment & Tech Readiness</h3>
      <div className="space-y-2">
        <FormLabel>Accepted Payment Modes</FormLabel>
        <div className="flex gap-4">
          {['cash', 'upi', 'bank_transfer'].map(mode => (
            <FormField key={mode} control={control} name={`modes.${mode}`} render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                <FormLabel className="capitalize">{mode.replace('_', ' ')}</FormLabel>
              </FormItem>
            )} />
          ))}
        </div>
      </div>
      <FormField control={control} name="upi_id" render={({ field }) => (
        <FormItem>
          <FormLabel>UPI ID (Optional)</FormLabel>
          <FormControl><Input {...field} /></FormControl>
        </FormItem>
      )} />

      <Separator />

      <h3 className="text-lg font-medium">Document Uploads</h3>
      <div className="space-y-4">
        <FormItem>
          <FormLabel>Resume / CV / Certifications</FormLabel>
          <FormControl>
            <Input
              type="file"
              accept=".pdf, .doc, .docx, .jpg, .png"
              onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            />
          </FormControl>
          <p className="text-xs text-muted-foreground">Upload any relevant documents (Resume, ITI Cert, etc)</p>
        </FormItem>
      </div>

      <Separator />
      <FormField control={control} name="agreed_to_terms" render={({ field }) => (
        <FormItem className="flex flex-row items-center space-x-2 space-y-0 rounded bg-blue-50 p-4 border border-blue-200">
          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
          <div className="space-y-1">
            <FormLabel>I accept the terms and conditions</FormLabel>
            <p className="text-xs text-muted-foreground">
              I agree that platform usage is free, prices will be transparent, and I will maintain service quality.
            </p>
          </div>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  )
}

interface TechnicianRegistrationFormProps {
  onSubmit: (data: RegisterFormValues, resumeFile: File | null) => Promise<void>;
  isSubmitting: boolean;
}

const steps = [
  "Basic Info",
  "Identity & Services",
  "Operations & Costs",
  "Payment & App",
  "Documents"
];

export default function TechnicianRegistrationForm({ onSubmit, isSubmitting }: TechnicianRegistrationFormProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  const methods = useForm<RegisterFormValues>({
    resolver: zodResolver(technicianRegistrationSchema),
    defaultValues: {
      vehicle_types: { two_wheeler: false, four_wheeler: false, commercial: false, heavy: false, ev: false },
      specialties: [],
      specialization: { bike: false, car: false, diesel: false, ev: false },
      modes: { cash: false, upi: false, bank_transfer: false },
      spare_parts_provided: false,
      spare_parts_billed_separately: true,
      inspection_adjustable: false,
      cancellation_free: true,
      service_24x7: false,
      night_service: false,
      emergency_service: false,
    }
  });

  const nextStep = async () => {
    const fieldsToValidate: (keyof RegisterFormValues)[] = [];

    switch (currentStep) {
      case 0:
        fieldsToValidate.push("name", "proprietor_name", "phone", "email", "address", "district", "state", "locality", "google_maps_link", "password", "confirmPassword");
        break;
      case 1:
        fieldsToValidate.push("aadhaar_number", "pan_number", "business_type", "specialties");
        break;
      case 2:
        fieldsToValidate.push("opening_time", "closing_time", "serviceAreaRange", "response_time");
        break;
      case 3:
        // Costs are important but mostly optional or have defaults, but let's validate basics
        fieldsToValidate.push("visit_charge_base");
        break;
      case 4:
        fieldsToValidate.push("agreed_to_terms");
        break;
    }

    // We can also just trigger the full validation, but it might show errors for future steps. 
    // Ideally we list fields per step.
    const isValid = await methods.trigger(fieldsToValidate as any);
    if (isValid) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
    }
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const onFinalSubmit = async (data: RegisterFormValues) => {
    await onSubmit(data, resumeFile);
  };

  return (
    <FormProvider {...methods}>
      <Card className="w-full shadow-lg">
        <CardHeader className="bg-slate-50 border-b">
          <div className="flex justify-between items-center mb-4">
            {steps.map((step, idx) => (
              <div key={idx} className={`flex flex-col items-center z-10 ${idx <= currentStep ? "text-primary" : "text-gray-400"}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${idx <= currentStep ? "border-primary bg-primary text-white" : "border-gray-300 bg-white"}`}>
                  {idx < currentStep ? <CheckCircle2 className="w-5 h-5" /> : <span>{idx + 1}</span>}
                </div>
                <span className="text-xs mt-1 hidden sm:block">{step}</span>
              </div>
            ))}
          </div>
          <CardTitle>{steps[currentStep]}</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={methods.handleSubmit(onFinalSubmit)} className="space-y-6">

            {currentStep === 0 && <BasicInfoStep />}
            {currentStep === 1 && <IdentityServicesStep />}
            {currentStep === 2 && <OperationsStep />}
            {currentStep === 3 && <CostsStep />}
            {currentStep === 4 && <PaymentStep resumeFile={resumeFile} setResumeFile={setResumeFile} />}

            <div className="flex justify-between mt-8">
              <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 0}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>

              {currentStep < steps.length - 1 ? (
                <Button type="button" onClick={nextStep}>
                  Next <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Submit Application
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </FormProvider>
  );
}
