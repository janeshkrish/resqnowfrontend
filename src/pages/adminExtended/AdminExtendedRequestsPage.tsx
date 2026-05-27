import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CircleX, ShieldAlert, UserPlus } from "lucide-react";
import { io, Socket } from "socket.io-client";
import DataTable from "./components/DataTable";
import Modal from "./components/Modal";
import { getAdminToken, getRequiredApiBaseUrl } from "@/lib/api";
import {
  AdminRequestRow,
  assignAdminRequest,
  closeAdminRequest,
  escalateAdminRequest,
  getAdminRequests,
  markAdminRequestHighPriority,
  overrideAdminRequestPricing,
} from "./api/adminExtendedApi";

type RequestActionType = "assign" | "escalate" | "priority" | "close" | "pricing";

const PAGE_LIMIT = 10;

const statusBadgeClass: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  assigned: "bg-blue-50 text-blue-700 border-blue-200",
  accepted: "bg-blue-50 text-blue-700 border-blue-200",
  processing: "bg-violet-50 text-violet-700 border-violet-200",
  service_started: "bg-indigo-50 text-indigo-700 border-indigo-200",
  payment_pending: "bg-orange-50 text-orange-700 border-orange-200",
  "in progress": "bg-cyan-50 text-cyan-700 border-cyan-200",
  in_progress: "bg-cyan-50 text-cyan-700 border-cyan-200",
  "in-progress": "bg-cyan-50 text-cyan-700 border-cyan-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

const priorityBadgeClass: Record<string, string> = {
  high: "bg-rose-50 text-rose-700 border-rose-200",
  normal: "bg-slate-50 text-slate-700 border-slate-200",
};

const formatDate = (value: string) => new Date(value).toLocaleString();

