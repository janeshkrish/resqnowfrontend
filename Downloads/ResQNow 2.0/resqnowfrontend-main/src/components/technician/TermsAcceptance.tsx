
import React from "react";
import { Link } from "react-router-dom";
import { FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { FormLabel } from "@/components/ui/form";
import { UseFormReturn } from "react-hook-form";
import { RegisterFormValues } from "@/types/technician-registration";

interface TermsAcceptanceProps {
  form: UseFormReturn<RegisterFormValues>;
}

const TermsAcceptance = ({ form }: TermsAcceptanceProps) => {
  return (
    <FormField
      control={form.control}
      name="termsAccepted"
      render={({ field }) => (
        <FormItem className="flex flex-row items-start space-x-3 space-y-0">
          <FormControl>
            <Checkbox
              checked={field.value}
              onCheckedChange={field.onChange}
            />
          </FormControl>
          <div className="space-y-1 leading-none">
            <FormLabel>
              I accept the <Link to="/terms" className="text-primary">terms and conditions</Link>
            </FormLabel>
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  );
};

export default TermsAcceptance;
