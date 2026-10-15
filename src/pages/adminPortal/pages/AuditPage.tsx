import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { listAudit, type AuditRow } from "../api/portalApi";
import { actionWords, clock, day, initials, rupees } from "../format";
import { Btn, Cell, Empty, ErrorState, Icon, Loading, Note, Pager, PillTabs, Row, SearchBox, Select, Table, usePortalHeader } from "../ui";

// Every change an admin makes: who, when, on what, and why.

type Group = "all" | "requests" | "technicians" | "complaints" | "messages" | "other";
const DAYS = [{ value: "1", label: "Today" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }];
const COLS = "130px 130px minmax(0,1fr) 150px minmax(0,1.5fr)";

function target(row: AuditRow): ReactNode {
  const id = row.targetId == null ? "" : String(row.targetId);
  if (!id) return <span className="ap-faint">—</span>;
  if (row.targetType === "service_request" || row.targetType === "request") return <Link className="ap-strong" style={{ textDecoration: "none" }} to={`/admin/requests/${id}`}>#{id}</Link>;
  if (row.targetType === "technician") return <Link className="ap-strong" style={{ textDecoration: "none" }} to={`/admin/technicians/${id}`}>Technician #{id}</Link>;
  if (row.targetType === "complaint") return <Link className="ap-strong" style={{ textDecoration: "none" }} to={`/admin/complaints/${id}`}>Complaint C-{id}</Link>;
  if (row.targetType === "broadcast") return id === "all" || id === "all_technicians" ? "All technicians" : `${id.split(",").length} technicians`;
  return <span className="ap-strong">{id}</span>;
}

/** The useful part of what was saved with an action, in words. */
export function auditDetails(row: AuditRow) {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const parts: string[] = [];
  const text = (key: string) => (meta[key] == null || meta[key] === "" ? null : String(meta[key]));
  if (text("title")) parts.push(`“${text("title")}”`);
  if (meta.base_amount != null) parts.push(`fare ${rupees(Number(meta.base_amount))}`);
  if (meta.technicianId != null) parts.push(`technician #${meta.technicianId}`);
  if (meta.assignedAdminId != null) parts.push(`to ${String(meta.assignedAdminId).split("@")[0]}`);
  if (meta.radiusKm != null) parts.push(`${meta.radiusKm} km`);
  if (meta.status != null && typeof meta.status === "string") parts.push(meta.status);
  if (meta.isVisible != null) parts.push(meta.isVisible ? "shown again" : "hidden");
  if (meta.passwordChanged) parts.push("password changed");
  for (const key of ["override_reason", "reason", "note", "resolutionNote"]) if (text(key)) parts.push(text(key) as string);
  return parts.join(" · ") || "—";
}

export default function AuditPage() {
  usePortalHeader("Audit log", "Every change an admin makes: who, when, on what, and why.");
  const [group, setGroup] = useState<Group>("all");
  const [days, setDays] = useState("7");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setSearch(text.trim()), 350); return () => window.clearTimeout(timer); }, [text]);
  useEffect(() => { setPage(1); }, [group, days, search]);
  const params = { group: group === "all" ? undefined : group, days: Number(days), search: search || undefined };
  const query = useQuery({ queryKey: ["portal", "audit", params, page], queryFn: () => listAudit({ ...params, page, limit: 25 }), placeholderData: keepPreviousData, refetchInterval: 60_000 });
  const data = query.data;
  const counts = data?.counts || {};
  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: AuditRow[] = [];
      for (let p = 1; p <= 50; p += 1) {
        const chunk = await listAudit({ ...params, page: p, limit: 100 });
        rows.push(...chunk.rows);
        if (p >= chunk.totalPages) break;
      }
      const cell = (value: unknown) => { const s = value == null ? "" : String(value); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
      const lines = ["When,Admin,What they did,On,Details", ...rows.map((row) => [row.at, row.by, actionWords(row.type).label, [row.targetType, row.targetId].filter(Boolean).join(" "), auditDetails(row)].map(cell).join(","))];
      const url = URL.createObjectURL(new Blob([lines.join("\n") + "\n"], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `resqnow-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
      toast.success(`Exported ${rows.length} entr${rows.length === 1 ? "y" : "ies"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export.");
    } finally {
      setExporting(false);
    }
  };
  return (
    <div className="adm-stack" data-testid="audit-page">
      <div className="ap-bar">
        <PillTabs<Group> label="Audit log" value={group} onChange={setGroup} items={[
          { key: "all", label: "Everything", count: counts.all }, { key: "requests", label: "Requests", count: counts.requests }, { key: "technicians", label: "Technicians", count: counts.technicians },
          { key: "complaints", label: "Complaints", count: counts.complaints }, { key: "messages", label: "Messages", count: counts.messages }, { key: "other", label: "Other", count: counts.other },
        ]} />
        <div className="ap-filters">
          <Select label="Dates" icon="calendar_month" value={days} onChange={setDays} options={DAYS} />
          <Btn icon="download" disabled={exporting || !data?.total} onClick={() => void exportCsv()}>{exporting ? "Exporting…" : "Export"}</Btn>
        </div>
      </div>
      <div className="ap-filters"><SearchBox value={text} onChange={setText} placeholder="Request number, technician, customer or a word in the note" style={{ flex: "1 1 260px" }} /></div>
      {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !data ? <Loading height={360} label="Loading the audit log" /> : data.rows.length === 0 ? <Empty icon="history" title="Nothing recorded for these filters" /> : (
        <Table label="Audit log" testId="audit" cols={COLS} minWidth={860} head={["When", "Admin", "What they did", "On", "Details"]}
          foot={<><span>{data.rows.length} of {data.total} in {DAYS.find((option) => option.value === days)?.label.toLowerCase()}</span><Pager page={data.page} totalPages={data.totalPages} onPage={setPage} /></>}>
          {data.rows.map((row) => {
            const words = actionWords(row.type);
            return (
              <Row key={row.id} cols={COLS} tight label={`${words.label} by ${row.by}`}>
                <Cell className="ap-num ap-faint">{day(row.at)} {clock(row.at)}</Cell>
                <Cell><span className="ap-who"><span className="ap-av is-sm" aria-hidden="true">{initials(row.by.split("@")[0])}</span><div><b>{row.by.split("@")[0]}</b></div></span></Cell>
                <Cell><span className="ap-row" style={{ gap: 8 }}><Icon name={words.icon} className="ap-faint" /><b className="ap-strong">{words.label}</b></span></Cell>
                <Cell>{target(row)}</Cell>
                <Cell>{auditDetails(row)}</Cell>
              </Row>
            );
          })}
        </Table>
      )}
      <Note>Approvals and rejections are kept on each technician's record, refunds on each payment, and payouts under Payouts.</Note>
    </div>
  );
}
