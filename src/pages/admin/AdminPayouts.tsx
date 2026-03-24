import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type WalletRow = {
  walletId: number;
  technicianId: number;
  technicianName: string;
  technicianEmail: string;
  upiId?: string | null;
  upiName?: string | null;
  currency: string;
  withdrawableBalance: number;
  totalEarned: number;
  totalPaidOut: number;
  onHoldBalance: number;
  lastTransactionAt?: string | null;
  walletUpdatedAt?: string | null;
};

type PayoutRow = {
  id: number;
  payoutReference: string;
  withdrawalRequestId?: number | null;
  technicianId: number;
  technicianName: string;
  upiId?: string | null;
  upiName?: string | null;
  amount: number;
  currency: string;
  status: string;
  payoutMethod?: string | null;
  externalReference?: string | null;
  destinationName?: string | null;
  processedAt?: string | null;
  createdAt?: string | null;
};

type WithdrawalRequestRow = {
  id: number;
  withdrawalReference: string;
  technicianId: number;
  technicianName?: string | null;
  technicianEmail?: string | null;
  amount: number;
  currency: string;
  status: string;
  upiId?: string | null;
  beneficiaryName?: string | null;
  note?: string | null;
  rejectionReason?: string | null;
  payoutId?: number | null;
  payoutReference?: string | null;
  payoutStatus?: string | null;
  payoutMethod?: string | null;
  externalReference?: string | null;
  upiLink?: string | null;
  processingStartedAt?: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString("en-IN") : "-";

const stripHtml = (value: string) =>
  String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildApiErrorMessage = (response: Response, rawText: string, fallback: string) => {
  const text = stripHtml(rawText);
  const missingRouteMatch = text.match(/Cannot\s+(GET|POST|PUT|PATCH|DELETE)\s+([^\s]+)/i);

  if (missingRouteMatch) {
    return `The deployed backend is missing ${missingRouteMatch[2]}. Deploy the latest backend and retry.`;
  }

  return text || `${fallback} (HTTP ${response.status})`;
};

const readJsonResponse = async <T,>(response: Response, fallbackError: string): Promise<T> => {
  const rawText = await response.text();
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const isJson = contentType.includes("application/json");

  let parsedBody: any = null;
  if (isJson && rawText) {
    try {
      parsedBody = JSON.parse(rawText);
    } catch {
      parsedBody = null;
    }
  }

  if (!response.ok) {
    throw new Error(
      parsedBody?.error ||
      parsedBody?.message ||
      buildApiErrorMessage(response, rawText, fallbackError)
    );
  }

  if (!isJson) {
    throw new Error(buildApiErrorMessage(response, rawText, fallbackError));
  }

  return (parsedBody ?? {}) as T;
};

const nextIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() || `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const AdminPayouts = () => {
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequestRow[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [withdrawalLoading, setWithdrawalLoading] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [withdrawalError, setWithdrawalError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [onlyPositive, setOnlyPositive] = useState(true);
  const [withdrawalStatus, setWithdrawalStatus] = useState("pending");
  const [payingId, setPayingId] = useState<number | null>(null);
  const [requestActionId, setRequestActionId] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const fetchWallets = async () => {
    setWalletLoading(true);
    setWalletError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (search) params.set("search", search);
      if (onlyPositive) params.set("onlyPositiveBalance", "true");
      const res = await apiFetch(`/api/admin/finance/wallets?${params.toString()}`, {
        method: "GET",
        admin: true,
      });
      const body = await readJsonResponse<{ data?: WalletRow[] }>(res, "Failed to fetch wallet balances.");
      setWallets(Array.isArray(body?.data) ? body.data : []);
    } catch (err) {
      setWalletError((err as Error)?.message || "Failed to fetch wallet balances.");
    } finally {
      setWalletLoading(false);
    }
  };

  const fetchPayouts = async () => {
    setPayoutLoading(true);
    setPayoutError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "20");
      if (search) params.set("search", search);
      const res = await apiFetch(`/api/admin/finance/payouts?${params.toString()}`, {
        method: "GET",
        admin: true,
      });
      const body = await readJsonResponse<{ data?: PayoutRow[] }>(res, "Failed to fetch payout history.");
      setPayouts(Array.isArray(body?.data) ? body.data : []);
    } catch (err) {
      setPayoutError((err as Error)?.message || "Failed to fetch payout history.");
    } finally {
      setPayoutLoading(false);
    }
  };

  const fetchWithdrawals = async () => {
    setWithdrawalLoading(true);
    setWithdrawalError(null);
    try {
      const params = new URLSearchParams();
      params.set("limit", "50");
      if (search) params.set("search", search);
      if (withdrawalStatus && withdrawalStatus !== "all") {
        params.set("status", withdrawalStatus);
      }
      const res = await apiFetch(`/api/admin/finance/withdrawal-requests?${params.toString()}`, {
        method: "GET",
        admin: true,
      });
      const body = await readJsonResponse<{ data?: WithdrawalRequestRow[] }>(
        res,
        "Failed to fetch withdrawal requests."
      );
      setWithdrawals(Array.isArray(body?.data) ? body.data : []);
    } catch (err) {
      setWithdrawalError((err as Error)?.message || "Failed to fetch withdrawal requests.");
    } finally {
      setWithdrawalLoading(false);
    }
  };

  const refreshAll = () => {
    fetchWallets();
    fetchPayouts();
    fetchWithdrawals();
  };

  useEffect(() => {
    refreshAll();
  }, [search, onlyPositive, withdrawalStatus]);

  const markLegacyPayoutAsPaid = async (wallet: WalletRow) => {
    if (payingId) return;
    const confirmed = window.confirm(
      `Record a direct payout of ${formatCurrency(wallet.withdrawableBalance)} for ${wallet.technicianName}?\n\nPreferred flow: use a technician withdrawal request whenever available.`
    );
    if (!confirmed) return;

    setPayingId(wallet.technicianId);
    try {
      const res = await apiFetch("/api/admin/finance/payouts", {
        method: "POST",
        admin: true,
        body: JSON.stringify({
          technicianId: wallet.technicianId,
          notes: `Legacy direct payout for technician #${wallet.technicianId}`,
          idempotencyKey: nextIdempotencyKey(),
        }),
      });
      const body = await readJsonResponse<{ alreadyProcessed?: boolean }>(res, "Failed to record payout.");
      toast.success(body?.alreadyProcessed ? "Payout already recorded." : "Payout recorded.");
      refreshAll();
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to record payout.");
    } finally {
      setPayingId(null);
    }
  };

  const openUpiLink = async (request: WithdrawalRequestRow) => {
    if (requestActionId) return;

    setRequestActionId(request.id);
    try {
      const res = await apiFetch(`/api/admin/finance/withdrawal-requests/${request.id}/start`, {
        method: "POST",
        admin: true,
        body: JSON.stringify({
          payoutMethod: "manual_upi",
          notes: `UPI payout initiated for withdrawal #${request.id}`,
        }),
      });
      const body = await readJsonResponse<{ request?: WithdrawalRequestRow }>(
        res,
        "Failed to start withdrawal processing."
      );
      const upiLink = body?.request?.upiLink || request.upiLink;
      if (!upiLink) {
        throw new Error("UPI link could not be generated for this withdrawal request.");
      }
      window.open(upiLink, "_self");
      toast.success("UPI payment link opened.");
      refreshAll();
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to open UPI link.");
    } finally {
      setRequestActionId(null);
    }
  };

  const copyUpi = async (request: WithdrawalRequestRow) => {
    const value = String(request.upiId || "").trim();
    if (!value) {
      toast.error("No UPI ID is available for this withdrawal request.");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      toast.success("UPI ID copied.");
    } catch {
      toast.error("Failed to copy UPI ID.");
    }
  };

  const markRequestPaid = async (request: WithdrawalRequestRow) => {
    if (requestActionId) return;
    const confirmed = window.confirm(
      `Mark ${formatCurrency(request.amount)} as paid to ${request.beneficiaryName || request.technicianName}?`
    );
    if (!confirmed) return;

    const externalReference =
      window.prompt("Optional UTR / payout reference", request.externalReference || "") ?? "";

    setRequestActionId(request.id);
    try {
      const res = await apiFetch(`/api/admin/finance/withdrawal-requests/${request.id}/mark-paid`, {
        method: "POST",
        admin: true,
        body: JSON.stringify({
          payoutMethod: "manual_upi",
          externalReference: externalReference.trim(),
          notes: `Marked paid for withdrawal #${request.id}`,
        }),
      });
      const body = await readJsonResponse<{ alreadyProcessed?: boolean }>(
        res,
        "Failed to mark withdrawal as paid."
      );
      toast.success(body?.alreadyProcessed ? "Withdrawal already marked as paid." : "Withdrawal marked as paid.");
      refreshAll();
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to mark withdrawal as paid.");
    } finally {
      setRequestActionId(null);
    }
  };

  const rejectRequest = async (request: WithdrawalRequestRow) => {
    if (requestActionId) return;
    const reason = window.prompt("Reason for rejection", request.rejectionReason || "Invalid UPI details");
    if (reason == null) return;

    setRequestActionId(request.id);
    try {
      const res = await apiFetch(`/api/admin/finance/withdrawal-requests/${request.id}/reject`, {
        method: "POST",
        admin: true,
        body: JSON.stringify({
          reason: reason.trim(),
          notes: `Rejected withdrawal #${request.id}`,
        }),
      });
      await readJsonResponse(res, "Failed to reject withdrawal request.");
      toast.success("Withdrawal request rejected.");
      refreshAll();
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to reject withdrawal request.");
    } finally {
      setRequestActionId(null);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const res = await apiFetch("/api/admin/finance/payout-queue/export?limit=500", {
        method: "GET",
        admin: true,
      });
      if (!res.ok) {
        const rawText = await res.text().catch(() => "");
        throw new Error(buildApiErrorMessage(res, rawText, "Failed to export payout queue."));
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `payout_queue_${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Payout queue CSV generated.");
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to export payout queue.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container py-8 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Technician Payouts</h1>
          <p className="text-muted-foreground">
            Process withdrawal requests first, then use direct wallet payouts only as a fallback.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refreshAll} disabled={walletLoading || payoutLoading || withdrawalLoading}>
            Refresh
          </Button>
          <Button variant="outline" onClick={exportCsv} disabled={exporting}>
            {exporting ? "Exporting..." : "Export Payout CSV"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Withdrawal Requests</CardTitle>
            <p className="text-sm text-muted-foreground">
              Preferred payout queue for manual UPI settlement.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search technician, UPI, beneficiary, ref"
              className="md:w-72"
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={withdrawalStatus}
              onChange={(event) => setWithdrawalStatus(event.target.value)}
            >
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
              <option value="all">All statuses</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {withdrawalError ? (
            <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {withdrawalError}
            </div>
          ) : null}
          {withdrawalLoading ? (
            <p className="text-sm text-muted-foreground">Loading withdrawal requests...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 text-left">Request</th>
                    <th className="py-2 pr-4 text-left">Technician</th>
                    <th className="py-2 pr-4 text-left">UPI</th>
                    <th className="py-2 pr-4 text-left">Amount</th>
                    <th className="py-2 pr-4 text-left">Status</th>
                    <th className="py-2 pr-4 text-left">Created</th>
                    <th className="py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((request) => {
                    const canAct = request.status === "pending" || request.status === "processing";
                    const busy = requestActionId === request.id;
                    return (
                      <tr key={request.id} className="border-b align-top">
                        <td className="py-2 pr-4">
                          <div className="font-semibold">{request.withdrawalReference}</div>
                          <div className="text-xs text-muted-foreground">
                            #{request.id}
                            {request.payoutReference ? ` | ${request.payoutReference}` : ""}
                          </div>
                          {request.note ? (
                            <div className="mt-1 text-xs text-muted-foreground">{request.note}</div>
                          ) : null}
                          {request.rejectionReason ? (
                            <div className="mt-1 text-xs text-rose-600">{request.rejectionReason}</div>
                          ) : null}
                        </td>
                        <td className="py-2 pr-4">
                          <div className="font-medium">{request.technicianName || "Technician"}</div>
                          <div className="text-xs text-muted-foreground">
                            #{request.technicianId}
                            {request.technicianEmail ? ` | ${request.technicianEmail}` : ""}
                          </div>
                        </td>
                        <td className="py-2 pr-4">
                          <div>{request.upiId || "-"}</div>
                          <div className="text-xs text-muted-foreground">
                            {request.beneficiaryName || "-"}
                          </div>
                        </td>
                        <td className="py-2 pr-4 font-semibold">{formatCurrency(request.amount)}</td>
                        <td className="py-2 pr-4">
                          <Badge variant="outline" className="capitalize">
                            {request.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4">
                          <div>{formatDate(request.createdAt)}</div>
                          <div className="text-xs text-muted-foreground">
                            {request.paidAt ? `Paid ${formatDate(request.paidAt)}` : request.processingStartedAt ? `Started ${formatDate(request.processingStartedAt)}` : ""}
                          </div>
                        </td>
                        <td className="py-2">
                          {canAct ? (
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => openUpiLink(request)} disabled={busy}>
                                {busy ? "Working..." : "Pay via UPI"}
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => copyUpi(request)} disabled={busy}>
                                Copy UPI
                              </Button>
                              <Button size="sm" onClick={() => markRequestPaid(request)} disabled={busy}>
                                Mark as Paid
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => rejectRequest(request)} disabled={busy}>
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {request.status === "paid" ? "Settled" : "No actions available"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {withdrawals.length === 0 && !withdrawalLoading ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-muted-foreground">
                        No withdrawal requests found for the selected filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Wallet Balances</CardTitle>
            <p className="text-sm text-muted-foreground">
              Remaining withdrawable balances. Direct payout is kept as a fallback path.
            </p>
          </div>
          <div className="flex flex-col gap-2 md:flex-row">
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search technician, email, or UPI"
              className="md:w-64"
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={onlyPositive ? "positive" : "all"}
              onChange={(event) => setOnlyPositive(event.target.value === "positive")}
            >
              <option value="positive">Only positive balances</option>
              <option value="all">All technicians</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {walletError ? (
            <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {walletError}
            </div>
          ) : null}
          {walletLoading ? (
            <p className="text-sm text-muted-foreground">Loading wallet balances...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 text-left">Technician</th>
                    <th className="py-2 pr-4 text-left">UPI</th>
                    <th className="py-2 pr-4 text-left">Withdrawable</th>
                    <th className="py-2 pr-4 text-left">On Hold</th>
                    <th className="py-2 pr-4 text-left">Total Earned</th>
                    <th className="py-2 pr-4 text-left">Paid Out</th>
                    <th className="py-2 pr-4 text-left">Last Activity</th>
                    <th className="py-2 text-left">Fallback</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((row) => (
                    <tr key={row.technicianId} className="border-b">
                      <td className="py-2 pr-4">
                        <div className="font-semibold">{row.technicianName}</div>
                        <div className="text-xs text-muted-foreground">
                          #{row.technicianId} {row.technicianEmail ? `| ${row.technicianEmail}` : ""}
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <div>{row.upiId || "-"}</div>
                        <div className="text-xs text-muted-foreground">{row.upiName || "-"}</div>
                      </td>
                      <td className="py-2 pr-4 font-semibold text-emerald-700">
                        {formatCurrency(row.withdrawableBalance)}
                      </td>
                      <td className="py-2 pr-4">{formatCurrency(row.onHoldBalance)}</td>
                      <td className="py-2 pr-4">{formatCurrency(row.totalEarned)}</td>
                      <td className="py-2 pr-4">{formatCurrency(row.totalPaidOut)}</td>
                      <td className="py-2 pr-4">{formatDate(row.lastTransactionAt || row.walletUpdatedAt)}</td>
                      <td className="py-2">
                        {row.withdrawableBalance > 0 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markLegacyPayoutAsPaid(row)}
                            disabled={payingId === row.technicianId}
                          >
                            {payingId === row.technicianId ? "Processing..." : "Direct Payout"}
                          </Button>
                        ) : (
                          <Badge variant="secondary">No payout due</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {wallets.length === 0 && !walletLoading ? (
                    <tr>
                      <td colSpan={8} className="py-4 text-muted-foreground">
                        No wallets found for the selected filters.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payout History</CardTitle>
          <p className="text-sm text-muted-foreground">
            Recently recorded manual payouts.
          </p>
        </CardHeader>
        <CardContent>
          {payoutError ? (
            <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {payoutError}
            </div>
          ) : null}
          {payoutLoading ? (
            <p className="text-sm text-muted-foreground">Loading payout history...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 pr-4 text-left">Payout Ref</th>
                    <th className="py-2 pr-4 text-left">Technician</th>
                    <th className="py-2 pr-4 text-left">Amount</th>
                    <th className="py-2 pr-4 text-left">Method</th>
                    <th className="py-2 pr-4 text-left">External Ref</th>
                    <th className="py-2 pr-4 text-left">Status</th>
                    <th className="py-2 text-left">Processed</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="py-2 pr-4">
                        <div className="font-semibold">{row.payoutReference}</div>
                        <div className="text-xs text-muted-foreground">
                          #{row.id}
                          {row.withdrawalRequestId ? ` | WDR #${row.withdrawalRequestId}` : ""}
                        </div>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="font-medium">{row.technicianName}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.destinationName || row.upiName || row.upiId || "-"}
                        </div>
                      </td>
                      <td className="py-2 pr-4 font-semibold">{formatCurrency(row.amount)}</td>
                      <td className="py-2 pr-4">{row.payoutMethod || "manual_upi"}</td>
                      <td className="py-2 pr-4">{row.externalReference || "-"}</td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="capitalize">
                          {row.status}
                        </Badge>
                      </td>
                      <td className="py-2">{formatDate(row.processedAt || row.createdAt)}</td>
                    </tr>
                  ))}
                  {payouts.length === 0 && !payoutLoading ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-muted-foreground">
                        No payout history recorded yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminPayouts;
