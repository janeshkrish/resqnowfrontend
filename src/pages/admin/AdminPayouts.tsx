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
  technicianId: number;
  technicianName: string;
  upiId?: string | null;
  amount: number;
  currency: string;
  status: string;
  payoutMethod?: string | null;
  externalReference?: string | null;
  processedAt?: string | null;
  createdAt?: string | null;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString() : "-";

const AdminPayouts = () => {
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [onlyPositive, setOnlyPositive] = useState(true);
  const [payingId, setPayingId] = useState<number | null>(null);
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
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || "Failed to fetch wallet balances.");
      }
      setWallets(Array.isArray(body?.data) ? body.data : []);
    } catch (err) {
      const message = (err as Error)?.message || "Failed to fetch wallet balances.";
      setWalletError(message);
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
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || "Failed to fetch payout history.");
      }
      setPayouts(Array.isArray(body?.data) ? body.data : []);
    } catch (err) {
      const message = (err as Error)?.message || "Failed to fetch payout history.";
      setPayoutError(message);
    } finally {
      setPayoutLoading(false);
    }
  };

  const refreshAll = () => {
    fetchWallets();
    fetchPayouts();
  };

  useEffect(() => {
    refreshAll();
  }, [search, onlyPositive]);

  const markAsPaid = async (wallet: WalletRow) => {
    if (payingId) return;
    const confirmed = window.confirm(
      `Mark ${formatCurrency(wallet.withdrawableBalance)} as paid to ${wallet.technicianName}?`
    );
    if (!confirmed) return;

    setPayingId(wallet.technicianId);
    try {
      const res = await apiFetch("/api/admin/finance/payouts", {
        method: "POST",
        admin: true,
        body: JSON.stringify({
          technicianId: wallet.technicianId,
          notes: `Manual payout for technician #${wallet.technicianId}`,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || "Failed to mark payout as paid.");
      }
      toast.success(body?.alreadyProcessed ? "Payout already recorded." : "Payout recorded.");
      refreshAll();
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to mark payout as paid.");
    } finally {
      setPayingId(null);
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
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || "Failed to export payout queue.");
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
            Monitor wallet balances and mark manual payouts as paid.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={refreshAll} disabled={walletLoading || payoutLoading}>
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
            <CardTitle>Wallet Balances</CardTitle>
            <p className="text-sm text-muted-foreground">
              Withdrawable balances ready for manual settlement.
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
                    <th className="text-left py-2 pr-4">Technician</th>
                    <th className="text-left py-2 pr-4">UPI</th>
                    <th className="text-left py-2 pr-4">Withdrawable</th>
                    <th className="text-left py-2 pr-4">Total Earned</th>
                    <th className="text-left py-2 pr-4">Paid Out</th>
                    <th className="text-left py-2 pr-4">Last Activity</th>
                    <th className="text-left py-2">Action</th>
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
                      <td className="py-2 pr-4">{row.upiId || "-"}</td>
                      <td className="py-2 pr-4 font-semibold text-emerald-700">
                        {formatCurrency(row.withdrawableBalance)}
                      </td>
                      <td className="py-2 pr-4">{formatCurrency(row.totalEarned)}</td>
                      <td className="py-2 pr-4">{formatCurrency(row.totalPaidOut)}</td>
                      <td className="py-2 pr-4">{formatDate(row.lastTransactionAt || row.walletUpdatedAt)}</td>
                      <td className="py-2">
                        {row.withdrawableBalance > 0 ? (
                          <Button
                            size="sm"
                            onClick={() => markAsPaid(row)}
                            disabled={payingId === row.technicianId}
                          >
                            {payingId === row.technicianId ? "Processing..." : "Mark as Paid"}
                          </Button>
                        ) : (
                          <Badge variant="secondary">No payout due</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {wallets.length === 0 && !walletLoading ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-muted-foreground">
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
                    <th className="text-left py-2 pr-4">Payout Ref</th>
                    <th className="text-left py-2 pr-4">Technician</th>
                    <th className="text-left py-2 pr-4">Amount</th>
                    <th className="text-left py-2 pr-4">Method</th>
                    <th className="text-left py-2 pr-4">External Ref</th>
                    <th className="text-left py-2 pr-4">Status</th>
                    <th className="text-left py-2">Processed</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="py-2 pr-4">
                        <div className="font-semibold">{row.payoutReference}</div>
                        <div className="text-xs text-muted-foreground">#{row.id}</div>
                      </td>
                      <td className="py-2 pr-4">
                        <div className="font-medium">{row.technicianName}</div>
                        <div className="text-xs text-muted-foreground">{row.upiId || "-"}</div>
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
