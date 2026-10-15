import { createContext, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import MaterialSymbol from "@/components/home/MaterialSymbol";
import { cn } from "@/lib/utils";

// The admin portal's building blocks. Classes come from portal.css (the approved design).

export const Icon = ({ name, className }: { name: string; className?: string }) => <MaterialSymbol name={name} className={className} />;

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "dark" | "hot" | "danger" | "ghost" | "light"; size?: "sm" | "lg"; icon?: string };
export function Btn({ variant, size, icon, children, className, type = "button", ...rest }: BtnProps) {
  return (
    <button type={type} className={cn("ap-btn", variant && `is-${variant}`, size && `is-${size}`, className)} {...rest}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}
export function IconBtn({ icon, label, size, variant, className, ...rest }: Omit<BtnProps, "children"> & { label: string }) {
  return (
    <button type="button" aria-label={label} title={label} className={cn("ap-btn is-icon", size && `is-${size}`, variant && `is-${variant}`, className)} {...rest}>
      <Icon name={icon || "more_horiz"} />
    </button>
  );
}

export type Tone = "ok" | "warn" | "bad" | "go" | "hot" | "dark" | "";
export function Pill({ tone = "", icon, children, className }: { tone?: Tone; icon?: string; children: ReactNode; className?: string }) {
  return <span className={cn("ap-pill", tone && `is-${tone}`, className)}>{icon ? <Icon name={icon} /> : null}{children}</span>;
}

export type KpiItem = { label: ReactNode; value: ReactNode; unit?: ReactNode; note?: ReactNode; tone?: "up" | "down"; warn?: boolean; testId?: string };
export function Kpis({ items, cols }: { items: KpiItem[]; cols?: number }) {
  return (
    <div className="ap-kpis" style={{ gridTemplateColumns: `repeat(${cols || items.length}, minmax(0, 1fr))` }}>
      {items.map((item, index) => (
        <div key={index} className={cn("ap-kpi", item.warn && "is-warn")} data-testid={item.testId}>
          <span>{item.label}</span>
          <b>{item.value}{item.unit ? <small>{item.unit}</small> : null}</b>
          {item.note != null ? <small className={item.tone === "up" ? "is-up" : item.tone === "down" ? "is-down" : undefined}>{item.note}</small> : null}
        </div>
      ))}
    </div>
  );
}

export type TabItem<T extends string> = { key: T; label: ReactNode; count?: number | string | null; warn?: boolean };
export function PillTabs<T extends string>({ items, value, onChange, label }: { items: TabItem<T>[]; value: T; onChange: (key: T) => void; label: string }) {
  return (
    <nav className="ap-tabs" aria-label={label}>
      {items.map((item) => (
        <button key={item.key} type="button" aria-pressed={item.key === value} className={cn("ap-tab", item.key === value && "is-on", item.warn && "is-warn")} onClick={() => onChange(item.key)}>
          {item.label}
          {item.count != null && item.count !== "" ? <i>{item.count}</i> : null}
        </button>
      ))}
    </nav>
  );
}
export function UnderTabs<T extends string>({ items, value, onChange, label }: { items: TabItem<T>[]; value: T; onChange: (key: T) => void; label: string }) {
  return (
    <nav className="ap-utabs" aria-label={label}>
      {items.map((item) => (
        <button key={item.key} type="button" aria-pressed={item.key === value} className={cn("ap-utab", item.key === value && "is-on")} onClick={() => onChange(item.key)}>
          {item.label}
          {item.count != null && item.count !== "" ? <i>{item.count}</i> : null}
        </button>
      ))}
    </nav>
  );
}

export function Select<T extends string>({ value, onChange, options, label, icon }: { value: T; onChange: (value: T) => void; options: { value: T; label: string }[]; label: string; icon?: string }) {
  return (
    <span className="ap-row" style={{ gap: 6 }}>
      {icon ? <Icon name={icon} className="ap-faint" /> : null}
      <select className="ap-sel" aria-label={label} value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </span>
  );
}

export function SearchBox({ value, onChange, placeholder, label, style }: { value: string; onChange: (value: string) => void; placeholder: string; label?: string; style?: CSSProperties }) {
  return (
    <label className="ap-search" style={style}>
      <Icon name="search" />
      <input className="ap-searchin" type="search" value={value} placeholder={placeholder} aria-label={label || placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export type Head = string | { label: string; right?: boolean };
export function Table({ cols, head, children, foot, label, minWidth, testId }: { cols: string; head: Head[]; children: ReactNode; foot?: ReactNode; label: string; minWidth?: number; testId?: string }) {
  return (
    <div className="ap-table" role="table" aria-label={label} data-testid={testId} style={minWidth ? ({ "--ap-table-min": `${minWidth}px` } as CSSProperties) : undefined}>
      <div className="ap-tr is-head" role="row" style={{ gridTemplateColumns: cols }}>
        {head.map((cell, index) => {
          const text = typeof cell === "string" ? cell : cell.label;
          return <span key={index} role="columnheader" className={typeof cell !== "string" && cell.right ? "is-r" : undefined}>{text}</span>;
        })}
      </div>
      {children}
      {foot ? <div className="ap-foot">{foot}</div> : null}
    </div>
  );
}
export function Row({ cols, children, onClick, selected, tone, tight, testId, label }: { cols: string; children: ReactNode; onClick?: () => void; selected?: boolean; tone?: "risk" | "muted"; tight?: boolean; testId?: string; label?: string }) {
  return (
    <div role="row" data-testid={testId} aria-label={label}
      className={cn("ap-tr", tight && "is-tight", selected && "is-sel", tone === "risk" && "is-risk", tone === "muted" && "is-muted", onClick && "is-link")}
      style={{ gridTemplateColumns: cols }}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (event) => { if (event.key === "Enter") onClick(); } : undefined}>
      {children}
    </div>
  );
}
export const Cell = ({ children, right, className }: { children?: ReactNode; right?: boolean; className?: string }) => (
  <span role="cell" className={cn(right && "is-r", className)}>{children}</span>
);

export function Pager({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (page: number) => void }) {
  if (totalPages <= 1) return null;
  const pages = totalPages <= 5 ? Array.from({ length: totalPages }, (_, i) => i + 1) : [...new Set([1, page - 1, page, page + 1, totalPages])].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  return (
    <span className="ap-pager" role="navigation" aria-label="Pages">
      <button type="button" className="ap-btn is-icon is-sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)}><Icon name="chevron_left" /></button>
      {pages.map((p, index) => (
        <span key={p} className="ap-row" style={{ gap: 6 }}>
          {index > 0 && p - pages[index - 1] > 1 ? <span className="ap-faint">…</span> : null}
          <button type="button" aria-current={p === page ? "page" : undefined} className={cn("ap-btn is-sm", p === page && "is-dark")} style={{ minWidth: 30, padding: "0 8px" }} onClick={() => onPage(p)}>{p}</button>
        </span>
      ))}
      <button type="button" className="ap-btn is-icon is-sm" aria-label="Next page" disabled={page >= totalPages} onClick={() => onPage(page + 1)}><Icon name="chevron_right" /></button>
    </span>
  );
}

export const Two = ({ top, bottom, tone }: { top: ReactNode; bottom?: ReactNode; tone?: "warn" | "ok" | "bad" }) => (
  <span className="ap-two"><b>{top}</b>{bottom != null ? <span className={tone ? `is-${tone}` : undefined}>{bottom}</span> : null}</span>
);
export const Who = ({ initials, name, sub, size }: { initials: string; name: ReactNode; sub?: ReactNode; size?: "sm" | "lg" }) => (
  <span className="ap-who"><span className={cn("ap-av", size && `is-${size}`)} aria-hidden="true">{initials}</span><div><b>{name}</b>{sub != null ? <span>{sub}</span> : null}</div></span>
);

export function Card({ title, aside, children, className, style, testId, label }: { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; style?: CSSProperties; testId?: string; label?: string }) {
  return (
    <section className={cn("ap-card", className)} style={style} data-testid={testId} aria-label={label}>
      {title != null || aside != null ? <div className="ap-h"><b>{title}</b>{typeof aside === "string" ? <span>{aside}</span> : aside}</div> : null}
      {children}
    </section>
  );
}

export function Note({ tone, icon = "info", children }: { tone?: "warn" | "ok" | "bad"; icon?: string; children: ReactNode }) {
  return <div className={cn("ap-note", tone && `is-${tone}`)}><Icon name={icon} /><span>{children}</span></div>;
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange?: (next: boolean) => void; label: string; disabled?: boolean }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled || !onChange} className={cn("ap-switch", on && "is-on")} onClick={() => onChange?.(!on)} />;
}
export function Check({ on, onChange, label, children }: { on: boolean; onChange: (next: boolean) => void; label?: string; children?: ReactNode }) {
  return (
    <label className="ap-row" style={{ gap: 10, cursor: "pointer", alignItems: "flex-start" }}>
      <input type="checkbox" className="sr-only" checked={on} aria-label={label} onChange={(event) => onChange(event.target.checked)} />
      <span className={cn("ap-check", on && "is-on")} aria-hidden="true">{on ? <Icon name="check" /> : null}</span>
      {children != null ? <span>{children}</span> : null}
    </label>
  );
}
export function Radio({ on, onChange, name, children }: { on: boolean; onChange: () => void; name: string; children: ReactNode }) {
  return (
    <label className="ap-row" style={{ gap: 10, cursor: "pointer", alignItems: "flex-start" }}>
      <input type="radio" className="sr-only" name={name} checked={on} onChange={onChange} />
      <span className={cn("ap-radio", on && "is-on")} aria-hidden="true" />
      <span style={{ minWidth: 0 }}>{children}</span>
    </label>
  );
}

export function KV({ rows, total }: { rows: [ReactNode, ReactNode][]; total?: [ReactNode, ReactNode] }) {
  return (
    <dl className="ap-kv">
      {rows.map(([key, value], index) => <div key={index}><dt>{key}</dt><dd>{value}</dd></div>)}
      {total ? <div className="is-total"><dt>{total[0]}</dt><dd>{total[1]}</dd></div> : null}
    </dl>
  );
}

export type TimelineItem = { time: ReactNode; tone?: "" | "warn" | "bad" | "ok" | "note"; title: ReactNode; sub?: ReactNode };
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="ap-tl">
      {items.map((item, index) => (
        <li key={index} className={item.tone ? `is-${item.tone}` : undefined}>
          <time>{item.time}</time><i aria-hidden="true" /><div><b>{item.title}</b>{item.sub ? <span>{item.sub}</span> : null}</div>
        </li>
      ))}
    </ol>
  );
}

