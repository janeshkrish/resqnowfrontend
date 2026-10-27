import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminApi, getAdminNotifications, type AdminNotificationRow } from "@/pages/adminExtended/api/adminExtendedApi";
import { ADMIN_LIVE_EVENTS, useAdminEvents, useAdminSocketConnected } from "@/pages/adminExtended/monitor/adminLive";
import { getNavCounts, markAllNotificationsRead, searchEverything, type NavCounts, type SearchResults } from "./api/portalApi";
import { ago, day, rupees, service, vehiclePicture } from "./format";
import { Icon, PortalHeaderContext, type PortalHeader } from "./ui";
import "./portal.css";

/** Everything the server tells admins about: requests, payments, technicians, alerts and the bell. */
export const PORTAL_EVENTS = [
  ...ADMIN_LIVE_EVENTS, "admin:notification", "admin:technician_audit_update", "admin:technician_activity_update",
  "admin:technician_inactivity_alert", "admin:analytics_update", "admin:command_center_reassign",
] as const;

type NavEntry =
  | { kind: "section"; label: string }
  | { kind: "item"; to: string; icon: string; label: string; count?: keyof NavCounts; warn?: boolean; sub?: boolean; end?: boolean };

const NAV: NavEntry[] = [
  { kind: "item", to: "/admin/today", icon: "space_dashboard", label: "Today" },
  { kind: "section", label: "Operations" },
  { kind: "item", to: "/admin/live", icon: "radar", label: "Live requests", count: "live" },
  { kind: "item", to: "/admin/requests", icon: "receipt_long", label: "All requests" },
  { kind: "item", to: "/admin/alerts", icon: "notification_important", label: "Alerts", count: "alerts", warn: true },
  { kind: "item", to: "/admin/watch", icon: "push_pin", label: "Watch list" },
  { kind: "section", label: "People" },
  { kind: "item", to: "/admin/technicians", icon: "engineering", label: "Technicians", end: false },
  { kind: "item", to: "/admin/technicians/new", icon: "add", label: "Add technician", sub: true },
  { kind: "item", to: "/admin/applications", icon: "how_to_reg", label: "Applications", count: "applications" },
  { kind: "item", to: "/admin/customers", icon: "group", label: "Customers" },
  { kind: "section", label: "Money" },
  { kind: "item", to: "/admin/payments", icon: "payments", label: "Payments" },
  { kind: "item", to: "/admin/payouts", icon: "account_balance", label: "Payouts", count: "payouts" },
  { kind: "item", to: "/admin/reports", icon: "bar_chart", label: "Reports" },
  { kind: "item", to: "/admin/app-installs", icon: "install_mobile", label: "App installs" },
  { kind: "section", label: "Support" },
  { kind: "item", to: "/admin/complaints", icon: "support_agent", label: "Complaints", count: "complaints" },
  { kind: "item", to: "/admin/messages", icon: "campaign", label: "Messages" },
  { kind: "section", label: "Setup" },
  { kind: "item", to: "/admin/services", icon: "tune", label: "Services and prices" },
  { kind: "item", to: "/admin/settings", icon: "settings", label: "Settings" },
  { kind: "item", to: "/admin/audit", icon: "history", label: "Audit log" },
];

function isActive(pathname: string, to: string) {
  if (to === "/admin/technicians") return pathname.startsWith("/admin/technicians") && !pathname.startsWith("/admin/technicians/new");
  return pathname === to || pathname.startsWith(`${to}/`);
}

