import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  ShieldCheck,
  ReceiptText,
  CreditCard,
  Banknote,
  CircleDollarSign,
  TicketPercent
} from "lucide-react";
import { cn } from "@/lib/utils";

type PaymentBreakdown = {
  baseAmount: number;
  platformFeePercent: number;
  originalPlatformFee: number;
  discountAmount: number;
  platformFee: number;
  totalAmount: number;
  currency?: string;
};

type CouponMessage = {
  tone: "success" | "error" | "info";
  text: string;
};

interface PaymentSummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  baseAmount: number | string;
  isProcessing: boolean;
  paymentMethod?: "online" | "cash";
  platformFeePercent?: number;
  currency?: string;
  breakdown?: PaymentBreakdown | null;
  showCouponSection?: boolean;
  couponCodeInput?: string;
  onCouponCodeInputChange?: (value: string) => void;
  onApplyCoupon?: () => void;
  onRemoveCoupon?: () => void;
  isApplyingCoupon?: boolean;
  couponAppliedCode?: string | null;
  couponHint?: string | null;
  couponMessage?: CouponMessage | null;
}

export function PaymentSummaryDialog({
  isOpen,
  onClose,
  onConfirm,
  baseAmount,
  isProcessing,
  paymentMethod = "online",
  platformFeePercent = 0.1,
  currency = "INR",
  breakdown = null,
  showCouponSection = false,
  couponCodeInput = "",
  onCouponCodeInputChange,
  onApplyCoupon,
  onRemoveCoupon,
  isApplyingCoupon = false,
  couponAppliedCode = null,
  couponHint = null,
  couponMessage = null,
}: PaymentSummaryDialogProps) {
  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const parsedBaseAmount = Number(baseAmount);
  const numericBaseAmount = Number.isFinite(parsedBaseAmount) && parsedBaseAmount > 0 ? parsedBaseAmount : 0;
  const normalizedCurrency = String(breakdown?.currency || currency || "INR").toUpperCase();
  const feePercent =
    Number.isFinite(platformFeePercent) && platformFeePercent >= 0
      ? platformFeePercent
      : 0.1;
  const fallbackPlatformFee = roundMoney(numericBaseAmount * feePercent);
  const fallbackTotal = roundMoney(numericBaseAmount + fallbackPlatformFee);

  const resolvedBase = Number.isFinite(Number(breakdown?.baseAmount))
    ? Number(breakdown?.baseAmount)
    : numericBaseAmount;
  const resolvedFeePercent = Number.isFinite(Number(breakdown?.platformFeePercent))
    ? Number(breakdown?.platformFeePercent)
    : feePercent;
  const resolvedOriginalPlatformFee = Number.isFinite(Number(breakdown?.originalPlatformFee))
    ? Number(breakdown?.originalPlatformFee)
    : fallbackPlatformFee;
  const resolvedDiscountAmount = Number.isFinite(Number(breakdown?.discountAmount))
    ? Number(breakdown?.discountAmount)
    : 0;
  const resolvedPlatformFee = Number.isFinite(Number(breakdown?.platformFee))
    ? Number(breakdown?.platformFee)
    : fallbackPlatformFee;
  const resolvedTotalAmount = Number.isFinite(Number(breakdown?.totalAmount))
    ? Number(breakdown?.totalAmount)
    : fallbackTotal;
  const isCash = paymentMethod === "cash";

  const formatAmount = (amount: number) => `${normalizedCurrency} ${amount.toFixed(2)}`;
  const hasDiscount = resolvedDiscountAmount > 0;

  const couponMessageClass = couponMessage?.tone === "success"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : couponMessage?.tone === "error"
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : "border-blue-200 bg-blue-50 text-blue-700";

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isProcessing && !open && onClose()}>
      <DialogContent
        className="w-[calc(100%-1.5rem)] max-w-[420px] gap-0 overflow-hidden rounded-[1.75rem] border-none p-0 shadow-2xl"
        style={{ fontFamily: '"Plus Jakarta Sans", Inter, sans-serif' }}
      >
        <DialogHeader
          className={cn(
            "px-5 pb-5 pt-6 text-white",
            isCash
              ? "bg-gradient-to-br from-zinc-700 via-zinc-800 to-slate-900"
              : "bg-gradient-to-br from-orange-500 via-orange-600 to-slate-900"
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-extrabold tracking-tight">
                {isCash ? "Cash Payment Summary" : "Confirm Your Payment"}
              </DialogTitle>
              <p className="mt-1 text-xs font-medium text-white/80">
                Review the final amount before proceeding.
              </p>
            </div>
            <div className="rounded-xl bg-white/15 p-2">
              {isCash ? <Banknote className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              Total Payable
            </p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-3xl font-black">{formatAmount(resolvedTotalAmount)}</span>
              <span className="mb-1 text-[11px] font-semibold text-white/75">
                incl. platform fee
              </span>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 px-5 py-5">
          <div className="rounded-2xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Service amount</span>
              <span className="font-medium">{formatAmount(resolvedBase)}</span>
            </div>
            <div className="mt-2 flex items-start justify-between text-sm">
              <div>
                <p className="text-muted-foreground">Platform fee</p>
                <p className="text-[11px] text-muted-foreground/80">
                  {Math.round(resolvedFeePercent * 100)}% convenience and support fee
                </p>
              </div>
              <span className="font-medium">{formatAmount(resolvedPlatformFee)}</span>
            </div>
            {hasDiscount && (
              <>
                <div className="mt-2 flex items-center justify-between text-sm text-muted-foreground">
                  <span>Original platform fee</span>
                  <span className="line-through">{formatAmount(resolvedOriginalPlatformFee)}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-sm text-emerald-700">
                  <span>Coupon discount</span>
                  <span>-{formatAmount(resolvedDiscountAmount)}</span>
                </div>
              </>
            )}
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Net amount</span>
              <span className="text-lg font-bold text-foreground">{formatAmount(resolvedTotalAmount)}</span>
            </div>
          </div>

          {showCouponSection && (
            <div className="rounded-2xl border border-orange-200 bg-orange-50/60 p-3">
              <div className="mb-2 flex items-center gap-2">
                <TicketPercent className="h-4 w-4 text-orange-600" />
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-orange-700">
                  Apply Coupon
                </p>
                {couponAppliedCode && (
                  <span className="ml-auto rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Applied: {couponAppliedCode}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={couponCodeInput}
                  onChange={(event) => onCouponCodeInputChange?.(event.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  disabled={isProcessing || isApplyingCoupon}
                  className="h-10 border-orange-200 bg-white text-sm"
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onApplyCoupon}
                  disabled={isProcessing || isApplyingCoupon || !couponCodeInput.trim()}
                  className="h-10 shrink-0 bg-orange-600 text-white hover:bg-orange-500"
                >
                  {isApplyingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                </Button>
              </div>
              {couponHint && (
                <p className="mt-2 text-[11px] font-medium text-orange-700/90">{couponHint}</p>
              )}
              {couponAppliedCode && onRemoveCoupon && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onRemoveCoupon}
                  disabled={isProcessing || isApplyingCoupon}
                  className="mt-1 h-8 px-2 text-[11px] text-slate-700 hover:bg-transparent hover:text-slate-900"
                >
                  Remove code
                </Button>
              )}
              {couponMessage && (
                <div className={cn("mt-2 rounded-lg border px-2 py-1.5 text-[11px] font-medium", couponMessageClass)}>
                  {couponMessage.text}
                </div>
              )}
            </div>
          )}

          <div
            className={cn(
              "rounded-xl border p-3 text-xs",
              isCash
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-emerald-200 bg-emerald-50 text-emerald-800"
            )}
          >
            <div className="flex items-start gap-2">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <p className="leading-relaxed">
                {isCash
                  ? "Pay this amount directly to the technician once the job is completed."
                  : "Your transaction is processed on a secure PCI-compliant payment gateway."}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-[11px] text-slate-700">
            <ReceiptText className="h-3.5 w-3.5" />
            <span>Detailed receipt is available in your completed request.</span>
            <CircleDollarSign className="ml-auto h-3.5 w-3.5" />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="outline" onClick={onClose} disabled={isProcessing} className="h-11 rounded-xl">
              Back
            </Button>
            <Button
              onClick={onConfirm}
              disabled={isProcessing}
              className={cn(
                "h-11 rounded-xl font-semibold",
                isCash ? "bg-zinc-900 hover:bg-zinc-800 text-white" : "bg-orange-600 hover:bg-orange-500 text-white"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing
                </>
              ) : isCash ? (
                "Confirm Cash"
              ) : (
                `Pay ${formatAmount(resolvedTotalAmount)}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
