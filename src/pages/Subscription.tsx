import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { Check, X, Shield, Star, Rocket } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SubscriptionPlanConfig, usePricingConfig } from "@/hooks/usePricingConfig";

type KnownSubscription = "free" | "basic" | "premium" | "enterprise" | "none";

const planIcons = {
  free: Shield,
  basic: Star,
  premium: Rocket,
} as const;

const toKnownSubscription = (id: string): KnownSubscription => {
  if (id === "free" || id === "basic" || id === "premium" || id === "enterprise" || id === "none") {
    return id;
  }
  return "basic";
};

const getPlanTone = (plan: SubscriptionPlanConfig) => {
  const key = (plan.color || "").toLowerCase();
  if (key === "blue" || plan.id === "basic") {
    return {
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
      button: "bg-blue-600 hover:bg-blue-700 hover:shadow-blue-200",
      border: "#2563EB",
    };
  }
  if (key === "purple" || plan.id === "premium") {
    return {
      iconBg: "bg-purple-50",
      iconColor: "text-purple-600",
      button: "bg-purple-600 hover:bg-purple-700 hover:shadow-purple-200",
      border: "#9333EA",
    };
  }
  return {
    iconBg: "bg-green-50",
    iconColor: "text-green-600",
    button: "bg-gray-800 hover:bg-gray-900",
    border: "#e5e7eb",
  };
};

const formatPrice = (currency: string, amount: number) => `${currency} ${Math.round(amount)}`;

const Subscription = () => {
  const { user, updateSubscription } = useAuth();
  const navigate = useNavigate();
  const { data: pricingConfig } = usePricingConfig();
  const [selectedPlan, setSelectedPlan] = useState<string | null>(
    user?.subscription && user.subscription !== "none" ? user.subscription : "basic"
  );
  const [isProcessing, setIsProcessing] = useState(false);

  const subscriptionPlans = useMemo(
    () => (pricingConfig?.subscription_plans || []).filter((plan) => plan.active !== false),
    [pricingConfig]
  );

  const handleSubscribe = async (plan: SubscriptionPlanConfig) => {
    const planId = String(plan.id || "").toLowerCase();
    const amount = Number(plan.amount || 0);

    if (amount <= 0 || planId === "free") {
      setIsProcessing(true);
      await new Promise((resolve) => setTimeout(resolve, 300));
      await updateSubscription("free");
      toast.success("Switched to PAY-AS-YOU-GO plan.");
      setIsProcessing(false);
      navigate("/");
      return;
    }

    setIsProcessing(true);

    if (!(window as any).Razorpay) {
      toast.error("Payment gateway not loaded. Please try again.");
      setIsProcessing(false);
      return;
    }

    try {
      const orderRes = await apiFetch("/api/payments/create-subscription-order", {
        method: "POST",
        body: JSON.stringify({ planId }),
      });
      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.error || "Failed to create order");
      }

      const options = {
        key: orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "ResQNow",
        description: `Subscription for ${plan.name}`,
        order_id: orderData.order_id,
        handler: async (response: any) => {
          try {
            const verifyRes = await apiFetch("/api/payments/verify-subscription-payment", {
              method: "POST",
              cache: "no-store",
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                planId,
              }),
            });
            const verifyData = await verifyRes.json();

            if (!verifyRes.ok || !verifyData.success) {
              toast.error("Payment verification failed. Please contact support.");
              return;
            }

            await updateSubscription(toKnownSubscription(planId));
            toast.success("Subscription activated successfully!");
            navigate("/");
          } catch (verifyErr) {
            console.error("Verification error:", verifyErr);
            toast.error("Failed to verify payment.");
          } finally {
            setIsProcessing(false);
          }
        },
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.phone || "",
        },
        theme: { color: "#dc2626" },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            toast.info("Payment cancelled.");
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (error: any) {
      console.error("Payment initialization error:", error);
      toast.error(error.message || "Failed to initialize payment.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="container py-16 animate-fade-in">
      <div className="text-center mb-12 space-y-4">
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-red-600">
          ResQNow Customer Plans
        </h1>
        <p className="text-xl text-gray-600">Roadside help, made predictable and stress-free</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        {subscriptionPlans.map((plan) => {
          const isUserPlan =
            user?.subscription === plan.id ||
            (plan.id === "free" && (!user?.subscription || user.subscription === "none"));
          const isSelected = selectedPlan === plan.id;
          const PlanIcon = planIcons[plan.id as keyof typeof planIcons] || Shield;
          const tone = getPlanTone(plan);

          return (
            <motion.div
              layout
              key={plan.id}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{
                scale: isSelected ? 1.05 : 1,
                opacity: 1,
                borderColor: isSelected ? tone.border : "#e5e7eb",
                boxShadow: isSelected
                  ? "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                  : "0 0 0 0 rgba(0,0,0,0)",
              }}
              whileHover={{ scale: isSelected ? 1.05 : 1.02 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative rounded-xl bg-card text-card-foreground border-2 cursor-pointer flex flex-col h-full overflow-hidden ${isSelected ? "z-10" : "z-0"}`}
            >
              {plan.recommended && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium shadow-md z-20">
                  Most Popular
                </div>
              )}

              {isUserPlan && (
                <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-semibold shadow-sm z-20">
                  Current Plan
                </div>
              )}

              <div className="p-6 flex-grow">
                <div className="text-center mb-6">
                  <div className={`mx-auto rounded-full p-4 ${tone.iconBg} inline-flex mb-4 group-hover:scale-110 transition-transform`}>
                    <PlanIcon className={`h-8 w-8 ${tone.iconColor}`} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">{plan.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                  <div className="mt-4">
                    <span className="text-4xl font-bold text-gray-900">
                      {formatPrice(pricingConfig?.currency || "INR", Number(plan.amount || 0))}
                    </span>
                    {Number(plan.amount || 0) > 0 && (
                      <span className="text-gray-500 ml-1">/ {plan.period || "month"}</span>
                    )}
                  </div>
                </div>

                <div className="mb-8 text-left">
                  <h4 className="font-semibold text-gray-900 mb-4">What you get:</h4>
                  <ul className="space-y-3">
                    {(plan.features || []).map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-600 text-sm leading-tight">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {(plan.notIncluded || []).length > 0 && (
                    <>
                      <h4 className="font-semibold text-gray-900 mt-6 mb-4">Not Included:</h4>
                      <ul className="space-y-3">
                        {(plan.notIncluded || []).map((feature, index) => (
                          <li key={index} className="flex items-start">
                            <X className="h-5 w-5 text-red-500 mr-3 flex-shrink-0 mt-0.5" />
                            <span className="text-gray-500 text-sm leading-tight">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  {(plan.idealFor || []).length > 0 && (
                    <div className="mt-6 p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ideal For</p>
                      <div className="flex flex-wrap gap-2">
                        {(plan.idealFor || []).map((item, idx) => (
                          <span key={idx} className="bg-card dark:bg-slate-900 border border-gray-200 text-gray-700 text-xs px-2 py-1 rounded-md">
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 pt-0 mt-auto">
                <p className="text-xs text-center text-gray-500 mb-4 italic">{plan.footer}</p>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubscribe(plan);
                  }}
                  disabled={isProcessing || isUserPlan}
                  className={`w-full py-6 text-lg font-semibold shadow-md transition-all ${tone.button}`}
                >
                  {isProcessing && selectedPlan === plan.id
                    ? "Processing..."
                    : isUserPlan
                      ? "Active Plan"
                      : Number(plan.amount || 0) === 0
                        ? "Switch to Free"
                        : `Subscribe to ${plan.name}`}
                </Button>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Subscription;
