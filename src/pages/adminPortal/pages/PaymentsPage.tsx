import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAdminEvents } from "@/pages/adminExtended/monitor/adminLive";
import { downloadFinanceCsv, getFlaggedPayments, getPaymentDiagnostics, getPaymentOverview, getRefundHistory, getToday, refundPayment, type PaymentRecord } from "../api/portalApi";
import { clock, day, paymentMethod, percent, rupees, service } from "../format";
import { PaymentChecks } from "../PaymentChecks";
import { Btn, Cell, Empty, ErrorState, Icon, Kpis, Loading, Note, Panel, Pill, PillTabs, Row, SearchBox, Strip, Table, Timeline, UnderTabs, usePortalHeader, type Tone } from "../ui";

// Every rupee in, matched to its request and its technician, with the old Payment Logs checks and refunds.

type Tab = "all" | "online" | "cash" | "look";
const num = (value: unknown) => (value == null || value === "" || !Number.isFinite(Number(value)) ? null : Number(value));
const truthy = (value: unknown) => value === true || value === 1 || value === "1" || value === "true";
const isCash = (row: PaymentRecord) => String(row.payment_method || "").toLowerCase() === "cash";
const FLAG: Record<string, string> = { stale_pending: "Pending for more than 30 min", missing_razorpay_reference: "Online payment without a gateway reference", invalid_completed_amount: "Marked paid with no amount", manual_review: "Needs a look" };

function whereItIs(row: PaymentRecord): { label: string; tone: Tone } {
  const status = String(row.payment_row_status || "").toLowerCase();
  if (status === "cancelled") return { label: "Cancelled", tone: "" };
  if (status === "failed") return { label: "Failed", tone: "bad" };
  if (status === "refunded") return { label: "Refunded", tone: "warn" };
  if (["pending", "processing", "created"].includes(status)) return isCash(row) ? { label: "Waiting for cash", tone: "warn" } : { label: "Not paid yet", tone: "warn" };
  if (truthy(row.is_settled)) return { label: "Settled to technician", tone: "ok" };
  return isCash(row) ? { label: "Cash collected · dues added", tone: "ok" } : { label: "Paid · share in wallet", tone: "ok" };
}

