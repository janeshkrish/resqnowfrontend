import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, User, Store, Phone, Navigation } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  regionOptions,
  stateOptions,
  tamilNaduDistricts,
  localityOptions,
} from "@/types/technician-registration";

export interface PersonalInfoData {
  technicianName: string;
  shopName: string;
  email: string;
  password: string;
  confirmPassword: string;
  personalContact: string;
  shopContact: string;
  shopAddress: string;
  gpsLocation: string;
  region: string;
  district: string;
  state: string;
  locality: string;
  serviceAreaRange: number;
  experience: number;
}

interface PersonalInfoStepProps {
  data: PersonalInfoData;
  onChange: (data: PersonalInfoData) => void;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
  onBlur: (field: string) => void;
}

export function PersonalInfoStep({
  data,
  onChange,
  errors,
  touched,
  onBlur,
}: PersonalInfoStepProps) {
  const handleChange = (field: keyof PersonalInfoData, value: string | number) => {
    onChange({ ...data, [field]: value });
  };

  const handleGetLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          handleChange("gpsLocation", `${latitude}, ${longitude}`);
        },
        (error) => {
          console.error("Error getting location:", error);
        }
      );
    }
  };

  const getFieldError = (field: string) => {
    return touched[field] && errors[field] ? errors[field] : null;
  };

  const availableLocalities = data.district
    ? localityOptions[data.district] || []
    : [];

  return (
    <Card className="border-2 border-primary/10">
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Tell us about you and your shop
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="technicianName">Technician Name *</Label>
              <Input
                id="technicianName"
                value={data.technicianName}
                onChange={(e) => handleChange("technicianName", e.target.value)}
                onBlur={() => onBlur("technicianName")}
                placeholder="Your full name"
                className={cn(
                  getFieldError("technicianName") &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
              {getFieldError("technicianName") && (
                <p className="text-sm text-destructive">
                  {getFieldError("technicianName")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="shopName">Shop Name *</Label>
              <Input
                id="shopName"
                value={data.shopName}
                onChange={(e) => handleChange("shopName", e.target.value)}
                onBlur={() => onBlur("shopName")}
                placeholder="Your shop/business name"
                className={cn(
                  getFieldError("shopName") &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
              {getFieldError("shopName") && (
                <p className="text-sm text-destructive">
                  {getFieldError("shopName")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={data.email}
                onChange={(e) => handleChange("email", e.target.value)}
                onBlur={() => onBlur("email")}
                placeholder="tech@example.com"
                className={cn(
                  getFieldError("email") &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
              {getFieldError("email") && (
                <p className="text-sm text-destructive">{getFieldError("email")}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                value={data.password}
                onChange={(e) => handleChange("password", e.target.value)}
                onBlur={() => onBlur("password")}
                placeholder="••••••••"
                className={cn(
                  getFieldError("password") &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
              {getFieldError("password") && (
                <p className="text-sm text-destructive">
                  {getFieldError("password")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={data.confirmPassword}
                onChange={(e) => handleChange("confirmPassword", e.target.value)}
                onBlur={() => onBlur("confirmPassword")}
                placeholder="••••••••"
                className={cn(
                  getFieldError("confirmPassword") &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
              {getFieldError("confirmPassword") && (
                <p className="text-sm text-destructive">
                  {getFieldError("confirmPassword")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="personalContact">Personal Contact No. *</Label>
              <Input
                id="personalContact"
                value={data.personalContact}
                onChange={(e) => handleChange("personalContact", e.target.value)}
                onBlur={() => onBlur("personalContact")}
                placeholder="+91 9876543210"
                className={cn(
                  getFieldError("personalContact") &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
              {getFieldError("personalContact") && (
                <p className="text-sm text-destructive">
                  {getFieldError("personalContact")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="shopContact">Shop Contact No. *</Label>
              <Input
                id="shopContact"
                value={data.shopContact}
                onChange={(e) => handleChange("shopContact", e.target.value)}
                onBlur={() => onBlur("shopContact")}
                placeholder="+91 9876543210"
                className={cn(
                  getFieldError("shopContact") &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
              {getFieldError("shopContact") && (
                <p className="text-sm text-destructive">
                  {getFieldError("shopContact")}
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="shopAddress">Shop Address *</Label>
              <Textarea
                id="shopAddress"
                value={data.shopAddress}
                onChange={(e) => handleChange("shopAddress", e.target.value)}
                onBlur={() => onBlur("shopAddress")}
                placeholder="Complete address with locality"
                rows={3}
                className={cn(
                  getFieldError("shopAddress") &&
                    "border-destructive focus-visible:ring-destructive"
                )}
              />
              {getFieldError("shopAddress") && (
                <p className="text-sm text-destructive">
                  {getFieldError("shopAddress")}
                </p>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="gpsLocation">GPS Location *</Label>
              <div className="flex gap-2">
                <Input
                  id="gpsLocation"
                  value={data.gpsLocation}
                  onChange={(e) => handleChange("gpsLocation", e.target.value)}
                  onBlur={() => onBlur("gpsLocation")}
                  placeholder="Latitude, Longitude"
                  className={cn(
                    getFieldError("gpsLocation") &&
                      "border-destructive focus-visible:ring-destructive"
                  )}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGetLocation}
                  className="shrink-0"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Get Location
                </Button>
              </div>
              {getFieldError("gpsLocation") && (
                <p className="text-sm text-destructive">
                  {getFieldError("gpsLocation")}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Click &quot;Get Location&quot; to automatically fetch your current GPS
                coordinates
              </p>
            </div>

            <div className="space-y-2">
              <Label>Region *</Label>
              <Select
                value={data.region}
                onValueChange={(v) => handleChange("region", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {regionOptions.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {getFieldError("region") && (
                <p className="text-sm text-destructive">{getFieldError("region")}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>District *</Label>
              <Select
                value={data.district}
                onValueChange={(v) => handleChange("district", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select district" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {tamilNaduDistricts.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {getFieldError("district") && (
                <p className="text-sm text-destructive">
                  {getFieldError("district")}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>State *</Label>
              <Select
                value={data.state || "Tamil Nadu"}
                onValueChange={(v) => handleChange("state", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tamil Nadu" />
                </SelectTrigger>
                <SelectContent>
                  {stateOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {availableLocalities.length > 0 && (
              <div className="space-y-2">
                <Label>Locality</Label>
                <Select
                  value={data.locality}
                  onValueChange={(v) => handleChange("locality", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select locality" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[200px]">
                    {availableLocalities.map((l) => (
                      <SelectItem key={l} value={l}>
                        {l}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="serviceAreaRange">Service Area Range (km) *</Label>
              <Input
                id="serviceAreaRange"
                type="number"
                min={1}
                max={100}
                value={data.serviceAreaRange || ""}
                onChange={(e) =>
                  handleChange(
                    "serviceAreaRange",
                    parseInt(e.target.value, 10) || 0
                  )
                }
                onBlur={() => onBlur("serviceAreaRange")}
                placeholder="10"
              />
              <p className="text-xs text-muted-foreground">
                Maximum distance you&apos;re willing to travel for service calls
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience">Years of Experience *</Label>
              <Input
                id="experience"
                type="number"
                min={0}
                max={50}
                value={data.experience || ""}
                onChange={(e) =>
                  handleChange("experience", parseInt(e.target.value, 10) || 0)
                }
                onBlur={() => onBlur("experience")}
                placeholder="0"
              />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
