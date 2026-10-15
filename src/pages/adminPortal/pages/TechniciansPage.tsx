import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { sendAdminTechnicianLoginReminder } from "@/pages/adminExtended/api/adminExtendedApi";
import { useAdminEvents } from "@/pages/adminExtended/monitor/adminLive";
import { listTechnicians, type TechnicianRow, type TechnicianTab } from "../api/portalApi";
import { ago, count, duration, initials, percent, rupees, service } from "../format";
import { DeleteTechnicianDialog, useVisibility } from "../TechnicianDialogs";
import { Btn, Cell, Empty, ErrorState, Loading, Menu, NoRowClick, Pager, PillTabs, Row, SearchBox, Select, Switch, Table, usePortalHeader } from "../ui";

const SERVICES = [
  { value: "", label: "All services" }, { value: "tow", label: "Towing" }, { value: "flat", label: "Flat tyre" }, { value: "battery", label: "Battery" },
  { value: "fuel", label: "Fuel delivery" }, { value: "lock", label: "Lockout" }, { value: "mechanic", label: "Mechanical" }, { value: "charg", label: "EV charging" }, { value: "winch", label: "Winching" },
];
const COLS = "minmax(0,1.5fr) minmax(0,1.3fr) minmax(0,1fr) 48px 64px 60px 66px 64px 72px 52px 104px";
const csvCell = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function nowCell(row: TechnicianRow) {
  const now = row.now;
  if (now.state === "on_job") {
    const tone = now.alert ? (now.alert.code === "gps_inactive" ? "is-bad" : "is-warn") : "";
    return (
      <span className={`pp-now ${tone}`}><span className={`ap-dot ${now.alert ? (tone === "is-bad" ? "is-bad" : "is-warn") : "is-go"}`} aria-hidden="true" />
        <div><b>{now.alert ? now.alert.text : "On a job"}</b><span>#{now.jobId} · {service(now.jobService)}</span></div></span>
    );
  }
  if (now.state === "free") return <span className="pp-now"><span className="ap-dot is-ok" aria-hidden="true" /><div><b>On duty, free</b><span>{row.area || "waiting for a job"}</span></div></span>;
  return <span className="pp-now"><span className="ap-dot" aria-hidden="true" /><div><b>Offline</b><span>{now.lastSeenAt ? `seen ${ago(now.lastSeenAt)}` : "not seen yet"}{row.hidden ? " · hidden" : ""}</span></div></span>;
}
const warnNum = (text: string, warn: boolean) => <span className={`ap-num${warn ? " ap-warn" : ""}`}>{text}</span>;

