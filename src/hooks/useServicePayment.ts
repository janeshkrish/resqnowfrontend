import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

type ProcessPaymentOptions = {
  requestId: number | string;
  couponCode?: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  onSuccess?: (paymentDetails: any) => void;
};

export const useServicePayment = () => {
  const [isProcessing, setIsProcessing] = useState(false);

  const processPayment = async (options: ProcessPaymentOptions) => {
    setIsProcessing(true);
    try {
      const orderRes = await apiFetch("/api/payments/create-order", {
        method: "POST",
        body: JSON.stringify({
          requestId: options.requestId,
          couponCode: options.couponCode || undefined,
        }),
      });

      const orderBody = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok) {
        throw new Error(orderBody?.error || "Failed to create payment order.");
      }

      const rzpOptions = {
        key: orderBody.key_id,
        amount: orderBody.amount,
        currency: orderBody.currency,
        name: "ResQNow",
        description: `Service request #${options.requestId}`,
        order_id: orderBody.id || orderBody.order_id,
        handler: async (response: any) => {
          try {
            const verifyRes = await apiFetch("/api/payments/confirm", {
              method: "POST",
              body: JSON.stringify({
                requestId: options.requestId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyBody = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok) {
              throw new Error(verifyBody?.error || "Payment verification failed.");
            }
            options.onSuccess?.({
              order: orderBody,
              confirmation: verifyBody,
              razorpay: response,
            });
          } catch (err: any) {
            toast.error(err.message || "Payment verification failed.");
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: options.userName,
          email: options.userEmail,
          contact: options.userPhone,
        },
        theme: {
          color: "#0f172a",
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            toast.warning("Payment cancelled. Please complete payment to close the request.");
          },
        },
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
