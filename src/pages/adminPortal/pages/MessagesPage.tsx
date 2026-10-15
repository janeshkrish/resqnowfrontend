import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { listAudit, listTechnicians, sendAnnouncement, sendToTechnicians, sendUrgent, type TechnicianRow, type TechnicianTab } from "../api/portalApi";
import { actionWords, clock, day, initials, service } from "../format";
import { Btn, Card, Cell, Check, Empty, ErrorState, Icon, Loading, Note, Radio, Row, SearchBox, Select, Table, Two, usePortalHeader } from "../ui";

// Tell technicians something. Urgent ones also make a sound. Every message is saved in the audit log.

type Who = "all" | "filter" | "pick";
type Kind = "announcement" | "urgent";
const MAX = 240;
const SERVICES = [
  { value: "", label: "All services" }, { value: "tow", label: "Towing" }, { value: "flat", label: "Flat tyre" }, { value: "battery", label: "Battery" },
  { value: "fuel", label: "Fuel delivery" }, { value: "lock", label: "Lockout" }, { value: "mechanic", label: "Mechanical" }, { value: "charg", label: "EV charging" }, { value: "winch", label: "Winching" },
];
const STATES: { value: TechnicianTab; label: string }[] = [{ value: "all", label: "Everyone approved" }, { value: "on_duty", label: "On duty now" }, { value: "on_job", label: "On a job" }, { value: "offline", label: "Offline" }];

