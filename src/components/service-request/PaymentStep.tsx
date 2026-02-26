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
  Smartphone
} from "lucide-react";
import { usePricingConfig } from "@/hooks/usePricingConfig";

interface PaymentStepProps {
  servicePrice: number;
  onPaymentConfirm: (paymentData: PaymentData) => void;
}

export interface PaymentData {
  timing: "before" | "after";
  method: "cash" | "card" | "upi" | "netbanking";
  razorpayOrderId?: string;
}

import { PaymentSummaryDialog } from "../payments/PaymentSummaryDialog";

const PaymentStep = ({ servicePrice, onPaymentConfirm }: PaymentStepProps) => {
  const { data: pricingConfig } = usePricingConfig();
  const currency = String(pricingConfig?.currency || "INR").toUpperCase();
  const [paymentTiming, setPaymentTiming] = useState<"before" | "after">("before");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "upi" | "netbanking">("upi");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPaymentSummary, setShowPaymentSummary] = useState(false);

  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const platformFeePercent = pricingConfig?.platform_fee_percent ?? 0.10;
  const payNowDiscountPercent = Math.max(0, Number(pricingConfig?.pay_now_discount_percent ?? 0));
  const platformFee = roundMoney(servicePrice * platformFeePercent);
  const totalAmount = roundMoney(servicePrice + platformFee);

  const paymentMethods = [
    {
      id: "upi",
      name: "UPI",
      icon: Smartphone,
      description: "Pay using UPI apps like GPay, PhonePe, Paytm",
      popular: true
    },
    {
      id: "card",
      name: "Card",
      icon: CreditCard,
      description: "Credit/Debit Card payments"
    },
    {
      id: "netbanking",
      name: "Net Banking",
      icon: Building2,
      description: "Direct bank transfer"
    },
    {
      id: "cash",
      name: "Cash",
      icon: Banknote,
      description: "Pay in cash to technician"
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
      // Simulate Razorpay payment processing
      try {
        const options = {
          key: import.meta.env.VITE_RAZORPAY_KEY_ID,
          amount: Math.round(totalAmount * 100), // Amount in paise (Base + Fee)
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
          },
          prefill: {
            name: "Customer",
            email: "customer@example.com",
            contact: "9999999999"
          },
          theme: {
            color: "#dc2626"
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
      // Cash payment or pay after service
      onPaymentConfirm({
        timing: paymentTiming,
        method: paymentMethod as any
      });
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-foreground mb-2">Payment Options</h3>
        <p className="text-muted-foreground">Choose your preferred payment method</p>
      </div>

      {/* Service Price Display */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-medium text-muted-foreground">Service Charge:</span>
            <span className="text-2xl font-bold text-blue-600">{currency} {servicePrice}</span>
          </div>
        </CardContent>
      </Card>

      {/* ... Payment Timing ... (UNCHANGED, reusing logic by not replacing if possible? No, need to render full) */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Clock className="h-5 w-5 text-orange-500" />
            When would you like to pay?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={paymentTiming} onValueChange={setPaymentTiming as any}>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors">
                <RadioGroupItem value="before" id="before" />
                <Label htmlFor="before" className="flex-1 cursor-pointer">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">Pay Now</span>
                      <p className="text-sm text-muted-foreground/80">Secure online payment before service</p>
                    </div>
                    {payNowDiscountPercent > 0 ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        {Math.round(payNowDiscountPercent * 100)}% Discount
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                        Online Payment
                      </Badge>
                    )}
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors">
                <RadioGroupItem value="after" id="after" />
                <Label htmlFor="after" className="flex-1 cursor-pointer">
                  <div>
                    <span className="font-medium">Pay After Service</span>
                    <p className="text-sm text-muted-foreground/80">Pay when technician completes the job</p>
                  </div>
                </Label>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Payment Methods */}
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wallet className="h-5 w-5 text-blue-500" />
            Payment Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod as any}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const isDisabled = paymentTiming === "after" && method.id !== "cash";

                return (
                  <div
                    key={method.id}
                    className={`relative flex items-center space-x-3 p-4 rounded-lg border transition-all ${isDisabled
                        ? "border-border bg-muted opacity-50"
                        : "border-border hover:border-blue-300 hover:bg-blue-50"
                      }`}
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
                        <div className={`p-2 rounded-lg ${method.id === "upi" ? "bg-purple-100" :
                            method.id === "card" ? "bg-blue-100" :
                              method.id === "netbanking" ? "bg-green-100" :
                                "bg-orange-100"
                          }`}>
                          <Icon className={`h-5 w-5 ${method.id === "upi" ? "text-purple-600" :
                              method.id === "card" ? "text-blue-600" :
                                method.id === "netbanking" ? "text-green-600" :
                                  "text-orange-600"
                            }`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{method.name}</span>
                            {method.popular && (
                              <Badge variant="secondary" className="bg-orange-100 text-orange-700 text-xs">
                                Popular
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground/80 mt-1">{method.description}</p>
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

      {/* Security Notice */}
      {paymentTiming === "before" && paymentMethod !== "cash" && (
        <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Secure Payment by Razorpay
                </p>
                <p className="text-xs text-green-600">
                  Your payment information is encrypted and secure
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Button */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handlePaymentClick}
          disabled={isProcessing}
          className="bg-red-600 hover:bg-red-700 min-w-[200px]"
        >
          {isProcessing ? (
            "Processing..."
          ) : paymentTiming === "before" && paymentMethod !== "cash" ? (
            <>
              <CreditCard className="h-4 w-4 mr-2" />
              Pay {currency} {totalAmount}
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Confirm Booking
            </>
          )}
        </Button>
      </div>

      <PaymentSummaryDialog
        isOpen={showPaymentSummary}
        onClose={() => setShowPaymentSummary(false)}
        onConfirm={handlePaymentComplete}
        baseAmount={servicePrice}
        isProcessing={isProcessing}
        platformFeePercent={platformFeePercent}
        currency={currency}
      />

      {/* Load Razorpay Script */}
      {paymentTiming === "before" && paymentMethod !== "cash" && (
        <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
      )}
    </div>
  );
};


export default PaymentStep;