export default function PaymentsPage() {
  usePortalHeader("Payments", "Every rupee in, matched to its request and its technician.");
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>("all");
  const [text, setText] = useState("");
  const [all, setAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const today = useQuery({ queryKey: ["portal", "today"], queryFn: getToday, refetchInterval: 60_000 });
  const overview = useQuery({ queryKey: ["portal", "payments"], queryFn: () => getPaymentOverview(200), refetchInterval: 60_000 });
  const flagged = useQuery({ queryKey: ["portal", "payments", "flagged"], queryFn: getFlaggedPayments, refetchInterval: 120_000 });
  useAdminEvents(() => void queryClient.invalidateQueries({ queryKey: ["portal", "payments"] }), 3_000, ["admin:payment_update", "admin:payment_pending", "admin:service_completed"]);
  const openRequest = params.get("refund") || params.get("request");
  const openTab = params.get("refund") ? "refund" : "checks";

  const flags = useMemo(() => new Map((flagged.data || []).map((row) => [Number(row.payment_id), row.flag_reason])), [flagged.data]);
  const records = overview.data?.records || [];
  const needsLook = (row: PaymentRecord) => !row.checks.request_paid_consistent || !row.checks.payment_method_consistent || flags.has(Number(row.payment_id));
  const q = text.trim().toLowerCase().replace(/^#/, "");
  const shown = records.filter((row) => (tab === "all" || (tab === "cash" ? isCash(row) : tab === "online" ? !isCash(row) : needsLook(row)))
    && (!q || [row.service_request_id, row.payment_id, row.customer_name, row.technician_name, row.razorpay_payment_id, row.razorpay_order_id].some((value) => String(value ?? "").toLowerCase().includes(q))));
  const look = records.filter(needsLook);
  const money = today.data?.money;

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await downloadFinanceCsv(30);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `resqnow-payments-30-days-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
      toast.success("Payments for the last 30 days exported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export.");
    } finally {
      setExporting(false);
    }
  };
  const cols = "70px 72px minmax(0,1fr) minmax(0,1fr) 64px 84px 96px 84px 190px 58px";
  const rows = all ? shown : shown.slice(0, 25);
  return (
    <div className="adm-stack" data-testid="payments-page">
      {money ? (
        <Kpis cols={6} items={[
          { label: "Collected today", value: rupees(money.collected), note: `${money.payments} payment${money.payments === 1 ? "" : "s"}`, testId: "kpi-collected" },
          { label: "Online", value: rupees(money.online.amount), note: `${money.online.count} · ${percent(money.collected ? money.online.amount / money.collected : null)}` },
          { label: "Cash", value: rupees(money.cash.amount), note: `${money.cash.count} jobs, collected by technicians` },
          { label: "To technicians", value: rupees(money.toTechnicians), note: `ResQNow ${rupees(money.toResqnow)}` },
          { label: "Cash dues to collect", value: rupees(money.cashDues.amount), note: `from ${money.cashDues.technicians} technician${money.cashDues.technicians === 1 ? "" : "s"}` },
          { label: "Need a look", value: look.length, note: look.length ? "see below" : "all checks pass", warn: look.length > 0, testId: "kpi-look" },
        ]} />
      ) : today.isError ? <ErrorState error={today.error} /> : <Loading height={96} />}
      {look.length ? (
        <div className="mn-banner"><Icon name="warning" /><span><b>{look.length} payment{look.length === 1 ? " needs" : "s need"} a look:</b> {look.slice(0, 3).map((row) => `#${row.service_request_id} ${!row.checks.request_paid_consistent ? "paid but not marked paid" : !row.checks.payment_method_consistent ? "method does not match" : (FLAG[flags.get(Number(row.payment_id)) || ""] || "flagged").toLowerCase()}`).join(" · ")}</span>
          <Btn size="sm" onClick={() => setTab("look")}>Review</Btn></div>
      ) : null}
      <div className="ap-bar">
        <PillTabs<Tab> label="Payments" value={tab} onChange={setTab} items={[
          { key: "all", label: "All", count: records.length }, { key: "online", label: "Online", count: records.filter((row) => !isCash(row)).length },
          { key: "cash", label: "Cash", count: records.filter(isCash).length }, { key: "look", label: "Need a look", count: look.length, warn: look.length > 0 },
        ]} />
        <div className="ap-filters">
          <SearchBox value={text} onChange={setText} placeholder="Request, customer, technician or payment id" style={{ width: 280, flex: "0 1 auto" }} />
          <Btn icon="download" disabled={exporting} onClick={() => void exportCsv()}>{exporting ? "Exporting…" : "Export 30 days"}</Btn>
        </div>
      </div>
      {overview.isError ? <ErrorState error={overview.error} onRetry={() => void overview.refetch()} /> : !overview.data ? <Loading height={360} label="Loading payments" /> : shown.length === 0 ? (
        <Empty icon="payments" title={tab === "look" ? "Nothing needs a look" : "No payments match"} />
      ) : (
        <Table label="Payments" testId="payments-table" cols={cols} minWidth={1080}
          head={["Time", "Request", "Customer", "Technician", "How", { label: "Amount", right: true }, { label: "To technician", right: true }, { label: "ResQNow", right: true }, "Where it is", "Checks"]}
          foot={<><span>{rows.length} of {shown.length} · the latest {records.length} payments · ResQNow = platform fee · Checks: paid status, then method</span>{shown.length > 25 ? <Btn size="sm" onClick={() => setAll(!all)}>{all ? "Show fewer" : "Show all"}</Btn> : null}</>}>
          {rows.map((row) => {
            const where = whereItIs(row);
            return (
              <Row key={row.payment_id} cols={cols} tight tone={needsLook(row) ? "risk" : undefined} label={`Payment for request ${row.service_request_id}`} onClick={() => setParams({ request: String(row.service_request_id) })}>
                <Cell className="ap-num ap-faint">{day(row.payment_created_at) === "Today" ? clock(row.payment_created_at) : day(row.payment_created_at)}</Cell>
                <Cell className="ap-strong ap-num">#{row.service_request_id}</Cell>
                <Cell>{row.customer_name || "—"}</Cell>
                <Cell>{row.technician_name || <span className="ap-faint">None</span>}</Cell>
                <Cell>{paymentMethod(row.payment_method)}</Cell>
                <Cell right className="ap-num ap-strong">{rupees(num(row.payment_total_amount))}</Cell>
                <Cell right className="ap-num">{rupees(num(row.technician_amount))}</Cell>
                <Cell right className="ap-num">{rupees(num(row.platform_fee))}</Cell>
                <Cell><Pill tone={where.tone}>{where.label}</Pill></Cell>
                <Cell><span className="mn-chk">
                  <i className={row.checks.request_paid_consistent ? "is-ok" : "is-bad"} title="Paid status matches"><Icon name={row.checks.request_paid_consistent ? "check" : "close"} /></i>
                  <i className={row.checks.payment_method_consistent ? "is-ok" : "is-bad"} title="Method matches"><Icon name={row.checks.payment_method_consistent ? "check" : "close"} /></i>
                </span></Cell>
              </Row>
            );
          })}
        </Table>
      )}
      {openRequest ? <PaymentPanel key={openRequest} requestId={Number(openRequest)} initialTab={openTab} onClose={() => setParams({})} /> : null}
    </div>
  );
}