export default function TechniciansPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const visibility = useVisibility();
  const [tab, setTab] = useState<TechnicianTab>("all");
  const [serviceFilter, setServiceFilter] = useState("");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<TechnicianRow | null>(null);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setSearch(text.trim()), 350); return () => window.clearTimeout(timer); }, [text]);
  useEffect(() => { setPage(1); }, [tab, serviceFilter, search]);
  const filters = { tab, service: serviceFilter || undefined, search: search || undefined };
  const list = useQuery({ queryKey: ["portal", "technicians", filters, page], queryFn: () => listTechnicians({ ...filters, page, limit: 20 }), placeholderData: keepPreviousData, refetchInterval: 60_000 });
  useAdminEvents(() => void queryClient.invalidateQueries({ queryKey: ["portal", "technicians"] }), 3_000);
  const counts = list.data?.counts;
  usePortalHeader("Technicians", counts ? `${count(counts.all)} approved partners · ${count(counts.on_duty)} on duty now · ${count(counts.on_job)} on a job` : "Every approved partner, what they are doing now, and how they do.");

  const remind = async (row: TechnicianRow) => {
    try {
      await sendAdminTechnicianLoginReminder({ technicianId: row.id });
      toast.success(`Reminder sent to ${row.name}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the reminder.");
    }
  };
  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: TechnicianRow[] = [];
      for (let p = 1; p <= 30; p += 1) {
        const chunk = await listTechnicians({ ...filters, page: p, limit: 100 });
        rows.push(...chunk.rows);
        if (p >= chunk.totalPages) break;
      }
      const head = ["Id", "Name", "Owner", "Phone", "Area", "Services", "Vehicles", "Now", "Hidden", "Jobs (30 days)", "On time", "Rating", "Reviews", "Accepts", "On duty today (min)", "Dues", "Joined"];
      const lines = [head.join(",")].concat(rows.map((row) => [
        row.id, row.name, row.owner, row.phoneMasked, row.area, row.services.map(service).join("; "), row.vehicles.join("; "),
        row.now.state === "on_job" ? `On job #${row.now.jobId}` : row.now.state === "free" ? "On duty, free" : "Offline", row.hidden ? "yes" : "no",
        row.jobs30, row.onTimeRate == null ? "" : Math.round(row.onTimeRate * 100) + "%", row.rating, row.reviews, row.acceptRate == null ? "" : Math.round(row.acceptRate * 100) + "%",
        row.onDutyTodayMinutes, row.dues, row.joinedAt,
      ].map(csvCell).join(",")));
      const url = URL.createObjectURL(new Blob([lines.join("\n") + "\n"], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `resqnow-technicians-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
      toast.success(`Exported ${rows.length} technician${rows.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export.");
    } finally {
      setExporting(false);
    }
  };

  const data = list.data;
  return (
    <div className="adm-stack" data-testid="technicians-page">
      <div className="ap-bar">
        <PillTabs<TechnicianTab> label="Technicians" value={tab} onChange={setTab} items={[
          { key: "all", label: "All", count: counts?.all }, { key: "on_duty", label: "On duty", count: counts?.on_duty }, { key: "on_job", label: "On a job", count: counts?.on_job },
          { key: "offline", label: "Offline", count: counts?.offline }, { key: "hidden", label: "Hidden", count: counts?.hidden }, { key: "needs_look", label: "Needs a look", count: counts?.needs_look, warn: Boolean(counts?.needs_look) },
        ]} />
        <div className="ap-row" style={{ gap: 8 }}>
          <Btn icon="download" disabled={exporting || !data?.total} onClick={() => void exportCsv()}>{exporting ? "Exporting…" : "Export"}</Btn>
          <Btn variant="dark" icon="add" onClick={() => navigate("/admin/technicians/new")}>Add technician</Btn>
        </div>
      </div>
      <div className="ap-filters">
        <Select label="Service" icon="build" value={serviceFilter} onChange={setServiceFilter} options={SERVICES} />
        <SearchBox value={text} onChange={setText} placeholder="Name, phone, shop or area" style={{ flex: "1 1 240px" }} />
      </div>
      {list.isError ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : !data ? <Loading height={420} label="Loading technicians" /> : data.rows.length === 0 ? (
        <Empty icon="person_search" title="No technicians match" sub="Try another tab, service or search." />
      ) : (
        <Table label="Technicians" testId="technicians-table" cols={COLS} minWidth={1120}
          head={["Technician", "Right now", "Services", { label: "Jobs", right: true }, { label: "On time", right: true }, { label: "Rating", right: true }, { label: "Accepts", right: true }, { label: "Today", right: true }, { label: "Dues", right: true }, "Shown", ""]}
          foot={<><span>Showing {data.rows.length} of {data.total} · busiest first · jobs and rates over the last 30 days</span><Pager page={data.page} totalPages={data.totalPages} onPage={setPage} /></>}>
          {data.rows.map((row) => (
            <Row key={row.id} cols={COLS} label={row.name} tone={row.hidden ? "muted" : undefined} onClick={() => navigate(`/admin/technicians/${row.id}`)}>
              <Cell><span className="ap-who"><span className="ap-av" aria-hidden="true">{initials(row.name)}</span><div><b>{row.name}</b><span>{[row.owner, row.area].filter(Boolean).join(" · ") || row.phoneMasked || "—"}</span></div></span></Cell>
              <Cell>{nowCell(row)}</Cell>
              <Cell><span className="pp-svc">{row.services.slice(0, 3).map((name) => <span key={name}>{service(name)}</span>)}{row.services.length > 3 ? <span>+{row.services.length - 3}</span> : null}</span></Cell>
              <Cell right>{warnNum(count(row.jobs30), false)}</Cell>
              <Cell right>{warnNum(percent(row.onTimeRate), row.onTimeRate != null && row.onTimeRate < 0.85)}</Cell>
              <Cell right><span className="ap-num ap-strong">{row.rating != null ? `★ ${row.rating.toFixed(1)}` : "—"}</span></Cell>
              <Cell right>{warnNum(percent(row.acceptRate), row.acceptRate != null && row.acceptRate < 0.75)}</Cell>
              <Cell right>{warnNum(row.onDutyTodayMinutes ? duration(row.onDutyTodayMinutes) : "—", false)}</Cell>
              <Cell right>{warnNum(rupees(row.dues), row.dues >= 1000)}</Cell>
              <Cell><NoRowClick><Switch on={!row.hidden} label={`${row.name} shown to customers`} disabled={visibility.busy} onChange={(on) => void visibility.set(row.id, row.name, on)} /></NoRowClick></Cell>
              <Cell><NoRowClick>
                <Btn size="sm" onClick={() => navigate(`/admin/technicians/${row.id}`)}>Record</Btn>
                <Menu label={`More for ${row.name}`} items={[
                  { label: "Edit details", icon: "edit", onClick: () => navigate(`/admin/technicians/${row.id}/edit`) },
                  { label: "Send a log-in reminder", icon: "notifications", disabled: row.now.state !== "offline", onClick: () => void remind(row) },
                  { label: "Delete technician", icon: "delete", danger: true, onClick: () => setDeleting(row) },
                ]} />
              </NoRowClick></Cell>
            </Row>
          ))}
        </Table>
      )}
      {deleting ? <DeleteTechnicianDialog technician={{ id: deleting.id, name: deleting.name, onJob: deleting.now.state === "on_job", dues: deleting.dues }} onClose={() => setDeleting(null)}
        onDeleted={() => { setDeleting(null); void queryClient.invalidateQueries({ queryKey: ["portal"] }); }} /> : null}
    </div>
  );
}
