import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { getTechnicianJobs, getTechnicianRecord, getTechnicianReviews, type TechnicianRecord } from "../api/adminMonitorApi";
import { useAdminEvents } from "./adminLive";
import { clock, dayAndTime, initials, money, PHASE_LABEL, service } from "./monitorFormat";
import RequestMonitorPanel from "./RequestMonitorPanel";

type Tab = "overview" | "jobs" | "reliability" | "reviews";

const pct = (value: number | null | undefined) => (value == null ? "—" : `${Math.round(value * 100)}%`);
const stars = (n: number | null | undefined) => (n == null ? "" : "★".repeat(Math.round(n)) + "☆".repeat(Math.max(0, 5 - Math.round(n))));
const share = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : "0%");

function Kpi({ label, value, note, noteCls = "" }: { label: string; value: string; note: string; noteCls?: string }) {
  return (
    <div className="at-kpi">
      <span>{label}</span>
      <b>{value}</b>
      <small className={noteCls}>{note}</small>
    </div>
  );
}

function Bar({ label, n, of, cls = "", suffix }: { label: string; n: number; of: number; cls?: string; suffix?: string }) {
  return (
    <div className="at-fun">
      <span>{label}</span>
      <div><i className={cls} style={{ width: share(n, of) }} /></div>
      <b>{n}<small>{suffix ?? (of ? share(n, of) : "")}</small></b>
    </div>
  );
}