export function Strip({ items }: { items: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "warn" | "ok" }[] }) {
  return (
    <div className="ap-strip" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
      {items.map((item, index) => (
        <div key={index}><span>{item.label}</span><b className={item.tone ? `is-${item.tone}` : undefined}>{item.value}</b>{item.sub != null ? <small>{item.sub}</small> : null}</div>
      ))}
    </div>
  );
}

export function HBars({ items, cols = "150px minmax(0,1fr) 70px", label }: { items: { label: ReactNode; value: ReactNode; fraction: number; tone?: string }[]; cols?: string; label: string }) {
  return (
    <div className="ap-hbars" role="list" aria-label={label}>
      {items.map((item, index) => (
        <div key={index} role="listitem" className="ap-hb" style={{ gridTemplateColumns: cols }}>
          <span>{item.label}</span>
          <div><i className={item.tone ? `is-${item.tone}` : undefined} style={{ width: `${Math.max(0, Math.min(1, item.fraction)) * 100}%` }} /></div>
          <b>{item.value}</b>
        </div>
      ))}
    </div>
  );
}

/** A bar chart drawn to one scale. stack is drawn on top of values; ghost is a comparison tick. */
export function Columns({ values, labels, height, stack, ghost, highlightLast, showValues = true, gap = 8, label }: {
  values: number[]; labels: string[]; height: number; stack?: number[]; ghost?: number[]; highlightLast?: boolean; showValues?: boolean; gap?: number; label: string;
}) {
  const peak = Math.max(1, ...values.map((value, index) => value + (stack?.[index] || 0)), ...(ghost || [0]));
  const step = peak <= 4 ? 1 : Math.ceil(peak / 4);
  const top = step * 4;
  const ticks = [top, step * 3, step * 2, step, 0];
  return (
    <div className="ap-chart" style={{ height }} role="img" aria-label={label}>
      <div className="ap-axis" aria-hidden="true">{ticks.map((tick) => <span key={tick}>{tick}</span>)}</div>
      <div className="ap-plot" style={{ gap }}>
        {values.map((value, index) => {
          const extra = stack?.[index] || 0;
          return (
            <div key={index} className="ap-col">
              {ghost ? <s style={{ bottom: `${(ghost[index] / top) * 100}%` }} /> : null}
              {extra ? <i className="is-warn" style={{ height: `${(extra / top) * 100}%` }} /> : null}
              <i className={highlightLast && index === values.length - 1 ? "is-brand" : "is-ink"} style={{ height: `${(value / top) * 100}%` }} />
              {showValues && value + extra > 0 ? <b style={{ bottom: `calc(${((value + extra) / top) * 100}% + 3px)` }}>{value + extra}</b> : null}
              <span>{labels[index] || ""}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function Loading({ label = "Loading…", height = 160 }: { label?: string; height?: number }) {
  return <div className="ap-skel" role="status" aria-label={label} style={{ height }} />;
}
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className="ap-state is-bad" role="alert">
      <Icon name="error" />
      <b>Could not load this</b>
      <span>{error instanceof Error ? error.message : "Something went wrong."}</span>
      {onRetry ? <Btn size="sm" icon="refresh" onClick={onRetry}>Try again</Btn> : null}
    </div>
  );
}
export function Empty({ icon = "inbox", title, sub }: { icon?: string; title: ReactNode; sub?: ReactNode }) {
  return <div className="ap-state"><Icon name={icon} /><b>{title}</b>{sub ? <span>{sub}</span> : null}</div>;
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
}
function useFocusOnOpen() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return ref;
}

export function Panel({ label, title, sub, badge, actions, strip, children, foot, footNote, onClose, width, testId }: {
  label: string; title: ReactNode; sub?: ReactNode; badge?: ReactNode; actions?: ReactNode; strip?: ReactNode; children: ReactNode; foot?: ReactNode; footNote?: ReactNode;
  onClose: () => void; width?: number; testId?: string;
}) {
  useEscape(onClose);
  const ref = useFocusOnOpen();
  const titleId = useId();
  return (
    <>
      <div className="ap-scrim" onClick={onClose} />
      <aside ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} aria-labelledby={titleId} className="ap-panel" style={width ? { width: `min(${width}px, 100vw)` } : undefined} data-testid={testId}>
        <div className="ap-ph">
          <div><h2 id={titleId} className="pj">{title}{badge}</h2>{sub ? <span>{sub}</span> : null}</div>
          {actions}
          <IconBtn icon="close" label="Close" size="sm" onClick={onClose} />
        </div>
        <div className="ap-pbody">
          {strip}
          {children}
        </div>
        {foot ? <div className="ap-pfoot">{footNote ? <span>{footNote}</span> : <span />}{foot}</div> : null}
      </aside>
    </>
  );
}

export function Dialog({ label, title, sub, children, foot, footNote, onClose, width, testId }: {
  label: string; title: ReactNode; sub?: ReactNode; children: ReactNode; foot?: ReactNode; footNote?: ReactNode; onClose: () => void; width?: number; testId?: string;
}) {
  useEscape(onClose);
  const ref = useFocusOnOpen();
  return (
    <>
      <div className="ap-scrim" onClick={onClose} />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={label} className="ap-dialog" style={width ? { width: `min(${width}px, calc(100vw - 24px))` } : undefined} data-testid={testId}>
        <div className="ap-dh"><div><h2 className="pj">{title}</h2>{sub ? <p>{sub}</p> : null}</div><IconBtn icon="close" label="Close" size="sm" variant="ghost" onClick={onClose} /></div>
        <div className="ap-dbody">{children}</div>
        {foot ? <div className="ap-dfoot">{footNote ? <span>{footNote}</span> : <span />}{foot}</div> : null}
      </div>
    </>
  );
}

// The page title and line under it live in the shell's top bar; each page names itself.
export type PortalHeader = { title: string; sub?: string };
export const PortalHeaderContext = createContext<(header: PortalHeader) => void>(() => {});
export function usePortalHeader(title: string, sub?: string) {
  const set = useContext(PortalHeaderContext);
  useEffect(() => { set({ title, sub }); }, [set, title, sub]);
}

export type MenuItem = { label: string; icon: string; onClick: () => void; danger?: boolean; disabled?: boolean };
/** A "more" button with a short list of actions. The list is placed by the button and closes on a click outside, Escape or scroll. */
export function Menu({ label, items, icon = "more_horiz" }: { label: string; items: MenuItem[]; icon?: string }) {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!at) return;
    const close = (event: Event) => { if (!ref.current?.contains(event.target as Node)) setAt(null); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setAt(null); };
    const scroll = () => setAt(null);
    document.addEventListener("mousedown", close);
    window.addEventListener("keydown", key);
    window.addEventListener("scroll", scroll, true);
    return () => { document.removeEventListener("mousedown", close); window.removeEventListener("keydown", key); window.removeEventListener("scroll", scroll, true); };
  }, [at]);
  return (
    <span ref={ref} style={{ display: "inline-flex" }} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <button type="button" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={Boolean(at)} className="ap-btn is-icon is-sm"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setAt(at ? null : { top: rect.bottom + 6, left: Math.max(12, Math.min(window.innerWidth - 252, rect.right - 240)) });
        }}>
        <Icon name={icon} />
      </button>
      {at ? (
        <div className="ex-pop ex-menu" role="menu" aria-label={label} style={{ position: "fixed", top: at.top, left: at.left, width: 240, zIndex: 80 }}>
          {items.map((item) => (
            <button key={item.label} type="button" role="menuitem" className={item.danger ? "is-danger" : undefined} disabled={item.disabled} onClick={() => { setAt(null); item.onClick(); }}>
              <Icon name={item.icon} />{item.label}
            </button>
          ))}
        </div>
      ) : null}
    </span>
  );
}

/** Stops a click inside a clickable table row from opening the row. */
export const NoRowClick = ({ children }: { children: ReactNode }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }} onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>{children}</span>
);
