import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { getReports, type Reports } from "../api/portalApi";
import { count, dateLong, percent, rupeesShort, service } from "../format";
import { Btn, Card, Columns, ErrorState, HBars, Icon, Kpis, Loading, usePortalHeader } from "../ui";

// How the business is doing over a period, against the period before.

const SPANS = [7, 30, 90] as const;
const STEP: Record<string, string> = { requested: "Requested", offered: "Offered", accepted: "Accepted", arrived: "Arrived", completed: "Completed", paid: "Paid" };
const WEEK = [["Mon", 1], ["Tue", 2], ["Wed", 3], ["Thu", 4], ["Fri", 5], ["Sat", 6], ["Sun", 0]] as const;
const HOURS = ["12a", "2a", "4a", "6a", "8a", "10a", "12p", "2p", "4p", "6p", "8p", "10p"];
const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const change = (now: number, before: number) => (before > 0 ? (now - before) / before : null);
const signed = (value: number | null, words: string) => (value == null ? "nothing to compare" : `${value >= 0 ? "+" : "−"}${Math.abs(Math.round(value * 100))}% ${words}`);

function busiest(heat: number[][]) {
  let best = { day: "", bucket: 0, value: -1 };
  for (const [label, index] of WEEK) {
    for (let bucket = 0; bucket < 12; bucket += 1) {
      const value = (heat[index]?.[bucket * 2] || 0) + (heat[index]?.[bucket * 2 + 1] || 0);
      if (value > best.value) best = { day: label, bucket, value };
    }
  }
  return best.value > 0 ? `${best.day} ${HOURS[best.bucket]} to ${HOURS[(best.bucket + 1) % 12]} is the busiest two hours, with ${best.value} requests.` : "No requests in this period yet.";
}