export default function AdminPortalLayout() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const connected = useAdminSocketConnected();
  const [header, setHeaderState] = useState<PortalHeader>({ title: "Admin" });
  const [navOpen, setNavOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menu, setMenu] = useState<"bell" | "me" | null>(null);

  const setHeader = useCallback((next: PortalHeader) => {
    setHeaderState((current) => (current.title === next.title && current.sub === next.sub ? current : next));
  }, []);
  useEffect(() => { document.title = `${header.title} · ResQNow admin`; }, [header.title]);
  useEffect(() => { setNavOpen(false); setMenu(null); }, [location.pathname]);

  const counts = useQuery({ queryKey: ["portal", "nav-counts"], queryFn: getNavCounts, refetchInterval: 30_000 });
  const bellCount = useQuery({
    queryKey: ["portal", "bell-count"],
    queryFn: async () => (await adminApi.get<{ count: number; pendingApplications: number }>("/notifications/count")).data,
    refetchInterval: 60_000,
  });
  useAdminEvents(() => {
    void queryClient.invalidateQueries({ queryKey: ["portal", "nav-counts"] });
    void queryClient.invalidateQueries({ queryKey: ["portal", "bell-count"] });
  }, 1500, PORTAL_EVENTS);

  // A pop-up closes on a tap anywhere outside it (its own button toggles it).
  useEffect(() => {
    if (!menu) return;
    const onDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-popover], [data-popover-toggle]")) return;
      setMenu(null);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <PortalHeaderContext.Provider value={setHeader}>
      <div className={`adm${navOpen ? " is-nav-open" : ""}`} data-testid="admin-portal">
        <nav className="adm-nav" aria-label="Admin">
          <Link to="/admin/today" className="adm-brand"><img src="/images/resqnow-wordmark.png" alt="ResQNow" /><span>Admin</span></Link>
          {NAV.map((entry, index) => {
            if (entry.kind === "section") return <p key={`s${index}`} className="adm-sec">{entry.label}</p>;
            const value = entry.count ? counts.data?.[entry.count] : undefined;
            const on = isActive(location.pathname, entry.to);
            return (
              <NavLink key={entry.to} to={entry.to} className={`adm-item${entry.sub ? " is-sub" : ""}${on ? " is-on" : ""}`} aria-current={on ? "page" : undefined}>
                <Icon name={entry.icon} />
                {entry.label}
                {value ? <i className={entry.warn ? "is-warn" : undefined}>{value}</i> : null}
              </NavLink>
            );
          })}
        </nav>
        <div className="adm-navscrim" onClick={() => setNavOpen(false)} />
        <main className="adm-main">
          <header className="adm-top">
            <div className="adm-top-l">
              <button type="button" className="adm-burger" aria-label="Open the menu" onClick={() => setNavOpen(true)}><Icon name="menu" /></button>
              <div>
                <h1 className="pj">{header.title}</h1>
                {header.sub ? <p>{header.sub}</p> : null}
              </div>
            </div>
            <div className="adm-top-r">
              <button type="button" className="adm-find" onClick={() => setSearchOpen(true)} aria-label="Search requests, people, payments">
                <Icon name="search" /><span>Search requests, people, payments</span><kbd>Ctrl K</kbd>
              </button>
              <span className={`adm-live${connected ? "" : " is-off"}`} title={connected ? "Live updates are on" : "Reconnecting for live updates"}>
                <i aria-hidden="true" /><span>{connected ? "Live" : "Reconnecting"}</span>
              </span>
              <button type="button" data-popover-toggle className="adm-bell" aria-label={`Notifications${bellCount.data?.count ? `, ${bellCount.data.count} new` : ""}`} aria-expanded={menu === "bell"} onClick={() => setMenu(menu === "bell" ? null : "bell")}>
                <Icon name="notifications" />
                {bellCount.data?.count ? <i>{bellCount.data.count > 99 ? "99+" : bellCount.data.count}</i> : null}
              </button>
              <AccountButton open={menu === "me"} onToggle={() => setMenu(menu === "me" ? null : "me")} />
              {menu === "bell" ? <BellMenu onClose={() => setMenu(null)} pendingApplications={bellCount.data?.pendingApplications ?? counts.data?.applications ?? 0} /> : null}
            </div>
          </header>
          <Outlet />
        </main>
        {searchOpen ? <SearchDialog onClose={() => setSearchOpen(false)} /> : null}
      </div>
    </PortalHeaderContext.Provider>
  );
}