export default function AdminExtendedRequestsPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [modalAction, setModalAction] = useState<RequestActionType | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<AdminRequestRow | null>(null);

  const [technicianId, setTechnicianId] = useState("");
  const [reason, setReason] = useState("");
  const [radiusKm, setRadiusKm] = useState("35");
  const [closeStatus, setCloseStatus] = useState("cancelled");
  const [overrideAmount, setOverrideAmount] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    // Keep requests table synced after server-side status updates.
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "requests"] });
    };

    const socketBaseUrl = getRequiredApiBaseUrl();
    const socket: Socket = io(socketBaseUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token: getAdminToken() || undefined },
    });

    socket.on("admin:request_status_updated", refresh);
    socket.on("admin:analytics_update", refresh);
    socket.on("admin:request_pricing_updated", refresh);

    const fallbackRefreshId = window.setInterval(refresh, 45000);

    return () => {
      window.clearInterval(fallbackRefreshId);
      socket.off("admin:request_status_updated", refresh);
      socket.off("admin:analytics_update", refresh);
      socket.off("admin:request_pricing_updated", refresh);
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

  const refreshRequests = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "requests"] });
  };

  const assignMutation = useMutation({
    mutationFn: assignAdminRequest,
    onSuccess: () => {
      toast.success("Request assigned successfully.");
      refreshRequests();
      closeModal();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const escalateMutation = useMutation({
    mutationFn: escalateAdminRequest,
    onSuccess: () => {
      toast.success("Request escalated.");
      refreshRequests();
      closeModal();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const highPriorityMutation = useMutation({
    mutationFn: markAdminRequestHighPriority,
    onSuccess: () => {
      toast.success("Request marked as high priority.");
      refreshRequests();
      closeModal();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const closeMutation = useMutation({
    mutationFn: closeAdminRequest,
    onSuccess: () => {
      toast.success("Request closed.");
      refreshRequests();
      void queryClient.invalidateQueries({ queryKey: ["admin", "finance"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "dashboard"] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "analytics"] });
      closeModal();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const pricingOverrideMutation = useMutation({
    mutationFn: overrideAdminRequestPricing,
    onSuccess: () => {
      toast.success("Pricing override saved.");
      refreshRequests();
      closeModal();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const isActionLoading =
    assignMutation.isPending ||
    escalateMutation.isPending ||
    highPriorityMutation.isPending ||
    closeMutation.isPending ||
    pricingOverrideMutation.isPending;

  const openModal = (action: RequestActionType, request: AdminRequestRow) => {
    setModalAction(action);
    setSelectedRequest(request);
    setReason("");
    setTechnicianId("");
    setRadiusKm("35");
    setCloseStatus("cancelled");
    setOverrideAmount(request.amount ? String(request.amount) : "");
  };

  const closeModal = () => {
    setModalAction(null);
    setSelectedRequest(null);
  };

  const submitModalAction = () => {
    if (!selectedRequest || !modalAction) return;

    const requestId = Number(selectedRequest.requestId);

    if (modalAction === "assign") {
      const id = Number(technicianId);
      if (!Number.isInteger(id) || id <= 0) {
        toast.error("Enter a valid technician ID.");
        return;
      }
      assignMutation.mutate({ requestId, technicianId: id });
      return;
    }

    if (modalAction === "escalate") {
      escalateMutation.mutate({
        requestId,
        reason: reason || undefined,
        radiusKm: Number(radiusKm) || 35,
      });
      return;
    }

    if (modalAction === "priority") {
      highPriorityMutation.mutate({ requestId, note: reason || undefined });
      return;
    }

    if (modalAction === "pricing") {
      const baseAmount = Number(overrideAmount);
      if (!Number.isFinite(baseAmount) || baseAmount <= 0) {
        toast.error("Enter a valid override amount.");
        return;
      }
      pricingOverrideMutation.mutate({
        requestId,
        baseAmount,
        finalPrice: selectedRequest.finalPrice || selectedRequest.estimatedPrice || undefined,
        reason: reason || undefined,
      });
      return;
    }

    closeMutation.mutate({
      requestId,
      status: closeStatus,
      reason: reason || undefined,
    });
  };

  const tableData = requestsQuery.data?.data || [];

  const columns = useMemo(
    () => [
      {
        key: "requestId",
        header: "Request ID",
        render: (row: AdminRequestRow) => <span className="font-semibold text-slate-900">#{row.requestId}</span>,
      },
      {
        key: "user",
        header: "User",
        render: (row: AdminRequestRow) => row.user || "-",
      },
      {
        key: "issueType",
        header: "Issue Type",
        render: (row: AdminRequestRow) => row.issueType || "-",
      },
      {
        key: "location",
        header: "Route",
        render: (row: AdminRequestRow) => (
          <div className="max-w-[260px] space-y-1 text-xs">
            <p className="line-clamp-1 font-semibold text-slate-800">Pickup: {row.pickupLocation || row.location || "-"}</p>
            {row.dropLocation && <p className="line-clamp-1 text-slate-600">Drop: {row.dropLocation}</p>}
            {row.routeDistanceKm != null && (
              <p className="font-bold text-slate-500">{Number(row.routeDistanceKm).toFixed(1)} km</p>
            )}
          </div>
        ),
      },
      {
        key: "fare",
        header: "Fare",
        render: (row: AdminRequestRow) => (
          <div className="text-xs">
            <p className="font-bold text-slate-900">INR {Number(row.finalPrice || row.estimatedPrice || row.amount || 0).toLocaleString("en-IN")}</p>
            {row.pricingFactors?.surgeMultiplier && (
              <p className="text-slate-500">Surge {Number(row.pricingFactors.surgeMultiplier).toFixed(2)}x</p>
            )}
          </div>
        ),
      },
      {
        key: "assignedTechnician",
        header: "Assigned Technician",
        render: (row: AdminRequestRow) => row.assignedTechnician || "Unassigned",
      },
      {
        key: "status",
        header: "Status",
        render: (row: AdminRequestRow) => {
          const key = String(row.status || "").toLowerCase();
          return (
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                statusBadgeClass[key] || "bg-slate-50 text-slate-700 border-slate-200"
              }`}
            >
              {row.status || "unknown"}
            </span>
          );
        },
      },
      {
        key: "priority",
        header: "Priority",
        render: (row: AdminRequestRow) => {
          const key = String(row.priority || "normal").toLowerCase();
          return (
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
                priorityBadgeClass[key] || priorityBadgeClass.normal
              }`}
            >
              {row.priority || "Normal"}
            </span>
          );
        },
      },
      {
        key: "createdTime",
        header: "Created Time",
        render: (row: AdminRequestRow) => formatDate(row.createdTime),
      },
      {
        key: "actions",
        header: "Actions",
        render: (row: AdminRequestRow) => (
          <div className="flex min-w-[250px] flex-wrap gap-1.5">
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-100"
              onClick={() => openModal("assign", row)}
            >
              Manual Assign
            </button>
            <button
              type="button"
              className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100"
              onClick={() => openModal("escalate", row)}
            >
              Escalate
            </button>
            <button
              type="button"
              className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"
              onClick={() => openModal("priority", row)}
            >
              High Priority
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
              onClick={() => openModal("close", row)}
            >
              Close Request
            </button>
            <button
              type="button"
              className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
              onClick={() => openModal("pricing", row)}
            >
              Override Fare
            </button>
          </div>
        ),
      },
    ],
    []
  );

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Request Control</h1>
        <p className="text-sm text-slate-500">Search, filter, and action service requests in real time.</p>
      </header>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1.8fr_1fr_1fr]">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by request ID, user, issue, location"
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm focus:border-slate-400 focus:outline-none"
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm focus:border-slate-400 focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="accepted">Accepted</option>
          <option value="processing">Processing</option>
          <option value="service_started">Service Started</option>
          <option value="in_progress">In Progress</option>
          <option value="payment_pending">Payment Pending</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(event) => {
            setPriorityFilter(event.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm focus:border-slate-400 focus:outline-none"
        >
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="normal">Normal</option>
        </select>
      </div>

      {requestsQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(requestsQuery.error as Error).message}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={tableData}
        rowKey="requestId"
        loading={requestsQuery.isLoading}
        emptyMessage="No service requests match the current filters."
        pagination={
          requestsQuery.data?.pagination
            ? {
                page: requestsQuery.data.pagination.page,
                totalPages: requestsQuery.data.pagination.totalPages,
                total: requestsQuery.data.pagination.total,
              }
            : undefined
        }
        onPageChange={setPage}
      />

      <Modal
        open={Boolean(modalAction && selectedRequest)}
        onClose={closeModal}
        title={
          modalAction === "assign"
            ? "Manual Assign"
            : modalAction === "escalate"
              ? "Escalate Request"
              : modalAction === "priority"
                ? "Mark High Priority"
                : modalAction === "pricing"
                  ? "Override Fare"
                  : "Close Request"
        }
        description={selectedRequest ? `Request #${selectedRequest.requestId}` : ""}
        onConfirm={submitModalAction}
        confirmDisabled={!selectedRequest}
        loading={isActionLoading}
        confirmText={
          modalAction === "assign"
            ? "Assign"
            : modalAction === "escalate"
              ? "Escalate"
              : modalAction === "priority"
                ? "Mark High"
                : modalAction === "pricing"
                  ? "Save Override"
                  : "Close"
        }
      >
        {modalAction === "assign" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Technician ID</label>
            <input
              value={technicianId}
              onChange={(event) => setTechnicianId(event.target.value)}
              placeholder="Enter technician ID"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
        ) : null}

        {modalAction === "escalate" ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Reroute Radius (km)</label>
              <input
                value={radiusKm}
                onChange={(event) => setRadiusKm(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Escalation Reason</label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Optional note"
              />
            </div>
          </>
        ) : null}

        {modalAction === "priority" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              <ShieldAlert className="h-4 w-4" />
              This will move the request into high-priority queue.
            </div>
            <label className="text-sm font-medium text-slate-700">Admin Note</label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Optional note"
            />
          </div>
        ) : null}

        {modalAction === "pricing" ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm text-indigo-800">
              This updates the base service amount. Customer totals are still recalculated by the payment service.
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Base Amount (INR)</label>
              <input
                value={overrideAmount}
                onChange={(event) => setOverrideAmount(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
                placeholder="Enter revised base fare"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Reason</label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Explain the override for audit"
              />
            </div>
          </div>
        ) : null}

        {modalAction === "close" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Closing a request updates final lifecycle state.
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Final Status</label>
              <select
                value={closeStatus}
                onChange={(event) => setCloseStatus(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
              >
                <option value="cancelled">Cancelled</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Reason</label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                placeholder="Reason for manual close"
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
