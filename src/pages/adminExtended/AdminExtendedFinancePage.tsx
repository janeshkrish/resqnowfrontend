import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertOctagon,
  Download,
  FileSearch,
  HandCoins,
  Landmark,
  ReceiptIndianRupee,
  Wallet,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import DataTable from "./components/DataTable";
import MetricCard from "./components/MetricCard";
import Modal from "./components/Modal";
import { getAdminToken, getRequiredApiBaseUrl } from "@/lib/api";
import {
  exportFinanceCsv,
  exportPayoutQueueCsv,
  FinanceTransactionRow,
  getFinanceAuditLogs,
  getFinanceSummary,
  getFinanceTransactions,
  getFlaggedPayments,
  getPayoutHistory,
  getTechnicianWalletBalances,
  markTechnicianPaymentCompleted,
  PayoutHistoryRow,
  TechnicianWalletBalanceRow,
  triggerWalletPayout,
} from "./api/adminExtendedApi";

const PAGE_LIMIT = 10;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : "-");

const buildIdempotencyKey = (prefix: string) => {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}:${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
};

export default function AdminExtendedFinancePage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [transactionPage, setTransactionPage] = useState(1);
  const [walletPage, setWalletPage] = useState(1);
  const [payoutPage, setPayoutPage] = useState(1);
  const [onlyPositiveBalance, setOnlyPositiveBalance] = useState(false);
  const [openModal, setOpenModal] = useState<"flagged" | "audit" | "walletPayout" | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportingPayoutQueue, setExportingPayoutQueue] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<TechnicianWalletBalanceRow | null>(null);
  const [payoutNotes, setPayoutNotes] = useState("");
  const [payoutReference, setPayoutReference] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setTransactionPage(1);
      setWalletPage(1);
      setPayoutPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const refreshFinance = () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "finance"] });
    };

    const socketBaseUrl = getRequiredApiBaseUrl();
    const socket: Socket = io(socketBaseUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token: getAdminToken() || undefined },
    });

    socket.on("admin:payment_update", refreshFinance);
    socket.on("admin:payout_update", refreshFinance);
    socket.on("admin:request_status_updated", refreshFinance);

    const fallbackRefreshId = window.setInterval(refreshFinance, 60000);

    return () => {
      window.clearInterval(fallbackRefreshId);
      socket.off("admin:payment_update", refreshFinance);
      socket.off("admin:payout_update", refreshFinance);
      socket.off("admin:request_status_updated", refreshFinance);
      socket.disconnect();
    };
  }, [queryClient]);

  const summaryQuery = useQuery({
    queryKey: ["admin", "finance", "summary"],
    queryFn: getFinanceSummary,
  });

  const transactionsQuery = useQuery({
    queryKey: ["admin", "finance", "transactions", transactionPage, PAGE_LIMIT, search, statusFilter],
    queryFn: () =>
      getFinanceTransactions({
        page: transactionPage,
        limit: PAGE_LIMIT,
        search,
        status: statusFilter,
      }),
  });

  const walletsQuery = useQuery({
    queryKey: ["admin", "finance", "wallets", walletPage, PAGE_LIMIT, search, onlyPositiveBalance],
    queryFn: () =>
      getTechnicianWalletBalances({
        page: walletPage,
        limit: PAGE_LIMIT,
        search,
        onlyPositiveBalance,
      }),
  });

  const walletsReadyCountQuery = useQuery({
    queryKey: ["admin", "finance", "wallets-ready-count"],
    queryFn: () =>
      getTechnicianWalletBalances({
        page: 1,
        limit: 1,
        search: "",
        onlyPositiveBalance: true,
      }),
  });

  const payoutHistoryQuery = useQuery({
    queryKey: ["admin", "finance", "payouts", payoutPage, PAGE_LIMIT, search],
    queryFn: () =>
      getPayoutHistory({
        page: payoutPage,
        limit: PAGE_LIMIT,
        search,
      }),
  });

  const flaggedQuery = useQuery({
    queryKey: ["admin", "finance", "flagged"],
    queryFn: () => getFlaggedPayments(100),
    enabled: openModal === "flagged",
  });

  const auditQuery = useQuery({
    queryKey: ["admin", "finance", "audit"],
    queryFn: () => getFinanceAuditLogs(100),
    enabled: openModal === "audit",
  });

  const payTechnicianMutation = useMutation({
    mutationFn: markTechnicianPaymentCompleted,
    onSuccess: (result) => {
      toast.success(
        result.alreadyCompleted
          ? "This payment was already settled."
          : "Payment-specific payout marked as completed."
      );
      void queryClient.invalidateQueries({ queryKey: ["admin", "finance"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const walletPayoutMutation = useMutation({
    mutationFn: triggerWalletPayout,
    onSuccess: (result) => {
      toast.success(
        result.alreadyProcessed
          ? "This payout request was already processed."
          : "Technician payout marked as paid."
      );
      setOpenModal(null);
      setSelectedWallet(null);
      setPayoutNotes("");
      setPayoutReference("");
      void queryClient.invalidateQueries({ queryKey: ["admin", "finance"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const onExportCsv = async () => {
    try {
      setExporting(true);
      const blob = await exportFinanceCsv(30);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `resqnow_finance_${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("CSV export generated.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const onExportPayoutQueue = async () => {
    try {
      setExportingPayoutQueue(true);
      const blob = await exportPayoutQueueCsv(500);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `resqnow_payout_queue_${new Date().toISOString().slice(0, 10)}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success("Payout queue CSV generated.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setExportingPayoutQueue(false);
    }
  };

  const openWalletPayoutModal = (row: TechnicianWalletBalanceRow) => {
    setSelectedWallet(row);
    setPayoutNotes(`Manual payout for technician #${row.technicianId}`);
    setPayoutReference("");
    setOpenModal("walletPayout");
  };

  const confirmWalletPayout = () => {
    if (!selectedWallet) return;
    walletPayoutMutation.mutate({
      technicianId: selectedWallet.technicianId,
      payoutMethod: "manual_upi",
      notes: payoutNotes.trim(),
      externalReference: payoutReference.trim(),
      idempotencyKey: buildIdempotencyKey(`wallet-payout-${selectedWallet.technicianId}`),
    });
  };

  const activePaymentTransactionId = payTechnicianMutation.isPending
    ? Number(payTechnicianMutation.variables || 0)
    : null;

  const transactionColumns = useMemo(
    () => [
      {
        key: "transactionId",
        header: "Transaction ID",
        render: (row: FinanceTransactionRow) => <span className="font-semibold text-slate-900">#{row.transactionId}</span>,
      },
      {
        key: "requestId",
        header: "Request ID",
        render: (row: FinanceTransactionRow) => {
          const requestId = Number(row.requestId);
          return Number.isInteger(requestId) && requestId > 0 ? (
            <span className="font-semibold text-slate-900">#{requestId}</span>
          ) : (
            "-"
          );
        },
      },
      {
        key: "user",
        header: "User",
        render: (row: FinanceTransactionRow) => row.user,
      },
      {
        key: "technician",
        header: "Technician",
        render: (row: FinanceTransactionRow) => row.technician || "Unassigned",
      },
      {
        key: "amount",
        header: "Total",
        render: (row: FinanceTransactionRow) => <span className="font-medium">{formatCurrency(row.amount)}</span>,
      },
      {
        key: "technicianAmount",
        header: "Tech Credit",
        render: (row: FinanceTransactionRow) => <span className="font-medium">{formatCurrency(row.technicianAmount)}</span>,
      },
      {
        key: "paymentFee",
        header: "Payment Fee",
        render: (row: FinanceTransactionRow) => <span className="font-medium">{formatCurrency(row.paymentFee || 0)}</span>,
      },
      {
        key: "paymentToTechnicianStatus",
        header: "Settlement",
        render: (row: FinanceTransactionRow) => {
          const payoutStatus = String(row.paymentToTechnicianStatus || "pending").toLowerCase();
          if (payoutStatus === "completed") {
            return (
              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                Completed
              </span>
            );
          }
          if (payoutStatus === "processing") {
            return (
              <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
                Partially Allocated
              </span>
            );
          }
          if (payoutStatus === "not_applicable") {
            return (
              <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                Not Applicable
              </span>
            );
          }
          const isMarking = activePaymentTransactionId === Number(row.transactionId);
          return (
            <button
              type="button"
              onClick={() => payTechnicianMutation.mutate(Number(row.transactionId))}
              disabled={isMarking}
              className="inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isMarking ? "Settling..." : "Settle This Payment"}
            </button>
          );
        },
      },
      {
        key: "status",
        header: "Status",
        render: (row: FinanceTransactionRow) => {
          const status = String(row.status || "").toLowerCase();
          const className =
            status === "completed"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : status === "pending" || status === "processing"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : status === "cancelled"
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-slate-200 bg-slate-50 text-slate-700";
          return (
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
              {row.status}
            </span>
          );
        },
      },
      {
        key: "date",
        header: "Date",
        render: (row: FinanceTransactionRow) => formatDate(row.date),
      },
    ],
    [activePaymentTransactionId, payTechnicianMutation]
  );

  const walletColumns = useMemo(
    () => [
      {
        key: "technicianName",
        header: "Technician",
        render: (row: TechnicianWalletBalanceRow) => (
          <div>
            <p className="font-semibold text-slate-900">{row.technicianName}</p>
            <p className="text-xs text-slate-500">#{row.technicianId} | {row.technicianEmail || "No email"}</p>
          </div>
        ),
      },
      {
        key: "upiId",
        header: "UPI",
        render: (row: TechnicianWalletBalanceRow) => row.upiId || "-",
      },
      {
        key: "withdrawableBalance",
        header: "Withdrawable",
        render: (row: TechnicianWalletBalanceRow) => (
          <span className="font-semibold text-emerald-700">{formatCurrency(row.withdrawableBalance)}</span>
        ),
      },
      {
        key: "totalEarned",
        header: "Total Earned",
        render: (row: TechnicianWalletBalanceRow) => formatCurrency(row.totalEarned),
      },
      {
        key: "totalPaidOut",
        header: "Paid Out",
        render: (row: TechnicianWalletBalanceRow) => formatCurrency(row.totalPaidOut),
      },
      {
        key: "lastTransactionAt",
        header: "Last Activity",
        render: (row: TechnicianWalletBalanceRow) => formatDate(row.lastTransactionAt || row.walletUpdatedAt || null),
      },
      {
        key: "actions",
        header: "Action",
        render: (row: TechnicianWalletBalanceRow) => {
          const isActive =
            walletPayoutMutation.isPending &&
            Number(walletPayoutMutation.variables?.technicianId || 0) === Number(row.technicianId);

          if (Number(row.withdrawableBalance || 0) <= 0) {
            return <span className="text-xs text-slate-400">No payout due</span>;
          }

          return (
            <button
              type="button"
              onClick={() => openWalletPayoutModal(row)}
              disabled={isActive}
              className="inline-flex items-center rounded-md border border-slate-200 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isActive ? "Processing..." : "Mark as Paid"}
            </button>
          );
        },
      },
    ],
    [walletPayoutMutation]
  );

  const payoutHistoryColumns = useMemo(
    () => [
      {
        key: "payoutReference",
        header: "Payout Ref",
        render: (row: PayoutHistoryRow) => (
          <div>
            <p className="font-semibold text-slate-900">{row.payoutReference}</p>
            <p className="text-xs text-slate-500">#{row.id}</p>
          </div>
        ),
      },
      {
        key: "technicianName",
        header: "Technician",
        render: (row: PayoutHistoryRow) => (
          <div>
            <p className="font-medium text-slate-900">{row.technicianName}</p>
            <p className="text-xs text-slate-500">{row.upiId || "No UPI on file"}</p>
          </div>
        ),
      },
      {
        key: "amount",
        header: "Amount",
        render: (row: PayoutHistoryRow) => <span className="font-semibold">{formatCurrency(row.amount)}</span>,
      },
      {
        key: "payoutMethod",
        header: "Method",
        render: (row: PayoutHistoryRow) => row.payoutMethod || "manual_upi",
      },
      {
        key: "externalReference",
        header: "External Ref",
        render: (row: PayoutHistoryRow) => row.externalReference || "-",
      },
      {
        key: "status",
        header: "Status",
        render: (row: PayoutHistoryRow) => (
          <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            {row.status}
          </span>
        ),
      },
      {
        key: "processedAt",
        header: "Processed",
        render: (row: PayoutHistoryRow) => formatDate(row.processedAt || row.createdAt),
      },
    ],
    []
  );

  const summary = summaryQuery.data;

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Financial Monitoring</h1>
        <p className="text-sm text-slate-500">
          Review payment collections, technician wallet balances, and manual payout history from one place.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Today Revenue"
          value={summary ? formatCurrency(summary.todayRevenue) : "--"}
          icon={<ReceiptIndianRupee className="h-4 w-4" />}
          accent="emerald"
        />
        <MetricCard
          title="Pending Payments"
          value={summary ? summary.pendingPayments.toLocaleString() : "--"}
          icon={<AlertOctagon className="h-4 w-4" />}
          accent="amber"
        />
        <MetricCard
          title="Completed Transactions"
          value={summary ? summary.completedTransactions.toLocaleString() : "--"}
          icon={<Landmark className="h-4 w-4" />}
          accent="blue"
        />
        <MetricCard
          title="Wallets Ready"
          value={walletsReadyCountQuery.data ? walletsReadyCountQuery.data.pagination.total.toLocaleString() : "--"}
          icon={<Wallet className="h-4 w-4" />}
          accent="slate"
        />
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <button
          type="button"
          onClick={onExportCsv}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          <Download className="h-4 w-4" /> {exporting ? "Exporting..." : "Export Finance CSV"}
        </button>
        <button
          type="button"
          onClick={onExportPayoutQueue}
          disabled={exportingPayoutQueue}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          <Download className="h-4 w-4" /> {exportingPayoutQueue ? "Preparing..." : "Export Batch Payout CSV"}
        </button>
        <button
          type="button"
          onClick={() => setOpenModal("flagged")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          <AlertOctagon className="h-4 w-4" /> View Flagged Payments
        </button>
        <button
          type="button"
          onClick={() => setOpenModal("audit")}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          <FileSearch className="h-4 w-4" /> Audit Logs
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1.6fr_1fr_1fr]">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by technician, email, UPI, payout ref, or transaction ID"
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setTransactionPage(1);
          }}
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
        >
          <option value="all">All Transactions</option>
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="failed">Failed</option>
          <option value="payment_pending">Payout Pending</option>
          <option value="payment_completed">Payout Completed</option>
        </select>
        <select
          value={onlyPositiveBalance ? "positive" : "all"}
          onChange={(event) => {
            setOnlyPositiveBalance(event.target.value === "positive");
            setWalletPage(1);
          }}
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
        >
          <option value="all">All Technicians</option>
          <option value="positive">Only Positive Balances</option>
        </select>
      </div>

      {transactionsQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(transactionsQuery.error as Error).message}
        </div>
      ) : null}
      {walletsQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(walletsQuery.error as Error).message}
        </div>
      ) : null}
      {payoutHistoryQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(payoutHistoryQuery.error as Error).message}
        </div>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-slate-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Technician Wallet Balances</h2>
            <p className="text-sm text-slate-500">Mark full withdrawable balances as paid after manual UPI or bank settlement.</p>
          </div>
        </div>
        <DataTable
          columns={walletColumns}
          data={walletsQuery.data?.data || []}
          rowKey="technicianId"
          loading={walletsQuery.isLoading}
          emptyMessage="No technician wallets found for the current filters."
          pagination={
            walletsQuery.data?.pagination
              ? {
                  page: walletsQuery.data.pagination.page,
                  totalPages: walletsQuery.data.pagination.totalPages,
                  total: walletsQuery.data.pagination.total,
                }
              : undefined
          }
          onPageChange={setWalletPage}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <HandCoins className="h-4 w-4 text-slate-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Payout History</h2>
            <p className="text-sm text-slate-500">Recent manual payouts recorded against technician wallets.</p>
          </div>
        </div>
        <DataTable
          columns={payoutHistoryColumns}
          data={payoutHistoryQuery.data?.data || []}
          rowKey="id"
          loading={payoutHistoryQuery.isLoading}
          emptyMessage="No payouts recorded yet."
          pagination={
            payoutHistoryQuery.data?.pagination
              ? {
                  page: payoutHistoryQuery.data.pagination.page,
                  totalPages: payoutHistoryQuery.data.pagination.totalPages,
                  total: payoutHistoryQuery.data.pagination.total,
                }
              : undefined
          }
          onPageChange={setPayoutPage}
        />
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Payment Transactions</h2>
          <p className="text-sm text-slate-500">Per-payment settlement status, useful when reconciling one payment at a time.</p>
        </div>
        <DataTable
          columns={transactionColumns}
          data={transactionsQuery.data?.data || []}
          rowKey="transactionId"
          loading={transactionsQuery.isLoading}
          emptyMessage="No transactions found for selected filters."
          pagination={
            transactionsQuery.data?.pagination
              ? {
                  page: transactionsQuery.data.pagination.page,
                  totalPages: transactionsQuery.data.pagination.totalPages,
                  total: transactionsQuery.data.pagination.total,
                }
              : undefined
          }
          onPageChange={setTransactionPage}
        />
      </div>

      <Modal
        open={openModal === "walletPayout"}
        onClose={() => {
          setOpenModal(null);
          setSelectedWallet(null);
        }}
        title="Mark Technician as Paid"
        description="This records a manual payout, debits the wallet ledger, and stores the payout history entry."
        onConfirm={confirmWalletPayout}
        confirmText="Mark as Paid"
        loading={walletPayoutMutation.isPending}
        confirmDisabled={!selectedWallet || Number(selectedWallet.withdrawableBalance || 0) <= 0}
      >
        {selectedWallet ? (
          <>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">{selectedWallet.technicianName}</p>
              <p className="mt-1">Withdrawable balance: {formatCurrency(selectedWallet.withdrawableBalance)}</p>
              <p className="mt-1">UPI: {selectedWallet.upiId || "Not available"}</p>
            </div>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Reference Number</span>
              <input
                value={payoutReference}
                onChange={(event) => setPayoutReference(event.target.value)}
                placeholder="Bank ref / UTR / manual note"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-sm font-medium text-slate-700">Notes</span>
              <textarea
                value={payoutNotes}
                onChange={(event) => setPayoutNotes(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Optional payout note"
              />
            </label>
          </>
        ) : null}
      </Modal>

      <Modal
        open={openModal === "flagged"}
        onClose={() => setOpenModal(null)}
        title="Flagged Payments"
        description="Payments that need manual review"
      >
        {flaggedQuery.isLoading ? <p className="text-sm text-slate-500">Loading flagged payments...</p> : null}
        {flaggedQuery.isError ? (
          <p className="text-sm text-red-600">{(flaggedQuery.error as Error).message}</p>
        ) : null}
        <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
          {(flaggedQuery.data?.data || []).map((item) => (
            <div key={`flag-${item.transactionId}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">
                #{item.transactionId} / {formatCurrency(item.amount)}
              </p>
              <p className="text-slate-600">
                {item.user} / {item.technician}
              </p>
              <p className="text-xs font-medium uppercase tracking-wide text-rose-600">{item.flagReason}</p>
            </div>
          ))}
          {!flaggedQuery.isLoading && (flaggedQuery.data?.data || []).length === 0 ? (
            <p className="text-sm text-slate-500">No flagged payments currently.</p>
          ) : null}
        </div>
      </Modal>

      <Modal
        open={openModal === "audit"}
        onClose={() => setOpenModal(null)}
        title="Audit Logs"
        description="Recent admin actions from finance and operations"
      >
        {auditQuery.isLoading ? <p className="text-sm text-slate-500">Loading audit logs...</p> : null}
        {auditQuery.isError ? <p className="text-sm text-red-600">{(auditQuery.error as Error).message}</p> : null}
        <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
          {(auditQuery.data?.data || []).map((item) => (
            <div key={`audit-${item.id}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-slate-900">{item.action_type}</p>
              <p className="text-xs text-slate-500">{formatDate(item.created_at)}</p>
            </div>
          ))}
          {!auditQuery.isLoading && (auditQuery.data?.data || []).length === 0 ? (
            <p className="text-sm text-slate-500">No audit logs found.</p>
          ) : null}
        </div>
      </Modal>
    </section>
  );
}
