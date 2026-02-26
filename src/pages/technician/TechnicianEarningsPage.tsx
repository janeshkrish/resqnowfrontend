
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, TrendingUp, CreditCard, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { useSocket } from "@/contexts/SocketContext";
import { apiFetch } from "@/lib/api";
import TechnicianEarningsChart from "@/components/technician/TechnicianEarningsChart";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";

interface EarningsHistoryPoint {
    date: string;
    amount: number;
}

interface PayoutTransaction {
    payment_id: string | number;
    service_request_id: string | number;
    payment_method?: string;
    payment_status?: string;
    request_status?: string;
    service_type?: string;
    vehicle_type?: string;
    vehicle_model?: string;
    address?: string;
    technician_amount?: number;
    platform_fee?: number;
    is_settled?: boolean;
    created_at?: string;
}

const TechnicianEarningsPage = () => {
    const { technician, token } = useTechnicianAuth();
    const { socket } = useSocket();
    const [earningsHistory, setEarningsHistory] = useState<EarningsHistoryPoint[]>([]);
    const [transactions, setTransactions] = useState<PayoutTransaction[]>([]);
    const [stats, setStats] = useState<{
        today: number;
        week: number;
        month: number;
        total: number;
        total_earnings?: number;
        pending_dues?: number;
    }>({ today: 0, week: 0, month: 0, total: 0 });
    const [loading, setLoading] = useState(true);
    const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);

    const fetchEarnings = useCallback(async () => {
        if (!technician || !token) return;

        try {
            const [earningsRes, statsRes, financialRes, payoutsRes] = await Promise.all([
                apiFetch(`/api/technicians/earnings-history`, { technician: true }),
                apiFetch(`/api/technicians/dashboard-stats`, { technician: true }),
                apiFetch(`/api/technicians/me/financials`, { technician: true }),
                apiFetch(`/api/technicians/me/payout-transactions?limit=20`, { technician: true })
            ]);

            if (earningsRes.ok) {
                const earningsData = await earningsRes.json();
                if (Array.isArray(earningsData)) {
                    const history = earningsData.map((row: any) => ({
                        date: String(row?.date || ""),
                        amount: Number(row?.amount || 0)
                    }));
                    setEarningsHistory(history);

                    const weekTotal = history.reduce((sum, row) => sum + Number(row.amount || 0), 0);
                    setStats((prev) => ({
                        ...prev,
                        week: weekTotal,
                        month: weekTotal,
                        total: weekTotal
                    }));
                }
            }

            if (statsRes.ok) {
                const dashStats = await statsRes.json();
                setStats((prev) => ({
                    ...prev,
                    total: Number(dashStats?.totalEarnings || 0),
                    today: Number(dashStats?.todayEarnings || 0)
                }));
            }

            if (financialRes.ok) {
                const finData = await financialRes.json();
                setStats((prev) => ({
                    ...prev,
                    pending_dues: Number(finData?.pending_dues || 0),
                    total_earnings: Number(finData?.total_earnings || 0)
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
        if (technician && token) fetchEarnings();
    }, [technician, token, fetchEarnings]);

    useEffect(() => {
        if (!technician || !token) return;
        const id = setInterval(fetchEarnings, 20000);
        return () => clearInterval(id);
    }, [technician, token, fetchEarnings]);

    useEffect(() => {
        if (!socket || !technician?.id) return;

        const refreshEarnings = () => {
            fetchEarnings();
        };

        const handleStatusUpdate = (payload: any) => {
            const status = String(payload?.status || "").toLowerCase();
            if (!status || ["paid", "completed", "cancelled", "payment_pending"].includes(status)) {
                refreshEarnings();
            }
        };

        const handleFinancials = (payload: any) => {
            if (payload && (payload.pending_dues != null || payload.total_earnings != null)) {
                setStats((prev) => ({
                    ...prev,
                    pending_dues: Number(payload.pending_dues ?? prev.pending_dues ?? 0),
                    total_earnings: Number(payload.total_earnings ?? prev.total_earnings ?? 0)
                }));
            }
            refreshEarnings();
        };

        socket.on("job:status_update", handleStatusUpdate);
        socket.on("job:list_update", refreshEarnings);
        socket.on("dashboard:stats_update", refreshEarnings);
        socket.on("technician:financials_update", handleFinancials);

        return () => {
            socket.off("job:status_update", handleStatusUpdate);
            socket.off("job:list_update", refreshEarnings);
            socket.off("dashboard:stats_update", refreshEarnings);
            socket.off("technician:financials_update", handleFinancials);
        };
    }, [socket, technician?.id, fetchEarnings]);

    const handlePayDues = async () => {
        if (!stats.pending_dues || stats.pending_dues <= 0) return;

        setIsPaymentProcessing(true);

        if (!(window as any).Razorpay) {
            console.error("Razorpay SDK not loaded");
            toast.error("Payment gateway not loaded. Please try again.");
            setIsPaymentProcessing(false);
            return;
        }
        if (!import.meta.env.VITE_RAZORPAY_KEY_ID) {
            toast.error("Payment configuration missing. Contact admin.");
            setIsPaymentProcessing(false);
            return;
        }

        try {
            // 1. Create Order using CORRECT existing endpoint (matches /me/financials logic)
            const orderRes = await apiFetch("/api/technicians/me/pay-dues", {
                method: "POST",
                body: JSON.stringify({}),
                technician: true
            });

            const orderData = await orderRes.json();

            // Note: The existing endpoint might return different structure or error fields, robust handling needed.
            // Based on technicians.js: returns res.json(order) directly on success.
            // If failed to create order (e.g. no dues), returns { error: ... } with 400 or 500 status.

            if (!orderRes.ok) {
                if (orderRes.status === 400 && orderData?.error === "No pending dues") {
                    setStats((prev) => ({ ...prev, pending_dues: 0 }));
                    toast.success("All dues are already cleared.");
                    setIsPaymentProcessing(false);
                    return;
                }
                throw new Error(orderData.error || "Failed to create payment order");
            }
            // Check success based on order structure (id should be present)
            if (!orderData.id) {
                throw new Error("Invalid order data received");
            }

            // 2. Razorpay Options
            const options = {
                key: import.meta.env.VITE_RAZORPAY_KEY_ID,
                amount: orderData.amount,
                currency: orderData.currency,
                name: "ResQNow",
                description: "Platform Dues Payment",
                order_id: orderData.id,
                handler: async function (response: any) {
                    try {
                        // Verify using CORRECT existing endpoint
                        const verifyRes = await apiFetch("/api/technicians/me/verify-dues", {
                            method: "POST",
                            cache: "no-store",
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature
                            }),
                            technician: true
                        });

                        const verifyData = await verifyRes.json();

                        if (!verifyRes.ok || !verifyData.success) {
                            throw new Error(verifyData.error || "Payment verification failed");
                        }

                        if (verifyData?.financials) {
                            setStats((prev) => ({
                                ...prev,
                                pending_dues: Number(verifyData.financials.pending_dues ?? prev.pending_dues ?? 0),
                                total_earnings: Number(verifyData.financials.total_earnings ?? prev.total_earnings ?? 0)
                            }));
                        }

                        toast.success("Dues paid successfully!");
                        await fetchEarnings();

                    } catch (err: any) {
                        toast.error(err.message || "Failed to verify payment");
                        console.error("Verification error:", err);
                    } finally {
                        setIsPaymentProcessing(false);
                    }
                },
                prefill: {
                    name: technician?.name,
                    email: technician?.email,
                    contact: technician?.phone || ""
                },
                theme: {
                    color: "#2563EB"
                },
                modal: {
                    ondismiss: () => {
                        setIsPaymentProcessing(false);
                    }
                }
            };

            // @ts-ignore
            const rzp = new window.Razorpay(options);
            rzp.open();

        } catch (error: any) {
            console.error("Payment initialization error:", error);
            toast.error(error.message || "Failed to initiate payment");
            setIsPaymentProcessing(false);
        }
    };

    return (
        <div className="container max-w-4xl mx-auto py-6 space-y-6">
            <div className="flex items-center gap-4 mb-2">
                <Button variant="ghost" size="icon" asChild>
                    <Link to="/technician/dashboard"><ArrowLeft className="w-5 h-5" /></Link>
                </Button>
                <h1 className="text-2xl font-bold text-foreground">Earnings & Payouts</h1>
            </div>

            {loading ? (
                <Skeleton className="h-[200px] w-full rounded-2xl" />
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white border-none shadow-lg">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-green-100 text-sm font-medium">Total Balance</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-bold">₹{stats.total_earnings || stats.total}</div>
                                <p className="text-green-100 text-xs mt-1">Lifetime Earnings</p>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                <CardTitle className="text-muted-foreground/80 text-sm font-medium">Today</CardTitle>
                                <TrendingUp className="w-4 h-4 text-green-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-foreground">₹{stats.today}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                                <CardTitle className="text-muted-foreground/80 text-sm font-medium">Platform Dues</CardTitle>
                                <CreditCard className="w-4 h-4 text-red-500" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">₹{stats.pending_dues || 0}</div>
                                {(stats.pending_dues || 0) > 0 && (
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        className="mt-2 w-full h-7 text-xs"
                                        onClick={handlePayDues}
                                        disabled={isPaymentProcessing}
                                    >
                                        {isPaymentProcessing ? (
                                            <>
                                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                                Processing...
                                            </>
                                        ) : "Pay Now"}
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-muted-foreground/80" />
                                Weekly Overview
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <TechnicianEarningsChart data={earningsHistory} />
                        </CardContent>
                    </Card>

                    <div className="space-y-4">
                        <h3 className="font-semibold text-lg text-foreground">Recent Transactions</h3>
                        <div className="bg-card dark:bg-slate-900 rounded-xl border divide-y">
                            {transactions.length === 0 ? (
                                <div className="p-4 text-center text-muted-foreground/80 text-sm">No transactions found.</div>
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
                                            minute: "2-digit"
                                        })
                                        : "Unknown date";
                                    const serviceLabel = String(row?.service_type || "Service payout").replace(/-/g, " ");

                                    return (
                                    <div key={String(row.payment_id)} className="p-4 flex items-center justify-between">
                                        <div>
                                            <p className="font-medium text-foreground">{dateLabel}</p>
                                            <p className="text-xs text-muted-foreground/80 capitalize">{serviceLabel}</p>
                                        </div>
                                        <p className="font-semibold text-green-700">Rs {Number(row.technician_amount || 0).toFixed(2)}</p>
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
