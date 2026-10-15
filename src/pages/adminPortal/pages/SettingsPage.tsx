import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { getPortalSettings, listEmailTemplates, saveEmailTemplate, type EmailTemplate } from "../api/portalApi";
import { dateLong } from "../format";
import { Btn, Card, Empty, ErrorState, Icon, Loading, Note, Pill, usePortalHeader } from "../ui";

// How the platform works for everyone: the real values in use, and the emails it sends.

const SAMPLE: Record<string, string> = {
  name: "Asha", requestId: "5502", serviceType: "commercial lockout", technicianName: "Arun Kumar", address: "Bharathi Nagar, Coimbatore", fare: "₹110",
  amount: "₹110", trackingLink: "https://www.resqnow.org", reason: "Documents checked", utr: "429115306712",
};
const words = (eventType: string) => eventType.toLowerCase().replace(/_/g, " ").replace(/^\w/, (letter) => letter.toUpperCase());
const fill = (text: string) => text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => SAMPLE[key] ?? `[${key}]`);
const tokensIn = (text: string) => [...new Set([...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((match) => match[1]))];

export default function SettingsPage({ section }: { section: "general" | "emails" }) {
  usePortalHeader("Settings", "How the platform works for everyone.");
  return (
    <div className="st-grid" data-testid="settings-page">
      <nav className="st-nav" aria-label="Settings">
        <Link to="/admin/settings" className={section === "general" ? "is-on" : undefined} aria-current={section === "general" ? "page" : undefined}><Icon name="tune" />General, dispatch and alerts</Link>
        <Link to="/admin/settings/emails" className={section === "emails" ? "is-on" : undefined} aria-current={section === "emails" ? "page" : undefined}><Icon name="mail" />Email templates</Link>
      </nav>
      {section === "general" ? <General /> : <Emails />}
    </div>
  );
}

function General() {
  const query = useQuery({ queryKey: ["portal", "settings"], queryFn: getPortalSettings });
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const s = query.data;
  if (!s) return <Loading height={360} label="Loading settings" />;
  const row = (title: string, sub: string, value: string, testId?: string) => <div className="st-row" data-testid={testId}><div><b>{title}</b><span>{sub}</span></div><em>{value}</em></div>;
  return (
    <div className="st-body">
      <div className="ap-grid" style={{ gap: 16, alignContent: "start" }}>
        <Card title="General" style={{ gap: 4 }}>
          {row("Platform name", "Shown in the apps and emails", "ResQNow")}
          {row("Admin sign-in", "The account this portal signs in with", s.admin.email || "Not set")}
          {row("Customers sign in with a phone code", "One-time code by SMS", s.phoneSignIn.configured ? "On" : "Not set up", "phone-sign-in")}
        </Card>
        <Card title="Dispatch" aside={<Pill>Set on the server</Pill>} style={{ gap: 4 }} testId="dispatch-settings">
          {row("Time to accept an offer", "Then it goes to the next technician", `${s.dispatch.offerTimeoutSeconds} s`)}
          {row("Wait before trying again", "When nobody is free", `${s.dispatch.retryDelaySeconds} s`)}
          {row("Tries before giving up", "Searches for one request", String(s.dispatch.maxRetries))}
          {row("Looks back for stuck searches", "After a restart", `${s.dispatch.recoveryWindowMinutes} min`)}
          {row("Distance", "Each technician's own range from their shop", "Per technician")}
        </Card>
      </div>
      <div className="ap-grid" style={{ gap: 16, alignContent: "start" }}>
        <Card title="Alerts on live jobs" aside={`checked every ${s.monitoring.intervalSeconds} s`} style={{ gap: 4 }} testId="alert-settings">
          {s.monitoring.rules.map((rule) => row(rule.label, rule.code.replace(/_/g, " "), rule.threshold))}
        </Card>
        <Note icon="info">These values come from the server's settings, so every admin sees the same numbers. Changing one is a server change: ask the tech team, and it is noted in the release.</Note>
      </div>
    </div>
  );
}

function Emails() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["portal", "email-templates"], queryFn: listEmailTemplates });
  const templates = useMemo(() => [...(query.data || [])].sort((a, b) => a.eventType.localeCompare(b.eventType)), [query.data]);
  const [current, setCurrent] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const selected: EmailTemplate | undefined = templates.find((item) => item.eventType === current) || templates[0];
  useEffect(() => { if (selected) { setSubject(selected.subject); setContent(selected.content); } }, [selected]);
  if (query.isError) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return <Loading height={360} label="Loading email templates" />;
  if (!selected) return <Empty icon="mail" title="No email templates yet" />;
  const changed = subject !== selected.subject || content !== selected.content;
  const save = async () => {
    setSaving(true);
    try {
      await saveEmailTemplate(selected.eventType, { subject: subject.trim(), content: content.trim() });
      toast.success(`${words(selected.eventType)} saved`);
      await queryClient.invalidateQueries({ queryKey: ["portal", "email-templates"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };
  const updated = selected.updatedAt || selected.updated_at;
  return (
    <div className="em-grid" style={{ gridTemplateColumns: "minmax(0, 1fr) 340px" }}>
      <Card style={{ gap: 12 }} testId="email-editor">
        <div className="ap-row" style={{ flexWrap: "wrap" }}>
          <label className="ap-row" style={{ flex: "1 1 auto", gap: 8 }}>
            <Icon name="mail" />
            <select className="ap-sel" aria-label="Template" value={selected.eventType} onChange={(event) => setCurrent(event.target.value)} style={{ flex: "1 1 auto" }}>
              {templates.map((item) => <option key={item.eventType} value={item.eventType}>{words(item.eventType)}</option>)}
            </select>
          </label>
          <span className="ap-faint" style={{ fontSize: 12, fontWeight: 700 }}>{templates.length} templates{updated ? ` · last changed ${dateLong(updated)}` : ""}</span>
        </div>
        <div className="ap-field"><label htmlFor="em-subject">Subject</label><input id="em-subject" value={subject} onChange={(event) => setSubject(event.target.value)} /></div>
        <div className="ap-field"><label htmlFor="em-content">Email (HTML)</label><textarea id="em-content" className="em-code" style={{ minHeight: 260, fontFamily: "ui-monospace, Consolas, monospace", fontSize: 12.5 }} value={content} onChange={(event) => setContent(event.target.value)} /></div>
        <div className="ap-field"><label>Fill-ins in this email</label><div className="em-tok">{tokensIn(`${subject} ${content}`).map((token) => <span key={token}>{`{{${token}}}`}</span>)}{tokensIn(`${subject} ${content}`).length === 0 ? <span className="ap-faint">None</span> : null}</div><small>Also common: {"{{name}}"}, {"{{requestId}}"}, {"{{serviceType}}"}, {"{{technicianName}}"}.</small></div>
        <div className="ap-row" style={{ justifyContent: "flex-end", gap: 8 }}>
          <Btn disabled={!changed} onClick={() => { setSubject(selected.subject); setContent(selected.content); }}>Undo changes</Btn>
          <Btn variant="dark" disabled={!changed || !subject.trim() || !content.trim() || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save"}</Btn>
        </div>
      </Card>
      <Card title="Preview" aside="with sample details" style={{ gap: 10 }} testId="email-preview">
        <p className="ap-strong" style={{ fontSize: 13.5 }}>{fill(subject)}</p>
        <iframe title="Email preview" sandbox="allow-same-origin" srcDoc={`<!doctype html><meta charset="utf-8"><body style="font-family:system-ui,sans-serif;font-size:14px;color:#283048;margin:12px">${fill(content)}</body>`} style={{ width: "100%", minHeight: 360, border: "1px solid #EAECF0", borderRadius: 12, background: "#FFFFFF" }} />
      </Card>
    </div>
  );
}