async function everyTechnician(tab: TechnicianTab, serviceKey: string) {
  const rows: TechnicianRow[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const chunk = await listTechnicians({ tab, service: serviceKey || undefined, page, limit: 100 });
    rows.push(...chunk.rows);
    if (page >= chunk.totalPages) break;
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

export default function MessagesPage() {
  usePortalHeader("Messages", "Tell technicians something. Urgent ones also make a sound.");
  const queryClient = useQueryClient();
  const [who, setWho] = useState<Who>("all");
  const [kind, setKind] = useState<Kind>("announcement");
  const [serviceKey, setServiceKey] = useState("");
  const [state, setState] = useState<TechnicianTab>("on_duty");
  const [picked, setPicked] = useState<number[]>([]);
  const [find, setFind] = useState("");
  const [pasted, setPasted] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const everyone = useQuery({ queryKey: ["portal", "messages", "techs", "all", ""], queryFn: () => everyTechnician("all", "") });
  const filtered = useQuery({ queryKey: ["portal", "messages", "techs", state, serviceKey], queryFn: () => everyTechnician(state, serviceKey), enabled: who === "filter" });
  const history = useQuery({ queryKey: ["portal", "messages", "history"], queryFn: () => listAudit({ group: "messages", days: 90 }) });
  useEffect(() => { if (kind === "urgent") setWho("all"); }, [kind]);
  useEffect(() => { setConfirm(false); }, [who, kind, title, message, picked, state, serviceKey]);

  const pastedIds = useMemo(() => [...new Set(pasted.split(/[^0-9]+/).filter(Boolean).map(Number).filter((id) => id > 0))], [pasted]);
  const pickIds = [...new Set([...picked, ...pastedIds])];
  const targets = who === "all" ? null : who === "filter" ? (filtered.data || []).map((row) => row.id) : pickIds;
  const reach = who === "all" ? everyone.data?.length ?? null : targets?.length ?? 0;
  const ready = title.trim() && message.trim() && message.length <= MAX && (who === "all" || (targets && targets.length > 0));
  const nameOf = (id: number) => everyone.data?.find((row) => row.id === id)?.name || `#${id}`;
  const list = (everyone.data || []).filter((row) => !find.trim() || [row.name, row.owner, String(row.id), row.phoneMasked].some((value) => String(value || "").toLowerCase().includes(find.trim().toLowerCase())));

  const send = async () => {
    setSending(true);
    try {
      const result = kind === "urgent" ? await sendUrgent(title.trim(), message.trim())
        : who === "all" ? await sendAnnouncement(title.trim(), message.trim())
        : await sendToTechnicians(title.trim(), message.trim(), targets || []);
      toast.success(`Sent to ${result.payload.targetCount} technician${result.payload.targetCount === 1 ? "" : "s"}`);
      setTitle("");
      setMessage("");
      setPicked([]);
      setPasted("");
      await queryClient.invalidateQueries({ queryKey: ["portal", "messages", "history"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send.");
    } finally {
      setSending(false);
      setConfirm(false);
    }
  };

  return (
    <div className="adm-stack" data-testid="messages-page">
      <div className="ms-grid">
        <Card title="New message" style={{ gap: 12 }} testId="composer">
          <div className="ap-row" style={{ flexWrap: "wrap" }}>
            <span className="ap-cap" style={{ width: 64 }}>Send to</span>
            <span className="ap-seg" role="radiogroup" aria-label="Who">
              {([["all", "All technicians", "engineering"], ["filter", "By filter", "tune"], ["pick", "Pick technicians", "checklist"]] as [Who, string, string][]).map(([key, label, icon]) => (
                <button key={key} type="button" role="radio" aria-checked={who === key} disabled={kind === "urgent" && key !== "all"} className={who === key ? "is-on" : undefined} onClick={() => setWho(key)}><Icon name={icon} />{label}</button>
              ))}
            </span>
            <span className="ms-reach" data-testid="reach"><Icon name="check_circle" />{reach == null ? "Counting…" : `Reaches ${reach} technician${reach === 1 ? "" : "s"}`}</span>
          </div>
          {who === "filter" ? (
            <div className="ap-filters" style={{ flexWrap: "wrap" }}>
              <Select label="Service" icon="build" value={serviceKey} onChange={setServiceKey} options={SERVICES} />
              <Select<TechnicianTab> label="Who" icon="schedule" value={state} onChange={setState} options={STATES} />
              {filtered.isFetching ? <span className="ap-faint" style={{ fontSize: 12.5 }}>Counting…</span> : null}
            </div>
          ) : null}
          {who === "pick" ? (
            <>
              {pickIds.length ? <div className="ex-tags" aria-label="Chosen">{pickIds.map((id) => <span key={id}>{nameOf(id)} #{id}<button type="button" aria-label={`Remove ${nameOf(id)}`} onClick={() => { setPicked(picked.filter((item) => item !== id)); setPasted(pastedIds.filter((item) => item !== id).join(", ")); }}><Icon name="close" /></button></span>)}</div> : null}
              <div className="ex-pick" data-testid="picker">
                <div className="ex-pick-row is-head">
                  <Check on={list.length > 0 && list.every((row) => picked.includes(row.id))} label="Select all shown" onChange={(on) => setPicked(on ? [...new Set([...picked, ...list.map((row) => row.id)])] : picked.filter((id) => !list.some((row) => row.id === id)))} />
                  <span style={{ flex: "1 1 auto" }}>Select all {list.length}</span>
                  <SearchBox value={find} onChange={setFind} placeholder="Name, ID or phone" style={{ maxWidth: 220, height: 32 }} />
                </div>
                {everyone.isLoading ? <Loading height={120} /> : list.slice(0, 50).map((row) => (
                  <div key={row.id} className="ex-pick-row">
                    <Check on={picked.includes(row.id)} label={`Pick ${row.name}`} onChange={(on) => setPicked(on ? [...picked, row.id] : picked.filter((id) => id !== row.id))} />
                    <span className="ap-who"><span className="ap-av is-sm" aria-hidden="true">{initials(row.name)}</span><div><b>{row.name}</b><span>#{row.id} · {row.services.map(service).join(", ").toLowerCase()}</span></div></span>
                    <small>{row.now.state === "on_job" ? "On a job" : row.now.state === "free" ? "On duty" : "Offline"}</small>
                  </div>
                ))}
              </div>
              <div className="ap-field"><label htmlFor="msg-ids">Or paste technician IDs</label><input id="msg-ids" value={pasted} placeholder="7, 12, 18, 34" onChange={(event) => setPasted(event.target.value)} /><small>As the old Notifications page took them.</small></div>
            </>
          ) : null}
          <div className="ms-two">
            <div className={`ms-kind${kind === "announcement" ? " is-on" : ""}`}><Radio on={kind === "announcement"} name="kind" onChange={() => setKind("announcement")}><span style={{ display: "flex", flexDirection: "column", gap: 1 }}><b>Announcement</b><span>A normal notification in the Partner app</span></span></Radio></div>
            <div className={`ms-kind is-urgent${kind === "urgent" ? " is-on" : ""}`}><Radio on={kind === "urgent"} name="kind" onChange={() => setKind("urgent")}><span style={{ display: "flex", flexDirection: "column", gap: 1 }}><b>Urgent</b><span>Plays a sound · goes to every technician</span></span></Radio></div>
          </div>
          <div className="ap-field"><label htmlFor="msg-title">Title</label><input id="msg-title" value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="For example: heavy rain on Avinashi Road tonight" /></div>
          <div className="ap-field"><label htmlFor="msg-body">Message <span className="ms-count" style={{ float: "right", color: message.length > MAX ? "#B42318" : undefined }}>{message.length} of {MAX}</span></label><textarea id="msg-body" value={message} onChange={(event) => setMessage(event.target.value)} /></div>
          {kind === "urgent" ? <Note tone="warn" icon="campaign">Urgent messages make a sound on every technician's phone. Keep them for real emergencies.</Note> : null}
          <div className="ap-row" style={{ justifyContent: "flex-end", gap: 8 }}>
            {confirm ? <><Btn onClick={() => setConfirm(false)}>Not yet</Btn><Btn variant="hot" icon="send" disabled={sending} onClick={() => void send()}>{sending ? "Sending…" : `Yes, send to ${reach ?? "all"}`}</Btn></>
              : <Btn variant="hot" icon="send" disabled={!ready} onClick={() => setConfirm(true)}>Send to {reach ?? "all"} technician{reach === 1 ? "" : "s"}</Btn>}
          </div>
        </Card>
        <Card title="How it looks" aside="On a technician's phone" style={{ gap: 10 }}>
          <div className="ms-phone">
            <div className="ms-clock"><span>{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</span><b>{clock(new Date().toISOString()).replace(/\s?[ap]m$/i, "")}</b></div>
            <div className="ms-note"><img src="/images/resqnow-wordmark.png" alt="" /><div><small><span>RESQNOW PARTNER</span><span>now</span></small><b>{title || "Your title"}</b><span>{message ? (message.length > 110 ? `${message.slice(0, 110)}…` : message) : "Your message"}</span></div></div>
          </div>
        </Card>
      </div>
      {history.isError ? <ErrorState error={history.error} /> : !history.data ? <Loading height={160} /> : history.data.rows.length === 0 ? <Empty icon="campaign" title="No messages sent in the last 90 days" /> : (
        <Table label="Sent messages" testId="sent" cols="130px minmax(0,1.6fr) minmax(0,1fr) 120px" minWidth={600} head={["Sent", "Title", "To", "By"]}
          foot={<span>{history.data.rows.length} of {history.data.total} in the last 90 days</span>}>
          {history.data.rows.map((row) => {
            const meta = row.metadata || {};
            const to = row.type === "technicianBroadcast" ? (row.targetId === "all_technicians" ? "All technicians" : `${Number(meta.technicianCount) || String(row.targetId || "").split(",").length} chosen technicians`) : "All technicians";
            return (
              <Row key={row.id} cols="130px minmax(0,1.6fr) minmax(0,1fr) 120px" tight>
                <Cell><Two top={`${day(row.at)} ${clock(row.at)}`} bottom={row.type === "emergencyMessage" ? "Urgent" : "Announcement"} tone={row.type === "emergencyMessage" ? "bad" : undefined} /></Cell>
                <Cell className="ap-strong">{String(meta.title || actionWords(row.type).label)}</Cell>
                <Cell>{to}</Cell>
                <Cell>{row.by.split("@")[0]}</Cell>
              </Row>
            );
          })}
        </Table>
      )}
    </div>
  );
}
