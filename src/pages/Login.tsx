import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Capacitor } from "@capacitor/core";
import { ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";

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

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof formSchema>;

const fieldLabelClassName = "mb-2 block text-[13px] font-semibold text-slate-700";
const fieldIconClassName =
  "pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const isMounted = useRef(true);
  const loginController = useRef<AbortController | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (loginController.current) {
        loginController.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    const confirmed = searchParams.get("confirmed");
    const err = searchParams.get("error");
    const token = searchParams.get("token");
    const userDataStr = searchParams.get("user");

    if (token && userDataStr) {
      try {
        const userData = JSON.parse(userDataStr);
        localStorage.setItem("resqnow_user_token", token);
        localStorage.setItem("resqnow_user_profile", JSON.stringify(userData));
        localStorage.setItem("isAuthenticated", "true");

        toast.success("Logged in with Google successfully!");

        const returnUrl = sessionStorage.getItem("returnUrl");
        if (returnUrl) {
          sessionStorage.removeItem("returnUrl");
          window.location.href = returnUrl;
        } else {
          window.location.href = "/";
        }
        return;
      } catch (parseError) {
        console.error("Failed to parse user data from url", parseError);
        toast.error("Login failed: Invalid data");
      }
    }

    if (confirmed === "1") {
      toast.success("Email confirmed. You can log in now.");
      setSearchParams({}, { replace: true });
    } else if (confirmed === "already") {
      toast.success("Email was already confirmed. You can log in.");
      setSearchParams({}, { replace: true });
    } else if (err === "invalid_token") {
      setError("Invalid or expired confirmation link. Please request a new one or try logging in.");
      setSearchParams({}, { replace: true });
    } else if (err === "confirm_failed") {
      setError("Confirmation failed. Please try again or contact support.");
      setSearchParams({}, { replace: true });
    } else if (
      err === "google_auth_failed" ||
      err === "google_token_error" ||
      err === "google_callback_exception"
    ) {
      setError("Google Login failed on the server. Please try again.");
      setSearchParams({}, { replace: true });
    } else if (err === "server_config") {
      setError("Server configuration error. Please contact admin.");
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    if (!isMounted.current) return;

    setIsLoading(true);
    setError(null);

    const controller = new AbortController();
    loginController.current = controller;

    try {
      const result = await login(data.email, data.password, { signal: controller.signal });
      if (result.user) {
        const role = String(result?.role || result?.user?.role || "").trim().toLowerCase();
        if (role === "admin") {
          toast.success("Admin login successful!");
          navigate("/admin/dashboard");
          return;
        }

        toast.success("Login successful!");

        const isProfileLogin = searchParams.get("from") === "profile";
        const returnUrl = sessionStorage.getItem("returnUrl");
        if (!isProfileLogin && returnUrl) {
          sessionStorage.removeItem("returnUrl");
          navigate(returnUrl);
        } else {
          sessionStorage.removeItem("returnUrl");
          navigate("/");
        }
      }
    } catch (submitError: any) {
      if (submitError?.name === "AbortError") {
        console.warn("Login request aborted");
        return;
      }
      console.error("Login error:", submitError);
      if (
        submitError.message?.includes("Email not confirmed") ||
        submitError.message?.includes("email_not_confirmed") ||
        submitError.message?.includes("confirm your email")
      ) {
        setError("Please confirm your email before logging in. Check your inbox for the confirmation link.");
        toast.error("Email not confirmed");
      } else {
        setError(submitError.message || "Invalid email or password");
        toast.error("Login failed");
      }
    } finally {
      loginController.current = null;
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const handleGoogleLogin = async () => {
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
        toast.error("Failed to initialize Google Login");
      }
    } catch (googleError) {
      console.error("Google Login Error:", googleError);
      if (isMounted.current) {
        toast.error("Something went wrong with Google Login");
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <ClientAuthShell
      mode="login"
      title="Welcome back"
      subtitle="Login to continue to your account"
      error={error}
      isLoading={isLoading}
      onGoogleAction={handleGoogleLogin}
      googleLabel="Continue with Google"
      footer={
        <p>
          New to ResQNow?{" "}
          <Link to="/register" className="font-bold text-[#ef233c] transition-colors hover:text-[#dc1f38]">
            Sign up
          </Link>
        </p>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      autoComplete="current-password"
                      placeholder="Enter your password"
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

          <Button type="submit" className={clientAuthPrimaryButtonClassName} disabled={isLoading}>
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing in...
              </span>
            ) : (
              <span className="relative flex w-full items-center justify-center">
                <span>Login</span>
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

export default Login;
