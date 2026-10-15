import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { callCommandCenterTechnician, getCommandCenterExceptions, remindCommandCenterTechnician, runCommandCenterMonitorCycle, type CommandCenterJob } from "@/pages/adminExtended/api/adminExtendedApi";
import { getLiveRequests, type MonitorRequest } from "@/pages/adminExtended/api/adminMonitorApi";
import { useAdminEvents } from "@/pages/adminExtended/monitor/adminLive";
import { getAlertRules, getHandledAlerts } from "../api/portalApi";
import { AssignDialog, type AssignTarget } from "../AssignDialog";
import { actionWords, ago, clock, duration, service } from "../format";
import { Btn, Card, Cell, Empty, ErrorState, Icon, Loading, Pill, PillTabs, Row, Table, usePortalHeader } from "../ui";

// Jobs that need a person. The monitor checks every live job on its own; this page lists what it flagged.

const SAY: Record<string, (tech: string) => string> = {
  arrival_delay: (tech) => `${tech} will arrive after the promised time`,
  sla_risk: (tech) => `${tech} is close to the promised time`,
  start_delay: (tech) => `${tech} has not set off yet`,
  gps_inactive: (tech) => `${tech}'s GPS stopped updating`,
  movement_stationary: (tech) => `${tech} has stopped on the way`,
  movement_away: (tech) => `${tech} is moving away from the customer`,
  progress_delay: () => "The work is running long",
  scheduled_start_miss: () => "The scheduled start was missed",
};
const ICON: Record<string, string> = { gps_inactive: "location_off", movement_away: "trending_up", progress_delay: "timer", arrival_delay: "schedule", sla_risk: "schedule" };
const say = (code: string, tech: string, fallback: string) => (SAY[code] ? SAY[code](tech) : fallback);

type Tab = "open" | "handled";

