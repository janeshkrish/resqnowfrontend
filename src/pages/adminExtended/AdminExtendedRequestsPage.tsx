import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Route } from "lucide-react";
import { io, Socket } from "socket.io-client";
import DataTable from "./components/DataTable";
import RequestDetailsModal from "./components/RequestDetailsModal";
import { getAdminToken, getRequiredApiBaseUrl } from "@/lib/api";
import { AdminRequestRow, getAdminRequests } from "./api/adminExtendedApi";

const PAGE_LIMIT = 10;

const statusBadgeClass: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  assigned: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-blue-50 text-blue-700 border-blue-200",
  en_route_pickup: "bg-sky-50 text-sky-700 border-sky-200",
  arrived_pickup: "bg-teal-50 text-teal-700 border-teal-200",
  vehicle_loaded: "bg-indigo-50 text-indigo-700 border-indigo-200",
  enroute_drop: "bg-cyan-50 text-cyan-700 border-cyan-200",
  arrived_drop: "bg-teal-50 text-teal-700 border-teal-200",
  service_completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  processing: "bg-violet-50 text-violet-700 border-violet-200",
  service_started: "bg-indigo-50 text-indigo-700 border-indigo-200",
  payment_pending: "bg-orange-50 text-orange-700 border-orange-200",
  in_progress: "bg-cyan-50 text-cyan-700 border-cyan-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  closed: "bg-slate-100 text-slate-700 border-slate-300",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

const priorityBadgeClass: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  normal: "bg-slate-50 text-slate-700 border-slate-200",
};

const formatDate = (value: string) => new Date(value).toLocaleString();

const formatStatusLabel = (value: string | null | undefined) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase()) || "-";

const formatMoney = (value: number | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `INR ${parsed.toLocaleString("en-IN")}` : "-";
};

export default function AdminExtendedRequestsPage() {
  const queryClient = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detailsRequestId, setDetailsRequestId] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: ["admin", "requests"] });
    const socket: Socket = io(getRequiredApiBaseUrl(), {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token: getAdminToken() || undefined },
    });
    const events = [
      "admin:request_status_updated",
      "admin:analytics_update",
      "admin:request_pricing_updated",
      "admin:vehicle_loaded",
      "admin:tow_started",
      "admin:arrived_drop",
      "admin:service_completed",
      "admin:payment_pending",
      "admin:job_closed",
    ];
    events.forEach((event) => socket.on(event, refresh));
    const fallbackRefreshId = window.setInterval(refresh, 45000);
    return () => {
      window.clearInterval(fallbackRefreshId);
      events.forEach((event) => socket.off(event, refresh));
      socket.disconnect();
    };
  }, [queryClient]);

  const requestsQuery = useQuery({
    queryKey: ["admin", "requests", page, PAGE_LIMIT, search, statusFilter, priorityFilter],
    queryFn: () =>
      getAdminRequests({
        page,
        limit: PAGE_LIMIT,
        search,
        status: statusFilter,
        priority: priorityFilter,
      }),
  });

  const columns = useMemo(
    () => [
      {
        key: "requestId",
        header: "Request ID",
        render: (row: AdminRequestRow) => <span className="font-semibold text-slate-900">#{row.requestId}</span>,
      },
      { key: "user", header: "User", render: (row: AdminRequestRow) => row.user || "-" },
      { key: "issueType", header: "Service", render: (row: AdminRequestRow) => formatStatusLabel(row.issueType) },
      {
        key: "route",
        header: "Route",
        render: (row: AdminRequestRow) => (
          <div className="max-w-[280px] space-y-1 text-xs">
            <p className="line-clamp-1 font-semibold text-slate-800">
              <span className="text-emerald-700">Pickup:</span> {row.pickupLocation || row.location || "-"}
            </p>
            {row.dropLocation ? <p className="line-clamp-1 text-slate-600"><span className="font-semibold text-rose-700">Drop:</span> {row.dropLocation}</p> : null}
            <p className="font-semibold text-slate-500">
              {row.routeDistanceKm == null ? "" : `${Number(row.routeDistanceKm).toFixed(1)} km`}
              {row.estimatedDuration == null ? "" : ` | ${Math.round(Number(row.estimatedDuration))} min`}
            </p>
          </div>
        ),
      },
      {
        key: "fare",
        header: "Fare / Margin",
        render: (row: AdminRequestRow) => (
          <div className="min-w-[150px] space-y-1 text-xs">
            <p className="font-bold text-slate-900">Customer: {formatMoney(row.customerFare ?? row.finalPrice ?? row.estimatedPrice ?? row.amount)}</p>
            <p className="font-semibold text-slate-700">Tech: {formatMoney(row.technicianEstimatedEarning)}</p>
            <p className="font-semibold text-slate-500">Margin: {formatMoney(row.platformMargin)}</p>
          </div>
        ),
      },
      { key: "assignedTechnician", header: "Technician", render: (row: AdminRequestRow) => row.assignedTechnician || "Unassigned" },
      {
        key: "status",
        header: "Status",
        render: (row: AdminRequestRow) => {
          const key = String(row.status || "").toLowerCase();
          return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${statusBadgeClass[key] || "bg-slate-50 text-slate-700 border-slate-200"}`}>{formatStatusLabel(row.status)}</span>;
        },
      },
      {
        key: "priority",
        header: "Priority",
        render: (row: AdminRequestRow) => {
          const key = String(row.priority || "normal").toLowerCase();
          return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${priorityBadgeClass[key] || priorityBadgeClass.normal}`}>{row.priority || "Normal"}</span>;
        },
      },
      { key: "createdTime", header: "Created", render: (row: AdminRequestRow) => formatDate(row.createdTime) },
      {
        key: "details",
        header: "",
        render: (row: AdminRequestRow) => (
          <button type="button" onClick={() => setDetailsRequestId(row.requestId)} className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100">
            <Route className="h-3.5 w-3.5" /> Details
          </button>
        ),
      },
    ],
    []
  );

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Request Control</h1>
        <p className="text-sm text-slate-500">Click any request row to inspect and manage the complete request.</p>
      </header>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1.8fr_1fr_1fr]">
        <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by request ID, user, issue, location" className="h-10 rounded-lg border border-slate-200 px-3 text-sm" />
        <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
          {["all", "pending", "assigned", "accepted", "en_route_pickup", "arrived_pickup", "vehicle_loaded", "enroute_drop", "arrived_drop", "service_completed", "processing", "service_started", "in_progress", "payment_pending", "completed", "closed", "cancelled"].map((status) => <option key={status} value={status}>{status === "all" ? "All Statuses" : formatStatusLabel(status)}</option>)}
        </select>
        <select value={priorityFilter} onChange={(event) => { setPriorityFilter(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
        </select>
      </div>

      {requestsQuery.isError ? <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{(requestsQuery.error as Error).message}</div> : null}

      <DataTable
        columns={columns}
        data={requestsQuery.data?.data || []}
        rowKey="requestId"
        loading={requestsQuery.isLoading}
        emptyMessage="No service requests match the current filters."
        pagination={requestsQuery.data?.pagination}
        onPageChange={setPage}
        onRowClick={(row) => setDetailsRequestId(row.requestId)}
      />

      <RequestDetailsModal requestId={detailsRequestId} open={detailsRequestId != null} onClose={() => setDetailsRequestId(null)} />
    </section>
  );
}
