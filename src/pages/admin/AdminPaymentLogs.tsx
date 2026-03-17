import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { io, Socket } from "socket.io-client";
import { FRONTEND_ONLY_MODE, getAdminToken, getRequiredApiBaseUrl } from "@/lib/api";

type PaymentRecord = {
  payment_id: number;
  service_request_id: number;
  payment_method: string;
  payment_row_status: string;
  payment_total_amount: number;
  platform_fee: number;
  technician_amount: number;
  is_settled: boolean | number;
  payment_created_at: string;
  request_status: string;
  request_payment_status: string;
  customer_name: string;
  customer_email: string;
  technician_name: string;
  checks?: {
    request_paid_consistent?: boolean;
    payment_method_consistent?: boolean;
  };
};

type RefundHistoryEntry = {
  id: number;
  refundReference: string;
  amount: number;
  status: string;
  technicianAdjustmentAmount: number;
  externalReference?: string | null;
  requestedBy?: string | null;
  processedAt?: string | null;
  createdAt?: string | null;
  reason?: string | null;
};

type RefundHistoryResponse = {
  paymentId: number;
  totalAmount: number;
  refundedAmount: number;
  remainingRefundable: number;
  refundStatus: string;
  paymentStatus: string | null;
  paymentMethod: string | null;
  paymentToTechnicianStatus: string | null;
  refunds: RefundHistoryEntry[];
};

type DispatchAuditTechnician = {
  technician_id: number | string;
  name: string;
  eligible: boolean;
  reject_reasons: string[];
  distance_km: number | null;
  service_type: string;
  vehicle_types: Record<string, boolean> | string[] | null;
  dispatch_offer_status: string | null;
};

type DispatchAuditResponse = {
  request: {
    id: number;
    service_type: string;
    vehicle_type: string;
    canonical_service_domain: string;
    canonical_vehicle_type: string;
    status: string;
  };
  summary: {
    total_technicians: number;
    eligible_count: number;
    rejected_count: number;
    rejection_reason_counts: Record<string, number>;
  };
  technicians: DispatchAuditTechnician[];
};