function Overview({ record, go }: { record: TechnicianRecord; go: (tab: Tab) => void }) {
  const k = record.kpis;
  const max = Math.max(5, ...record.weekly.map((w) => w.jobs));
  const top = Math.ceil(max / 5) * 5;
  const answered = k.offers.accepted + k.offers.declined + k.offers.expired;
  return (
    <div className="adm-stack">
      <div className="at-kpis">
        <Kpi label="Jobs completed" value={String(k.jobsCompleted)} note={`${k.jobsThisWeek} this week · ${k.jobsLastWeek} last week`} noteCls={k.jobsThisWeek >= k.jobsLastWeek ? "is-up" : ""} />
        <Kpi label="Offers accepted" value={pct(k.acceptanceRate)} note={`${k.offers.accepted} of ${answered} answered offers`} />
        <Kpi label="Taken off by an admin" value={String(k.removedByAdmin)} note="jobs reassigned to someone else" noteCls={k.removedByAdmin ? "is-warn" : ""} />
        <Kpi label="On-time arrival" value={pct(k.onTimeRate)} note={k.arrivalsJudged ? `${k.arrivalsJudged} arrivals judged against the promise` : "no arrivals recorded yet"} />
        <Kpi label="Average time to arrive" value={k.averageMinutesToArrive != null ? `${k.averageMinutesToArrive} min` : "—"} note={k.arrivalsMeasured ? `from accepting · ${k.arrivalsMeasured} jobs` : "no arrivals recorded yet"} />
        <Kpi label="Rating" value={k.rating != null ? k.rating.toFixed(1) : "—"} note={`${k.ratingCount} reviews${k.lowRatings ? ` · ${k.lowRatings} low` : ""}`} noteCls={k.lowRatings ? "is-warn" : ""} />
        <Kpi label="Earned this month" value={money(k.earnedThisMonth)} note={`${money(k.earnedTotal)} since joining`} />
        <Kpi label="Dues to ResQNow" value={money(k.duesOwed)} note={k.duesOwed ? "pending" : "nothing owed"} noteCls={k.duesOwed ? "is-warn" : "is-up"} />
      </div>
      <div className="at-grid2">
        <div className="at-card">
          <p className="at-h"><b>Jobs completed per week</b><span>Last 12 weeks · {record.weekly.reduce((a, w) => a + w.jobs, 0)} jobs</span></p>
          <div className="at-chart" role="img" aria-label={`Jobs per week: ${record.weekly.map((w) => w.jobs).join(", ")}`}>
            <div className="at-axis" aria-hidden="true">{[top, (top * 3) / 4, top / 2, top / 4, 0].map((v) => <span key={v}>{Math.round(v)}</span>)}</div>
            <div className="at-plot">
              {record.weekly.map((w, i) => (
                <div key={w.weekStart} className={`at-bar${i === record.weekly.length - 1 ? " is-now" : ""}`}>
                  <b style={{ bottom: `calc(${(w.jobs / top) * 100}% + 2px)` }}>{w.jobs}</b>
                  <i style={{ height: `${(w.jobs / top) * 100}%` }} />
                  <span>{i % 2 ? "" : new Date(w.weekStart).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="at-card">
          <p className="at-h"><b>Needs a look</b><span>{record.flags.length ? `${record.flags.length} now` : "Nothing now"}</span></p>
          <div className="at-flags">
            {record.flags.length === 0 ? <p className="am-muted">No late arrivals this week, no low reviews this month, no missed offers.</p> : null}
            {record.flags.map((flag, i) => (
              <div key={i} className={`at-flag${flag.kind === "review" ? " is-bad" : flag.kind === "expired" ? " is-info" : ""}`}>
                <MaterialSymbol name={flag.kind === "late" ? "schedule" : flag.kind === "review" ? "thumb_down" : "do_not_disturb_on"} />
                <div><b>{flag.title}</b><span>{flag.text}</span></div>
                <button type="button" className="at-btn is-sm" onClick={() => go(flag.tab)}>See</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Jobs({ technicianId, onOpen }: { technicianId: number; onOpen: (id: number) => void }) {
  const [page, setPage] = useState(1);
  const [days, setDays] = useState<number | null>(30);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const jobs = useQuery({ queryKey: ["admin", "monitor", "tech-jobs", technicianId, page, days, status, search], queryFn: () => getTechnicianJobs(technicianId, { page, limit: 12, days, status, search }) });
  const rows = jobs.data?.data ?? [];
  const p = jobs.data?.pagination;
  return (
    <div className="adm-stack">
      <div className="at-filters">
        <select className="at-filter" value={days ?? ""} onChange={(e) => { setDays(e.target.value ? Number(e.target.value) : null); setPage(1); }} aria-label="Period">
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="">All time</option>
        </select>
        <select className="at-filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Status">
          <option value="all">All statuses</option>
          <option value="done">Completed</option>
          <option value="active">On now</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <label className="at-filter is-grow"><MaterialSymbol name="search" /><input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Request number or customer" aria-label="Search jobs" /></label>
      </div>
      <div className="at-table" role="table" aria-label="Job history">
        <div className="at-tr is-jobs is-head" role="row"><span>When</span><span>Request</span><span>Customer</span><span>Service</span><span>Distance</span><span>Promised → arrived</span><span>Work</span><span>Fare</span><span>Payment</span><span>Rating</span><span>Status</span></div>
        {jobs.isLoading ? <p className="am-empty">Loading jobs…</p> : null}
        {!jobs.isLoading && rows.length === 0 ? <p className="am-empty">No jobs in this view.</p> : null}
        {rows.map((j) => {
          const active = !["done", "cancelled", "payment_due"].includes(j.phase);
          return (
            <div key={j.id} className="at-tr is-jobs" role="row">
              <span className="is-faint">{dayAndTime(j.createdAt)}</span>
              <span className="is-strong is-num">{active ? <button type="button" className="at-link" onClick={() => onOpen(j.id)}>#{j.id}</button> : <Link to={`/admin/extended/requests/${j.id}/replay`}>#{j.id}</Link>}</span>
              <span>{j.customer}</span>
              <span>{service(j.serviceType)}</span>
              <span className="is-num">{j.distanceKm != null ? `${j.distanceKm} km` : "—"}</span>
              <span className={j.lateMinutes != null ? (j.lateMinutes > 0 ? "is-warn" : "is-ok") : "is-faint"}>
                {j.promisedAt || j.arrivedAt ? `${clock(j.promisedAt)} → ${j.arrivedAt ? clock(j.arrivedAt) : "—"}${j.lateMinutes ? ` · ${j.lateMinutes} late` : ""}` : "—"}
              </span>
              <span className="is-num">{j.workMinutes != null ? `${j.workMinutes} min` : "—"}</span>
              <span className="is-strong is-num">{money(j.fare)}</span>
              <span className="is-faint">{[j.paymentMethod, j.paymentStatus].filter(Boolean).join(", ") || "—"}</span>
              <span className={j.rating != null && j.rating <= 2 ? "is-warn is-num" : "is-strong is-num"}>{j.rating != null ? `${j.rating} ★` : "—"}</span>
              <span><span className={`at-pill${j.phase === "done" ? " is-ok" : j.phase === "cancelled" ? " is-warn" : ""}`}>{PHASE_LABEL[j.phase]}</span></span>
            </div>
          );
        })}
        {p ? (
          <div className="at-foot">
            <span>{p.total ? `${(p.page - 1) * p.limit + 1}–${Math.min(p.total, p.page * p.limit)} of ${p.total}` : "0 jobs"}</span>
            <span className="at-pager">
              <button type="button" className="at-btn is-sm" disabled={p.page <= 1} onClick={() => setPage(p.page - 1)}>Previous</button>
              <button type="button" className="at-btn is-sm" disabled={p.page >= p.totalPages} onClick={() => setPage(p.page + 1)}>Next</button>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Reliability({ record, onOpen }: { record: TechnicianRecord; onOpen: (id: number) => void }) {
  const r = record.reliability;
  const sent = r.offers.sent;
  const judged = r.arrivalsJudged;
  const maxAlerts = Math.max(1, ...r.alerts.map((a) => a.count));
  return (
    <div className="at-grid2 is-even">
      <div className="at-card">
        <p className="at-h"><b>Offers and cancellations</b><span>Since joining · {sent} offers</span></p>
        <div className="at-funnel">
          <Bar label="Offers sent" n={sent} of={sent} cls="is-soft" suffix="" />
          <Bar label="Accepted" n={r.offers.accepted} of={sent} />
          <Bar label="Declined" n={r.offers.declined} of={sent} cls="is-soft" />
          <Bar label="Let expire" n={r.offers.expired} of={sent} cls="is-warn" />
          <Bar label="Taken off by an admin" n={r.removedByAdmin.length} of={Math.max(r.offers.accepted, r.removedByAdmin.length)} cls="is-bad" suffix="" />
          <Bar label="Customer cancelled" n={r.customerCancelled.length} of={Math.max(r.offers.accepted, r.customerCancelled.length)} cls="is-soft" suffix="" />
        </div>
        <div className="at-table" role="table" aria-label="Cancellations">
          <div className="at-tr is-cancel is-head" role="row"><span>When</span><span>Request</span><span>Who</span><span>Reason</span></div>
          {r.customerCancelled.length + r.removedByAdmin.length === 0 ? <p className="am-empty">No cancellations or removals.</p> : null}
          {[...r.customerCancelled.map((c) => ({ ...c, who: "Customer" })), ...r.removedByAdmin.map((c) => ({ ...c, who: "Admin", reason: "Reassigned to another technician", serviceType: null }))]
            .sort((a, b) => String(b.at).localeCompare(String(a.at)))
            .slice(0, 8)
            .map((c) => (
              <div key={`${c.who}-${c.requestId}`} className="at-tr is-cancel" role="row">
                <span className="is-faint">{dayAndTime(c.at)}</span>
                <span className="is-strong is-num"><Link to={`/admin/extended/requests/${c.requestId}/replay`}>#{c.requestId}</Link></span>
                <span><span className={`at-pill${c.who === "Admin" ? " is-bad" : ""}`}>{c.who}</span></span>
                <span>{c.reason || "No reason given"}</span>
              </div>
            ))}
        </div>
      </div>
      <div className="at-card">
        <p className="at-h"><b>Arrivals and delays</b><span>{judged} arrivals judged against the promise</span></p>
        <div className="at-funnel">
          <Bar label="On time" n={r.arrivals.onTime} of={judged} />
          <Bar label="1 to 5 min late" n={r.arrivals.late1to5} of={judged} cls="is-warn" />
          <Bar label="6 to 10 min late" n={r.arrivals.late6to10} of={judged} cls="is-warn" />
          <Bar label="Over 10 min late" n={r.arrivals.lateOver10} of={judged} cls="is-bad" />
        </div>
        <p className="at-h"><b>Command-centre alerts</b><span>Since {new Date(r.alertsSince).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></p>
        <div className="at-funnel">
          {r.alerts.filter((a) => a.count > 0 || ["arrival_delay", "start_delay", "gps_inactive", "movement_stationary"].includes(a.code)).map((a) => (
            <div key={a.code} className="at-fun"><span>{a.label}</span><div><i className="is-warn" style={{ width: `${(a.count / maxAlerts) * 100}%` }} /></div><b>{a.count}</b></div>
          ))}
        </div>
        <div className="at-table" role="table" aria-label="Late arrivals">
          <div className="at-tr is-late is-head" role="row"><span>Request</span><span>Due → in</span><span>Late</span><span>Job</span></div>
          {r.late.length === 0 ? <p className="am-empty">No late arrivals recorded.</p> : null}
          {r.late.map((l) => (
            <div key={l.requestId} className="at-tr is-late" role="row">
              <span><button type="button" className="at-link" onClick={() => onOpen(l.requestId)}>#{l.requestId}</button> <span className="is-faint">{dayAndTime(l.arrivedAt).split(" ")[0]}</span></span>
              <span className="is-num">{clock(l.promisedAt)} → {clock(l.arrivedAt)}</span>
              <span className="is-warn is-num">{l.lateMinutes} min</span>
              <span>{service(l.serviceType)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Reviews({ record, technicianId }: { record: TechnicianRecord; technicianId: number }) {
  const [page, setPage] = useState(1);
  const reviews = useQuery({ queryKey: ["admin", "monitor", "tech-reviews", technicianId, page], queryFn: () => getTechnicianReviews(technicianId, { page, limit: 10 }) });
  const total = record.reviews.count;
  const p = reviews.data?.pagination;
  return (
    <div className="at-grid2 is-reviews">
      <div className="at-card">
        <div className="at-score"><b>{record.reviews.average != null ? record.reviews.average.toFixed(1) : "—"}</b><div><span className="at-stars">{stars(record.reviews.average)}</span><span>{total} review{total === 1 ? "" : "s"}</span></div></div>
        <div className="at-dist">
          {record.reviews.distribution.map((d) => (
            <div key={d.stars}><span>{d.stars}★</span><div><i style={{ width: share(d.count, total) }} /></div><b>{d.count}</b></div>
          ))}
        </div>
      </div>
      <div className="at-reviews">
        {reviews.isLoading ? <p className="am-empty">Loading reviews…</p> : null}
        {!reviews.isLoading && (reviews.data?.data.length ?? 0) === 0 ? <p className="am-empty">No reviews yet.</p> : null}
        {(reviews.data?.data ?? []).map((r) => (
          <div key={r.id} className={`at-review${r.rating != null && r.rating <= 2 ? " is-low" : ""}`}>
            <div className="at-review-top">
              <span className="at-stars">{stars(r.rating)}</span>
              <b>{r.customer}</b>
              <span>{[dayAndTime(r.createdAt), service(r.serviceType), r.requestId ? `#${r.requestId}` : null].filter(Boolean).join(" · ")}</span>
            </div>
            <p className={r.comment ? "" : "is-empty"}>{r.comment || "No comment left"}</p>
          </div>
        ))}
        {p && p.totalPages > 1 ? (
          <div className="at-pager">
            <button type="button" className="at-btn is-sm" disabled={p.page <= 1} onClick={() => setPage(p.page - 1)}>Newer</button>
            <span>Page {p.page} of {p.totalPages}</span>
            <button type="button" className="at-btn is-sm" disabled={p.page >= p.totalPages} onClick={() => setPage(p.page + 1)}>Older</button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function TechnicianRecordPage() {
  const params = useParams();
  const technicianId = Number(params.technicianId);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("overview");
  const [openId, setOpenId] = useState<number | null>(null);
  const record = useQuery({ queryKey: ["admin", "monitor", "tech", technicianId], queryFn: () => getTechnicianRecord(technicianId), enabled: Number.isInteger(technicianId) && technicianId > 0, refetchInterval: 60_000 });
  // Any request or payment change can move these numbers; refresh at most every 5 seconds.
  useAdminEvents(() => void queryClient.invalidateQueries({ queryKey: ["admin", "monitor", "tech"] }), 5_000);
  const data = record.data;
  const t = data?.technician;
  const tabs: Array<{ key: Tab; label: string; n?: number }> = [
    { key: "overview", label: "Overview" },
    { key: "jobs", label: "Jobs", n: data?.kpis.jobsCompleted },
    { key: "reliability", label: "Cancellations and delays", n: data ? data.kpis.removedByAdmin + data.kpis.customerCancelledAfterAccepting : undefined },
    { key: "reviews", label: "Reviews", n: data?.kpis.ratingCount },
  ];
  return (
    <section className="at" data-testid="technician-record">
      {record.isError ? <p className="am-error" role="alert">{(record.error as Error).message}</p> : null}
      {record.isLoading ? <p className="am-empty">Loading the record…</p> : null}
      {t && data ? (
        <>
          <div className="at-who">
            <span className="at-face" aria-hidden="true">{initials(t.name)}</span>
            <div className="at-id">
              <span className="at-name"><h1>{t.name}</h1>{t.status === "approved" || t.status === "verified" ? <MaterialSymbol name="verified" /> : null}</span>
              <span className="at-meta">
                <span className={t.onDuty ? "at-duty" : "at-duty is-off"}><i aria-hidden="true" />{t.onDuty ? (t.currentRequestId ? `On duty · on job #${t.currentRequestId}` : "On duty · free") : "Off duty"}</span>
                {t.serviceType ? <span><MaterialSymbol name="build" />{service(t.serviceType)}</span> : null}
                {t.place ? <span><MaterialSymbol name="location_on" />{t.place}</span> : null}
                {t.joinedAt ? <span><MaterialSymbol name="calendar_month" />Joined {new Date(t.joinedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</span> : null}
                {t.phoneMasked ? <span><MaterialSymbol name="call" />{t.phoneMasked}</span> : null}
              </span>
            </div>
            <div className="at-btns">
              {t.currentRequestId ? <button type="button" className="at-btn" onClick={() => setOpenId(t.currentRequestId)}><MaterialSymbol name="monitoring" />Live job</button> : null}
              {t.phone ? <a className="at-btn" href={`tel:${t.phone.replace(/\s+/g, "")}`}><MaterialSymbol name="call" />Call</a> : null}
              <Link className="at-btn" to={`/admin/extended/technicians/${t.id}/activity`}><MaterialSymbol name="schedule" />Log-in activity</Link>
            </div>
          </div>
          <nav className="at-tabs" aria-label="Technician record">
            {tabs.map((x) => (
              <button key={x.key} type="button" className={`at-tab${tab === x.key ? " is-on" : ""}`} aria-current={tab === x.key ? "page" : undefined} onClick={() => setTab(x.key)}>
                {x.label}
                {x.n != null ? <i>{x.n}</i> : null}
              </button>
            ))}
          </nav>
          {tab === "overview" ? <Overview record={data} go={setTab} /> : null}
          {tab === "jobs" ? <Jobs technicianId={technicianId} onOpen={setOpenId} /> : null}
          {tab === "reliability" ? <Reliability record={data} onOpen={setOpenId} /> : null}
          {tab === "reviews" ? <Reviews record={data} technicianId={technicianId} /> : null}
        </>
      ) : null}
      {openId != null ? <RequestMonitorPanel requestId={openId} onClose={() => setOpenId(null)} /> : null}
    </section>
  );
}
