
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { RegisterFormValues } from "@/types/technician-registration";
import { validateResumeFile } from "@/utils/resumeUploadUtils";

export const useTechnicianRegistrationForm = () => {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const formSchema = z.object({
    name: z.string().min(2, "Full name is required"),
    email: z.string().email("Valid email is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
    phone: z.string().min(10, "Valid phone number is required"),
    address: z.string().min(5, "Address is required"),
    region: z.string().min(1, "Region is required"),
    district: z.string().min(1, "District is required"),
    state: z.string().min(1, "State is required"),
    locality: z.string().optional(),
    serviceAreaRange: z.number().min(1, "Service area range is required"),
    experience: z.number().min(0, "Experience is required"),
    specialties: z.array(z.string()).min(1, "Select at least one specialty"),
    pricing: z.object({
      towing: z.number().min(0, "Price required"),
      tireChange: z.number().min(0, "Price required"),
      jumpStart: z.number().min(0, "Price required"),
      fuelDelivery: z.number().min(0, "Price required"),
      lockout: z.number().min(0, "Price required"),
      winching: z.number().min(0, "Price required")
    }),
    termsAccepted: z.boolean().refine(val => val === true, {
      message: "You must accept the terms and conditions",
    })
  }).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"]
  });
  
  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      phone: "",
      address: "",
      region: "",
      district: "",
      state: "Tamil Nadu", // Pre-set default state value
      locality: "",
      serviceAreaRange: 10,
      experience: 0,
      specialties: [],
      pricing: {
        towing: 0,
        tireChange: 0,
        jumpStart: 0,
        fuelDelivery: 0,
        lockout: 0,
        winching: 0
      },
      termsAccepted: false,
    },
  });

  const handleResumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && validateResumeFile(file)) {
      setResumeFile(file);
    } else if (file) {
      // Reset the input if file is invalid
      e.target.value = '';
    }
  };

  return {
    form,
    resumeFile,
    isLoading,
    setIsLoading,
    handleResumeChange
  };
};
