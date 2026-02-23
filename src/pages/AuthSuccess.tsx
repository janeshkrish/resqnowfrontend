
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/api";

const AuthSuccess = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const handleAuth = async () => {
            const token = searchParams.get("token");
            const error = searchParams.get("error");

            if (error) {
                toast.error("Authentication failed");
                navigate("/login");
                return;
            }

            if (!token) {
                toast.error("No token received");
                navigate("/login");
                return;
            }

            try {
                // Store token first
                localStorage.setItem("resqnow_user_token", token);
                localStorage.setItem("isAuthenticated", "true"); // For non-React guards

                // Verify token and get user details
                const response = await fetch(apiUrl("/api/auth/verify"), {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (!response.ok) {
                    throw new Error("Token verification failed");
                }

                const data = await response.json();
                const { user } = data;

                // Store user profile
                localStorage.setItem("resqnow_user_profile", JSON.stringify(user));

                toast.success(`Welcome back, ${user.full_name || 'User'}!`);

                // Handle return URL
                const returnUrl = sessionStorage.getItem('returnUrl');
                if (returnUrl) {
                    sessionStorage.removeItem('returnUrl');
                    window.location.href = returnUrl;
                } else {
                    window.location.href = "/";
                }

            } catch (err) {
                console.error("Auth success processing error:", err);
                toast.error("Authentication error. Please login again.");
                navigate("/login");
            }
        };

        handleAuth();
    }, [searchParams, navigate]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <h2 className="text-xl font-semibold text-gray-700">Logging you in...</h2>
            <p className="text-gray-500 text-sm mt-2">Please wait while we verify your credentials.</p>
        </div>
    );
};

export default AuthSuccess;
