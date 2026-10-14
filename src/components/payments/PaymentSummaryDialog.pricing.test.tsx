import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { PaymentSummaryDialog } from "./PaymentSummaryDialog";

it("keeps the accepted technician charge and taxes distinct at checkout", () => {
  render(<PaymentSummaryDialog isOpen onClose={vi.fn()} onConfirm={vi.fn()} isProcessing={false} baseAmount={1260} breakdown={{ baseAmount: 1260, technicianCharge: 1200, taxAmount: 60, platformFee: 126, originalPlatformFee: 126, platformFeePercent: 0.1, discountAmount: 0, paymentFee: 2, paymentFeePercent: 0, totalAmount: 1388 } as any} />);
  expect(screen.getByText("Technician amount").parentElement).toHaveTextContent("INR 1200.00");
  expect(screen.getByText("Taxes").parentElement).toHaveTextContent("INR 60.00");
});
