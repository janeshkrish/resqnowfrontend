
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2 } from "lucide-react";
import { RegisterFormValues, serviceTypeOptions, vehicleTypeOptions } from "@/types/technician-registration";
import { toast } from "@/components/ui/sonner";

interface TechnicianSignupFormProps {
  onSubmit: (data: RegisterFormValues, resumeFile: File | null) => Promise<void>;
  isSubmitting: boolean;
}

export function TechnicianSignupForm({ onSubmit, isSubmitting }: TechnicianSignupFormProps) {
  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<RegisterFormValues>({
    defaultValues: {
      vehicleType: []
    }
  });

  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const selectedVehicleTypes = watch("vehicleType") || [];

  const handleVehicleTypeChange = (id: string, checked: boolean) => {
    if (checked) {
      setValue("vehicleType", [...selectedVehicleTypes, id]);
    } else {
      setValue("vehicleType", selectedVehicleTypes.filter(v => v !== id));
    }
  };

  const onFormSubmit = async (data: RegisterFormValues) => {
    if (!acceptedTerms) {
      toast.error("You must accept the terms and conditions.");
      return;
    }
    await onSubmit({ ...data, termsAccepted: true }, null);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6 max-w-md mx-auto p-6 border rounded-lg shadow-sm bg-card dark:bg-slate-900">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Technician Registration</h2>

        <div className="grid gap-2">
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            placeholder="John Doe"
            {...register("name", { required: "Name is required" })}
          />
          {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="john@example.com"
            {...register("email", {
              required: "Email is required",
              pattern: { value: /^\S+@\S+$/i, message: "Invalid email" }
            })}
          />
          {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="phone">Phone Number</Label>
          <Input
            id="phone"
            placeholder="+91 9876543210"
            {...register("phone", { required: "Phone is required" })}
          />
          {errors.phone && <p className="text-sm text-red-500">{errors.phone.message}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="serviceType">Primary Service Type</Label>
          <Select onValueChange={(val) => setValue("serviceType", val)}>
            <SelectTrigger>
              <SelectValue placeholder="Select Service Type" />
            </SelectTrigger>
            <SelectContent>
              {serviceTypeOptions.map((opt) => (
                <SelectItem key={opt.id} value={opt.id}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.serviceType && <p className="text-sm text-red-500">{String(errors.serviceType.message)}</p>}
        </div>

        <div className="grid gap-2">
          <Label>Vehicle Types Serviced</Label>
          <div className="grid grid-cols-2 gap-2">
            {vehicleTypeOptions.map((opt) => (
              <div key={opt.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`vehicle-${opt.id}`}
                  checked={selectedVehicleTypes.includes(opt.id)}
                  onCheckedChange={(checked) => handleVehicleTypeChange(opt.id, checked as boolean)}
                />
                <label htmlFor={`vehicle-${opt.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  {opt.label}
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="serviceArea">Service Area (City / Zone)</Label>
          <Input
            id="serviceArea"
            placeholder="e.g. Chennai, Anna Nagar"
            {...register("serviceArea", { required: "Service Area is required" })}
          />
          {errors.serviceArea && <p className="text-sm text-red-500">{errors.serviceArea.message}</p>}
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            {...register("password", {
              required: "Password is required",
              minLength: { value: 8, message: "Must be at least 8 characters" }
            })}
          />
          {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
        </div>

        <div className="flex items-start space-x-2 pt-2">
          <Checkbox
            id="terms"
            checked={acceptedTerms}
            onCheckedChange={(c) => setAcceptedTerms(c as boolean)}
          />
          <Label htmlFor="terms" className="text-sm text-muted-foreground">
            I agree to the <Link to="/terms" className="text-primary hover:underline">Terms & Conditions</Link> and <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link>.
          </Label>
        </div>

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Submitting...
            </>
          ) : (
            "Register as Technician"
          )}
        </Button>
      </div>

      <div className="mt-4 text-center text-sm">
        <p className="text-muted-foreground">
          Already have an account? <Link to="/technician/login" className="text-primary hover:underline">Login here</Link>
        </p>
      </div>
    </form>
  );
}
