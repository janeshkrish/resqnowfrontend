import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, BellRing, Send, Trash2 } from "lucide-react";
import {
  deleteAdminNotification,
  getAdminNotifications,
  sendEmergencyMessage,
  sendSystemAnnouncement,
  sendTechnicianBroadcast,
} from "./api/adminExtendedApi";

const parseTechnicianIds = (value: string) =>
  value
    .split(",")
    .map((id) => Number(id.replace("#", "").trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

export default function AdminExtendedNotificationsPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [technicianIdsText, setTechnicianIdsText] = useState("");

  const technicianIds = useMemo(() => parseTechnicianIds(technicianIdsText), [technicianIdsText]);

  const notificationsQuery = useQuery({
    queryKey: ["admin", "notifications", "list"],
    queryFn: () => getAdminNotifications({ limit: 100, offset: 0 }),
  });

  const systemMutation = useMutation({
    mutationFn: sendSystemAnnouncement,
    onSuccess: () => {
      toast.success("System announcement sent.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const technicianMutation = useMutation({
    mutationFn: sendTechnicianBroadcast,
    onSuccess: () => {
      toast.success("Technician broadcast sent.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const emergencyMutation = useMutation({
    mutationFn: sendEmergencyMessage,
    onSuccess: () => {
      toast.success("Emergency message sent.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAdminNotification,
    onSuccess: () => {
      toast.success("Notification deleted.");
      void queryClient.invalidateQueries({ queryKey: ["admin", "notifications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sending =
    systemMutation.isPending || technicianMutation.isPending || emergencyMutation.isPending;

  const sendBroadcast = (type: "system" | "technician" | "emergency") => {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!message.trim()) {
      toast.error("Message is required.");
      return;
    }
    if (type === "technician" && technicianIds.length === 0) {
      toast.error("Enter at least one technician ID for technician broadcast.");
      return;
    }

    if (type === "technician") {
      technicianMutation.mutate({
        title: title.trim(),
        message: message.trim(),
        technicianIds,
      });
      return;
    }

    if (type === "emergency") {
      emergencyMutation.mutate({
        title: title.trim(),
        message: message.trim(),
      });
      return;
    }

    systemMutation.mutate({
      title: title.trim(),
      message: message.trim(),
    });
  };

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Notification Broadcast</h1>
        <p className="text-sm text-slate-500">Send announcements to all users or targeted technicians.</p>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Title</label>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Maintenance window update"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Message</label>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={5}
              placeholder="Type your message here"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-700">Technician IDs</label>
            <input
              value={technicianIdsText}
              onChange={(event) => setTechnicianIdsText(event.target.value)}
              placeholder="101, 205, 389"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm"
            />
            <p className="text-xs text-slate-500">Used for technician broadcast only.</p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => sendBroadcast("system")}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <BellRing className="h-4 w-4" /> Send System Announcement
          </button>
          <button
            type="button"
            onClick={() => sendBroadcast("technician")}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            <Send className="h-4 w-4" /> Send Technician Broadcast
          </button>
          <button
            type="button"
            onClick={() => sendBroadcast("emergency")}
            disabled={sending}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
          >
            <AlertTriangle className="h-4 w-4" /> Send Emergency Message
          </button>
        </div>

        {sending ? (
          <p className="mt-3 text-sm text-slate-500">Sending notification...</p>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Notification History</h2>
        <div className="mt-3 space-y-2">
          {notificationsQuery.isLoading ? (
            <p className="text-sm text-slate-500">Loading notifications...</p>
          ) : null}
          {notificationsQuery.isError ? (
            <p className="text-sm text-red-600">{(notificationsQuery.error as Error).message}</p>
          ) : null}

          {(notificationsQuery.data || []).map((item) => (
            <div
              key={`notification-${item.id}`}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
            >
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-1 text-sm text-slate-600">{item.message}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-slate-500">
                  {item.type} • {new Date(item.created_at).toLocaleString()}
                </p>
              </div>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(item.id)}
                disabled={deleteMutation.isPending}
                className="rounded-md border border-rose-200 bg-white p-2 text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                aria-label={`Delete notification ${item.id}`}
                title="Delete notification"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {!notificationsQuery.isLoading && (notificationsQuery.data || []).length === 0 ? (
            <p className="text-sm text-slate-500">No admin notifications found.</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
