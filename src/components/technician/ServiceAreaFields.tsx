import React, { useEffect, useState } from "react";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { UseFormReturn } from "react-hook-form";
import { RegisterFormValues, regionOptions, stateOptions, tamilNaduDistricts, localityOptions } from "@/types/technician-registration";

interface ServiceAreaFieldsProps {
  form: UseFormReturn<RegisterFormValues>;
}

const ServiceAreaFields = ({ form }: ServiceAreaFieldsProps) => {
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");
  const [availableLocalities, setAvailableLocalities] = useState<string[]>([]);

  // Update localities when district changes
  useEffect(() => {
    if (selectedDistrict && localityOptions[selectedDistrict]) {
      setAvailableLocalities(localityOptions[selectedDistrict]);
    } else {
      setAvailableLocalities([]);
    }
  }, [selectedDistrict]);

  // Set default value for state field if empty
  useEffect(() => {
    if (!form.getValues("state")) {
      form.setValue("state", "Tamil Nadu", { shouldValidate: true });
    }
  }, [form]);

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <h3 className="text-lg font-medium mb-4">Service Area</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <FormField
            control={form.control}
            name="region"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Region</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select region" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {regionOptions.map(region => (
                      <SelectItem key={region} value={region}>{region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="district"
            render={({ field }) => (
              <FormItem>
                <FormLabel>District</FormLabel>
                <Select 
                  onValueChange={(value) => {
                    field.onChange(value);
                    setSelectedDistrict(value);
                  }} 
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select district" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent className="max-h-[200px] overflow-y-auto">
                    {tamilNaduDistricts.map(district => (
                      <SelectItem key={district} value={district}>{district}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="state"
            render={({ field }) => (
              <FormItem>
                <FormLabel>State</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || "Tamil Nadu"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Tamil Nadu" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {stateOptions.map(state => (
                      <SelectItem key={state} value={state}>{state}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          
          {selectedDistrict && availableLocalities.length > 0 && (
            <FormField
              control={form.control}
              name="locality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Locality</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select locality" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="max-h-[200px] overflow-y-auto">
                      {availableLocalities.map(locality => (
                        <SelectItem key={locality} value={locality}>{locality}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          <FormField
            control={form.control}
            name="serviceAreaRange"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Service Area Range (km)</FormLabel>
                <FormControl>
                  <Input 
                    type="number" 
                    min="1" 
                    max="100" 
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                  />
                </FormControl>
                <FormDescription>Maximum distance you're willing to travel for service calls</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default ServiceAreaFields;
