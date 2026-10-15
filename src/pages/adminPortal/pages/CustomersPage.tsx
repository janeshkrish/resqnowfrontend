import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { listCustomers, type CustomerRow, type CustomerTab } from "../api/portalApi";
import { AddCustomerDialog } from "../CustomerDialogs";
import { count, dateLong, day, initials, planName, rupees, vehiclePicture } from "../format";
import { Btn, Cell, Empty, ErrorState, Icon, Loading, Pager, Pill, PillTabs, Row, SearchBox, Table, usePortalHeader } from "../ui";

const COLS = "minmax(0,1.3fr) 104px 96px 76px 88px 150px 124px minmax(0,1fr) 20px";
const csvCell = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export default function CustomersPage() {
  const navigate = useNavigate();
  const [search, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<CustomerTab>("all");
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const adding = search.get("add") === "1";
  useEffect(() => { const timer = window.setTimeout(() => setQuery(text.trim()), 350); return () => window.clearTimeout(timer); }, [text]);
  useEffect(() => { setPage(1); }, [tab, query]);
  const list = useQuery({ queryKey: ["portal", "customers", tab, query, page], queryFn: () => listCustomers({ tab, search: query || undefined, page, limit: 20 }), placeholderData: keepPreviousData, refetchInterval: 120_000 });
  const data = list.data;
  usePortalHeader("Customers", data ? `${count(data.counts.all)} customers · ${count(data.joinedThisMonth)} joined in the last 30 days` : "Everyone who uses ResQNow.");

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: CustomerRow[] = [];
      for (let p = 1; p <= 100; p += 1) {
        const chunk = await listCustomers({ tab, search: query || undefined, page: p, limit: 100 });
        rows.push(...chunk.rows);
        if (p >= chunk.totalPages) break;
      }
      const head = ["Id", "Name", "Email", "Phone", "Joined", "Plan", "Vehicles", "Requests", "Cancelled", "Spent", "Last request", "Live request"];
      const lines = [head.join(",")].concat(rows.map((row) => [row.id, row.name, row.email, row.phoneMasked, row.joinedAt, planName(row.plan), row.vehicles.join("; "), row.requests, row.cancelled, row.spent, row.lastRequestAt, row.liveRequestId].map(csvCell).join(",")));
      const url = URL.createObjectURL(new Blob([lines.join("\n") + "\n"], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `resqnow-customers-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
      toast.success(`Exported ${rows.length} customer${rows.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="adm-stack" data-testid="customers-page">
      <div className="ap-bar">
        <PillTabs<CustomerTab> label="Customers" value={tab} onChange={setTab} items={[
          { key: "all", label: "All", count: data?.counts.all }, { key: "active", label: "Active this month", count: data?.counts.active },
          { key: "members", label: "Smart Care members", count: data?.counts.members }, { key: "live", label: "Live now", count: data?.counts.live },
        ]} />
        <div className="ap-row" style={{ gap: 8 }}>
          <Btn icon="download" disabled={exporting || !data?.total} onClick={() => void exportCsv()}>{exporting ? "Exporting…" : "Export"}</Btn>
          <Btn variant="dark" icon="person_add" onClick={() => setSearchParams({ add: "1" })}>Add customer</Btn>
        </div>
      </div>
      <div className="ap-filters"><SearchBox value={text} onChange={setText} placeholder="Name, phone, email or customer number" style={{ flex: "1 1 240px" }} /></div>
      {list.isError ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : !data ? <Loading height={420} label="Loading customers" /> : data.rows.length === 0 ? (
        <Empty icon="person_search" title="No customers match" sub="Try another tab or search." />
      ) : (
        <Table label="Customers" testId="customers-table" cols={COLS} minWidth={1000}
          head={["Customer", "Joined", "Vehicles", { label: "Requests", right: true }, { label: "Spent", right: true }, "Last request", "Plan", "Needs a look", ""]}
          foot={<><span>{(data.page - 1) * data.limit + 1}–{Math.min(data.total, data.page * data.limit)} of {count(data.total)} · most recent first</span><Pager page={data.page} totalPages={data.totalPages} onPage={setPage} /></>}>
          {data.rows.map((row) => (
            <Row key={row.id} cols={COLS} label={row.name || `Customer ${row.id}`} onClick={() => navigate(`/admin/customers/${row.id}`)}>
              <Cell><span className="ap-who"><span className="ap-av" aria-hidden="true">{initials(row.name || row.email)}</span><div><b>{row.name || "No name"}</b><span>{row.phoneMasked || row.email || "—"}</span></div></span></Cell>
              <Cell className="ap-faint">{row.joinedAt ? (day(row.joinedAt) === "Today" ? "Today" : dateLong(row.joinedAt)) : "—"}</Cell>
              <Cell><span className="pp-thumbs">{row.vehicles.slice(0, 3).map((type, index) => <span key={index} className="ap-thumb"><img src={vehiclePicture(type)} alt={type} /></span>)}{row.vehicles.length === 0 ? <span className="ap-faint">—</span> : null}</span></Cell>
              <Cell right className="ap-num">{count(row.requests)}</Cell>
              <Cell right className="ap-num ap-strong">{rupees(row.spent)}</Cell>
              <Cell>{row.liveRequestId ? <Pill tone="go">Live now · #{row.liveRequestId}</Pill> : <span className="ap-faint">{row.lastRequestAt ? day(row.lastRequestAt) : "Never"}</span>}</Cell>
              <Cell>{row.plan ? <Pill tone="dark" icon="workspace_premium">{planName(row.plan)}</Pill> : <span className="ap-faint">—</span>}</Cell>
              <Cell>{row.cancelled >= 3 ? <Pill tone="warn">Cancelled {row.cancelled} times</Pill> : row.requests === 1 && row.liveRequestId ? <span className="ap-faint">First request</span> : null}</Cell>
              <Cell className="ap-faint"><Icon name="chevron_right" /></Cell>
            </Row>
          ))}
        </Table>
      )}
      {adding ? <AddCustomerDialog onClose={() => setSearchParams({})} onAdded={(id) => navigate(`/admin/customers/${id}`)} /> : null}
    </div>
  );
}
