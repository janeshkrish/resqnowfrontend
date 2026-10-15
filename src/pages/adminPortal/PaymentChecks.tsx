import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { getPaymentDiagnostics, type PaymentDiagnostics } from "./api/portalApi";
import { clock, day, paymentMethod, rupees } from "./format";
import { Btn, ErrorState, Icon, KV, Loading, Pill } from "./ui";

// The same checks the old Payment Logs page ran for one request. They find problems; fixing them is a job for the tech team.

type Check = { key: string; title: string; sub: string; state: "ok" | "bad" | "na"; code?: string };
const num = (value: unknown) => (value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));
const truthy = (value: unknown) => value === true || value === 1 || value === "1" || value === "true";

export function paymentChecks(data: PaymentDiagnostics): Check[] {
  const request = data.request;
  const payment = data.payments[0] || null;
  const invoice = data.invoices[0] || null;
  const status = String(request.status || "").toLowerCase();
  const paidRequest = ["paid", "completed"].includes(status);
  const methodOnRequest = request.payment_method ? String(request.payment_method).toLowerCase() : null;
  const methodOnPayment = payment?.payment_method ? String(payment.payment_method).toLowerCase() : null;
  const cash = methodOnPayment === "cash";
  return [
    { key: "request", title: "Request found", sub: `#${request.id} · ${request.service_type || "service"} · ${request.status}`, state: "ok" },
    {
      key: "paid", code: "paid-sync", title: "Paid status matches",
      sub: data.checks.paid_status_consistent ? `Request ${request.status}, payment ${request.payment_status || "not set"}` : `The request is ${request.status}, but its payment status is still ${request.payment_status || "not set"}`,
      state: data.checks.paid_status_consistent ? "ok" : "bad",
    },
    {
      key: "method", code: "method-sync", title: "Payment method matches",
      sub: !methodOnRequest || !methodOnPayment ? "Nothing to compare yet" : methodOnRequest === methodOnPayment ? `${paymentMethod(methodOnPayment)} on the request and on the payment` : `${paymentMethod(methodOnRequest)} on the request, ${paymentMethod(methodOnPayment)} on the payment`,
      state: !methodOnRequest || !methodOnPayment ? "na" : methodOnRequest === methodOnPayment ? "ok" : "bad",
    },
    {
      key: "payment", title: "Payment record exists",
      sub: payment ? `${rupees(num(payment.amount))} · created ${day(payment.created_at)} ${clock(payment.created_at)}` : paidRequest ? "The request is paid but has no payment record" : "No payment yet",
      state: payment ? "ok" : data.checks.payment_row_exists_if_paid ? "na" : "bad",
    },
    {
      key: "invoice", title: "Invoice exists",
      sub: invoice ? `${rupees(num(invoice.total_amount))} · ${invoice.status || "made"}` : paidRequest ? "No invoice was made for this request" : "Made once the request is paid",
      state: invoice ? "ok" : data.checks.invoice_exists_if_paid ? "na" : "bad",
    },
    {
      key: "pdf", title: "Invoice PDF",
      sub: !invoice ? "Not checked until there is an invoice" : data.checks.invoice_pdf_present ? "Attached" : "The invoice has no PDF",
      state: !invoice ? "na" : data.checks.invoice_pdf_present ? "ok" : "bad",
    },
    {
      key: "dues", title: "Cash dues record",
      sub: !cash ? "Only for cash payments" : data.technicianDues.length ? `${rupees(num(data.technicianDues[0].amount))} · ${data.technicianDues[0].status}` : "Cash was taken but no dues record was made",
      state: !cash ? "na" : data.checks.cash_due_record_present ? "ok" : "bad",
    },
  ];
}

export function PaymentChecks({ requestId }: { requestId: number }) {
  const query = useQuery({ queryKey: ["portal", "payment-checks", requestId], queryFn: () => getPaymentDiagnostics(requestId) });
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <Loading height={240} label="Running the payment checks" />;
  const data = query.data;
  const checks = paymentChecks(data);
  const failed = checks.filter((check) => check.state === "bad");
  const payment = data.payments[0] || null;
  const copy = async () => {
    const text = [
      `Request #${data.request.id} (${data.request.status}, payment ${data.request.payment_status || "not set"})`,
      payment ? `Payment ${payment.id}: order ${payment.razorpay_order_id || "—"}, payment ${payment.razorpay_payment_id || "—"}, ${payment.status}` : "No payment record",
      failed.length ? `Failed: ${failed.map((check) => `${check.title}${check.code ? ` (${check.code})` : ""}`).join("; ")}` : "All checks passed",
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied for the tech team");
    } catch {
      toast.error("Could not copy. Select the text instead.");
    }
  };
  return (
    <div className="ap-pcols" style={{ gridTemplateColumns: "minmax(0, 1fr) 280px" }} data-testid="payment-checks">
      <div className="ap-pcol">
        <div className="ap-row">
          <p className="ap-cap ap-grow">Checks · run {clock(data.generatedAt)}</p>
          {failed.length ? <Pill tone="bad">{failed.length} check{failed.length === 1 ? "" : "s"} failed</Pill> : <Pill tone="ok">All checks passed</Pill>}
        </div>
        <div className="ex-checks">
          {checks.map((check) => (
            <div key={check.key} className={`ex-check${check.state === "bad" ? " is-bad" : check.state === "na" ? " is-na" : ""}`}>
              <Icon name={check.state === "ok" ? "check_circle" : check.state === "bad" ? "cancel" : "remove_circle"} />
              <div><b>{check.title}</b><span>{check.sub}</span></div>
              {check.code ? <small>{check.code}</small> : null}
            </div>
          ))}
        </div>
        <div className="ap-row" style={{ gap: 8 }}>
          <Btn size="sm" icon="refresh" onClick={() => void query.refetch()}>Run checks again</Btn>
          <Btn size="sm" icon="content_copy" onClick={() => void copy()}>Copy for the tech team</Btn>
        </div>
        <p className="ad-hint"><Icon name="info" />There is no one-tap fix for a failed check in the system today; send it to the tech team.</p>
      </div>
      <div className="ap-pcol">
        <p className="ap-cap">Payment record</p>
        {payment ? (
          <KV rows={[
            ["Order", <span key="o" className="ex-code">{payment.razorpay_order_id || "—"}</span>],
            ["Payment", <span key="p" className="ex-code">{payment.razorpay_payment_id || "—"}</span>],
            ["How", paymentMethod(payment.payment_method)],
            ["Status", payment.status],
            ["Amount", rupees(num(payment.amount))],
            ["To technician", rupees(num(payment.technician_amount))],
            ["Platform fee", rupees(num(payment.platform_fee))],
            ["Settled", truthy(payment.is_settled) ? "Yes" : "No"],
          ]} />
        ) : <p className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}>None</p>}
        <p className="ap-cap">Invoices</p>
        {data.invoices.length ? <KV rows={data.invoices.map((invoice) => [`#${invoice.id}`, `${rupees(num(invoice.total_amount))} · ${truthy(invoice.has_invoice_pdf) ? "PDF" : "no PDF"}`])} /> : <p className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}>None</p>}
        <p className="ap-cap">Technician dues</p>
        {data.technicianDues.length ? <KV rows={data.technicianDues.map((due) => [`#${due.id}`, `${rupees(num(due.amount))} · ${due.status}`])} /> : <p className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}>None{payment && String(payment.payment_method).toLowerCase() !== "cash" ? " · paid online" : ""}</p>}
      </div>
    </div>
  );
}
