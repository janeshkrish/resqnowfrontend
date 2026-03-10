import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertOctagon, Download, FileSearch, Landmark, ReceiptIndianRupee } from "lucide-react";
import { io, Socket } from "socket.io-client";
import DataTable from "./components/DataTable";
import MetricCard from "./components/MetricCard";
import Modal from "./components/Modal";
import { getAdminToken, getRequiredApiBaseUrl } from "@/lib/api";
import {
  exportFinanceCsv,
  getFinanceAuditLogs,
  getFinanceSummary,
  getFinanceTransactions,
  getFlaggedPayments,
  getPayoutBatches,
  getSettlementReports,
  FinanceTransactionRow,
  PayoutBatchRow,
  DailySettlementRow
} from "./api/adminExtendedApi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const PAGE_LIMIT = 10;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value: string) => new Date(value).toLocaleString();

export default function AdminExtendedFinancePage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [openModal, setOpenModal] = useState<"flagged" | "audit" | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    // Keep finance views synced after request/payment status changes.
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
    socket.on("admin:request_status_updated", refreshFinance);

    const fallbackRefreshId = window.setInterval(refreshFinance, 60000);

    return () => {
      window.clearInterval(fallbackRefreshId);
      socket.off("admin:payment_update", refreshFinance);
      socket.off("admin:request_status_updated", refreshFinance);
      socket.disconnect();
    };
  }, [queryClient]);

  const summaryQuery = useQuery({
    queryKey: ["admin", "finance", "summary"],
    queryFn: getFinanceSummary,
  });

  const transactionsQuery = useQuery({
    queryKey: ["admin", "finance", "transactions", page, PAGE_LIMIT, search, statusFilter],
    queryFn: () =>
      getFinanceTransactions({
        page,
        limit: PAGE_LIMIT,
        search,
        status: statusFilter,
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

  const batchesQuery = useQuery({
    queryKey: ["admin", "finance", "batches"],
    queryFn: () => getPayoutBatches(50),
  });

  const settlementsQuery = useQuery({
    queryKey: ["admin", "finance", "settlements"],
    queryFn: () => getSettlementReports(30),
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

  const columns = useMemo(
    () => [
      {
        key: "transactionId",
        header: "Transaction ID",
        render: (row: FinanceTransactionRow) => <span className="font-semibold text-slate-900">#{row.transactionId}</span>,
      },
      {
        key: "requestId",
        header: "REQUEST ID",
        render: (row: FinanceTransactionRow) => {
          const requestId = Number(row.requestId);
          if (!Number.isInteger(requestId) || requestId <= 0) {
            return "—";
          }
          return <span className="font-semibold text-slate-900">#{requestId}</span>;
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
        header: "Amount",
        render: (row: FinanceTransactionRow) => <span className="font-medium">{formatCurrency(row.amount)}</span>,
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
    []
  );

  const batchColumns = useMemo(
    () => [
      {
        key: "batch_id",
        header: "Batch ID",
        render: (row: PayoutBatchRow) => <span className="font-semibold text-slate-900">#{row.batch_id}</span>,
      },
      {
        key: "total_amount",
        header: "Total Amount",
        render: (row: PayoutBatchRow) => <span className="font-medium">{formatCurrency(row.total_amount)}</span>,
      },
      {
        key: "total_payouts",
        header: "Payouts Count",
        render: (row: PayoutBatchRow) => row.total_payouts,
      },
      {
        key: "status",
        header: "Status",
        render: (row: PayoutBatchRow) => {
          const status = String(row.status || "").toLowerCase();
          const className =
            status === "completed"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-amber-200 bg-amber-50 text-amber-700";
          return (
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${className}`}>
              {row.status}
            </span>
          );
        },
      },
      {
        key: "created_at",
        header: "Date",
        render: (row: PayoutBatchRow) => formatDate(row.created_at),
      },
    ],
    []
  );

  const settlementColumns = useMemo(
    () => [
      {
        key: "date",
        header: "Date",
        render: (row: DailySettlementRow) => <span className="font-semibold text-slate-900">{row.date}</span>,
      },
      {
        key: "total_payments",
        header: "Total Collected",
        render: (row: DailySettlementRow) => <span className="font-medium text-emerald-600">{formatCurrency(row.total_payments)}</span>,
      },
      {
        key: "total_payouts",
        header: "Total Dispatched",
        render: (row: DailySettlementRow) => <span className="font-medium text-rose-600">{formatCurrency(row.total_payouts)}</span>,
      },
      {
        key: "total_technician_earnings",
        header: "Tech Earnings",
        render: (row: DailySettlementRow) => <span className="font-medium">{formatCurrency(row.total_technician_earnings)}</span>,
      },
      {
        key: "total_commission",
        header: "Platform Comm.",
        render: (row: DailySettlementRow) => <span className="font-medium text-blue-600">{formatCurrency(row.total_commission)}</span>,
      },
    ],
    []
  );

  const summary = summaryQuery.data;

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Financial Monitoring</h1>
        <p className="text-sm text-slate-500">Track revenue, transactions, anomalies, and audit events.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <button
          type="button"
          onClick={onExportCsv}
          disabled={exporting}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-60"
        >
          <Download className="h-4 w-4" /> {exporting ? "Exporting..." : "Export CSV"}
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

      <Tabs defaultValue="transactions" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="transactions">Gateway Transactions</TabsTrigger>
          <TabsTrigger value="batches">Payout Batches</TabsTrigger>
          <TabsTrigger value="settlements">Daily Settlements</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1.8fr_1fr] mb-4">
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search by transaction ID, user, or technician"
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          {transactionsQuery.isError ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {(transactionsQuery.error as Error).message}
            </div>
          ) : null}

          <DataTable
            columns={columns}
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
            onPageChange={setPage}
          />
        </TabsContent>

        <TabsContent value="batches">
          {batchesQuery.isError ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {(batchesQuery.error as Error).message}
            </div>
          ) : null}
          <DataTable
            columns={batchColumns}
            data={batchesQuery.data?.batches || []}
            rowKey="batch_id"
            loading={batchesQuery.isLoading}
            emptyMessage="No payout batches found."
          />
        </TabsContent>

        <TabsContent value="settlements">
          {settlementsQuery.isError ? (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {(settlementsQuery.error as Error).message}
            </div>
          ) : null}
          <DataTable
            columns={settlementColumns}
            data={settlementsQuery.data?.settlements || []}
            rowKey="date"
            loading={settlementsQuery.isLoading}
            emptyMessage="No settlement reports found."
          />
        </TabsContent>
      </Tabs>

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
                #{item.transactionId} • {formatCurrency(item.amount)}
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

