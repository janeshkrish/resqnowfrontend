import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCheck, UserRoundCog } from "lucide-react";
import DataTable from "./components/DataTable";
import Modal from "./components/Modal";
import {
  ComplaintRow,
  addComplaintInternalNote,
  assignComplaint,
  createComplaint,
  getComplaints,
  resolveComplaint,
} from "./api/adminExtendedApi";

const PAGE_LIMIT = 10;

const formatDate = (value: string) => new Date(value).toLocaleString();

type ComplaintActionType = "assign" | "resolve" | "note";

export default function AdminExtendedComplaintsPage() {
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [selectedComplaint, setSelectedComplaint] = useState<ComplaintRow | null>(null);
  const [modalType, setModalType] = useState<ComplaintActionType | null>(null);
  const [assignedAdminId, setAssignedAdminId] = useState("");
  const [note, setNote] = useState("");

  const complaintsQuery = useQuery({
    queryKey: ["admin", "complaints", page, PAGE_LIMIT, statusFilter],
    queryFn: () =>
      getComplaints({
        page,
        limit: PAGE_LIMIT,
        status: statusFilter,
      }),
  });

  const refreshComplaints = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "complaints"] });
  };

  const createMutation = useMutation({
    mutationFn: createComplaint,
    onSuccess: () => {
      toast.success("Complaint created.");
      setTitle("");
      setDescription("");
      refreshComplaints();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const assignMutation = useMutation({
    mutationFn: assignComplaint,
    onSuccess: () => {
      toast.success("Complaint assigned.");
      refreshComplaints();
      closeModal();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const resolveMutation = useMutation({
    mutationFn: resolveComplaint,
    onSuccess: () => {
      toast.success("Complaint resolved.");
      refreshComplaints();
      closeModal();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const noteMutation = useMutation({
    mutationFn: addComplaintInternalNote,
    onSuccess: () => {
      toast.success("Internal note added.");
      closeModal();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openModal = (type: ComplaintActionType, complaint: ComplaintRow) => {
    setModalType(type);
    setSelectedComplaint(complaint);
    setAssignedAdminId("");
    setNote("");
  };

  const closeModal = () => {
    setModalType(null);
    setSelectedComplaint(null);
    setAssignedAdminId("");
    setNote("");
  };

  const onCreateComplaint = (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      toast.error("Complaint title is required.");
      return;
    }

    createMutation.mutate({
      title: title.trim(),
      description: description.trim() || undefined,
    });
  };

  const submitAction = () => {
    if (!selectedComplaint || !modalType) return;

    if (modalType === "assign") {
      if (!assignedAdminId.trim()) {
        toast.error("Assigned admin is required.");
        return;
      }
      assignMutation.mutate({
        complaintId: selectedComplaint.complaintId,
        assignedAdminId: assignedAdminId.trim(),
        note: note.trim() || undefined,
      });
      return;
    }

    if (modalType === "resolve") {
      resolveMutation.mutate({
        complaintId: selectedComplaint.complaintId,
        resolutionNote: note.trim() || undefined,
      });
      return;
    }

    if (!note.trim()) {
      toast.error("Internal note is required.");
      return;
    }

    noteMutation.mutate({
      complaintId: selectedComplaint.complaintId,
      note: note.trim(),
    });
  };

  const isActionLoading = assignMutation.isPending || resolveMutation.isPending || noteMutation.isPending;

  const columns = useMemo(
    () => [
      {
        key: "complaintId",
        header: "Complaint ID",
        render: (row: ComplaintRow) => <span className="font-semibold text-slate-900">#{row.complaintId}</span>,
      },
      {
        key: "user",
        header: "User",
        render: (row: ComplaintRow) => row.user || "-",
      },
      {
        key: "assignedAdmin",
        header: "Assigned Admin",
        render: (row: ComplaintRow) => row.assignedAdmin || "Unassigned",
      },
      {
        key: "status",
        header: "Status",
        render: (row: ComplaintRow) => (
          <span
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${
              row.status === "resolved"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : row.status === "assigned"
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
            }`}
          >
            {row.status}
          </span>
        ),
      },
      {
        key: "createdDate",
        header: "Created Date",
        render: (row: ComplaintRow) => formatDate(row.createdDate),
      },
      {
        key: "actions",
        header: "Actions",
        render: (row: ComplaintRow) => (
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => openModal("assign", row)}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-100"
            >
              <UserRoundCog className="h-3.5 w-3.5" /> Assign Admin
            </button>
            <button
              type="button"
              onClick={() => openModal("resolve", row)}
              className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Resolve
            </button>
            <button
              type="button"
              onClick={() => openModal("note", row)}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium hover:bg-slate-100"
            >
              Add Internal Note
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
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Complaint Module</h1>
        <p className="text-sm text-slate-500">Create and resolve complaints with assignment and internal notes.</p>
      </header>

      <form onSubmit={onCreateComplaint} className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-base font-semibold text-slate-900">Create Complaint</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Complaint title"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
          />
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
            className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={createMutation.isPending}
          className="mt-3 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {createMutation.isPending ? "Creating..." : "Submit Complaint"}
        </button>
      </form>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto]">
        <p className="text-sm text-slate-500">Complaint records and status tracking.</p>
        <select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="open">Open</option>
          <option value="assigned">Assigned</option>
          <option value="resolved">Resolved</option>
        </select>
      </div>

      {complaintsQuery.isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {(complaintsQuery.error as Error).message}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        data={complaintsQuery.data?.data || []}
        rowKey="complaintId"
        loading={complaintsQuery.isLoading}
        emptyMessage="No complaints found for this filter."
        pagination={
          complaintsQuery.data?.pagination
            ? {
                page: complaintsQuery.data.pagination.page,
                totalPages: complaintsQuery.data.pagination.totalPages,
                total: complaintsQuery.data.pagination.total,
              }
            : undefined
        }
        onPageChange={setPage}
      />

      <Modal
        open={Boolean(modalType && selectedComplaint)}
        onClose={closeModal}
        title={
          modalType === "assign"
            ? "Assign Admin"
            : modalType === "resolve"
              ? "Resolve Complaint"
              : "Add Internal Note"
        }
        description={selectedComplaint ? `Complaint #${selectedComplaint.complaintId}` : ""}
        onConfirm={submitAction}
        loading={isActionLoading}
        confirmText={modalType === "assign" ? "Assign" : modalType === "resolve" ? "Resolve" : "Add Note"}
      >
        {modalType === "assign" ? (
          <>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Assigned Admin</label>
              <input
                value={assignedAdminId}
                onChange={(event) => setAssignedAdminId(event.target.value)}
                placeholder="admin@resqnow.org"
                className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Note (optional)</label>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </>
        ) : null}

        {modalType === "resolve" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Resolution Note</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Add final resolution details"
            />
          </div>
        ) : null}

        {modalType === "note" ? (
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Internal Note</label>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              placeholder="Internal admin note"
            />
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
