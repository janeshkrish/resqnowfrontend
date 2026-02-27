
import React from "react";
import { FormField, FormItem, FormLabel, FormDescription, FormMessage, FormControl } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { UseFormReturn } from "react-hook-form";
import { RegisterFormValues } from "@/types/technician-registration";

interface SpecialtiesSelectProps {
  form: UseFormReturn<RegisterFormValues>;
  specialtiesOptions: { id: string; label: string }[];
}

const SpecialtiesSelect = ({ form, specialtiesOptions }: SpecialtiesSelectProps) => {
  return (
    <FormField
      control={form.control}
      name="specialties"
      render={() => (
        <FormItem>
          <div className="mb-4">
            <FormLabel>Service Specialties</FormLabel>
            <FormDescription>
              Select the services you can provide
            </FormDescription>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {specialtiesOptions.map((option) => (
              <FormField
                key={option.id}
                control={form.control}
                name="specialties"
                render={({ field }) => {
                  return (
                    <FormItem
                      key={option.id}
                      className="flex flex-row items-start space-x-3 space-y-0"
                    >
                      <FormControl>
                        <Checkbox
                          checked={field.value?.includes(option.id)}
                          onCheckedChange={(checked) => {
                            return checked
                              ? field.onChange([...field.value, option.id])
                              : field.onChange(
                                  field.value?.filter(
                                    (value) => value !== option.id
                                  )
                                )
                          }}
                        />
                      </FormControl>
                      <FormLabel className="font-normal">
                        {option.label}
                      </FormLabel>
                    </FormItem>
                  )
                }}
              />
            ))}
          </div>
          <FormMessage />
        </FormItem>
      )}
    />
  );
};

export default SpecialtiesSelect;