const AdminPaymentLogs = () => {
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [requestIdQuery, setRequestIdQuery] = useState("");
  const [diagnostics, setDiagnostics] = useState<any>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [dispatchAudit, setDispatchAudit] = useState<DispatchAuditResponse | null>(null);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundRecord, setRefundRecord] = useState<PaymentRecord | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");
  const [refundHistory, setRefundHistory] = useState<RefundHistoryResponse | null>(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundSubmitting, setRefundSubmitting] = useState(false);

  const formatCurrency = (value: number | null | undefined) => `Rs ${Number(value || 0).toFixed(2)}`;

  const fetchOverview = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiFetch("/api/payments/diagnostics/overview?limit=100", { method: "GET", admin: true });
      if (!res.ok) throw new Error("Failed to fetch payment logs");
      const data = await res.json();
      setRecords(Array.isArray(data.records) ? data.records : []);
      setStats(data.stats || {});
    } catch (err: any) {
      if (!silent) toast.error(err.message || "Failed to load payment logs");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchRefundHistory = async (paymentId: number, silent = false) => {
    if (!silent) setRefundLoading(true);
    try {
      const res = await apiFetch(`/api/admin/finance/refunds/${paymentId}`, { method: "GET", admin: true });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.error || "Failed to load refund history");
      }
      const data = await res.json();
      setRefundHistory(data);
    } catch (err: any) {
      if (!silent) toast.error(err.message || "Failed to load refund history");
      setRefundHistory(null);
    } finally {
      if (!silent) setRefundLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    if (FRONTEND_ONLY_MODE) {
      const id = window.setInterval(() => fetchOverview(true), 60000);
      return () => window.clearInterval(id);
    }

    const socketBaseUrl = getRequiredApiBaseUrl();
    const socket: Socket = io(socketBaseUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token: getAdminToken() || undefined },
    });

    socket.on("admin:payment_update", () => {
      fetchOverview(true);
    });

    // fallback refresh to recover from transient socket disconnects
    const id = window.setInterval(() => fetchOverview(true), 60000);

    return () => {
      window.clearInterval(id);
      socket.disconnect();
    };
  }, []);

  const filtered = useMemo(() => {
    const q = requestIdQuery.trim();
    if (!q) return records;
    return records.filter((r) => String(r.service_request_id).includes(q));
  }, [records, requestIdQuery]);

  const runDiagnostics = async () => {
    const requestId = requestIdQuery.trim();
    if (!requestId) {
      toast.error("Enter a request ID");
      return;
    }
    setDiagLoading(true);
    try {
      const [paymentsRes, auditRes] = await Promise.all([
        apiFetch(`/api/payments/diagnostics/request/${requestId}`, { method: "GET", admin: true }),
        apiFetch(`/api/admin/dispatch-audit/${requestId}`, { method: "GET", admin: true }),
      ]);

      if (!paymentsRes.ok) throw new Error("Diagnostics not found");
      const paymentsData = await paymentsRes.json();
      setDiagnostics(paymentsData);

      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setDispatchAudit(auditData);
      } else {
        setDispatchAudit(null);
      }
    } catch (err: any) {
      setDiagnostics(null);
      setDispatchAudit(null);
      toast.error(err.message || "Failed to fetch diagnostics");
    } finally {
      setDiagLoading(false);
    }
  };

  const openRefundDialog = (record: PaymentRecord) => {
    setRefundRecord(record);
    setRefundAmount("");
    setRefundReason("");
    setRefundHistory(null);
    setRefundDialogOpen(true);
    if (record?.payment_id) {
      fetchRefundHistory(record.payment_id);
    }
  };

  const closeRefundDialog = () => {
    if (refundSubmitting) return;
    setRefundDialogOpen(false);
    setRefundRecord(null);
    setRefundAmount("");
    setRefundReason("");
    setRefundHistory(null);
  };

  const handleRefundSubmit = async () => {
    if (!refundRecord) return;
    const amountInput = refundAmount.trim();
    let amount: number | null = null;
    if (amountInput) {
      const parsed = Number(amountInput);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        toast.error("Enter a valid refund amount.");
        return;
      }
      amount = parsed;
      if (
        refundHistory?.remainingRefundable != null &&
        amount > Number(refundHistory.remainingRefundable || 0)
      ) {
        toast.error("Refund amount exceeds remaining refundable balance.");
        return;
      }
    }

    setRefundSubmitting(true);
    try {
      const res = await apiFetch(`/api/admin/finance/refund/${refundRecord.payment_id}`, {
        method: "POST",
        admin: true,
        body: JSON.stringify({
          refundAmount: amount,
          reason: refundReason.trim(),
          useGateway: true,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const gatewayInfo = body?.gatewayRefundId ? ` Gateway refund id: ${body.gatewayRefundId}` : "";
        throw new Error(`${body?.error || "Failed to process refund."}${gatewayInfo}`);
      }

      toast.success(
        body?.refundStatus
          ? `Refund processed (${body.refundStatus}).`
          : "Refund processed successfully."
      );
      await fetchRefundHistory(refundRecord.payment_id, true);
      fetchOverview(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to process refund.");
    } finally {
      setRefundSubmitting(false);
    }
  };

  return (
    <div className="container py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payment Logs</h1>
        <p className="text-muted-foreground">Live payment records and diagnostics</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total</p><p className="text-xl font-semibold">{stats.total_payments || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Completed</p><p className="text-xl font-semibold">{stats.completed_payments || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Cash</p><p className="text-xl font-semibold">{stats.cash_payments || 0}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Online</p><p className="text-xl font-semibold">{stats.online_payments || 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Request Diagnostics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={requestIdQuery} onChange={(e) => setRequestIdQuery(e.target.value)} placeholder="Search request ID or run diagnostics" />
            <Button onClick={runDiagnostics} disabled={diagLoading}>{diagLoading ? "Checking..." : "Check"}</Button>
          </div>
          {diagnostics && (
            <div className="rounded border p-3 bg-muted/20 text-sm">
              <div className="flex flex-wrap gap-2 mb-2">
                {Object.entries(diagnostics.checks || {}).map(([k, v]) => (
                  <Badge key={k} variant={v ? "default" : "destructive"}>{k}: {String(v)}</Badge>
                ))}
              </div>
              <div>Request Status: {diagnostics.request?.status} / Payment: {diagnostics.request?.payment_status}</div>
              <div>Payments Found: {(diagnostics.payments || []).length}</div>
              <div>Invoices Found: {(diagnostics.invoices || []).length}</div>
            </div>
          )}
          {dispatchAudit && (
            <div className="rounded border p-3 bg-muted/10 text-sm space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">Dispatch Audit</span>
                <Badge variant="outline">Req #{dispatchAudit.request.id}</Badge>
                <Badge variant="outline">{dispatchAudit.request.service_type}</Badge>
                <Badge variant="outline">{dispatchAudit.request.vehicle_type}</Badge>
                <Badge variant={dispatchAudit.summary.eligible_count > 0 ? "default" : "destructive"}>
                  Eligible: {dispatchAudit.summary.eligible_count}
                </Badge>
                <Badge variant="secondary">Rejected: {dispatchAudit.summary.rejected_count}</Badge>
              </div>

              <div className="overflow-x-auto border rounded">
                <table className="min-w-full text-xs">
                  <thead className="bg-muted/40">
                    <tr className="border-b">
                      <th className="text-left py-2 px-2">Technician</th>
                      <th className="text-left py-2 px-2">Eligibility</th>
                      <th className="text-left py-2 px-2">Distance</th>
                      <th className="text-left py-2 px-2">Offer</th>
                      <th className="text-left py-2 px-2">Reasons</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(dispatchAudit.technicians || []).slice(0, 30).map((t) => (
                      <tr key={String(t.technician_id)} className="border-b last:border-b-0">
                        <td className="py-2 px-2">
                          <div className="font-medium">{t.name}</div>
                          <div className="text-muted-foreground">{t.service_type || "-"}</div>
                        </td>
                        <td className="py-2 px-2">
                          <Badge variant={t.eligible ? "default" : "destructive"}>
                            {t.eligible ? "Eligible" : "Rejected"}
                          </Badge>
                        </td>
                        <td className="py-2 px-2">{t.distance_km != null ? `${t.distance_km} km` : "-"}</td>
                        <td className="py-2 px-2">{t.dispatch_offer_status || "-"}</td>
                        <td className="py-2 px-2">
                          <div className="flex flex-wrap gap-1">
                            {t.reject_reasons?.length ? (
                              t.reject_reasons.map((r) => (
                                <Badge key={r} variant="secondary" className="text-[10px]">
                                  {r}
                                </Badge>
                              ))
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!dispatchAudit.technicians || dispatchAudit.technicians.length === 0) && (
                      <tr>
                        <td colSpan={5} className="py-3 px-2 text-muted-foreground">
                          No technicians available in audit.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Payments</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p>Loading payment logs...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">Request</th>
                    <th className="text-left py-2 pr-4">Method</th>
                    <th className="text-left py-2 pr-4">Amount</th>
                    <th className="text-left py-2 pr-4">Customer</th>
                    <th className="text-left py-2 pr-4">Technician</th>
                    <th className="text-left py-2 pr-4">State</th>
                    <th className="text-left py-2">Checks</th>
                    <th className="text-left py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.payment_id} className="border-b">
                      <td className="py-2 pr-4">{r.service_request_id}</td>
                      <td className="py-2 pr-4">{r.payment_method}</td>
                      <td className="py-2 pr-4">Rs {Number(r.payment_total_amount || 0).toFixed(2)}</td>
                      <td className="py-2 pr-4">{r.customer_name || "-"}</td>
                      <td className="py-2 pr-4">{r.technician_name || "-"}</td>
                      <td className="py-2 pr-4">{r.request_status}/{r.request_payment_status}</td>
                      <td className="py-2">
                        <div className="flex gap-1 flex-wrap">
                          <Badge variant={r.checks?.request_paid_consistent ? "default" : "destructive"}>paid-sync</Badge>
                          <Badge variant={r.checks?.payment_method_consistent ? "default" : "destructive"}>method-sync</Badge>
                        </div>
                      </td>
                      <td className="py-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openRefundDialog(r)}
                          disabled={
                            String(r.payment_method || "").toLowerCase() === "cash" ||
                            Number(r.payment_total_amount || 0) <= 0
                          }
                        >
                          Refund
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 text-muted-foreground">No payment records found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={refundDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeRefundDialog();
          else setRefundDialogOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Refund payment #{refundRecord?.payment_id ?? "-"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">Total Paid</p>
                <p className="text-base font-semibold">
                  {formatCurrency(refundHistory?.totalAmount ?? refundRecord?.payment_total_amount)}
                </p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">Refunded</p>
                <p className="text-base font-semibold">
                  {formatCurrency(refundHistory?.refundedAmount ?? 0)}
                </p>
              </div>
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground">Remaining</p>
                <p className="text-base font-semibold">
                  {formatCurrency(refundHistory?.remainingRefundable ?? (refundRecord?.payment_total_amount || 0))}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Refund amount (leave empty for full refund)</div>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="e.g. 499.00"
              />
              {refundHistory && (
                <p className="text-xs text-muted-foreground">
                  Remaining refundable: {formatCurrency(refundHistory.remainingRefundable)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Reason (optional)</div>
              <Textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={3}
                placeholder="Reason for refund"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Refund history</div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => refundRecord && fetchRefundHistory(refundRecord.payment_id)}
                  disabled={refundLoading}
                >
                  {refundLoading ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
              {refundLoading ? (
                <p className="text-sm text-muted-foreground">Loading refund history...</p>
              ) : refundHistory?.refunds?.length ? (
                <div className="overflow-x-auto border rounded">
                  <table className="min-w-full text-xs">
                    <thead className="bg-muted/40">
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Reference</th>
                        <th className="text-left py-2 px-2">Amount</th>
                        <th className="text-left py-2 px-2">Status</th>
                        <th className="text-left py-2 px-2">Tech Reversal</th>
                        <th className="text-left py-2 px-2">Gateway ID</th>
                        <th className="text-left py-2 px-2">Processed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {refundHistory.refunds.map((refund) => (
                        <tr key={refund.id} className="border-b last:border-b-0">
                          <td className="py-2 px-2">{refund.refundReference || refund.id}</td>
                          <td className="py-2 px-2">{formatCurrency(refund.amount)}</td>
                          <td className="py-2 px-2">{refund.status || "-"}</td>
                          <td className="py-2 px-2">{formatCurrency(refund.technicianAdjustmentAmount || 0)}</td>
                          <td className="py-2 px-2">{refund.externalReference || "-"}</td>
                          <td className="py-2 px-2">{refund.processedAt || refund.createdAt || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No refunds recorded yet.</p>
              )}
            </div>
          </div>
          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={closeRefundDialog} disabled={refundSubmitting}>
              Close
            </Button>
            <Button onClick={handleRefundSubmit} disabled={refundSubmitting || !refundRecord}>
              {refundSubmitting ? "Processing..." : "Process refund"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPaymentLogs;
