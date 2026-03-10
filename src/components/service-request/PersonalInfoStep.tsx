import { useState } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { ServiceRequestFormData } from "./types";
import { User, Phone, Mail } from "lucide-react";

interface PersonalInfoStepProps {
  formData: ServiceRequestFormData;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const PersonalInfoStep = ({ formData, onInputChange }: PersonalInfoStepProps) => {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="mb-6 px-1">
        <h3 className="text-2xl font-black tracking-tight text-foreground mb-2">Personal Details</h3>
        <p className="text-sm font-medium text-muted-foreground/80">We'll use this to coordinate your service</p>
      </div>

      <div className="bg-card dark:bg-slate-900 rounded-[1.5rem] border border-border/60 shadow-sm overflow-hidden">

        {/* Full Name */}
        <div className="p-4 border-b border-border/60">
          <div className="flex items-center gap-2.5 mb-1.5">
            <User className="h-4 w-4 text-slate-400" />
            <Label htmlFor="name" className="text-[11px] uppercase font-bold tracking-widest text-slate-400">Full Name</Label>
          </div>
          <Input
            id="name"
            name="name"
            placeholder="e.g. John Doe"
            value={formData.name}
            onChange={onInputChange}
            required
            className="h-10 text-base border-0 focus-visible:ring-0 px-0 rounded-none bg-transparent placeholder:text-slate-300 font-bold text-foreground shadow-none"
          />
        </div>

        {/* Phone Number */}
        <div className="p-4 border-b border-border/60">
          <div className="flex items-center gap-2.5 mb-1.5">
            <Phone className="h-4 w-4 text-slate-400" />
            <Label htmlFor="phone" className="text-[11px] uppercase font-bold tracking-widest text-slate-400">Phone Number</Label>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-foreground font-bold text-base bg-muted px-3 py-2 rounded-lg border border-border">+91</span>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="98765 43210"
              value={formData.phone}
              onChange={onInputChange}
              required
              maxLength={10}
              className="h-10 text-base border-0 focus-visible:ring-0 px-0 rounded-none bg-transparent placeholder:text-slate-300 font-bold text-foreground shadow-none flex-1 tracking-wider"
            />
          </div>
        </div>

        {/* Email Address */}
        <div className="p-4 bg-muted/30">
          <div className="flex items-center gap-2.5 mb-1.5">
            <Mail className="h-4 w-4 text-slate-400" />
            <Label htmlFor="email" className="text-[11px] uppercase font-bold tracking-widest text-slate-400">Email Address</Label>
          </div>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="mail@example.com"
            value={formData.email || ""}
            onChange={onInputChange}
            required
            className="h-10 text-base border-0 focus-visible:ring-0 px-0 rounded-none bg-transparent placeholder:text-slate-300 font-bold text-foreground shadow-none"
          />
          <p className="text-[11px] text-muted-foreground/80 font-medium mt-3 flex items-start gap-1.5">
            <span className="text-emerald-500 shrink-0">✓</span> Real-time updates & receipts will be sent here
          </p>
        </div>

      </div>
    </div>
  );
};

export default PersonalInfoStep;