function AccountButton({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { adminUser, logoutAdmin } = useAdminAuth();
  const email = adminUser?.email || "";
  const initials = (adminUser?.name && adminUser.name !== "Admin" ? adminUser.name : email || "A").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
  return (
    <>
      <button type="button" data-popover-toggle className="adm-me" aria-label="Your account" aria-expanded={open} onClick={onToggle}>{initials || "A"}</button>
      {open ? (
        <div data-popover className="ex-pop ex-menu" role="menu" aria-label="Your account" style={{ right: 0, top: 50, width: 280 }}>
          <div className="ex-who"><span className="ap-av" style={{ background: "#283048", color: "#FFFFFF" }}>{initials || "A"}</span><div><b>{adminUser?.name || "Admin"}</b><span>{email || "Signed in"}</span></div></div>
          <Link role="menuitem" to="/admin/settings"><Icon name="settings" />Settings</Link>
          <Link role="menuitem" to="/admin/audit"><Icon name="history" />Audit log</Link>
          <a role="menuitem" href="/" target="_blank" rel="noreferrer"><Icon name="open_in_new" />Open the customer site</a>
          <hr />
          <button type="button" role="menuitem" className="is-danger" style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px", border: 0, background: "transparent", color: "#B42318", font: "inherit", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }} onClick={() => void logoutAdmin()}>
            <Icon name="logout" />Sign out
          </button>
        </div>
      ) : null}
    </>
  );
}

const NOTE_LOOK: Record<string, { icon: string; tone: string; title: string }> = {
  NEW_TECHNICIAN_APPLICATION: { icon: "how_to_reg", tone: "is-app", title: "New technician application" },
  TECHNICIAN_APPROVED: { icon: "verified", tone: "is-ok", title: "Technician approved" },
  SYSTEM_ALERT: { icon: "warning", tone: "is-warn", title: "System alert" },
};

function BellMenu({ onClose, pendingApplications }: { onClose: () => void; pendingApplications: number }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [limit, setLimit] = useState(8);
  const list = useQuery({ queryKey: ["portal", "bell", limit], queryFn: () => getAdminNotifications({ limit, offset: 0 }) });
  const unread = (list.data || []).filter((row) => !Number(row.is_read)).length;
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["portal", "bell"] });
    void queryClient.invalidateQueries({ queryKey: ["portal", "bell-count"] });
  };
  const open = async (row: AdminNotificationRow) => {
    if (!Number(row.is_read)) await adminApi.post(`/notifications/${row.id}/read`).catch(() => undefined);
    refresh();
    onClose();
    if (row.type === "NEW_TECHNICIAN_APPLICATION") navigate("/admin/applications");
    else if (row.type === "TECHNICIAN_APPROVED") navigate("/admin/technicians");
    else navigate("/admin/alerts");
  };
  return (
    <div data-popover className="ex-pop" role="dialog" aria-label="Notifications" style={{ right: 52, top: 50, width: 420 }} data-testid="bell-menu">
      <div className="ex-pop-h">
        <b>Notifications{unread ? ` · ${unread} new` : ""}</b>
        <button type="button" className="ap-btn is-ghost is-sm" disabled={!unread} onClick={async () => { await markAllNotificationsRead(); refresh(); }}>Mark all as read</button>
      </div>
      {list.isLoading ? <div style={{ padding: 16 }}><div className="ap-skel" style={{ height: 120 }} /></div> : null}
      {list.data && list.data.length === 0 ? <p className="ap-faint" style={{ padding: "8px 16px 16px", fontSize: 13, fontWeight: 600 }}>Nothing new.</p> : null}
      <div style={{ maxHeight: 420, overflowY: "auto" }}>
        {(list.data || []).map((row) => {
          const look = NOTE_LOOK[row.type] || { icon: "notifications", tone: "", title: row.title };
          const fresh = !Number(row.is_read);
          return (
            <button key={row.id} type="button" className={`ex-note${fresh ? " is-new" : ""}`} style={{ width: "100%", border: 0, borderTop: "1px solid #F2F4F7", background: fresh ? "#FAFBFF" : "#FFFFFF", textAlign: "left", font: "inherit", cursor: "pointer" }} onClick={() => void open(row)}>
              <span className={`ex-ic ${look.tone}`}><Icon name={look.icon} /></span>
              <div><b>{row.title || look.title}</b><span>{row.message}</span><small>{ago(row.created_at)}</small></div>
              {fresh ? <i /> : null}
            </button>
          );
        })}
      </div>
      <div className="ex-pop-f">
        <span>{pendingApplications ? `${pendingApplications} application${pendingApplications === 1 ? "" : "s"} waiting` : "No applications waiting"}</span>
        {list.data && list.data.length >= limit ? <button type="button" className="ap-btn is-sm" onClick={() => setLimit(limit + 10)}>View more</button> : null}
      </div>
    </div>
  );
}

type Hit = { key: string; group: string; title: string; sub: string; go: string; to: string; picture?: string | null; icon?: string };

function SearchDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(text.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [text]);
  const results = useQuery({ queryKey: ["portal", "search", query], queryFn: () => searchEverything(query), enabled: query.length >= 2 || /^\d+$/.test(query) });
  const hits = useMemo(() => toHits(results.data), [results.data]);
  useEffect(() => { setActive(0); }, [query]);
  const go = (hit: Hit | undefined) => { if (!hit) return; onClose(); navigate(hit.to); };
  const groups = [...new Set(hits.map((hit) => hit.group))];
  return (
    <>
      <div className="ap-scrim" onClick={onClose} />
      <div className="sx" role="dialog" aria-modal="true" aria-label="Search" data-testid="search-dialog">
        <div className="sx-in">
          <Icon name="search" />
          <input ref={inputRef} className="ap-searchin" style={{ fontSize: 17, fontWeight: 700 }} value={text} placeholder="Request number, name, phone, UPI ID or UTR" aria-label="Search"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onClose();
              if (event.key === "ArrowDown") { event.preventDefault(); setActive(Math.min(active + 1, hits.length - 1)); }
              if (event.key === "ArrowUp") { event.preventDefault(); setActive(Math.max(active - 1, 0)); }
              if (event.key === "Enter") go(hits[active]);
            }} />
          <kbd>Esc</kbd>
        </div>
        <div style={{ overflowY: "auto" }}>
          {query && results.isFetching && !hits.length ? <p className="ap-faint" style={{ padding: "14px 18px", fontWeight: 600 }}>Searching…</p> : null}
          {query && results.isSuccess && !hits.length ? <p className="ap-faint" style={{ padding: "14px 18px", fontWeight: 600 }}>Nothing found for “{query}”.</p> : null}
          {results.isError ? <p className="ap-bad" style={{ padding: "14px 18px" }}>Search failed. Try again.</p> : null}
          {groups.map((group) => (
            <div key={group} className="sx-group">
              <p>{group}</p>
              {hits.filter((hit) => hit.group === group).map((hit) => {
                const index = hits.indexOf(hit);
                return (
                  <button key={hit.key} type="button" className={`sx-hit${index === active ? " is-on" : ""}`} style={{ border: 0, background: index === active ? "#F2F4F7" : "transparent", textAlign: "left", font: "inherit", width: "100%", cursor: "pointer" }}
                    onMouseEnter={() => setActive(index)} onClick={() => go(hit)}>
                    <span className="sx-ic">{hit.picture ? <img src={hit.picture} alt="" /> : <Icon name={hit.icon || "search"} />}</span>
                    <div><b>{hit.title}</b><span>{hit.sub}</span></div>
                    <span className="sx-go">{hit.go}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="sx-foot"><span><kbd>↑</kbd><kbd>↓</kbd>move</span><span><kbd>Enter</kbd>open</span><span>Finds request numbers, names, phone numbers, payment IDs and UTRs</span></div>
      </div>
    </>
  );
}

function toHits(data: SearchResults | undefined): Hit[] {
  if (!data) return [];
  return [
    ...data.requests.map((row) => ({
      key: `r${row.id}`, group: "Requests", title: `#${row.id} · ${service(row.service)}${row.customer ? ` · ${row.customer}` : ""}`,
      sub: [day(row.createdAt), row.technician ? `with ${row.technician}` : null, row.fare != null ? rupees(row.fare) : null, row.area].filter(Boolean).join(" · "),
      go: row.phase === "done" || row.phase === "cancelled" ? "Details" : "Monitor", to: `/admin/requests/${row.id}`, picture: vehiclePicture(row.vehicleType),
    })),
    ...data.customers.map((row) => ({
      key: `c${row.id}`, group: "Customers", title: row.name || `Customer #${row.id}`,
      sub: [row.phoneMasked, row.email, `${row.requests} request${row.requests === 1 ? "" : "s"}`].filter(Boolean).join(" · "), go: "Profile", to: `/admin/customers/${row.id}`, icon: "person",
    })),
    ...data.technicians.map((row) => ({
      key: `t${row.id}`, group: "Technicians", title: row.name, sub: [row.owner, row.phoneMasked, row.currentJobId ? `on job #${row.currentJobId}` : row.onDuty ? "on duty" : row.status].filter(Boolean).join(" · "),
      go: "Record", to: `/admin/technicians/${row.id}`, icon: "engineering",
    })),
    ...data.payments.map((row) => ({
      key: `${row.kind}${row.id}`, group: "Payments", title: `${rupees(row.amount)} · ${row.kind === "payout" ? `payout to ${row.technician || "technician"}` : `#${row.requestId}`}`,
      sub: [row.reference, row.status, day(row.at)].filter(Boolean).join(" · "), go: row.kind === "payout" ? "Payouts" : "Payment",
      to: row.kind === "payout" ? `/admin/payouts?tab=paid` : `/admin/payments?request=${row.requestId}`, icon: row.kind === "payout" ? "account_balance" : "receipt_long",
    })),
  ];
}
