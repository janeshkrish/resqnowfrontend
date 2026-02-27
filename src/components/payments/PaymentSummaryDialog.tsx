import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Loader2,
  ShieldCheck,
  ReceiptText,
  CreditCard,
  Banknote,
  CircleDollarSign
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentSummaryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  baseAmount: number | string;
  isProcessing: boolean;
  paymentMethod?: "online" | "cash";
  platformFeePercent?: number;
  currency?: string;
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
}: PaymentSummaryDialogProps) {
  const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
  const parsedBaseAmount = Number(baseAmount);
  const numericBaseAmount = Number.isFinite(parsedBaseAmount) && parsedBaseAmount > 0 ? parsedBaseAmount : 0;
  const normalizedCurrency = String(currency || "INR").toUpperCase();
  const feePercent =
    Number.isFinite(platformFeePercent) && platformFeePercent >= 0
      ? platformFeePercent
      : 0.1;
  const platformFee = roundMoney(numericBaseAmount * feePercent);
  const totalAmount = roundMoney(numericBaseAmount + platformFee);
  const isCash = paymentMethod === "cash";

  const formatAmount = (amount: number) => `${normalizedCurrency} ${amount.toFixed(2)}`;

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
              <span className="text-3xl font-black">{formatAmount(totalAmount)}</span>
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
              <span className="font-medium">{formatAmount(numericBaseAmount)}</span>
            </div>
            <div className="mt-2 flex items-start justify-between text-sm">
              <div>
                <p className="text-muted-foreground">Platform fee</p>
                <p className="text-[11px] text-muted-foreground/80">
                  {Math.round(feePercent * 100)}% convenience and support fee
                </p>
              </div>
              <span className="font-medium">{formatAmount(platformFee)}</span>
            </div>
            <Separator className="my-3" />
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">Net amount</span>
              <span className="text-lg font-bold text-foreground">{formatAmount(totalAmount)}</span>
            </div>
          </div>

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
                `Pay ${formatAmount(totalAmount)}`
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
