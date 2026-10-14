import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useServicePayment } from "./useServicePayment";
const payment = vi.hoisted(() => ({ fetch: vi.fn(), info: vi.fn(), gateway: null as any, confirmation: {} as any }));
vi.mock("@/lib/api", () => ({ apiFetch: payment.fetch }));
vi.mock("sonner", () => ({ toast: { info: payment.info, error: vi.fn(), warning: vi.fn() } }));
beforeEach(() => {
  payment.info.mockClear(); payment.gateway = null;
  payment.confirmation = { success: true, immediateFinalization: false, request: { status: "payment_pending", payment_status: "pending" } };
  payment.fetch.mockReset().mockImplementation(async (path: string) => new Response(JSON.stringify(path.endsWith("create-order") ? { id: "order-1", key_id: "rzp_test_simulated", amount: 132200, currency: "INR" } : payment.confirmation), { status: 200 }));
  (window as any).Razorpay = function(options: any) { payment.gateway = options; this.open = vi.fn(); };
});
afterEach(() => { delete (window as any).Razorpay; });
it("does not call payment success for authorization that is still awaiting capture", async () => {
  const onSuccess = vi.fn();
  const { result } = renderHook(() => useServicePayment());
  await act(async () => { await result.current.processPayment({ requestId: "101", userName: "Asha", userEmail: "test@example.test", userPhone: "9999999999", onSuccess }); });
  await act(async () => { await payment.gateway.handler({ razorpay_order_id: "order-1", razorpay_payment_id: "payment-1", razorpay_signature: "simulated" }); });
  expect(onSuccess).not.toHaveBeenCalled();
  expect(payment.info).toHaveBeenCalledWith(expect.stringMatching(/verif|processing/i));
});
it("calls payment success when the server confirms payment completion", async () => {
  payment.confirmation = { success: true, immediateFinalization: true, request: { status: "paid", payment_status: "completed" } };
  const onSuccess = vi.fn();
  const { result } = renderHook(() => useServicePayment());
  await act(async () => { await result.current.processPayment({ requestId: "101", userName: "Asha", userEmail: "test@example.test", userPhone: "9999999999", onSuccess }); });
  await act(async () => { await payment.gateway.handler({ razorpay_order_id: "order-1", razorpay_payment_id: "payment-1", razorpay_signature: "simulated" }); });
  expect(onSuccess).toHaveBeenCalledTimes(1);
});
