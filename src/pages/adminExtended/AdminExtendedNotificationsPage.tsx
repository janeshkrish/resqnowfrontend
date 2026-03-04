import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, BellRing, Send } from "lucide-react";
import { broadcastNotification } from "./api/adminExtendedApi";

const parseTechnicianIds = (value: string) =>
  value
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

export default function AdminExtendedNotificationsPage() {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [technicianIdsText, setTechnicianIdsText] = useState("");

  const technicianIds = useMemo(() => parseTechnicianIds(technicianIdsText), [technicianIdsText]);

  const broadcastMutation = useMutation({
    mutationFn: broadcastNotification,
    onSuccess: () => {
      toast.success("Notification sent successfully.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

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

    broadcastMutation.mutate({
      type,
      title: title.trim(),
      message: message.trim(),
      technicianIds: type === "technician" ? technicianIds : undefined,
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
            disabled={broadcastMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <BellRing className="h-4 w-4" /> Send System Announcement
          </button>
          <button
            type="button"
            onClick={() => sendBroadcast("technician")}
            disabled={broadcastMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
          >
            <Send className="h-4 w-4" /> Send Technician Broadcast
          </button>
          <button
            type="button"
            onClick={() => sendBroadcast("emergency")}
            disabled={broadcastMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
          >
            <AlertTriangle className="h-4 w-4" /> Send Emergency Message
          </button>
        </div>

        {broadcastMutation.isPending ? (
          <p className="mt-3 text-sm text-slate-500">Sending notification...</p>
        ) : null}
      </div>
    </section>
  );
}
