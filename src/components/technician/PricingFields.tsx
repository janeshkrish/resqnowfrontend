
import React from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { UseFormReturn } from "react-hook-form";
import { RegisterFormValues, specialtiesOptions } from "@/types/technician-registration";

interface PricingFieldsProps {
  form: UseFormReturn<RegisterFormValues>;
}

const PricingFields = ({ form }: PricingFieldsProps) => {
  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <h3 className="text-lg font-medium mb-4">Your Service Pricing</h3>
        <FormDescription className="mb-4">
          Set your rates for each service you offer (in ₹)
        </FormDescription>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="pricing.towing"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Towing Service</FormLabel>
                <div className="flex items-center">
                  <span className="text-xl mr-2">₹</span>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      min="0"
                      step="1"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value === "" ? "" : parseInt(e.target.value, 10) || "")}
                      onKeyDown={(e) => {
                        if (e.key === '.' || e.key === ',') {
                          e.preventDefault();
                        }
                      }}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="pricing.tireChange"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tire Change</FormLabel>
                <div className="flex items-center">
                  <span className="text-xl mr-2">₹</span>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      min="0"
                      step="1"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value === "" ? "" : parseInt(e.target.value, 10) || "")}
                      onKeyDown={(e) => {
                        if (e.key === '.' || e.key === ',') {
                          e.preventDefault();
                        }
                      }}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="pricing.jumpStart"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Jump Start</FormLabel>
                <div className="flex items-center">
                  <span className="text-xl mr-2">₹</span>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      min="0"
                      step="1"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value === "" ? "" : parseInt(e.target.value, 10) || "")}
                      onKeyDown={(e) => {
                        if (e.key === '.' || e.key === ',') {
                          e.preventDefault();
                        }
                      }}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="pricing.fuelDelivery"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fuel Delivery</FormLabel>
                <div className="flex items-center">
                  <span className="text-xl mr-2">₹</span>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      min="0"
                      step="1"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value === "" ? "" : parseInt(e.target.value, 10) || "")}
                      onKeyDown={(e) => {
                        if (e.key === '.' || e.key === ',') {
                          e.preventDefault();
                        }
                      }}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="pricing.lockout"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Lockout Service</FormLabel>
                <div className="flex items-center">
                  <span className="text-xl mr-2">₹</span>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      min="0"
                      step="1"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value === "" ? "" : parseInt(e.target.value, 10) || "")}
                      onKeyDown={(e) => {
                        if (e.key === '.' || e.key === ',') {
                          e.preventDefault();
                        }
                      }}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="pricing.winching"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Winching</FormLabel>
                <div className="flex items-center">
                  <span className="text-xl mr-2">₹</span>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="0"
                      min="0"
                      step="1"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value === "" ? "" : parseInt(e.target.value, 10) || "")}
                      onKeyDown={(e) => {
                        if (e.key === '.' || e.key === ',') {
                          e.preventDefault();
                        }
                      }}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default PricingFields;
