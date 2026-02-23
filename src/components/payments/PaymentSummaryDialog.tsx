import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Loader2, Ticket, ShieldCheck, Info } from "lucide-react";

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

  const formatAmount = (amount: number) => `${normalizedCurrency} ${amount.toFixed(2)}`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isProcessing && !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-primary" />
            {paymentMethod === "cash" ? "Cash Payment Summary" : "Payment Summary"}
          </DialogTitle>
          <DialogDescription>
            Review your bill details before proceeding to payment.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          <div className="space-y-3 bg-muted/40 p-4 rounded-lg border">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Service Cost</span>
              <span>{formatAmount(numericBaseAmount)}</span>
            </div>

            <div className="flex justify-between text-sm items-start">
              <div className="flex flex-col">
                <span className="text-muted-foreground flex items-center gap-1">
                  Platform Fee
                  <Info className="h-3 w-3" />
                </span>
                <span className="text-[10px] text-muted-foreground">
                  ({Math.round(feePercent * 100)}% of service)
                </span>
              </div>
              <span>{formatAmount(platformFee)}</span>
            </div>

            <Separator />

            <div className="flex justify-between items-center">
              <span className="font-semibold text-base">Total Payable</span>
              <span className="font-bold text-lg text-primary">{formatAmount(totalAmount)}</span>
            </div>
          </div>

          <div
            className={`flex items-center gap-2 text-xs p-2 rounded border ${
              paymentMethod === "cash"
                ? "bg-amber-50 text-amber-700 border-amber-100"
                : "bg-green-50 text-green-700 border-green-100"
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            <span>
              {paymentMethod === "cash"
                ? "Pay this total amount directly to the technician."
                : "Secure payment via Razorpay. 100% Safe and Verified."}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isProcessing} className="w-full sm:w-auto bg-primary">
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : paymentMethod === "cash" ? (
              "Confirm Cash Payment"
            ) : (
              `Pay ${formatAmount(totalAmount)}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
