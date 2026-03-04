import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertOctagon, Download, FileSearch, Landmark, ReceiptIndianRupee } from "lucide-react";
import DataTable from "./components/DataTable";
import MetricCard from "./components/MetricCard";
import Modal from "./components/Modal";
import {
  exportFinanceCsv,
  getFinanceAuditLogs,
  getFinanceSummary,
  getFinanceTransactions,
  getFlaggedPayments,
  FinanceTransactionRow,
} from "./api/adminExtendedApi";

const PAGE_LIMIT = 10;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const formatDate = (value: string) => new Date(value).toLocaleString();

export default function AdminExtendedFinancePage() {
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
        render: (row: FinanceTransactionRow) => (
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
              String(row.status || "").toLowerCase() === "completed"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : String(row.status || "").toLowerCase() === "pending"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {row.status}
          </span>
        ),
      },
      {
        key: "date",
        header: "Date",
        render: (row: FinanceTransactionRow) => formatDate(row.date),
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

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1.8fr_1fr]">
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
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
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
