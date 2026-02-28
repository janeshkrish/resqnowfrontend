import React, { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { LogIn, Mail, Lock, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { apiUrl } from "@/lib/api";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof formSchema>;

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // Keep non-React guards working
        localStorage.setItem('isAuthenticated', 'true');

        toast.success("Logged in with Google successfully!");

        const returnUrl = sessionStorage.getItem('returnUrl');
        if (returnUrl) {
          sessionStorage.removeItem('returnUrl');
          window.location.href = returnUrl;
        } else {
          window.location.href = "/";
        }
        return;
      } catch (e) {
        console.error("Failed to parse user data from url", e);
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
    } else if (err === "google_auth_failed" || err === "google_token_error" || err === "google_callback_exception") {
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
    setIsLoading(true);
    setError(null);
    try {
      const result = await login(data.email, data.password);
      if (result.user) {
        const role = String(result?.role || result?.user?.role || "").trim().toLowerCase();
        if (role === "admin") {
          toast.success("Admin login successful!");
          setTimeout(() => {
            navigate("/admin/dashboard");
          }, 100);
          return;
        }

        toast.success("Login successful!");
        const isProfileLogin = searchParams.get("from") === "profile";
        const returnUrl = sessionStorage.getItem('returnUrl');
        if (!isProfileLogin && returnUrl) {
          sessionStorage.removeItem('returnUrl');
          setTimeout(() => {
            navigate(returnUrl);
          }, 100);
        } else {
          sessionStorage.removeItem('returnUrl');
          setTimeout(() => {
            navigate("/");
          }, 100);
        }
      }
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.message?.includes("Email not confirmed") || error.message?.includes("email_not_confirmed") || error.message?.includes("confirm your email")) {
        setError("Please confirm your email before logging in. Check your inbox for the confirmation link.");
        toast.error("Email not confirmed");
      } else {
        setError(error.message || "Invalid email or password");
        toast.error("Login failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const response = await fetch(apiUrl("/api/auth/google/url"));
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error("Failed to initialize Google Login");
      }
    } catch (error) {
      console.error("Google Login Error:", error);
      toast.error("Something went wrong with Google Login");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-foreground tracking-tight mb-2">
            Welcome Back
          </h1>
          <p className="text-muted-foreground/80 font-medium text-sm">Sign in to your ResQNow account</p>
        </div>

        <div className="bg-card dark:bg-slate-900 rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-6 sm:p-8 relative overflow-hidden border border-border/60">
          <div className="space-y-6">
            {error && (
              <Alert variant="destructive" className="animate-in fade-in-50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Button
              type="button"
              variant="outline"
              className="w-full h-14 bg-card dark:bg-slate-900 border-2 border-border hover:bg-muted hover:border-border text-muted-foreground font-bold rounded-xl shadow-sm transition-all active:scale-95"
              onClick={handleGoogleLogin}
              disabled={isLoading}
            >
              <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card dark:bg-slate-900 px-2 text-muted-foreground/80 font-bold tracking-wider">Or continue with email</span>
              </div>
            </div>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground/80 font-bold">Email</FormLabel>
                      <FormControl>
                        <div className="relative mt-1">
                          <Mail className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <Input
                            placeholder="you@example.com"
                            className="pl-9 pr-0 h-12 bg-transparent border-0 border-b-2 border-border rounded-none focus-visible:ring-0 focus-visible:border-slate-800 transition-colors shadow-none text-base font-semibold"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs uppercase tracking-widest text-muted-foreground/80 font-bold">Password</FormLabel>
                      <FormControl>
                        <div className="relative mt-1">
                          <Lock className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                          <Input
                            type="password"
                            placeholder="••••••••"
                            className="pl-9 pr-0 h-12 bg-transparent border-0 border-b-2 border-border rounded-none focus-visible:ring-0 focus-visible:border-slate-800 transition-colors shadow-none text-base font-semibold tracking-widest"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-14 mt-6 text-base font-bold rounded-xl shadow-[0_8px_20px_rgba(225,29,72,0.25)] bg-slate-900 hover:bg-slate-800 hover:shadow-lg transition-all active:scale-95 text-white"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Signing in...
                    </span>
                  ) : (
                    "Sign In"
                  )}
                </Button>
              </form>
            </Form>

            <div className="text-center pt-2 space-y-2">
              <p className="text-sm font-medium text-muted-foreground/80">
                Don't have an account?{" "}
                <Link to="/register" className="text-primary hover:text-primary/80 font-bold transition-colors">
                  Sign up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
