
import { ServiceType, ServiceRequestFormData } from "./types";
import { PaymentData } from "./PaymentStep";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";
import {
  AlertCircle,
  Star,
  CreditCard,
  Banknote,
  Clock,
  CheckCircle2,
  User,
  Phone,
  Car,
  MapPin,
  Wrench
} from "lucide-react";
import { cn } from "@/lib/utils";
import defaultAvatar from "@/assets/default-avatar.png";

interface ConfirmationStepProps {
  service: ServiceType;
  formData: ServiceRequestFormData;
  paymentData?: PaymentData | null;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  estimatedBaseAmount?: number;
  currency?: string;
  technicianName?: string;
}

const ConfirmationStep = ({
  service,
  formData,
  paymentData,
  onInputChange,
  estimatedBaseAmount,
  currency = "INR",
  technicianName = "Rajesh Kumar",
}: ConfirmationStepProps) => {
  const numericBaseAmount = Number(estimatedBaseAmount);
  const normalizedCurrency = String(currency || "INR").toUpperCase();
  const formattedBaseAmount =
    Number.isFinite(numericBaseAmount) && numericBaseAmount > 0
      ? `${normalizedCurrency} ${numericBaseAmount.toFixed(2)}`
      : "Estimate pending";

  const paymentMethodLabel: Record<PaymentData["method"], string> = {
    cash: "Cash",
    card: "Card",
    upi: "UPI",
    netbanking: "Net Banking",
  };

  return (
    <div
      className="space-y-5 animate-fade-in"
      style={{ fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}
    >
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-orange-600 text-white shadow-lg">
        <div className="p-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Final Review
          </div>
          <h2 className="mt-3 text-2xl font-extrabold tracking-tight">Confirm your request details</h2>
          <p className="mt-1 text-sm text-white/80">
            Quick review before you place this service request.
          </p>
        </div>
      </div>

      <Card className="rounded-2xl border-orange-100 bg-orange-50/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold text-orange-900">Service summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-orange-800/80">Selected service</span>
              <span className="font-semibold text-orange-900">{service.name}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-orange-800/80">Estimated range</span>
              <span className="font-semibold text-orange-900">{service.estimatedPrice}</span>
            </div>
            <p className="rounded-xl bg-white/70 px-3 py-2 text-xs leading-relaxed text-orange-900/80">
              Final amount may vary based on parts, complexity, and exact on-site diagnosis.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-bold">
            <Wrench className="h-4 w-4 text-orange-500" />
            Assigned technician
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 rounded-xl border border-border/80 bg-muted/30 p-3">
            <Avatar className="h-12 w-12 border border-border">
              <AvatarImage src={defaultAvatar} alt="Technician" />
              <AvatarFallback className="bg-orange-100 font-semibold text-orange-800">
                RT
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h4 className="truncate text-sm font-semibold text-foreground">{technicianName}</h4>
              <div className="mt-0.5 flex items-center text-yellow-500">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} className="h-3 w-3" fill="currentColor" />
                ))}
                <span className="ml-1 text-[11px] text-muted-foreground">4.8 (538 jobs)</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-orange-600">{formattedBaseAmount}</div>
              <div className="text-[11px] text-muted-foreground">Base charge</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Customer details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                Name
              </div>
              <p className="text-sm font-semibold text-foreground">{formData.name}</p>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                Phone
              </div>
              <p className="text-sm font-semibold text-foreground">{formData.phone}</p>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Car className="h-4 w-4" />
                Vehicle
              </div>
              <p className="text-right text-sm font-semibold text-foreground">
                {formData.vehicleSubtype} {formData.vehicleModel}
              </p>
            </div>
            <div className="rounded-xl bg-muted/40 px-3 py-2.5">
              <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                Location
              </div>
              <p className="text-sm font-medium text-foreground">{formData.location}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {paymentData && (
        <Card className="rounded-2xl border-emerald-200 bg-gradient-to-r from-emerald-50 to-green-50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-emerald-900">
              {paymentData.timing === "before" ? <CreditCard className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              Payment details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
                <span className="text-sm text-emerald-900/75">Payment timing</span>
                <Badge
                  className={cn(
                    paymentData.timing === "before"
                      ? "bg-emerald-700 text-white hover:bg-emerald-700"
                      : "border border-amber-200 bg-amber-100 text-amber-800 hover:bg-amber-100"
                  )}
                >
                  {paymentData.timing === "before" ? "Paid Online" : "Pay After Service"}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
                <span className="text-sm text-emerald-900/75">Payment method</span>
                <div className="flex items-center gap-2 text-sm font-semibold text-emerald-900">
                  {paymentData.method === "cash" ? <Banknote className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                  <span>{paymentMethodLabel[paymentData.method]}</span>
                </div>
              </div>

              {paymentData.razorpayOrderId && (
                <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2">
                  <span className="text-sm text-emerald-900/75">Transaction ID</span>
                  <span className="rounded border bg-card dark:bg-slate-900 px-2 py-1 font-mono text-xs">
                    {paymentData.razorpayOrderId.slice(0, 20)}...
                  </span>
                </div>
              )}

              {paymentData.timing === "before" && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-100 p-2.5 text-emerald-800">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-semibold">Payment confirmed</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-2xl border-border/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">Additional notes</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Label htmlFor="details" className="text-xs text-muted-foreground">
            Optional details to help your technician
          </Label>
          <Textarea
            id="details"
            name="details"
            value={formData.details}
            onChange={onInputChange}
            placeholder="Parking location, landmarks, fault symptoms, or urgency details."
            className="mt-2 min-h-[90px] rounded-xl border-border bg-muted/20"
          />
        </CardContent>
      </Card>

      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-xs leading-relaxed text-amber-800">
          By placing this request, you agree to the terms of service and privacy policy. Final charges are shared transparently after technician inspection.
        </p>
      </div>
    </div>
  );
};

export default ConfirmationStep;
