import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, FilePenLine } from "lucide-react";
import { io, Socket } from "socket.io-client";
import DataTable from "./components/DataTable";
import Modal from "./components/Modal";
import { getAdminToken, getRequiredApiBaseUrl } from "@/lib/api";
import {
  TechnicianRow,
  addAdminTechnicianNote,
  getAdminTechnicians,
  sendAdminTechnicianLoginReminder,
  toggleAdminTechnicianVisibility,
} from "./api/adminExtendedApi";

const PAGE_LIMIT = 10;

const LOCAL_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";

const parseDate = (value: string | null | undefined) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDateTime = (value: string | null | undefined) => {
  const date = parseDate(value);
  if (!date) return "Never";
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZoneName: "short",
  });
};

const formatRelativeTime = (value: string | null | undefined) => {
  const date = parseDate(value);
  if (!date) return "Never";
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round((diffMinutes / 60) * 10) / 10;
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round((diffHours / 24) * 10) / 10;
  return `${diffDays}d ago`;
};

const formatHours = (value: number | null | undefined) => {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return "0.00 h";
  return `${parsed.toFixed(2)} h`;
};

export default function AdminExtendedTechniciansPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loginStatusFilter, setLoginStatusFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [selectedTech, setSelectedTech] = useState<TechnicianRow | null>(null);
  const [modalType, setModalType] = useState<"toggle" | "note" | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["admin", "technicians"] });
    };
    const onInactivityAlert = (payload: { technicianId?: number; message?: string }) => {
      toast.warning(`Login alert sent${payload?.technicianId ? ` (#${payload.technicianId})` : ""}`, {
        description: payload?.message || "Technician was inactive and received a login reminder.",
      });
      refresh();
    };

    const socketBaseUrl = getRequiredApiBaseUrl();
    const socket: Socket = io(socketBaseUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token: getAdminToken() || undefined },
    });

    socket.on("admin:technician_activity_update", refresh);
    socket.on("admin:technician_inactivity_alert", onInactivityAlert);
    socket.on("admin:technician_activity_cycle", refresh);

    const fallbackRefreshId = window.setInterval(refresh, 60000);

    return () => {
      window.clearInterval(fallbackRefreshId);
      socket.off("admin:technician_activity_update", refresh);
      socket.off("admin:technician_inactivity_alert", onInactivityAlert);
      socket.off("admin:technician_activity_cycle", refresh);
      socket.disconnect();
    };
  }, [queryClient]);

  const techniciansQuery = useQuery({
    queryKey: ["admin", "technicians", page, PAGE_LIMIT, search, statusFilter, loginStatusFilter, visibilityFilter],
    queryFn: () =>
      getAdminTechnicians({
        page,
        limit: PAGE_LIMIT,
        search,
        status: statusFilter,
        loginStatus: loginStatusFilter,
        visibility: visibilityFilter,
      }),
  });

  const refreshTechnicians = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "technicians"] });
  };

  const toggleMutation = useMutation({
    mutationFn: toggleAdminTechnicianVisibility,
    onSuccess: () => {
      toast.success("Technician visibility updated.");
      refreshTechnicians();
      closeModal();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const noteMutation = useMutation({
    mutationFn: addAdminTechnicianNote,
    onSuccess: () => {
      toast.success("Admin note added.");
      refreshTechnicians();
      closeModal();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reminderMutation = useMutation({
    mutationFn: sendAdminTechnicianLoginReminder,
    onSuccess: () => {
      toast.success("Login reminder sent.");
      refreshTechnicians();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openModal = (type: "toggle" | "note", technician: TechnicianRow) => {
    setModalType(type);
    setSelectedTech(technician);
    setNote(technician.adminNote || "");
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedTech(null);
    setNote("");
  };

  const sendLoginReminder = (technician: TechnicianRow) => {
    if (technician.loginStatus === "Logged In") {
      toast.info("Technician is already logged in.");
      return;
    }
    reminderMutation.mutate({
      technicianId: technician.technicianId,
    });
  };

  const submitModal = () => {
    if (!selectedTech || !modalType) return;

    if (modalType === "toggle") {
      toggleMutation.mutate({
        technicianId: selectedTech.technicianId,
        isVisible: !selectedTech.visibility,
        note: note || undefined,
      });
      return;
    }

    if (!note.trim()) {
      toast.error("Please add a note.");
      return;
    }

    noteMutation.mutate({
      technicianId: selectedTech.technicianId,
      note: note.trim(),
    });
  };

  const isActionLoading = toggleMutation.isPending || noteMutation.isPending;

  const columns = useMemo(
    () => [
      {
        key: "technician",
        header: "Technician",
        className: "min-w-[140px]",
        render: (row: TechnicianRow) => (
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-900">{row.name}</p>
            <p className="text-xs text-slate-500">#{row.technicianId}</p>
            <p className="text-xs text-slate-500">
              Jobs: {row.activeJobs} | Rating: {row.rating?.toFixed(1) || "0.0"}
            </p>
          </div>
        ),
      },
      {
        key: "state",
        header: "State",
        className: "min-w-[130px]",
        render: (row: TechnicianRow) => (
          <div className="flex flex-col gap-1.5">
            <span
              className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${
                row.status === "Online"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {row.status}
            </span>
            <span
              className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${
                row.loginStatus === "Logged In"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {row.loginStatus || "Logged Out"}
            </span>
            <span
              className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-medium ${
                row.visibility
                  ? "border-blue-200 bg-blue-50 text-blue-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}
            >
              {row.visibility ? "Visible" : "Hidden"}
            </span>
          </div>
        ),
      },
      {
        key: "activity",
        header: "Activity",
        className: "min-w-[210px]",
        render: (row: TechnicianRow) => (
          <div className="space-y-1.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Last Seen</p>
              <p className="text-sm text-slate-900">{formatRelativeTime(row.lastSeenAt)}</p>
              <p className="text-xs text-slate-500">{formatDateTime(row.lastSeenAt)}</p>
            </div>
            <div className="space-y-1 text-xs text-slate-700">
              <p>
                <span className="font-medium">Login:</span> {formatDateTime(row.lastLoginAt)}
              </p>
              <p>
                <span className="font-medium">Logout:</span> {formatDateTime(row.lastLogoutAt)}
              </p>
            </div>
          </div>
        ),
      },
      {
        key: "hours",
        header: "Hours",
        className: "min-w-[120px]",
        render: (row: TechnicianRow) => (
          <div className="space-y-1 text-xs text-slate-700">
            <p>
              <span className="font-medium">Current:</span>{" "}
              {row.loginStatus === "Logged In" ? formatHours(row.currentSessionHours) : "0.00 h"}
            </p>
            <p>
              <span className="font-medium">24h:</span> {formatHours(row.loggedInHours24h)}
            </p>
            <p>
              <span className="font-medium">Total:</span> {formatHours(row.loggedInHoursTotal)}
            </p>
          </div>
        ),
      },
      {
        key: "inactivityAlertSentAt",
        header: "Last Alert",
        className: "min-w-[150px]",
        render: (row: TechnicianRow) => (
          <div className="space-y-0.5">
            <p className="text-sm text-slate-900">{formatRelativeTime(row.inactivityAlertSentAt)}</p>
            <p className="text-xs text-slate-500">{formatDateTime(row.inactivityAlertSentAt)}</p>
          </div>
        ),
      },
      {
        key: "adminNote",
        header: "Admin Note",
        className: "min-w-[140px] max-w-[220px]",
        render: (row: TechnicianRow) => (
          <span className="line-clamp-3 text-sm text-slate-600">{row.adminNote || "No note"}</span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        className: "min-w-[110px]",
        render: (row: TechnicianRow) => (
          <div className="flex flex-col items-start gap-1.5">
            <button
              type="button"
              onClick={() => openModal("toggle", row)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-100"
            >
              {row.visibility ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {row.visibility ? "Hide" : "Show"}
            </button>
            <button
              type="button"
              onClick={() => openModal("note", row)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-100"
            >
              <FilePenLine className="h-3.5 w-3.5" /> Note
            </button>
            <button
              type="button"
              onClick={() => sendLoginReminder(row)}
              disabled={row.loginStatus === "Logged In" || reminderMutation.isPending}
              className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Remind
            </button>
          </div>
        ),
      },
    ],
    [reminderMutation.isPending]
  );

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Technician Oversight</h1>
        <p className="text-sm text-slate-500">
          Monitor accurate login/logout activity, last seen, logged hours, visibility, and reminders.
        </p>
        <p className="mt-1 text-xs text-slate-500">Times are shown in {LOCAL_TIME_ZONE}.</p>
      </header>

      <div className="flex flex-wrap gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by ID, name or email"
          className="h-10 min-w-[240px] flex-1 rounded-lg border border-slate-200 px-3 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          className="h-10 min-w-[170px] rounded-lg border border-slate-200 px-3 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
        <select
          value={visibilityFilter}
          onChange={(event) => {
            setVisibilityFilter(event.target.value);
            setPage(1);
          }}
          className="h-10 min-w-[170px] rounded-lg border border-slate-200 px-3 text-sm"
        >
          <option value="all">All Visibility</option>
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
        </select>
        <select
          value={loginStatusFilter}
          onChange={(event) => {
            setLoginStatusFilter(event.target.value);
            setPage(1);
          }}
          className="h-10 min-w-[170px] rounded-lg border border-slate-200 px-3 text-sm"
        >
          <option value="all">All Login Status</option>
          <option value="logged_in">Logged In</option>
          <option value="logged_out">Logged Out</option>
        </select>
      </div>

      {techniciansQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(techniciansQuery.error as Error).message}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={techniciansQuery.data?.data || []}
        rowKey="technicianId"
        loading={techniciansQuery.isLoading}
        emptyMessage="No technicians matched your current filters."
        pagination={
          techniciansQuery.data?.pagination
            ? {
                page: techniciansQuery.data.pagination.page,
                totalPages: techniciansQuery.data.pagination.totalPages,
                total: techniciansQuery.data.pagination.total,
              }
            : undefined
        }
        onPageChange={setPage}
      />

      <Modal
        open={Boolean(modalType && selectedTech)}
        onClose={closeModal}
        title={modalType === "toggle" ? "Toggle Visibility" : "Add Admin Note"}
        description={selectedTech ? `${selectedTech.name} (#${selectedTech.technicianId})` : ""}
        onConfirm={submitModal}
        loading={isActionLoading}
        confirmText={modalType === "toggle" ? "Update" : "Save Note"}
      >
        {modalType === "toggle" ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Current visibility: <strong>{selectedTech?.visibility ? "Visible" : "Hidden"}</strong>
            </p>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              placeholder="Optional admin note"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        ) : null}

        {modalType === "note" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Admin Note</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              placeholder="Add internal note for this technician"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
