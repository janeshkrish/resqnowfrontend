import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { useAdminEvents } from "@/pages/adminExtended/monitor/adminLive";
import { listRequests, type RequestQuery, type RequestRow, type RequestTab } from "../api/portalApi";
import { clock, dayAndTime, duration, initials, paymentMethod, rupees, service, vehiclePicture } from "../format";
import RequestPanel, { statusOf } from "../RequestPanel";
import { Btn, Cell, Empty, ErrorState, Icon, Loading, Pager, Pill, PillTabs, Row, SearchBox, Select, Table, Two, usePortalHeader, type Tone } from "../ui";

const DAYS = [{ value: "1", label: "Today" }, { value: "7", label: "Last 7 days" }, { value: "30", label: "Last 30 days" }, { value: "90", label: "Last 90 days" }];
const SERVICES = [
  { value: "", label: "All services" }, { value: "tow", label: "Towing" }, { value: "flat", label: "Flat tyre" }, { value: "battery", label: "Battery" },
  { value: "fuel", label: "Fuel delivery" }, { value: "lockout", label: "Lockout" }, { value: "mechanic", label: "Mechanical" }, { value: "charg", label: "EV charging" }, { value: "winch", label: "Winching" },
];
const PAYMENTS = [{ value: "", label: "Any payment" }, { value: "online", label: "Online" }, { value: "cash", label: "Cash" }, { value: "unpaid", label: "Not paid" }];
const PRIORITIES = [{ value: "", label: "Any priority" }, { value: "high", label: "High priority" }, { value: "normal", label: "Normal" }];
const COLS = "96px minmax(0,1.15fr) minmax(0,1.1fr) minmax(0,1fr) 104px 60px 108px 120px 112px 20px";

export function paymentPill(row: Pick<RequestRow, "payment" | "phase">): { label: string; tone: Tone } | null {
  const method = row.payment.method ? paymentMethod(row.payment.method) : null;
  if (row.payment.refunded > 0) return { label: `Refunded ${rupees(row.payment.refunded)}`, tone: "warn" };
  if (!method) return null;
  const cash = method === "Cash";
  if (row.payment.paid) return { label: `${method}, ${cash ? "collected" : "paid"}`, tone: "ok" };
  if (row.phase === "cancelled") return { label: `${method}, none`, tone: "" };
  if (row.phase === "payment_due") return { label: `${method}, due`, tone: "warn" };
  return { label: `${method}, ${cash ? "on completion" : "pending"}`, tone: "" };
}

function arrival(row: RequestRow) {
  if (row.phase === "cancelled" && !row.arrivedAt) return <Two top="—" bottom="cancelled" />;
  if (!row.arrivedAt) return <Two top="—" bottom={row.technician ? "not yet" : "no technician"} />;
  const late = row.lateMinutes != null && row.lateMinutes > 0;
  return <Two top={clock(row.arrivedAt)} bottom={row.lateMinutes == null ? "no promise" : late ? `${row.lateMinutes} min late` : "on time"} tone={row.lateMinutes == null ? undefined : late ? "warn" : "ok"} />;
}