export default function ReportsPage() {
  const [days, setDays] = useState<number>(30);
  const query = useQuery({ queryKey: ["portal", "reports", days], queryFn: () => getReports(days), staleTime: 60_000 });
  const r = query.data;
  usePortalHeader("Reports", r ? `${dateLong(r.from)} to ${dateLong(r.to)} · compared with the ${r.days} days before` : "How the business is doing.");
  const download = (data: Reports) => {
    const lines = ["Date,Completed,Cancelled,Other", ...data.perDay.map((row) => `${row.date},${row.completed},${row.cancelled},${row.other}`), "",
      "Step,Requests", ...data.funnel.map((row) => `${STEP[row.step] || row.step},${row.count}`), "",
      "Service,Requests", ...data.serviceMix.map((row) => `"${service(row.service)}",${row.count}`), "",
      "Cancellation reason,Requests", ...data.cancellations.reasons.map((row) => `"${row.reason.replace(/"/g, '""')}",${row.count}`)];
    const url = URL.createObjectURL(new Blob([lines.join("\n") + "\n"], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `resqnow-report-${data.days}-days-${data.to.slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
    toast.success("Report saved as a CSV file");
  };
  return (
    <div className="adm-stack" data-testid="reports-page">
      <div className="ap-bar">
        <span className="ap-seg" role="radiogroup" aria-label="Period">
          {SPANS.map((span) => <button key={span} type="button" role="radio" aria-checked={days === span} className={days === span ? "is-on" : undefined} onClick={() => setDays(span)}>{span} days</button>)}
        </span>
        <Btn icon="download" disabled={!r} onClick={() => r && download(r)}>Download CSV</Btn>
      </div>
      {query.isError ? <ErrorState error={query.error} onRetry={() => void query.refetch()} /> : !r ? <Loading height={480} label="Loading the report" /> : <Body r={r} />}
    </div>
  );
}

function Body({ r }: { r: Reports }) {
  const k = r.kpis;
  const requestsChange = change(k.requests, k.previousRequests);
  const collectedChange = change(k.collected, k.previousCollected);
  const cancelledDown = k.cancelledRate != null && k.previousCancelledRate != null ? k.cancelledRate <= k.previousCancelledRate : null;
  const step = Math.max(1, Math.ceil(r.perDay.length / 5));
  const top = r.funnel[0]?.count || 0;
  const mixTop = Math.max(1, ...r.serviceMix.map((row) => row.count));
  const reasonTop = Math.max(1, ...r.cancellations.reasons.map((row) => row.count));
  const heatMax = Math.max(1, ...WEEK.flatMap(([, index]) => Array.from({ length: 12 }, (_, bucket) => (r.busyHours[index]?.[bucket * 2] || 0) + (r.busyHours[index]?.[bucket * 2 + 1] || 0))));
  return (
    <>
      <Kpis cols={6} items={[
        { label: "Requests", value: count(k.requests), note: signed(requestsChange, "vs before"), tone: requestsChange != null && requestsChange >= 0 ? "up" : "down", testId: "kpi-requests" },
        { label: "Completed", value: count(k.completed), note: `${percent(k.completedRate)} of requests` },
        { label: "Average arrival", value: k.averageArrivalMinutes == null ? "—" : Math.round(k.averageArrivalMinutes), unit: k.averageArrivalMinutes == null ? undefined : "min", note: "accept to arrival" },
        { label: "Collected", value: rupeesShort(k.collected), note: signed(collectedChange, "vs before"), tone: collectedChange != null && collectedChange >= 0 ? "up" : "down", testId: "kpi-collected" },
        { label: "ResQNow margin", value: rupeesShort(k.margin), note: k.collected ? `${percent(k.margin / k.collected)} of collected` : "—" },
        { label: "Cancelled", value: percent(k.cancelledRate, 1), note: k.previousCancelledRate == null ? "nothing to compare" : `${cancelledDown ? "down" : "up"} from ${percent(k.previousCancelledRate, 1)}`, tone: cancelledDown ? "up" : "down" },
      ]} />
      <div className="rp-grid">
        <Card title="Requests each day" aside={`${Math.round(k.requests / Math.max(1, r.days))} a day on average`} style={{ gridColumn: "span 2" }} testId="per-day">
          <Columns values={r.perDay.map((row) => row.completed)} stack={r.perDay.map((row) => row.cancelled)} labels={r.perDay.map((row, index) => (index % step === 0 ? shortDate(row.date) : ""))}
            height={200} showValues={false} gap={r.perDay.length > 40 ? 2 : 5} label={`Requests each day: ${count(k.completed)} completed and ${count(k.requests - k.completed)} others`} />
          <div className="ap-legend"><span><i />Completed</span><span><i style={{ background: "#F79009" }} />Cancelled</span></div>
        </Card>
        <Card title="From request to paid" aside="where jobs drop off" testId="funnel">
          <div className="rp-funnel">{r.funnel.map((row, index) => (
            <div key={row.step} className="rp-step"><span>{STEP[row.step] || row.step}</span><div><i style={{ width: `${top ? (row.count / top) * 100 : 0}%` }} /></div><b>{count(row.count)}<small>{index === 0 || !top ? "" : `${Math.round((row.count / top) * 100)}%`}</small></b></div>
          ))}</div>
        </Card>
        <Card title="Busiest hours" aside="darker is busier" testId="busy-hours">
          <div className="rp-heat" role="img" aria-label={busiest(r.busyHours)} style={{ gridTemplateColumns: "34px repeat(12, minmax(0, 1fr))" }}>
            <span />{HOURS.map((hour) => <span key={hour} className="is-h">{hour}</span>)}
            {WEEK.map(([label, index]) => [
              <span key={`${label}-l`}>{label}</span>,
              ...Array.from({ length: 12 }, (_, bucket) => {
                const value = (r.busyHours[index]?.[bucket * 2] || 0) + (r.busyHours[index]?.[bucket * 2 + 1] || 0);
                return <i key={`${label}-${bucket}`} title={`${label} ${HOURS[bucket]}: ${value}`} style={{ opacity: value ? 0.12 + (value / heatMax) * 0.88 : 0.05 }} />;
              }),
            ])}
          </div>
          <p className="ap-faint" style={{ fontSize: 12, fontWeight: 600 }}>{busiest(r.busyHours)}</p>
        </Card>
        <Card title="What people asked for" aside={`${count(k.requests)} requests`} testId="service-mix">
          {r.serviceMix.length ? <HBars label="Requests by service" cols="124px minmax(0,1fr) 40px" items={r.serviceMix.map((row, index) => ({ label: service(row.service), value: count(row.count), fraction: row.count / mixTop, tone: index === 0 ? "ink" : "soft" }))} /> : <p className="ap-faint">No requests yet</p>}
        </Card>
        <Card title="Why requests were cancelled" aside={`${count(r.cancellations.total)} in ${r.days} days`} testId="cancel-reasons">
          {r.cancellations.reasons.length ? <HBars label="Cancellation reasons" cols="150px minmax(0,1fr) 28px" items={r.cancellations.reasons.map((row) => ({ label: row.reason, value: row.count, fraction: row.count / reasonTop, tone: /long|late|wait/i.test(row.reason) ? "warn" : /technician/i.test(row.reason) ? "bad" : "soft" }))} />
            : <p className="ap-faint" style={{ fontSize: 12.5, fontWeight: 600 }}><Icon name="task_alt" /> None cancelled</p>}
        </Card>
      </div>
    </>
  );
}
