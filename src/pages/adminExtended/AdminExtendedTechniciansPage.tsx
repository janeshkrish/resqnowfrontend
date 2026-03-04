import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, EyeOff, FilePenLine } from "lucide-react";
import DataTable from "./components/DataTable";
import Modal from "./components/Modal";
import {
  TechnicianRow,
  addAdminTechnicianNote,
  getAdminTechnicians,
  toggleAdminTechnicianVisibility,
} from "./api/adminExtendedApi";

const PAGE_LIMIT = 10;

export default function AdminExtendedTechniciansPage() {
  const queryClient = useQueryClient();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
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

  const techniciansQuery = useQuery({
    queryKey: ["admin", "technicians", page, PAGE_LIMIT, search, statusFilter, visibilityFilter],
    queryFn: () =>
      getAdminTechnicians({
        page,
        limit: PAGE_LIMIT,
        search,
        status: statusFilter,
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
        key: "technicianId",
        header: "Technician ID",
        render: (row: TechnicianRow) => <span className="font-semibold text-slate-900">#{row.technicianId}</span>,
      },
      {
        key: "name",
        header: "Name",
        render: (row: TechnicianRow) => row.name,
      },
      {
        key: "status",
        header: "Status",
        render: (row: TechnicianRow) => (
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
              row.status === "Online"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {row.status}
          </span>
        ),
      },
      {
        key: "activeJobs",
        header: "Active Jobs",
        render: (row: TechnicianRow) => row.activeJobs,
      },
      {
        key: "rating",
        header: "Rating",
        render: (row: TechnicianRow) => row.rating?.toFixed(1) || "0.0",
      },
      {
        key: "visibility",
        header: "Visibility",
        render: (row: TechnicianRow) => (
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
              row.visibility
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-rose-200 bg-rose-50 text-rose-700"
            }`}
          >
            {row.visibility ? "Visible" : "Hidden"}
          </span>
        ),
      },
      {
        key: "adminNote",
        header: "Admin Note",
        render: (row: TechnicianRow) => (
          <span className="line-clamp-2 max-w-[220px] text-sm text-slate-600">{row.adminNote || "-"}</span>
        ),
      },
      {
        key: "actions",
        header: "Actions",
        render: (row: TechnicianRow) => (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => openModal("toggle", row)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-100"
            >
              {row.visibility ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              Toggle Visibility
            </button>
            <button
              type="button"
              onClick={() => openModal("note", row)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-100"
            >
              <FilePenLine className="h-3.5 w-3.5" /> Add Note
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
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Technician Oversight</h1>
        <p className="text-sm text-slate-500">Monitor availability, visibility, ratings, and admin notes.</p>
      </header>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1.8fr_1fr_1fr]">
        <input
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Search by ID, name or email"
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
          <option value="online">Online</option>
          <option value="offline">Offline</option>
        </select>
        <select
          value={visibilityFilter}
          onChange={(event) => {
            setVisibilityFilter(event.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
        >
          <option value="all">All Visibility</option>
          <option value="visible">Visible</option>
          <option value="hidden">Hidden</option>
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
