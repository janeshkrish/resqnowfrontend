import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import TechnicianBottomNav, { type TechnicianTab } from "@/components/technician/TechnicianBottomNav";
import { useTechText } from "@/lib/technicianLanguage";
import { useTechnicianNavSettings } from "@/lib/technicianNavSettings";
import { TECH_LANGUAGES } from "@/lib/technicianText";
import { cn } from "@/lib/utils";

/**
 * One page of the technician app: a single column with the bar at the bottom.
 * `tab` lights that place in the bar; `bare` leaves the bar out (before the account is approved);
 * `wide` gives a job in progress the room its card has always had.
 */
export function TechPage({ tab, bare = false, wide = false, testId, children }: { tab: TechnicianTab; bare?: boolean; wide?: boolean; testId?: string; children: ReactNode }) {
  const { lang, t } = useTechText();
  const { enabled } = useTechnicianNavSettings();
  const barShown = enabled && !bare;
  return (
    <div className={cn("tp", !barShown && "is-bare")} lang={lang} data-testid={testId}>
      <div className={cn("tp-in", wide && "is-wide")}>
        {/* Without the bar, the tab pages still need a way back to Home. */}
        {!barShown && !bare && tab !== "home" ? (
          <Link to="/technician/dashboard" className="tp-back tp-press">
            <MaterialSymbol name="arrow_back" />
            {t("nav.home")}
          </Link>
        ) : null}
        {children}
      </div>
      {bare ? null : <TechnicianBottomNav active={tab} />}
    </div>
  );
}

/** The Back button at the top of a page opened from another one. */
export function TechBack({ to, onClick }: { to?: string; onClick?: () => void }) {
  const { t } = useTechText();
  const inner = (
    <>
      <MaterialSymbol name="arrow_back" />
      {t("common.back")}
    </>
  );
  return to
    ? <Link to={to} className="tp-back tp-press">{inner}</Link>
    : <button type="button" className="tp-back tp-press" onClick={onClick}>{inner}</button>;
}

/** A sheet that rises from the bottom on phones and sits in the middle on larger screens. */
export function TechSheet({ open, onClose, title, sub, children }: { open: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode }) {
  const { lang } = useTechText();
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="tp-sheet-scrim" />
        <Dialog.Content className="tp-sheet" lang={lang} aria-describedby={undefined}>
          <div className="tp-grab" aria-hidden="true" />
          <Dialog.Title className="tp-sheet-title tp-pj">{title}</Dialog.Title>
          {sub ? <p className="tp-sheet-sub">{sub}</p> : null}
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/** A switch with its name, for a setting that is on or off. */
export function TechSwitch({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      className="tp-switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    />
  );
}

/** Choosing the language of the technician app. Kept on this phone. */
export function TechLanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang, setLang, t } = useTechText();
  return (
    <TechSheet open={open} onClose={onClose} title={t("lang.title")} sub={t("lang.sub")}>
      <div role="radiogroup" aria-label={t("lang.title")} style={{ marginTop: 6 }}>
        {TECH_LANGUAGES.map((language) => (
          <button
            key={language.code}
            type="button"
            role="radio"
            aria-checked={lang === language.code}
            lang={language.code}
            className={cn("tp-pick tp-press", lang === language.code && "is-on")}
            onClick={() => {
              setLang(language.code);
              onClose();
            }}
          >
            <span>
              {language.name}
              {language.english ? <small> {language.english}</small> : null}
            </span>
            {lang === language.code ? <MaterialSymbol name="check_circle" /> : null}
          </button>
        ))}
      </div>
    </TechSheet>
  );
}

/** Five stars for a rating, with halves. */
export function TechStars({ value, label }: { value: number; label?: string }) {
  const rating = Math.max(0, Math.min(5, Number(value) || 0));
  return (
    <span className="tp-stars" role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {[1, 2, 3, 4, 5].map((n) => {
        const kind = rating >= n - 0.25 ? "star" : rating >= n - 0.75 ? "star_half" : "star";
        return <MaterialSymbol key={n} name={kind} className={rating < n - 0.75 ? "is-empty" : undefined} />;
      })}
    </span>
  );
}
