import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.VITE_API_URL || "";

/**
 * Handles email confirmation when user lands on /confirm-email?token=... (e.g. old link or manual).
 * Calls GET /api/users/confirm-email?token=... (JSON) and shows success or error, then redirects to login.
 * New registration emails use a link to the backend GET /api/auth/confirm-email which redirects to /login?confirmed=1.
 */
const ConfirmEmail = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("Confirmation token is missing. Please use the link from your email.");
      return;
    }

    const run = async () => {
      try {
        const res = await fetch(`${BASE}/api/users/confirm-email?token=${encodeURIComponent(token)}`, {
          method: "GET",
          headers: { Accept: "application/json" },
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setStatus("success");
          setMessage(data.message || "Email confirmed successfully. You can now log in.");
          setTimeout(() => navigate("/login", { replace: true }), 2000);
        } else {
          setStatus("error");
          setMessage(data.error || "Invalid or expired confirmation link.");
        }
      } catch {
        if (cancelled) return;
        setStatus("error");
        setMessage("Failed to confirm email. Please try again.");
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [searchParams, navigate]);

  if (status === "processing") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Confirming your email
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Please wait while we verify your email address.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Email confirmed
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{message}</p>
            <Button onClick={() => navigate("/login", { replace: true })}>
              Go to login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            Confirmation failed
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert variant="destructive">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => navigate("/login", { replace: true })}>
            Go to login
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ConfirmEmail;