export default function AlertsPage() {
  usePortalHeader("Alerts", "Jobs that need a person. The rest run on their own.");
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("open");
  const [checking, setChecking] = useState(false);
  const [moving, setMoving] = useState<AssignTarget | null>(null);
  const open = useQuery({ queryKey: ["portal", "alerts", "open"], queryFn: getCommandCenterExceptions, refetchInterval: 30_000 });
  const live = useQuery({ queryKey: ["admin", "monitor", "live"], queryFn: getLiveRequests, refetchInterval: 30_000 });
  const handled = useQuery({ queryKey: ["portal", "alerts", "handled"], queryFn: getHandledAlerts, refetchInterval: 60_000 });
  const rules = useQuery({ queryKey: ["portal", "alerts", "rules"], queryFn: getAlertRules, staleTime: 10 * 60_000 });
  useAdminEvents(() => {
    void queryClient.invalidateQueries({ queryKey: ["portal", "alerts"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "monitor", "live"] });
  }, 1_500);

  const checkNow = async () => {
    setChecking(true);
    try {
      const result = await runCommandCenterMonitorCycle();
      toast.success(`Checked ${result.jobsScanned} live job${result.jobsScanned === 1 ? "" : "s"} · ${result.alertsDetected} flagged, ${result.alertsResolved} cleared`);
      await queryClient.invalidateQueries({ queryKey: ["portal", "alerts"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not run the check.");
    } finally {
      setChecking(false);
    }
  };

  const jobs = open.data?.data || [];
  const byId = new Map((live.data?.requests || []).map((request) => [request.id, request]));
  const monitor = open.data?.monitor;
  return (
    <div className="adm-stack" data-testid="alerts-page">
      <div className="ap-bar">
        <PillTabs<Tab> label="Alerts" value={tab} onChange={setTab} items={[
          { key: "open", label: "Open", count: open.data ? jobs.length : null, warn: jobs.length > 0 },
          { key: "handled", label: "Handled today", count: handled.data?.length },
        ]} />
        <div className="ap-row">
          {monitor ? <span className="ap-faint" style={{ fontSize: 12.5, fontWeight: 700 }}>Checked every {Math.round(monitor.intervalMs / 1000)} s{monitor.lastRunAt ? ` · last at ${clock(monitor.lastRunAt)}` : ""}</span> : null}
          <Btn icon="refresh" disabled={checking} onClick={() => void checkNow()}>{checking ? "Checking…" : "Check now"}</Btn>
        </div>
      </div>
      <div className="al-grid">
        <div className="al-main">
          {tab === "open" ? (
            open.isError ? <ErrorState error={open.error} onRetry={() => void open.refetch()} /> : !open.data ? <Loading height={300} label="Loading alerts" /> : jobs.length === 0 ? (
              <Empty icon="task_alt" title="Nothing needs a person right now" sub={monitor?.lastError ? `The last check failed: ${monitor.lastError}` : "Every live job is on track. New alerts show up here on their own."} />
            ) : jobs.map((job) => <AlertCard key={job.requestId} job={job} request={byId.get(job.requestId)} onMove={setMoving} />)
          ) : <Handled data={handled.data} error={handled.error} onRetry={() => void handled.refetch()} />}
          {tab === "open" && handled.data?.length ? <Handled data={handled.data.slice(0, 3)} error={null} onRetry={() => undefined} more={handled.data.length > 3 ? () => setTab("handled") : undefined} /> : null}
        </div>
        <Card title="What we watch for" style={{ gap: 10, alignSelf: "start" }} testId="alert-rules">
          {rules.data ? (
            <>
              <div className="al-rules">
                {rules.data.rules.map((rule) => <div key={rule.code} className="al-rule"><div><b>{rule.label}</b></div><em>{rule.threshold}</em></div>)}
              </div>
              <p className="ad-hint"><Icon name="info" />Every live job is checked every {rules.data.intervalSeconds} s. These limits are set on the server; ask the tech team to change one.</p>
            </>
          ) : rules.isError ? <ErrorState error={rules.error} /> : <Loading height={200} />}
        </Card>
      </div>
      {moving ? <AssignDialog request={moving} onClose={() => setMoving(null)} /> : null}
    </div>
  );
}

function AlertCard({ job, request, onMove }: { job: CommandCenterJob; request: MonitorRequest | undefined; onMove: (target: AssignTarget) => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"call" | "remind" | null>(null);
  const tech = job.technician?.name || "The technician";
  const main = [...job.reasons].sort((a, b) => (a.riskLevel === "red" ? -1 : 0) - (b.riskLevel === "red" ? -1 : 0))[0];
  const high = job.riskLevel === "red";
  const lateBy = job.etaArrival && job.slaDeadline ? Math.round((Date.parse(job.etaArrival) - Date.parse(job.slaDeadline)) / 60_000) : null;
  const gps = request?.live;
  const call = async () => {
    setBusy("call");
    try {
      const result = (await callCommandCenterTechnician({ requestId: job.requestId })) as { dialLink?: string | null };
      const link = result?.dialLink || (job.technician?.phone ? `tel:${job.technician.phone.replace(/\s+/g, "")}` : null);
      if (link) window.location.href = link;
      else toast.error("No phone number on file");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the call.");
    } finally {
      setBusy(null);
    }
  };
  const remind = async () => {
    setBusy("remind");
    try {
      await remindCommandCenterTechnician({ requestId: job.requestId });
      toast.success(`Reminder sent to ${tech}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send the reminder.");
    } finally {
      setBusy(null);
    }
  };
  return (
    <article className={`al-card${high ? "" : " is-med"}`} aria-label={`Alert on request ${job.requestId}`} data-testid={`alert-${job.requestId}`}>
      <div className="al-top">
        <Pill tone={high ? "bad" : "warn"}>{high ? "High" : "Medium"}</Pill>
        <b>#{job.requestId} · {service(job.serviceType)}</b>
        <span className="al-ago">Flagged {clock(job.firstDetectedAt)} · {ago(job.firstDetectedAt)}</span>
      </div>
      <div className="al-say"><Icon name={ICON[main?.code || ""] || "warning"} />{main ? say(main.code, tech, main.text) : "Needs a look"}</div>
      <div className="al-facts">
        <div><span>Customer</span><b>{request?.customer.name || "—"}</b><small>{request?.createdAt ? `waiting ${duration((Date.now() - Date.parse(request.createdAt)) / 60_000)}` : ""}{job.customerLocation?.address ? ` · ${job.customerLocation.address}` : ""}</small></div>
        <div><span>Arrival now</span><b className={lateBy != null && lateBy > 0 ? "is-warn" : undefined}>{job.etaArrival ? clock(job.etaArrival) : job.etaMinutes != null ? `${job.etaMinutes} min` : "—"}</b><small>{job.slaDeadline ? `deadline ${clock(job.slaDeadline)}${lateBy != null && lateBy > 0 ? ` · ${lateBy} min late` : ""}` : "no deadline"}</small></div>
        <div><span>Last GPS</span><b>{gps?.lastSeenAt ? ago(gps.lastSeenAt) : "—"}</b><small>{!gps ? "no position" : gps.gpsStale ? "not updating" : gps.speedKmh != null && gps.speedKmh < 2 ? "standing still" : gps.speedKmh != null ? `${Math.round(gps.speedKmh)} km/h` : "moving"}</small></div>
        <div><span>Distance left</span><b>{gps?.distanceKm != null ? `${gps.distanceKm} km` : "—"}</b><small>{gps?.distanceSource === "route" ? "by road" : gps?.distanceSource === "straight" ? "in a straight line" : ""}</small></div>
      </div>
      {job.reasons.length > 1 ? <div className="al-trail"><Icon name="history" />Also: {job.reasons.filter((reason) => reason !== main).map((reason) => say(reason.code, tech, reason.text)).join(" · ")}</div> : null}
      <div className="al-acts">
        <Btn size="sm" icon="call" disabled={busy === "call"} onClick={() => void call()}>Call {tech.split(" ")[0]}</Btn>
        <Btn size="sm" icon="notifications" disabled={busy === "remind"} onClick={() => void remind()}>Send a reminder</Btn>
        <Btn size="sm" icon="swap_horiz" onClick={() => onMove({ id: job.requestId, service: job.serviceType, customer: request?.customer.name || null, address: job.customerLocation?.address || null, technicianId: job.technician?.id ?? null, technicianName: job.technician?.name ?? null })}>Reassign</Btn>
        <Btn size="sm" variant="dark" icon="monitoring" onClick={() => navigate(`/admin/live?open=${job.requestId}`)}>Open monitor</Btn>
      </div>
    </article>
  );
}

function Handled({ data, error, onRetry, more }: { data: Awaited<ReturnType<typeof getHandledAlerts>> | undefined; error: unknown; onRetry: () => void; more?: () => void }) {
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (!data) return <Loading height={160} />;
  if (!data.length) return <Empty icon="inbox" title="Nothing handled yet today" />;
  const cols = "72px 70px minmax(0,1fr) minmax(0,1.3fr) 120px";
  return (
    <Table label="Handled today" testId="handled-alerts" cols={cols} minWidth={640} head={["When", "Request", "What happened", "How it was handled", "By"]}
      foot={more ? <><span>Showing {data.length} handled today</span><Btn size="sm" onClick={more}>See all</Btn></> : undefined}>
      {data.map((row) => (
        <Row key={row.id} cols={cols} tight>
          <Cell className="ap-num ap-faint">{clock(row.resolvedAt)}</Cell>
          <Cell className="ap-strong">#{row.requestId}</Cell>
          <Cell>{SAY[row.code] ? say(row.code, row.technician || "The technician", row.text) : row.text}</Cell>
          <Cell>{row.actions.length ? row.actions.map((action) => actionWords(action.type).label).join(" · ") : "Cleared by itself"}</Cell>
          <Cell className={row.actions.length ? undefined : "ap-faint"}>{row.actions.length ? [...new Set(row.actions.map((action) => action.by))].join(", ") : "Auto"}</Cell>
        </Row>
      ))}
    </Table>
  );
}