function PaymentPanel({ requestId, initialTab, onClose }: { requestId: number; initialTab: "checks" | "refund"; onClose: () => void }) {
  const [tab, setTab] = useState<"checks" | "refund">(initialTab);
  const diagnostics = useQuery({ queryKey: ["portal", "payment-checks", requestId], queryFn: () => getPaymentDiagnostics(requestId) });
  const payment = diagnostics.data?.payments[0] || null;
  const amount = num(payment?.amount);
  const online = payment && String(payment.payment_method || "").toLowerCase() === "razorpay";
  return (
    <Panel label={`Payment for request ${requestId}`} testId="payment-panel" width={820} onClose={onClose}
      title={<>#{requestId}{payment ? ` · ${rupees(amount)} ${paymentMethod(payment.payment_method)}` : ""}</>}
      sub={diagnostics.data ? [service(diagnostics.data.request.service_type), diagnostics.data.request.status, payment?.created_at ? `${day(payment.created_at)} ${clock(payment.created_at)}` : null].filter(Boolean).join(" · ") : "Loading"}
      actions={<Link className="ap-btn is-sm" to={`/admin/requests/${requestId}`}><Icon name="open_in_new" />Open request</Link>}
      strip={<>
        {payment ? <Strip items={[
          { label: "Paid", value: rupees(amount), sub: `${paymentMethod(payment.payment_method)} · ${payment.status}` },
          { label: "To technician", value: rupees(num(payment.technician_amount)), sub: truthy(payment.is_settled) ? "settled" : "not settled yet" },
          { label: "ResQNow", value: rupees(num(payment.platform_fee)), sub: "platform fee" },
          { label: "Reference", value: <span className="ex-code">{payment.razorpay_payment_id || "—"}</span>, sub: payment.razorpay_order_id || (online ? "" : "cash, no gateway") },
        ]} /> : null}
        <div style={{ padding: "0 20px" }}><UnderTabs<"checks" | "refund"> label="Payment" value={tab} onChange={setTab} items={[{ key: "checks", label: "Checks" }, { key: "refund", label: "Refund" }]} /></div>
      </>}>
      {tab === "checks" ? <PaymentChecks requestId={requestId} /> : diagnostics.isLoading ? <div className="ap-pcol"><Loading height={200} /></div>
        : !payment ? <div className="ap-pcol"><Empty icon="payments" title="No payment for this request" /></div>
        : <Refund paymentId={Number(payment.id)} online={Boolean(online)} technicianShare={num(payment.technician_amount)} amount={amount} />}
    </Panel>
  );
}

function Refund({ paymentId, online, technicianShare, amount }: { paymentId: number; online: boolean; technicianShare: number | null; amount: number | null }) {
  const queryClient = useQueryClient();
  const history = useQuery({ queryKey: ["portal", "refunds", paymentId], queryFn: () => getRefundHistory(paymentId) });
  const remaining = history.data?.remainingRefundable ?? amount ?? 0;
  const [part, setPart] = useState(false);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { setValue(String(remaining || "")); }, [remaining]);
  const refundAmount = part ? Number(value) : remaining;
  const valid = Number.isFinite(refundAmount) && refundAmount > 0 && refundAmount <= remaining + 0.001 && reason.trim().length > 0;
  const takeBack = technicianShare != null && amount ? Math.round(technicianShare * (refundAmount / amount)) : null;
  const send = async () => {
    setBusy(true);
    setError("");
    try {
      await refundPayment(paymentId, { refundAmount, reason: reason.trim(), idempotencyKey: `portal-${paymentId}-${refundAmount}-${Date.now()}` });
      toast.success(`${rupees(refundAmount)} refund started`);
      setConfirming(false);
      setReason("");
      await queryClient.invalidateQueries({ queryKey: ["portal"] });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The refund did not go through.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="ap-pcols" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }} data-testid="refund">
      <div className="ap-pcol">
        <p className="ap-cap">Refunds so far</p>
        {history.isLoading ? <Loading height={80} /> : history.data?.refunds.length ? (
          <Timeline items={history.data.refunds.map((row) => ({ time: day(row.createdAt), tone: "warn", title: `${rupees(row.amount)} refunded · ${row.status}`, sub: [row.reason, row.technicianAdjustmentAmount ? `${rupees(row.technicianAdjustmentAmount)} taken back from the technician` : null, row.requestedBy ? `by ${row.requestedBy}` : null].filter(Boolean).join(" · ") }))} />
        ) : <p className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}>None</p>}
        {history.data ? <p className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}>Paid {rupees(history.data.totalAmount)} · refunded {rupees(history.data.refundedAmount)} · {rupees(history.data.remainingRefundable)} can still be refunded</p> : null}
      </div>
      <div className="ap-pcol">
        <p className="ap-cap">Refund</p>
        {!online ? <Note tone="warn" icon="info">Only online (Razorpay) payments can be refunded here. For cash jobs, settle it with the customer and note it on the request.</Note> : remaining <= 0 ? <Note icon="task_alt">Fully refunded.</Note> : (
          <>
            <div className="ap-seg" role="radiogroup" aria-label="How much">
              <button type="button" role="radio" aria-checked={!part} className={!part ? "is-on" : undefined} onClick={() => setPart(false)}>Full · {rupees(remaining)}</button>
              <button type="button" role="radio" aria-checked={part} className={part ? "is-on" : undefined} onClick={() => setPart(true)}>Part</button>
            </div>
            {part ? <div className="ap-field"><label htmlFor="refund-amount">Amount (₹)</label><input id="refund-amount" inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value.replace(/[^\d.]/g, ""))} /><small>Up to {rupees(remaining)}</small></div> : null}
            <div className="ap-field"><label htmlFor="refund-reason">Reason</label><input id="refund-reason" value={reason} placeholder="For example: the service did not fix the problem" onChange={(event) => setReason(event.target.value)} /></div>
            <Note icon="schedule">The money goes back through Razorpay to the customer's account in about 5 to 7 working days.{takeBack ? ` ${rupees(takeBack)} of the technician's share is taken back from their wallet.` : ""}</Note>
            {error ? <Note tone="bad" icon="error">{error}</Note> : null}
            <div className="ap-row" style={{ justifyContent: "flex-end", gap: 8 }}>
              {confirming ? <><Btn onClick={() => setConfirming(false)}>Cancel</Btn><Btn variant="hot" icon="currency_rupee" disabled={!valid || busy} onClick={() => void send()}>{busy ? "Refunding…" : `Yes, refund ${rupees(refundAmount)}`}</Btn></>
                : <Btn variant="dark" icon="currency_rupee" disabled={!valid} onClick={() => setConfirming(true)}>Refund {Number.isFinite(refundAmount) ? rupees(refundAmount) : ""}</Btn>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
