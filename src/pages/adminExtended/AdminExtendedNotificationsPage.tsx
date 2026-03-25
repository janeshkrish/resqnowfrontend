import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, BellRing, Loader2, Send, Trash2, Users } from "lucide-react";
import {
  deleteAdminNotification,
  getBroadcastTechnicians,
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

const TECHNICIAN_CATEGORY_OPTIONS = [
  { label: "Towing", value: "towing" },
  { label: "Battery Jumpstart", value: "battery_jumpstart" },
  { label: "Fuel Delivery", value: "fuel_delivery" },
  { label: "Lockout Assistance", value: "lockout_assistance" },
  { label: "Tire Change", value: "tire_change" },
] as const;

const TECHNICIAN_STATUS_OPTIONS = [
  { label: "Online", value: "online" },
  { label: "Offline", value: "offline" },
  { label: "Busy", value: "busy" },
] as const;

type TechnicianFilters = {
  selectAll: boolean;
  categories: string[];
  region: string;
  status: string;
};

export default function AdminExtendedNotificationsPage() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [technicianIdsText, setTechnicianIdsText] = useState("");
  const [filters, setFilters] = useState<TechnicianFilters>({
    selectAll: false,
    categories: [],
    region: "",
    status: "",
  });
  const [filteredTechnicians, setFilteredTechnicians] = useState<number[]>([]);
  const [isFilteringTechnicians, setIsFilteringTechnicians] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const manualTechnicianIdsRef = useRef("");

  const technicianIds = useMemo(() => parseTechnicianIds(technicianIdsText), [technicianIdsText]);
  const isFilterActive = useMemo(
    () =>
      filters.selectAll ||
      filters.categories.length > 0 ||
      Boolean(filters.region) ||
      Boolean(filters.status),
    [filters]
  );

  const notificationsQuery = useQuery({
    queryKey: ["admin", "notifications", "list"],
    queryFn: () => getAdminNotifications({ limit: 100, offset: 0 }),
  });

  const technicianDirectoryQuery = useQuery({
    queryKey: ["admin", "notifications", "technician-directory"],
    queryFn: () => getBroadcastTechnicians(),
    staleTime: 5 * 60 * 1000,
  });

  const regionOptions = useMemo(() => {
    const regions = new Set<string>();
    for (const technician of technicianDirectoryQuery.data || []) {
      const region = String(technician.region || "").trim();
      if (region) regions.add(region);
    }
    return Array.from(regions).sort((left, right) => left.localeCompare(right));
  }, [technicianDirectoryQuery.data]);

  useEffect(() => {
    if (!isFilterActive) {
      setFilteredTechnicians([]);
      setFilterError(null);
      setTechnicianIdsText(manualTechnicianIdsRef.current);
      return;
    }

    let cancelled = false;

    const syncFilteredTechnicians = async () => {
      setIsFilteringTechnicians(true);
      setFilterError(null);

      try {
        const technicians = await getBroadcastTechnicians(
          filters.selectAll
            ? {}
            : {
                categories: filters.categories,
                region: filters.region,
                status: filters.status,
              }
        );

        if (cancelled) return;

        const ids = Array.from(
          new Set(
            technicians
              .map((technician) => Number(technician.id))
              .filter((id) => Number.isInteger(id) && id > 0)
          )
        );

        setFilteredTechnicians(ids);
        setTechnicianIdsText(ids.join(", "));
      } catch (error) {
        if (cancelled) return;
        setFilteredTechnicians([]);
        setTechnicianIdsText("");
        setFilterError((error as Error).message || "Unable to filter technicians.");
      } finally {
        if (!cancelled) {
          setIsFilteringTechnicians(false);
        }
      }
    };

    void syncFilteredTechnicians();

    return () => {
      cancelled = true;
    };
  }, [filters, isFilterActive]);

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
  const selectedTechnicianCount = isFilterActive ? filteredTechnicians.length : technicianIds.length;

  const updateFilter = <K extends keyof TechnicianFilters>(key: K, value: TechnicianFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const toggleCategory = (category: string) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(category)
        ? prev.categories.filter((item) => item !== category)
        : [...prev.categories, category],
    }));
  };

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
              onChange={(event) => {
                const nextValue = event.target.value;
                manualTechnicianIdsRef.current = nextValue;
                setTechnicianIdsText(nextValue);
              }}
              disabled={isFilterActive}
              placeholder="101, 205, 389"
              className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
            />
            <p className="text-xs text-slate-500">Used for technician broadcast only.</p>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      checked={filters.selectAll}
                      onChange={(event) => updateFilter("selectAll", event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                    />
                    Select All Technicians
                  </label>
                  <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    <Users className="h-3.5 w-3.5" />
                    {selectedTechnicianCount} technicians selected
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Category</p>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {TECHNICIAN_CATEGORY_OPTIONS.map((option) => {
                      const checked = filters.categories.includes(option.value);
                      return (
                        <label
                          key={option.value}
                          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                            filters.selectAll
                              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                              : checked
                                ? "border-slate-900 bg-slate-900 text-white"
                                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={filters.selectAll}
                            onChange={() => toggleCategory(option.value)}
                            className="h-4 w-4 rounded border-current"
                          />
                          {option.label}
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Region</label>
                    <select
                      value={filters.region}
                      onChange={(event) => updateFilter("region", event.target.value)}
                      disabled={filters.selectAll}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="">All regions</option>
                      {regionOptions.map((region) => (
                        <option key={region} value={region}>
                          {region}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700">Status</label>
                    <select
                      value={filters.status}
                      onChange={(event) => updateFilter("status", event.target.value)}
                      disabled={filters.selectAll}
                      className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="">All statuses</option>
                      {TECHNICIAN_STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {isFilteringTechnicians ? (
                  <p className="inline-flex items-center gap-2 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading filtered technicians...
                  </p>
                ) : null}

                {filterError ? (
                  <p className="text-xs text-rose-600">{filterError}</p>
                ) : null}

                {technicianDirectoryQuery.isError && !filterError ? (
                  <p className="text-xs text-rose-600">
                    {(technicianDirectoryQuery.error as Error).message}
                  </p>
                ) : null}

                <p className="text-xs text-slate-500">
                  Filtered results auto-fill the Technician IDs field. Clear all filters to re-enable manual entry.
                </p>
              </div>
            </div>
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
            disabled={sending || isFilteringTechnicians}
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
                  {item.type} | {new Date(item.created_at).toLocaleString()}
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
