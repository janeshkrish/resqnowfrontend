import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/components/ui/sonner";
import { KeyRound, Mail, AlertCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

const formSchema = z.object({
    otp: z.string().length(6, "OTP must be exactly 6 digits"),
});

type OTPFormValues = z.infer<typeof formSchema>;

const OTPVerify = () => {
    const { verifyOtp } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Retrieve data passed from Register page
    const { name, email, password } = location.state || {};

    useEffect(() => {
        if (!email || !password || !name) {
            toast.error("Invalid session. Please register again.");
            navigate("/register");
        }
    }, [email, password, name, navigate]);

    const form = useForm<OTPFormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            otp: "",
        },
    });

    const onSubmit = async (data: OTPFormValues) => {
        setIsLoading(true);
        setError(null);

        try {
            await verifyOtp(email, data.otp, name, password);
            toast.success("Account verified successfully!");
            navigate("/");
        } catch (err: any) {
            console.error("Verification error:", err);
            setError(err.message || "Verification failed. Please try again.");
            toast.error("Verification failed");
        } finally {
            setIsLoading(false);
        }
    };

    if (!email) return null;

    return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-2">
                        Verify Email
                    </h1>
                    <p className="text-muted-foreground">Enter the OTP sent to {email}</p>
                </div>

                <Card className="border-2 shadow-2xl backdrop-blur">
                    <CardHeader className="space-y-2 pb-4">
                        <CardTitle className="text-2xl font-bold text-center">Enter OTP</CardTitle>
                        <CardDescription className="text-center">Check your inbox significantly</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-4">
                        {error && (
                            <Alert variant="destructive" className="animate-in fade-in-50">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="otp"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>One-Time Password</FormLabel>
                                            <FormControl>
                                                <div className="relative">
                                                    <KeyRound className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                                                    <Input
                                                        placeholder="123456"
                                                        className="pl-10 h-12 text-center tracking-widest text-lg"
                                                        maxLength={6}
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
                                    className="w-full h-12 text-base font-semibold"
                                    disabled={isLoading}
                                >
                                    {isLoading ? "Verifying..." : "Verify & Create Account"}
                                </Button>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default OTPVerify;
