import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { TechPage, TechSheet } from "@/components/technician/app/TechUi";
import { useSocket } from "@/contexts/SocketContext";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { apiFetch } from "@/lib/api";
import { serviceArt } from "@/lib/services";
import { techDate, techDayLabel, techRupees, techServiceName, techTime, techWeekday, useTechText } from "@/lib/technicianLanguage";
import type { TechTextKey } from "@/lib/technicianText";
import { cn } from "@/lib/utils";

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

// How a withdrawal request shows at each stage.
const REQUEST_LOOK: Record<string, { icon: string; tone: string; state: string }> = {
  pending: { icon: "hourglass_top", tone: "is-amber", state: "is-wait" },
  processing: { icon: "hourglass_top", tone: "is-amber", state: "is-wait" },
  paid: { icon: "check", tone: "is-green", state: "is-ok" },
  rejected: { icon: "close", tone: "is-red", state: "is-void" },
};
const NOT_GIVEN = ["rejected", "failed", "disputed"];

const nextIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() || `wdr_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const TechnicianEarningsPage = () => {
  const { technician, token } = useTechnicianAuth();
  const { socket } = useSocket();
  const { lang, t } = useTechText();
  const [takeOpen, setTakeOpen] = useState(false);
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
      setTakeOpen(false);
    } catch (error) {
      toast.error((error as Error)?.message || "Failed to submit withdrawal request.");
    } finally {
      setSubmittingWithdrawal(false);
    }
  };

  const upiId = String(technician?.upi_id || "").trim();
  const withdrawable = Number(stats.withdrawable_balance || 0);
  const notGiven = withdrawals.reduce(
    (total, request) => (NOT_GIVEN.includes(String(request.status || "").toLowerCase()) ? total + Number(request.amount || 0) : total),
    0
  );
  const weekTotal = earningsHistory.reduce((total, point) => total + Number(point.amount || 0), 0);
  const tallest = Math.max(1, ...earningsHistory.map((point) => Number(point.amount || 0)));
  // The history runs oldest to newest and ends today.
  const dayOf = (index: number) => {
    const day = new Date();
    day.setDate(day.getDate() - (earningsHistory.length - 1 - index));
    return day;
  };
  const quickAmounts = [500, 1000].filter((value) => value < withdrawable);
  const when = (value: unknown) => [techDayLabel(lang, value), techTime(lang, value)].filter(Boolean).join(", ");

  return (
    <TechPage tab="money" testId="technician-money">
      <h1 className="tp-h1 tp-pj">{t("money.title")}</h1>

      {loading ? (
        <p className="tp-empty" role="status">{t("common.loading")}</p>
      ) : (
        <>
          <section className="tp-hero">
            <small>{t("money.ready")}</small>
            <b className="tp-pj" data-testid="money-ready">{techRupees(withdrawable)}</b>
            <button type="button" className="tp-big tp-press" disabled={withdrawable <= 0} onClick={() => setTakeOpen(true)}>
              <MaterialSymbol name="arrow_outward" />
              {t("money.takeOut")}
            </button>
          </section>

          <h2 className="tp-h2 tp-pj">{t("money.where")}</h2>
          <div className="tp-list" data-testid="money-where">
            <div className="tp-row">
              <span className="tp-ic is-amber" aria-hidden="true"><MaterialSymbol name="hourglass_top" /></span>
              <span className="tp-text"><b>{t("money.waiting")}</b><span>{t("money.waitingSub")}</span></span>
              <span className="tp-end"><b>{techRupees(stats.pending_withdrawals)}</b></span>
            </div>
            <div className="tp-row">
              <span className="tp-ic is-green" aria-hidden="true"><MaterialSymbol name="check" /></span>
              <span className="tp-text"><b>{t("money.paid")}</b><span>{t("money.paidSub")}</span></span>
              <span className="tp-end"><b>{techRupees(stats.total_paid_out)}</b></span>
            </div>
            <div className="tp-row">
              <span className="tp-ic" aria-hidden="true"><MaterialSymbol name="error" /></span>
              <span className="tp-text"><b>{t("money.held")}</b><span className="is-wrap">{t("money.heldSub")}</span></span>
              <span className="tp-end"><b>{techRupees(notGiven)}</b></span>
            </div>
          </div>

          <h2 className="tp-h2 tp-pj">{t("money.earned")}</h2>
          <div className="tp-list tp-amounts" data-testid="money-earned">
            {earningsHistory.length > 0 ? (
              <div className="tp-bars" role="img" aria-label={t("money.weekAria", { n: earningsHistory.length })}>
                {earningsHistory.map((point, index) => (
                  <div key={`${point.date}-${index}`} className={cn("tp-bar", index === earningsHistory.length - 1 && "is-today")}>
                    <small>{techRupees(Math.round(Number(point.amount || 0)))}</small>
                    <i style={{ height: `${Math.max(6, Math.round((Number(point.amount || 0) / tallest) * 78))}px` }} />
                    <em>{techWeekday(lang, dayOf(index))}</em>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="tp-row"><span className="is-label">{t("money.today")}</span><b>{techRupees(stats.today)}</b></div>
            {earningsHistory.length > 0 ? (
              <div className="tp-row"><span className="is-label">{t("money.week", { n: earningsHistory.length })}</span><b>{techRupees(weekTotal)}</b></div>
            ) : null}
            <div className="tp-row"><span className="is-label">{t("money.all")}</span><b>{techRupees(stats.total_earnings || stats.total)}</b></div>
          </div>

          <h2 className="tp-h2 tp-pj">{t("money.asked")}</h2>
          <div className="tp-list" data-testid="money-asked">
            {withdrawals.length === 0 ? (
              <p className="tp-empty">{t("money.askedNone")}</p>
            ) : (
              withdrawals.map((request) => {
                const status = String(request.status || "").toLowerCase();
                const look = REQUEST_LOOK[status] ?? REQUEST_LOOK.pending;
                const known = status in REQUEST_LOOK;
                const target = [request.beneficiaryName, request.upiId].filter(Boolean).join(" · ");
                const dateLine = request.paidAt
                  ? t("money.paidOn", { date: techDate(lang, request.paidAt) })
                  : request.createdAt
                    ? t("money.askedOn", { date: techDate(lang, request.createdAt) })
                    : "";
                return (
                  <div key={request.id} className="tp-row is-tall" data-status={status}>
                    <span className={cn("tp-ic", look.tone)} aria-hidden="true"><MaterialSymbol name={look.icon} /></span>
                    <span className="tp-text">
                      <b>{techRupees(request.amount)}</b>
                      <span className="is-wrap">{[dateLine, target ? t("money.to", { upi: target }) : ""].filter(Boolean).join(" · ")}</span>
                      <span className="is-wrap">{[t("money.ref", { ref: request.withdrawalReference }), request.payoutReference].filter(Boolean).join(" · ")}</span>
                      {request.note ? <span className="is-wrap">{request.note}</span> : null}
                      {request.rejectionReason ? <span className="is-bad">{t("money.notGiven", { reason: request.rejectionReason })}</span> : null}
                    </span>
                    <span className={cn("tp-state", look.state)}>
                      {status === "paid" ? <MaterialSymbol name="check_circle" /> : null}
                      {known ? t(`money.status.${status}` as TechTextKey) : request.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <h2 className="tp-h2 tp-pj">{t("money.inOut")}</h2>
          <div className="tp-list" data-testid="money-activity">
            {transactions.length === 0 ? (
              <p className="tp-empty">{t("money.inOutNone")}</p>
            ) : (
              transactions.slice(0, 10).map((row, index) => {
                const isPayout = row.entry_type === "payout_debit";
                const art = isPayout ? null : serviceArt(row.service_type);
                return (
                  <div key={`${row.entry_type}-${row.payment_id || row.payout_id || index}`} className="tp-row">
                    {isPayout ? (
                      <span className="tp-ic" aria-hidden="true"><MaterialSymbol name="arrow_outward" /></span>
                    ) : (
                      <span className="tp-thumb" aria-hidden="true">
                        {art ? <img src={art} alt="" draggable={false} /> : <MaterialSymbol name="payments" />}
                      </span>
                    )}
                    <span className="tp-text">
                      <b>{isPayout ? t("money.paidOut") : row.service_type ? techServiceName(lang, row.service_type) : t("money.jobMoney")}</b>
                      <span>{when(row.created_at)}</span>
                    </span>
                    <span className={cn("tp-end", isPayout ? "is-out" : "is-in")}>
                      <b>{isPayout ? "−" : "+"}{techRupees(row.technician_amount)}</b>
                      {row.balance_after != null ? <small>{t("money.balance", { amount: techRupees(row.balance_after) })}</small> : null}
                    </span>
                  </div>
                );
              })
            )}
          </div>
          <p className="tp-fine">{t("money.fine")}</p>
        </>
      )}

      <TechSheet
        open={takeOpen}
        onClose={() => setTakeOpen(false)}
        title={t("take.title")}
        sub={t("take.sub", { amount: techRupees(withdrawable) })}
      >
        <label className="tp-amount">
          <span aria-hidden="true">₹</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={withdrawalAmount}
            onChange={(event) => setWithdrawalAmount(event.target.value)}
            placeholder="0"
            aria-label={t("take.amount")}
          />
        </label>
        <div className="tp-quick">
          {quickAmounts.map((value) => (
            <button
              key={value}
              type="button"
              className={cn("tp-press", Number(withdrawalAmount) === value && "is-on")}
              onClick={() => setWithdrawalAmount(String(value))}
            >
              {techRupees(value)}
            </button>
          ))}
          <button
            type="button"
            className={cn("tp-press", withdrawable > 0 && Number(withdrawalAmount) === withdrawable && "is-on")}
            onClick={() => setWithdrawalAmount(withdrawable > 0 ? withdrawable.toFixed(2) : "")}
          >
            {t("take.all")}
          </button>
        </div>
        <label className="tp-field" style={{ marginTop: 10 }}>
          <small>{t("take.note")}</small>
          <span className="tp-input">
            <textarea
              rows={1}
              value={withdrawalNote}
              onChange={(event) => setWithdrawalNote(event.target.value)}
              placeholder={t("take.notePlaceholder")}
            />
          </span>
        </label>
        {upiId ? (
          <p className="tp-to">
            <MaterialSymbol name="account_balance" />
            <span>{t("take.goesTo", { upi: upiId })}</span>
          </p>
        ) : null}
        <button type="button" className="tp-big tp-press" disabled={submittingWithdrawal || withdrawable <= 0} onClick={submitWithdrawal}>
          {submittingWithdrawal ? t("take.sending") : t("take.submit", { amount: techRupees(withdrawalAmount) })}
        </button>
        <p className="tp-fine" style={{ margin: "12px 0 0" }}>{t("take.fine")}</p>
      </TechSheet>
    </TechPage>
  );
};

export default TechnicianEarningsPage;
