import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { RadioGroup, RadioGroupItem } from "../ui/radio-group";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import {
  CreditCard,
  Wallet,
  Banknote,
  Building2,
  Clock,
  CheckCircle2,
  Shield,
  Smartphone,
  ArrowRight
} from "lucide-react";
import { usePricingConfig } from "@/hooks/usePricingConfig";
import { cn } from "@/lib/utils";
import { PaymentSummaryDialog } from "../payments/PaymentSummaryDialog";

interface PaymentStepProps {
  servicePrice: number;
  onPaymentConfirm: (paymentData: PaymentData) => void;
}

export interface PaymentData {
  timing: "before" | "after";
  method: "cash" | "card" | "upi" | "netbanking";
  razorpayOrderId?: string;
}

const PaymentStep = ({ servicePrice, onPaymentConfirm }: PaymentStepProps) => {
  const { data: pricingConfig } = usePricingConfig();
  const currency = String(pricingConfig?.currency || "INR").toUpperCase();
  const [paymentTiming, setPaymentTiming] = useState<"before" | "after">("before");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "upi" | "netbanking">("upi");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentSummary, setShowPaymentSummary] = useState(false);

  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const platformFeePercent = pricingConfig?.platform_fee_percent ?? 0.10;
  const paymentFeePercent = pricingConfig?.payment_fee_percent ?? 0.02;
  const payNowDiscountPercent = Math.max(0, Number(pricingConfig?.pay_now_discount_percent ?? 0));
  const platformFee = roundMoney(servicePrice * platformFeePercent);
  const paymentFee = roundMoney(servicePrice * paymentFeePercent);
  const totalAmount = roundMoney(servicePrice + platformFee + paymentFee);

  const ensureRazorpayLoaded = async () => {
    if ((window as any).Razorpay) return true;
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
      document.body.appendChild(script);
    });
    return !!(window as any).Razorpay;
  };

  const paymentMethods = [
    {
      id: "upi",
      name: "UPI Apps",
      icon: Smartphone,
      description: "Google Pay, PhonePe, Paytm and BHIM",
      popular: true
    },
    {
      id: "card",
      name: "Card",
      icon: CreditCard,
      description: "Credit, debit and prepaid cards"
    },
    {
      id: "netbanking",
      name: "Net Banking",
      icon: Building2,
      description: "Pay directly from your bank"
    },
    {
      id: "cash",
      name: "Cash",
      icon: Banknote,
      description: "Pay directly to the technician"
    }
  ];

  const handlePaymentClick = () => {
    if (paymentTiming === "before" && paymentMethod !== "cash") {
      setShowPaymentSummary(true);
    } else {
      handlePaymentComplete();
    }
  };

  const handlePaymentComplete = async () => {
    setIsProcessing(true);

    if (paymentTiming === "before" && paymentMethod !== "cash") {
      try {
        const sdkReady = await ensureRazorpayLoaded();
        if (!sdkReady) {
          throw new Error("Razorpay SDK not available");
        }

        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: Math.round(totalAmount * 100),
          currency,
          name: "ResQNow",
          description: "Roadside Assistance Service",
          image: "/favicon.ico",
          handler: function (response: any) {
            console.log("Payment successful:", response);
            onPaymentConfirm({
              timing: paymentTiming,
              method: paymentMethod as any,
              razorpayOrderId: response.razorpay_payment_id
            });
            setShowPaymentSummary(false);
            setIsProcessing(false);
          },
          prefill: {
            name: "Customer",
            email: "customer@example.com",
            contact: "9999999999"
          },
          theme: {
            color: "#ea580c"
          },
          modal: {
            ondismiss: () => {
              setIsProcessing(false);
            }
          }
        };

        // @ts-ignore - Razorpay will be loaded dynamically
        const rzp = new window.Razorpay(options);
        rzp.open();
        setShowPaymentSummary(false);
      } catch (error) {
        console.error("Payment failed:", error);
        setIsProcessing(false);
      }
    } else {
      onPaymentConfirm({
        timing: paymentTiming,
        method: paymentMethod as any
      });
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="space-y-5 animate-fade-in"
      style={{ fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}
    >
      <div className="overflow-hidden rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-500 via-orange-600 to-slate-900 text-white shadow-lg">
        <div className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
              <Wallet className="h-3.5 w-3.5" />
              Payment Checkout
            </div>
            <Badge className="bg-white/15 text-white border border-white/20 hover:bg-white/20">
              Secure
            </Badge>
          </div>
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight">Choose how you want to pay</h3>
          <p className="mt-1 text-sm text-white/80">
            Fast checkout now, or pay after service completion.
          </p>

          <div className="mt-5 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between text-sm text-white/90">
              <span>Service charge</span>
              <span className="font-semibold">{currency} {servicePrice.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-white/90">
              <span>Platform fee</span>
              <span className="font-semibold">{currency} {platformFee.toFixed(2)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm text-white/90">
              <span>Payment fee</span>
              <span className="font-semibold">{currency} {paymentFee.toFixed(2)}</span>
            </div>
            <div className="mt-3 h-px bg-white/20" />
            <div className="mt-3 flex items-end justify-between">
              <span className="text-sm font-semibold text-white/80">Estimated total</span>
              <span className="text-2xl font-black">{currency} {totalAmount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Clock className="h-4 w-4 text-orange-500" />
            Payment timing
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <RadioGroup value={paymentTiming} onValueChange={setPaymentTiming as any}>
            <div className="space-y-3">
              <div
                className={cn(
                  "flex items-start space-x-3 rounded-xl border p-3 transition-colors",
                  paymentTiming === "before"
                    ? "border-orange-200 bg-orange-50/70"
                    : "border-border hover:bg-muted/60"
                )}
              >
                <RadioGroupItem value="before" id="before" />
                <Label htmlFor="before" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-semibold text-foreground">Pay now</span>
                      <p className="text-xs text-muted-foreground">Complete secure checkout before service starts</p>
                    </div>
                    {payNowDiscountPercent > 0 ? (
                      <Badge variant="secondary" className="border border-emerald-200 bg-emerald-100 text-emerald-700">
                        {Math.round(payNowDiscountPercent * 100)}% Discount
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="border border-red-200 bg-red-100 text-red-700">
                        Online Payment
                      </Badge>
                    )}
                  </div>
                </Label>
              </div>

              <div
                className={cn(
                  "flex items-start space-x-3 rounded-xl border p-3 transition-colors",
                  paymentTiming === "after"
                    ? "border-zinc-300 bg-zinc-50"
                    : "border-border hover:bg-muted/60"
                )}
              >
                <RadioGroupItem value="after" id="after" />
                <Label htmlFor="after" className="flex-1 cursor-pointer">
                  <div>
                    <span className="text-sm font-semibold text-foreground">Pay after service</span>
                    <p className="text-xs text-muted-foreground">Cash payment after technician marks job complete</p>
                  </div>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Wallet className="h-5 w-5 text-red-500" />
            Payment method
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod as any}>
            <div className="grid grid-cols-1 gap-3">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const isDisabled = paymentTiming === "after" && method.id !== "cash";
                const isSelected = paymentMethod === method.id;

                return (
                  <div
                    key={method.id}
                    className={cn(
                      "relative flex items-start space-x-3 rounded-xl border p-4 transition-all",
                      isDisabled
                        ? "border-border bg-muted/60 opacity-50"
                        : isSelected
                        ? "border-orange-200 bg-orange-50/70 shadow-sm"
                        : "border-border hover:border-orange-200 hover:bg-orange-50/30"
                    )}
                  >
                    <RadioGroupItem
                      value={method.id}
                      id={method.id}
                      disabled={isDisabled}
                    />
                    <Label
                      htmlFor={method.id}
                      className={`flex-1 ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "rounded-lg p-2.5",
                          method.id === "upi"
                            ? "bg-amber-100 text-amber-700"
                            : method.id === "card"
                            ? "bg-red-100 text-red-700"
                            : method.id === "netbanking"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-zinc-100 text-zinc-700"
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{method.name}</span>
                            {method.popular && (
                              <Badge variant="secondary" className="border border-orange-200 bg-orange-100 text-[10px] text-orange-700">
                                Popular
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{method.description}</p>
                        </div>
                      </div>
                    </Label>
                  </div>
                );
              })}
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {paymentTiming === "before" && paymentMethod !== "cash" && (
        <Card className="rounded-2xl border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="mt-0.5 h-5 w-5 text-emerald-700" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">
                  Secure Payment by Razorpay
                </p>
                <p className="text-xs text-emerald-700/80">
                  256-bit encryption and verified payment gateway protection.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="pt-2">
        <Button
          onClick={handlePaymentClick}
          disabled={isProcessing}
          className="h-12 w-full rounded-xl bg-orange-600 text-sm font-semibold text-white hover:bg-orange-500"
        >
          {isProcessing ? (
            "Processing..."
          ) : paymentTiming === "before" && paymentMethod !== "cash" ? (
            <>
              <CreditCard className="mr-2 h-4 w-4" />
              Proceed to pay {currency} {totalAmount.toFixed(2)}
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm booking
            </>
          )}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          You can review full bill breakup before final confirmation.
        </p>
      </div>

      <PaymentSummaryDialog
        isOpen={showPaymentSummary}
        onClose={() => setShowPaymentSummary(false)}
        onConfirm={handlePaymentComplete}
        baseAmount={servicePrice}
        isProcessing={isProcessing}
        platformFeePercent={platformFeePercent}
        paymentFeePercent={paymentFeePercent}
        currency={currency}
      />
    </div>
  );
};


export default PaymentStep;
