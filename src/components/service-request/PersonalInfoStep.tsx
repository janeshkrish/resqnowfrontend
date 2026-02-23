
import { useState } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { ServiceRequestFormData } from "./types";
import { User, Phone } from "lucide-react";

interface PersonalInfoStepProps {
  formData: ServiceRequestFormData;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const PersonalInfoStep = ({ formData, onInputChange }: PersonalInfoStepProps) => {
  return (
    <div className="space-y-6 animate-in fade-in-50 duration-500">
      <div className="mb-6">
        <h3 className="text-xl md:text-2xl font-bold text-foreground mb-2">Personal Information</h3>
        <p className="text-sm text-muted-foreground">We'll use this to contact you about your service</p>
      </div>

      <Card className="p-4 md:p-6 border-border/50 bg-accent/20 hover:bg-accent/30 transition-colors">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <User className="h-4 w-4 text-primary" />
            </div>
            <Label htmlFor="name" className="text-base font-semibold">Full Name</Label>
          </div>
          <Input
            id="name"
            name="name"
            placeholder="Enter your full name"
            value={formData.name}
            onChange={onInputChange}
            required
            className="h-12 text-base border-2 focus:border-primary"
          />
        </div>
      </Card>

      <Card className="p-4 md:p-6 border-border/50 bg-accent/20 hover:bg-accent/30 transition-colors">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Phone className="h-4 w-4 text-primary" />
            </div>
            <Label htmlFor="phone" className="text-base font-semibold">Phone Number</Label>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="px-4 h-12 text-base font-medium pointer-events-none"
              disabled
            >
              +91
            </Button>
            <Input
              id="phone"
              name="phone"
              type="tel"
              placeholder="98765 43210"
              value={formData.phone}
              onChange={onInputChange}
              required
              className="h-12 text-base border-2 focus:border-primary flex-1"
              maxLength={10}
            />
          </div>
        </div>
      </Card>

      <Card className="p-4 md:p-6 border-border/50 bg-accent/20 hover:bg-accent/30 transition-colors">
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-2 bg-primary/10 rounded-lg">
              <User className="h-4 w-4 text-primary" />
            </div>
            <Label htmlFor="email" className="text-base font-semibold">Email Address</Label>
          </div>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="your@email.com"
            value={formData.email || ""}
            onChange={onInputChange}
            required
            className="h-12 text-base border-2 focus:border-primary"
          />
          <p className="text-xs text-muted-foreground bg-background/50 p-2 rounded border">
            📧 We'll send you real-time updates and receipt to this email
          </p>
        </div>
      </Card>
    </div>
  );
};

export default PersonalInfoStep;
