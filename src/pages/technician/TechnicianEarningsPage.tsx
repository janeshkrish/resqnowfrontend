import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Wallet, TrendingUp, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { apiFetch } from "@/lib/api";
import TechnicianEarningsChart from "@/components/technician/TechnicianEarningsChart";
import { Skeleton } from "@/components/ui/skeleton";

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

type TechnicianFinancials = {
  today: number;
  total: number;
  withdrawable_balance: number;
  total_paid_out: number;
  total_earnings: number;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const TechnicianEarningsPage = () => {
  const { technician, token } = useTechnicianAuth();
  const { socket } = useSocket();
  const [earningsHistory, setEarningsHistory] = useState<EarningsHistoryPoint[]>([]);
  const [transactions, setTransactions] = useState<WalletActivityRow[]>([]);
  const [stats, setStats] = useState<TechnicianFinancials>({
    today: 0,
    total: 0,
    withdrawable_balance: 0,
    total_paid_out: 0,
    total_earnings: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchEarnings = useCallback(async () => {
    if (!technician || !token) return;

    try {
      const [earningsRes, statsRes, financialRes, payoutsRes] = await Promise.all([
        apiFetch(`/api/technicians/earnings-history`, { technician: true }),
        apiFetch(`/api/technicians/dashboard-stats`, { technician: true }),
        apiFetch(`/api/technicians/me/financials`, { technician: true }),
        apiFetch(`/api/technicians/me/payout-transactions?limit=20`, { technician: true }),
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

      if (financialRes.ok) {
        const finData = await financialRes.json();
        setStats((prev) => ({
          ...prev,
          total: Number(finData?.total_earnings || prev.total || 0),
          total_earnings: Number(finData?.total_earnings || 0),
          withdrawable_balance: Number(finData?.withdrawable_balance || 0),
          total_paid_out: Number(finData?.total_paid_out || 0),
        }));
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

    return () => {
      socket.off("job:status_update", refreshEarnings);
      socket.off("job:list_update", refreshEarnings);
      socket.off("dashboard:stats_update", refreshEarnings);
      socket.off("technician:financials_update", refreshEarnings);
      socket.off("admin:payment_update", refreshEarnings);
    };
  }, [socket, technician?.id, fetchEarnings]);

  return (
    <div className="container max-w-4xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/technician/dashboard"><ArrowLeft className="w-5 h-5" /></Link>
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Wallet & Payouts</h1>
      </div>

      {loading ? (
        <Skeleton className="h-[200px] w-full rounded-2xl" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-none shadow-lg">
              <CardHeader className="pb-2">
                <CardTitle className="text-emerald-100 text-sm font-medium">Withdrawable Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{formatCurrency(stats.withdrawable_balance)}</div>
                <p className="text-emerald-100 text-xs mt-1">Ready for manual payout</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-muted-foreground/80 text-sm font-medium">Today</CardTitle>
                <TrendingUp className="w-4 h-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(stats.today)}</div>
                <p className="text-xs text-muted-foreground mt-1">New wallet credits today</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-muted-foreground/80 text-sm font-medium">Total Paid Out</CardTitle>
                <Landmark className="w-4 h-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{formatCurrency(stats.total_paid_out)}</div>
                <p className="text-xs text-muted-foreground mt-1">Settled by admin</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-muted-foreground/80" />
                Weekly Wallet Credits
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TechnicianEarningsChart data={earningsHistory} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Wallet Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">Total Earned</p>
                <p className="mt-1 text-xl font-semibold">{formatCurrency(stats.total_earnings || stats.total)}</p>
              </div>
              <div className="rounded-xl border bg-muted/20 p-4">
                <p className="text-sm text-muted-foreground">Current Wallet Balance</p>
                <p className="mt-1 text-xl font-semibold">{formatCurrency(stats.withdrawable_balance)}</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg text-foreground">Recent Wallet Activity</h3>
              <p className="text-sm text-muted-foreground">Credits come from successful platform-collected payments. Debits appear when admin marks payouts as paid.</p>
            </div>
            <div className="bg-card dark:bg-slate-900 rounded-xl border divide-y">
              {transactions.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground/80 text-sm">No wallet activity found.</div>
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
                    <div key={`${row.entry_type}-${row.payment_id || row.payout_id || dateLabel}`} className="p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-foreground">{dateLabel}</p>
                        <p className="text-xs text-muted-foreground/80 capitalize">{label}</p>
                        {row.balance_after != null ? (
                          <p className="text-[11px] text-muted-foreground mt-1">Balance after: {formatCurrency(Number(row.balance_after || 0))}</p>
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
