import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Landmark, TimerReset, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { apiFetch } from "@/lib/api";
import TechnicianEarningsChart from "@/components/technician/TechnicianEarningsChart";

interface EarningsHistoryPoint {
  date: string;
  amount: number;
}

interface WalletActivityRow {
  payment_id?: string | number | null;
  payout_id?: string | number | null;
  service_request_id?: string | number | null;
  service_type?: string | null;
  vehicle_type?: string | null;
  entry_type?: string;
  technician_amount?: number;
  balance_after?: number;
  created_at?: string;
}

interface WithdrawalRequestRow {
  id: number;
  withdrawalReference: string;
  amount: number;
  currency: string;
  status: string;
  upiId?: string | null;
  beneficiaryName?: string | null;
  note?: string | null;
  rejectionReason?: string | null;
  payoutReference?: string | null;
  processingStartedAt?: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
}

type TechnicianFinancials = {
  today: number;
  total: number;
  withdrawable_balance: number;
  total_paid_out: number;
  total_earnings: number;
  on_hold_balance: number;
  pending_withdrawals: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const nextIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() || `wdr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const TechnicianEarningsPage = () => {
  const { technician, token } = useTechnicianAuth();
  const { socket } = useSocket();
  const [earningsHistory, setEarningsHistory] = useState<EarningsHistoryPoint[]>([]);
  const [transactions, setTransactions] = useState<WalletActivityRow[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequestRow[]>([]);
  const [stats, setStats] = useState<TechnicianFinancials>({
    today: 0,
    total: 0,
    withdrawable_balance: 0,
    total_paid_out: 0,
    total_earnings: 0,
    on_hold_balance: 0,
    pending_withdrawals: 0,
  });
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalNote, setWithdrawalNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

  const fetchEarnings = useCallback(async () => {
    if (!technician || !token) return;

    try {
      const [earningsRes, statsRes, walletRes, payoutsRes, withdrawalsRes] = await Promise.all([
        apiFetch("/api/technicians/earnings-history", { technician: true }),
        apiFetch("/api/technicians/dashboard-stats", { technician: true }),
        apiFetch("/api/technicians/me/wallet", { technician: true }),
        apiFetch("/api/technicians/me/payout-transactions?limit=20", { technician: true }),
        apiFetch("/api/technicians/me/withdrawals?limit=10", { technician: true }),
      ]);

      if (earningsRes.ok) {
        const earningsData = await earningsRes.json();
        if (Array.isArray(earningsData)) {
          setEarningsHistory(
            earningsData.map((row: any) => ({
              date: String(row?.date || ""),
              amount: Number(row?.amount || 0),
            }))
          );
        }
      }

      if (statsRes.ok) {
        const dashStats = await statsRes.json();
        setStats((prev) => ({
          ...prev,
          today: Number(dashStats?.todayEarnings || 0),
          total: Number(dashStats?.totalEarnings || 0),
        }));
      }

      if (walletRes.ok) {
        const walletData = await walletRes.json();
        setStats((prev) => ({
          ...prev,
          total: Number(walletData?.total_earnings || prev.total || 0),
          total_earnings: Number(walletData?.total_earnings || 0),
          withdrawable_balance: Number(walletData?.withdrawable_balance || 0),
          total_paid_out: Number(walletData?.total_paid_out || 0),
          on_hold_balance: Number(walletData?.on_hold_balance || 0),
          pending_withdrawals: Number(
            walletData?.pending_withdrawals ?? walletData?.on_hold_balance ?? 0
          ),
        }));
        setWithdrawals(Array.isArray(walletData?.recent_withdrawals) ? walletData.recent_withdrawals : []);
        setWithdrawalAmount((current) => {
          if (current.trim()) return current;
          const nextValue = Number(walletData?.withdrawable_balance || 0);
          return nextValue > 0 ? nextValue.toFixed(2) : "";
        });
      }

      if (withdrawalsRes.ok) {
        const withdrawalData = await withdrawalsRes.json();
        setWithdrawals(Array.isArray(withdrawalData?.data) ? withdrawalData.data : []);
      }

      if (payoutsRes.ok) {
        const payoutData = await payoutsRes.json();
        setTransactions(Array.isArray(payoutData) ? payoutData : []);
      }
    } catch (error) {
      console.error("Error fetching earnings:", error);
    } finally {
      setLoading(false);
    }
  }, [technician, token]);

  useEffect(() => {
    if (technician && token) void fetchEarnings();
  }, [technician, token, fetchEarnings]);

  useEffect(() => {
    if (!technician || !token) return;
    const id = setInterval(() => void fetchEarnings(), 20000);
    return () => clearInterval(id);
  }, [technician, token, fetchEarnings]);

  useEffect(() => {
    if (!socket || !technician?.id) return;

    const refreshEarnings = () => {
      void fetchEarnings();
    };

    socket.on("job:status_update", refreshEarnings);
    socket.on("job:list_update", refreshEarnings);
    socket.on("dashboard:stats_update", refreshEarnings);
    socket.on("technician:financials_update", refreshEarnings);
    socket.on("admin:payment_update", refreshEarnings);
    socket.on("admin:payout_update", refreshEarnings);

    return () => {
      socket.off("job:status_update", refreshEarnings);
      socket.off("job:list_update", refreshEarnings);
      socket.off("dashboard:stats_update", refreshEarnings);
      socket.off("technician:financials_update", refreshEarnings);
      socket.off("admin:payment_update", refreshEarnings);
      socket.off("admin:payout_update", refreshEarnings);
    };
  }, [socket, technician?.id, fetchEarnings]);

  const submitWithdrawal = async () => {
    if (submittingWithdrawal) return;

    const amount = Number(withdrawalAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid withdrawal amount.");
      return;
    }

    setSubmittingWithdrawal(true);
    try {
      const res = await apiFetch("/api/technicians/me/withdrawals", {
        method: "POST",
        technician: true,
        body: JSON.stringify({
          amount,
          note: withdrawalNote.trim(),
          idempotencyKey: nextIdempotencyKey(),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || "Failed to submit withdrawal request.");
      }
      toast.success(body?.alreadyCreated ? "Recent withdrawal request already exists." : "Withdrawal request submitted.");
      setWithdrawalNote("");
      setWithdrawalAmount("");
      await fetchEarnings();
    } catch (error) {
      toast.error((error as Error)?.message || "Failed to submit withdrawal request.");
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      <div className="mb-2 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/technician/dashboard"><ArrowLeft className="h-5 w-5" /></Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Wallet & Withdrawals</h1>
      </div>

      {loading ? (
        <Skeleton className="h-[200px] w-full rounded-2xl" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Card className="border-none bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-100">Withdrawable Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(stats.withdrawable_balance)}</div>
                <p className="mt-1 text-xs text-emerald-100">Ready for withdrawal request</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground/80">On Hold</CardTitle>
                <TimerReset className="h-4 w-4 text-amber-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(stats.pending_withdrawals)}</div>
                <p className="mt-1 text-xs text-muted-foreground">Pending or processing withdrawals</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground/80">Today</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(stats.today)}</div>
                <p className="mt-1 text-xs text-muted-foreground">New wallet credits today</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground/80">Total Paid Out</CardTitle>
                <Landmark className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(stats.total_paid_out)}</div>
                <p className="mt-1 text-xs text-muted-foreground">Settled manually by admin</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-muted-foreground/80" />
                Weekly Wallet Credits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TechnicianEarningsChart data={earningsHistory} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Request Withdrawal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,220px),1fr,auto]">
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">Amount</p>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={withdrawalAmount}
                    onChange={(event) => setWithdrawalAmount(event.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <p className="mb-2 text-sm text-muted-foreground">Note for admin</p>
                  <Textarea
                    value={withdrawalNote}
                    onChange={(event) => setWithdrawalNote(event.target.value)}
                    placeholder="Optional note for the payout team"
                    className="min-h-[44px]"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={submitWithdrawal}
                    disabled={submittingWithdrawal || stats.withdrawable_balance <= 0}
                    className="w-full md:w-auto"
                  >
                    {submittingWithdrawal ? "Submitting..." : "Withdraw"}
                  </Button>
                </div>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                Available now: {formatCurrency(stats.withdrawable_balance)}. Pending requests remain on hold until the admin pays or rejects them.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Withdrawal History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {withdrawals.length === 0 ? (
                  <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
                    No withdrawal requests yet.
                  </div>
                ) : (
                  withdrawals.map((request) => (
                    <div key={request.id} className="rounded-xl border p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{request.withdrawalReference}</p>
                            <Badge variant="outline" className="capitalize">
                              {request.status}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {formatCurrency(request.amount)}
                            {request.beneficiaryName ? ` • ${request.beneficiaryName}` : ""}
                            {request.upiId ? ` • ${request.upiId}` : ""}
                          </p>
                          {request.note ? (
                            <p className="mt-2 text-sm text-muted-foreground">{request.note}</p>
                          ) : null}
                          {request.rejectionReason ? (
                            <p className="mt-2 text-sm text-rose-600">{request.rejectionReason}</p>
                          ) : null}
                        </div>
                        <div className="text-sm text-muted-foreground md:text-right">
                          <div>Created {request.createdAt ? new Date(request.createdAt).toLocaleString("en-IN") : "-"}</div>
                          {request.processingStartedAt ? (
                            <div>Processing {new Date(request.processingStartedAt).toLocaleString("en-IN")}</div>
                          ) : null}
                          {request.paidAt ? (
                            <div>Paid {new Date(request.paidAt).toLocaleString("en-IN")}</div>
                          ) : null}
                          {request.payoutReference ? (
                            <div className="font-medium text-foreground">{request.payoutReference}</div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Wallet Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">Total Earned</p>
                <p className="mt-1 text-xl font-semibold">{formatCurrency(stats.total_earnings || stats.total)}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">Current Withdrawable</p>
                <p className="mt-1 text-xl font-semibold">{formatCurrency(stats.withdrawable_balance)}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">On Hold</p>
                <p className="mt-1 text-xl font-semibold">{formatCurrency(stats.pending_withdrawals)}</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Recent Wallet Activity</h3>
              <p className="text-sm text-muted-foreground">
                Credits come from successful platform-collected payments. Debits appear after admin marks a withdrawal as paid.
              </p>
            </div>
            <div className="divide-y rounded-xl border bg-card dark:bg-slate-900">
              {transactions.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground/80">No wallet activity found.</div>
              ) : (
                transactions.slice(0, 10).map((row) => {
                  const created = row?.created_at ? new Date(row.created_at) : null;
                  const validDate = !!created && !Number.isNaN(created.getTime());
                  const dateLabel = validDate
                    ? created.toLocaleString("en-IN", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "Unknown date";
                  const isPayout = row.entry_type === "payout_debit";
                  const label = isPayout
                    ? `Manual payout${row.payout_id ? ` #${row.payout_id}` : ""}`
                    : String(row?.service_type || "Service earning").replace(/-/g, " ");

                  return (
                    <div
                      key={`${row.entry_type}-${row.payment_id || row.payout_id || dateLabel}`}
                      className="flex items-center justify-between gap-4 p-4"
                    >
                      <div>
                        <p className="font-medium text-foreground">{dateLabel}</p>
                        <p className="text-xs capitalize text-muted-foreground/80">{label}</p>
                        {row.balance_after != null ? (
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            Balance after: {formatCurrency(Number(row.balance_after || 0))}
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        <p className={`font-semibold ${isPayout ? "text-rose-600" : "text-emerald-700"}`}>
                          {isPayout ? "-" : "+"}
                          {formatCurrency(Number(row.technician_amount || 0))}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {isPayout ? "Payout settled" : "Wallet credited"}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TechnicianEarningsPage;
