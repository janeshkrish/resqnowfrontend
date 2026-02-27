import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export const useServicePayment = () => {
    const [isProcessing, setIsProcessing] = useState(false);

    const processPayment = async (options: {
        serviceType: string;
        amount?: number;
        userName: string;
        userEmail: string;
        userPhone: string;
        onSuccess: (paymentDetails: any) => void;
    }) => {
        setIsProcessing(true);
        try {
            // 1. Create order
            const orderRes = await apiFetch("/api/payments/create-service-order", {
                method: "POST",
                body: JSON.stringify({
                    serviceType: options.serviceType,
                    amount: options.amount
                })
            });

            if (!orderRes.ok) {
                throw new Error("Failed to create payment order.");
            }

            const orderData = await orderRes.json();

            // 2. Open Razorpay
            const rzpOptions = {
                key: orderData.key_id,
                amount: orderData.amount,
                currency: orderData.currency,
                name: "ResQNow",
                description: `Booking Fee for ${options.serviceType}`,
                order_id: orderData.order_id,
                handler: (response: any) => {
                    options.onSuccess(response);
                },
                prefill: {
                    name: options.userName,
                    email: options.userEmail,
                    contact: options.userPhone
                },
                theme: {
                    color: "#2563eb" // blue-600
                },
                modal: {
                    ondismiss: () => {
                        setIsProcessing(false);
                        toast.warning("Payment cancelled. Please complete payment to book your service.");
                    }
                }
            };

            const rzp = new (window as any).Razorpay(rzpOptions);
            rzp.open();
        } catch (err: any) {
            console.error("Payment error:", err);
            toast.error(err.message || "Payment initialization failed.");
            setIsProcessing(false);
        }
    };

    return { processPayment, isProcessing };
};