const csvCell = (value: unknown) => {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export default function RequestsPage() {
  usePortalHeader("All requests", "Every request, finished or not. Open one to see what happened and put it right.");
  const params = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const openId = params.requestId ? Number(params.requestId) : null;
  const [tab, setTab] = useState<RequestTab>("all");
  const [days, setDays] = useState("7");
  const [serviceFilter, setServiceFilter] = useState("");
  const [payment, setPayment] = useState("");
  const [priority, setPriority] = useState("");
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  useEffect(() => { const timer = window.setTimeout(() => setSearch(text.trim()), 350); return () => window.clearTimeout(timer); }, [text]);
  useEffect(() => { setPage(1); }, [tab, days, serviceFilter, payment, priority, search]);

  const filters: RequestQuery = { tab, days: Number(days), service: serviceFilter || undefined, payment: payment || undefined, priority: priority || undefined, search: search || undefined };
  const list = useQuery({ queryKey: ["portal", "requests", filters, page], queryFn: () => listRequests({ ...filters, page, limit: 20 }), placeholderData: keepPreviousData, refetchInterval: 60_000 });
  useAdminEvents(() => void queryClient.invalidateQueries({ queryKey: ["portal", "requests"] }), 3_000);

  const counts = list.data?.counts;
  const tabs = [
    { key: "all" as const, label: "All", count: counts?.all },
    { key: "live" as const, label: "Live", count: counts?.live },
    { key: "completed" as const, label: "Completed", count: counts?.completed },
    { key: "cancelled" as const, label: "Cancelled", count: counts?.cancelled },
    { key: "payment_due" as const, label: "Payment due", count: counts?.payment_due, warn: Boolean(counts?.payment_due) },
    { key: "refunded" as const, label: "Refunded", count: counts?.refunded },
  ];

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows: RequestRow[] = [];
      for (let p = 1; p <= 50; p += 1) {
        const chunk = await listRequests({ ...filters, page: p, limit: 100 });
        rows.push(...chunk.rows);
        if (p >= chunk.totalPages) break;
      }
      const head = ["Request", "Created", "Status", "Service", "Vehicle", "Area", "Customer", "Technician", "Promised", "Arrived", "Late minutes", "Work minutes", "Fare", "ResQNow margin", "Payment", "Payment state", "Refunded", "Priority"];
      const lines = [head.join(",")].concat(rows.map((row) => [
        row.id, row.createdAt, statusOf(row.phase, row.status).label, service(row.service), row.vehicleModel || row.vehicleType, row.area, row.customer?.name, row.technician?.name,
        row.promisedAt, row.arrivedAt, row.lateMinutes, row.workMinutes, row.fare, row.margin, paymentMethod(row.payment.method), row.payment.state, row.payment.refunded, row.priority,
      ].map(csvCell).join(",")));
      const url = URL.createObjectURL(new Blob([lines.join("\n") + "\n"], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `resqnow-requests-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
      toast.success(`Exported ${rows.length} request${rows.length === 1 ? "" : "s"}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not export.");
    } finally {
      setExporting(false);
    }
  };

  const data = list.data;
  const range = DAYS.find((option) => option.value === days)?.label.toLowerCase() || "";
  return (
    <div className="adm-stack" data-testid="requests-page">
      <div className="ap-bar">
        <PillTabs<RequestTab> label="Requests" items={tabs} value={tab} onChange={setTab} />
        <Btn icon="download" disabled={exporting || !data?.total} onClick={() => void exportCsv()}>{exporting ? "Exporting…" : "Export CSV"}</Btn>
      </div>
      <div className="ap-filters">
        <Select label="Dates" icon="calendar_month" value={days} onChange={setDays} options={DAYS} />
        <Select label="Service" icon="build" value={serviceFilter} onChange={setServiceFilter} options={SERVICES} />
        <Select label="Payment" icon="payments" value={payment} onChange={setPayment} options={PAYMENTS} />
        <Select label="Priority" icon="flag" value={priority} onChange={setPriority} options={PRIORITIES} />
        <SearchBox value={text} onChange={setText} placeholder="Request, customer, phone or technician" style={{ flex: "1 1 240px" }} />
      </div>
      {list.isError ? <ErrorState error={list.error} onRetry={() => void list.refetch()} /> : !data ? <Loading height={420} label="Loading requests" /> : data.rows.length === 0 ? (
        <Empty icon="search_off" title="No requests match" sub={`Nothing ${tab === "all" ? "" : `under ${tabs.find((item) => item.key === tab)?.label} `}in ${range}. Try other filters.`} />
      ) : (
        <Table label="All requests" testId="requests-table" cols={COLS} minWidth={1060}
          head={["Request", "Customer", "Service and area", "Technician", "Arrived", "Work", "Fare", "Payment", "Status", ""]}
          foot={<><span>{(data.page - 1) * data.limit + 1}–{Math.min(data.total, data.page * data.limit)} of {data.total} in {range}</span><Pager page={data.page} totalPages={data.totalPages} onPage={setPage} /></>}>
          {data.rows.map((row) => {
            const state = statusOf(row.phase, row.status);
            const pay = paymentPill(row);
            return (
              <Row key={row.id} cols={COLS} selected={openId === row.id} label={`Request ${row.id}`} onClick={() => navigate(`/admin/requests/${row.id}`)}>
                <Cell><span className="ap-two"><b>#{row.id}{row.priority === "high" ? <span className="ap-pill is-hot" style={{ height: 18, padding: "0 6px", fontSize: 10.5, marginLeft: 6 }}>High</span> : null}</b><span>{dayAndTime(row.createdAt)}</span></span></Cell>
                <Cell><span className="rq-cust"><span className="ap-thumb"><img src={vehiclePicture(row.vehicleType)} alt="" /></span><div><b>{row.customer?.name || "—"}</b><span>{row.vehicleModel || row.vehicleType || "—"}</span></div></span></Cell>
                <Cell><Two top={service(row.service)} bottom={row.area || "—"} /></Cell>
                <Cell>{row.technician ? <span className="ap-who"><span className="ap-av is-sm" aria-hidden="true">{initials(row.technician.name)}</span><div><b>{row.technician.name || `#${row.technician.id}`}</b><span>{row.technician.rating != null ? `★ ${row.technician.rating}` : "No rating"}</span></div></span> : <span className="ap-faint">None yet</span>}</Cell>
                <Cell>{arrival(row)}</Cell>
                <Cell className="ap-num">{duration(row.workMinutes)}</Cell>
                <Cell><Two top={rupees(row.fare)} bottom={row.margin != null ? `ResQNow ${rupees(row.margin)}` : row.phase === "cancelled" ? "nothing charged" : "—"} /></Cell>
                <Cell>{pay ? <Pill tone={pay.tone}>{pay.label}</Pill> : <span className="ap-faint">—</span>}</Cell>
                <Cell><Pill tone={state.tone}>{state.label}</Pill></Cell>
                <Cell className="ap-faint"><Icon name="chevron_right" /></Cell>
              </Row>
            );
          })}
        </Table>
      )}
      {openId ? <RequestPanel key={openId} requestId={openId} onClose={() => navigate("/admin/requests")} /> : null}
    </div>
  );
}
