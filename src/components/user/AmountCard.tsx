import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface AmountCardProps {
  amount?: number | null;
  technicianAmount?: number | null;
  platformFee?: number | null;
  razorpayFee?: number | null;
  total?: number | null;
  paymentMode?: "cash" | "upi" | null;
  currency?: string;
  title?: string;
  loadingLabel?: string;
  helperText?: string;
  badgeText?: string | null;
  className?: string;
}

const DEFAULT_TITLE = "Estimated Amount";
const DEFAULT_LOADING_LABEL = "Calculating...";

const formatAmount = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `\u20b9${amount.toFixed(amount % 1 === 0 ? 0 : 2)}`;
  }
};

const AmountCard = ({
  amount = null,
  technicianAmount = null,
  platformFee = null,
  razorpayFee = null,
  total = null,
  paymentMode = null,
  currency = "INR",
  title = DEFAULT_TITLE,
  loadingLabel = DEFAULT_LOADING_LABEL,
  helperText = "Live estimate from your current service request.",
  badgeText,
  className,
}: AmountCardProps) => {
  const resolvedTotal =
    total != null && Number.isFinite(Number(total))
      ? Number(total)
      : amount != null && Number.isFinite(Number(amount))
      ? Number(amount)
      : technicianAmount != null && platformFee != null
      ? Number(technicianAmount || 0) + Number(platformFee || 0) + Number(razorpayFee || 0)
      : null;
  const hasAmount = Number.isFinite(resolvedTotal) && Number(resolvedTotal) > 0;
  const resolvedAmount = hasAmount && resolvedTotal != null ? formatAmount(resolvedTotal, currency) : loadingLabel;
  const resolvedBadgeText =
    badgeText === undefined ? (hasAmount ? "Live" : "Updating") : badgeText;
  const hasBreakdown =
    (technicianAmount != null && Number.isFinite(Number(technicianAmount))) ||
    (platformFee != null && Number.isFinite(Number(platformFee))) ||
    (razorpayFee != null && Number.isFinite(Number(razorpayFee)));

  return (
    <Card
      className={cn(
        "overflow-hidden rounded-2xl border-orange-100/80 bg-gradient-to-br from-orange-50 via-white to-amber-50 shadow-[0_12px_28px_rgba(249,115,22,0.12)]",
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-orange-700/80">
              {title}
            </p>
            <h3
              className={cn(
                "mt-2 text-2xl font-black tracking-tight sm:text-3xl",
                hasAmount ? "text-orange-600" : "text-slate-500"
              )}
            >
              {resolvedAmount}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{helperText}</p>
          </div>

          {resolvedBadgeText ? (
            <Badge
              className={cn(
                "shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em]",
                hasAmount
                  ? "border-orange-200 bg-white text-orange-700 hover:bg-white"
                  : "border-slate-200 bg-white text-slate-500 hover:bg-white"
              )}
            >
              {resolvedBadgeText}
            </Badge>
          ) : null}
        </div>

        {hasBreakdown ? (
          <div className="mt-4 rounded-xl border border-orange-100/80 bg-white/80 p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Technician</span>
              <span className="font-semibold">
                {formatAmount(Number(technicianAmount || 0), currency)}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Platform Fee</span>
              <span className="font-semibold">
                {formatAmount(Number(platformFee || 0), currency)}
              </span>
            </div>
            {(paymentMode === "upi" || Number(razorpayFee || 0) > 0) && (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Razorpay Fee</span>
                <span className="font-semibold">
                  {formatAmount(Number(razorpayFee || 0), currency)}
                </span>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-orange-100 pt-3 text-sm">
              <span className="font-semibold text-foreground">Total</span>
              <span className="text-base font-black text-orange-600">
                {formatAmount(Number(resolvedTotal || 0), currency)}
              </span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default AmountCard;
