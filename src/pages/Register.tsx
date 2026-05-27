import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Capacitor } from "@capacitor/core";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { apiUrl } from "@/lib/api";
import {
  ClientAuthShell,
  clientAuthInputClassName,
  clientAuthPrimaryButtonClassName,
} from "@/components/auth/ClientAuthShell";

const formSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterFormValues = z.infer<typeof formSchema>;

const fieldLabelClassName = "mb-1.5 block text-[13px] font-semibold text-slate-700 sm:mb-2";
const fieldIconClassName =
  "pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400";

const Register = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: RegisterFormValues) => {
    if (!isMounted.current) return;
    setIsLoading(true);
    setError(null);

    try {
      const result = await register(data.name, data.email, data.password);

      if (result.message) {
        toast.success("OTP sent to your email.");
        navigate("/otp-verify", {
          state: {
            name: data.name,
            email: data.email,
            password: data.password,
          },
        });
      }
    } catch (submitError: any) {
      console.error("Registration error:", submitError);
      let errorMessage = "Registration failed. Please try again.";

      if (
        submitError.message?.includes("already registered") ||
        submitError.message?.includes("already been registered")
      ) {
        errorMessage = "This email is already registered. Please login instead.";
      } else if (
        submitError.message?.includes("Database error") ||
        submitError.message?.includes("database system")
      ) {
        errorMessage = "Service temporarily unavailable. Please try again in a moment.";
      } else if (submitError.message) {
        errorMessage = submitError.message;
      }

      if (isMounted.current) {
        setError(errorMessage);
        toast.error(errorMessage);
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const handleGoogleSignup = async () => {
    try {
      if (!isMounted.current) return;
      setIsLoading(true);

      const isNative = Capacitor.isNativePlatform();
      const endpoint = isNative ? "/api/auth/google/url?platform=capacitor" : "/api/auth/google/url";

      const response = await fetch(apiUrl(endpoint));
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Failed to initialize Google Sign-up");
      }
    } catch (googleError) {
      console.error("Google Sign-up Error:", googleError);
      if (isMounted.current) {
        toast.error("Something went wrong with Google Sign-up");
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <ClientAuthShell
      mode="signup"
      title="Create your account"
      subtitle="Sign up to get started"
      error={error}
      isLoading={isLoading}
      onGoogleAction={handleGoogleSignup}
      googleLabel="Continue with Google"
      footer={
        <p>
          Already have an account?{" "}
          <Link to="/login" className="font-bold text-[#ef233c] transition-colors hover:text-[#dc1f38]">
            Log in
          </Link>
        </p>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5 sm:space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={fieldLabelClassName}>Full name</FormLabel>
                <FormControl>
                  <div className="relative">
                    <User className={fieldIconClassName} />
                    <Input
                      autoComplete="name"
                      placeholder="Enter your full name"
                      className={clientAuthInputClassName}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-[13px]" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={fieldLabelClassName}>Email address</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Mail className={fieldIconClassName} />
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="Enter your email"
                      className={clientAuthInputClassName}
                      {...field}
                    />
                  </div>
                </FormControl>
                <FormMessage className="text-[13px]" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={fieldLabelClassName}>Password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className={fieldIconClassName} />
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Create a password"
                      className={clientAuthInputClassName}
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-[13px]" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={fieldLabelClassName}>Confirm password</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Lock className={fieldIconClassName} />
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Confirm your password"
                      className={clientAuthInputClassName}
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-600"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-[18px] w-[18px]" />
                      ) : (
                        <Eye className="h-[18px] w-[18px]" />
                      )}
                    </button>
                  </div>
                </FormControl>
                <FormMessage className="text-[13px]" />
              </FormItem>
            )}
          />

          <div className="flex items-start space-x-3 px-1 py-1 relative cursor-pointer">
            <input type="checkbox" id="terms" className="peer absolute h-4 w-4 opacity-0 cursor-pointer" required />
            <div className="mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border border-slate-300 bg-white transition-colors peer-checked:bg-[#ef233c] peer-checked:border-[#ef233c]">
              <svg className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <label htmlFor="terms" className="text-[12px] font-medium leading-5 text-slate-500 cursor-pointer select-none">
              I agree to the{" "}
              <Link to="/terms-of-service" className="font-semibold text-[#ef233c] hover:text-[#dc1f38]">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link to="/privacy-policy" className="font-semibold text-[#ef233c] hover:text-[#dc1f38]">
                Privacy Policy
              </Link>
              .
            </label>
          </div>

          <Button type="submit" className={clientAuthPrimaryButtonClassName} disabled={isLoading}>
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Creating account...
              </span>
            ) : (
              <span className="relative flex w-full items-center justify-center">
                <span>Sign up</span>
                <span className="absolute right-0 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#ef233c] shadow-sm">
                  <ArrowRight className="h-4 w-4" />
                </span>
              </span>
            )}
          </Button>
        </form>
      </Form>
    </ClientAuthShell>
  );
};

export default Register;
