
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LogIn, User } from "lucide-react";

type LoginFormValues = {
  email: string;
  password: string;
};

const TechnicianLogin = () => {
  const { login, isAuthenticated } = useTechnicianAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
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

  const resolvePostLoginPath = React.useCallback(() => {
    const pendingJobId = sessionStorage.getItem("resqnow_pending_job_deeplink");
    if (pendingJobId) {
      sessionStorage.removeItem("resqnow_pending_job_deeplink");
      return `/job/${encodeURIComponent(pendingJobId)}`;
    }
    return "/technician/dashboard";
  }, []);

  // Auto-redirect if already logged in
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(resolvePostLoginPath(), { replace: true });
    }
  }, [isAuthenticated, navigate, resolvePostLoginPath]);

  const form = useForm<LoginFormValues>({
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    loginController.current = new AbortController();
    try {
      await login(data.email, data.password, { signal: loginController.current.signal });
      toast({
        title: "Login successful!",
        description: "Welcome to the ResQNow technician portal",
      });
      navigate(resolvePostLoginPath());
    } catch (error: unknown) {
      if ((error as any)?.name === 'AbortError') {
        console.warn("Technician login aborted");
        return;
      }
      const message = error instanceof Error ? error.message : "Invalid email or password. Please try again.";
      toast({
        title: "Login failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="container py-20 flex flex-col items-center">
      <div className="max-w-lg w-full">

        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold">Technician Portal</h2>
          <p className="text-muted-foreground mt-2">Login to your technician account</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="hidden md:flex flex-col justify-center items-center bg-muted p-6 rounded-lg">
            <User size={64} className="text-primary mb-4" />
            <h3 className="text-lg font-medium mb-2">Join Our Network</h3>
            <p className="text-sm text-center text-muted-foreground">
              Become a ResQNow technician and grow your business while helping drivers in need.
            </p>
            <Button variant="link" asChild className="mt-4">
              <Link to="/technician/register">Sign up as a technician</Link>
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Technician Login</CardTitle>
              <CardDescription>Enter your credentials to access your account</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="tech@example.com" {...field} />
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
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Logging in...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center">
                        <LogIn className="mr-2 h-4 w-4" /> Login
                      </span>
                    )}
                  </Button>
                </form>
              </Form>

              <div className="mt-6 text-center md:hidden">
                <p className="text-sm text-muted-foreground">
                  Don't have an account?{" "}
                  <Link to="/technician/register" className="text-primary font-medium">
                    Sign up
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TechnicianLogin;
