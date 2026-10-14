import { describe, expect, it } from "vitest";
import { isServicePaymentFinalized, resolveServiceRequestPaymentDetails } from "./serviceRequestPayment";

describe("authoritative payment completion", () => {
  it.each([
    ["generic confirmation success", { success: true }, false],
    ["authorization awaiting capture", { success: true, immediateFinalization: false, request: { status: "payment_pending", payment_status: "pending" } }, false],
    ["already paid confirmation", { alreadyPaid: true }, true],
    ["immediate capture finalization", { immediateFinalization: true }, true],
    ["paid request", { request: { status: "paid" } }, true],
    ["completed payment", { request: { payment_status: "completed" } }, true],
    ["completed request", { request: { status: "completed" } }, true],
    ["captured request polling result", { status: "paid", payment_status: "completed" }, true],
  ])("recognizes %s", (_name, confirmation, expected) => {
    expect(isServicePaymentFinalized(confirmation)).toBe(expected);
  });
});

describe("payment details with deferred customer pricing", () => {
  it("does not turn missing or null prices into a zero-value quote", () => {
    expect(resolveServiceRequestPaymentDetails({ amount: null, base_amount: null, final_amount: null })).toMatchObject({ hasPricing: false, finalAmount: null });
  });
  it("honours explicit pending pricing even if an old amount remains", () => {
    expect(resolveServiceRequestPaymentDetails({ pricing_status: "pending", pricing_finalized: false, amount: 500, final_amount: 552 })).toMatchObject({ hasPricing: false, finalAmount: null });
  });
  it("preserves the backend's confirmed amount and fees", () => {
    expect(resolveServiceRequestPaymentDetails({ pricing_status: "confirmed", pricing_finalized: true, amount: 1200, platform_fee: 120, payment_fee: 2, final_amount: 1322 })).toMatchObject({ hasPricing: true, baseAmount: 1200, platformFee: 120, finalAmount: 1322 });
  });

  it("separates tax from the technician's earning in an accepted towing snapshot", () => {
    expect(resolveServiceRequestPaymentDetails({ status: "accepted", amount: 1260, pricing_snapshot: JSON.stringify({ technician_earning: 1200, pricing_breakdown: { tax_amount: 60 } }), platform_fee: 126, payment_fee: 2, final_amount: 1388 })).toMatchObject({ baseAmount: 1260, technicianCharge: 1200, taxAmount: 60, finalAmount: 1388 });
  });
});
