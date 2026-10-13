import MaterialSymbol from "@/components/home/MaterialSymbol";
import { TechBack } from "@/components/technician/app/TechUi";
import { techDayLabel, techTime, useTechText } from "@/lib/technicianLanguage";
import { cn } from "@/lib/utils";

export type TechMessage = {
  id: string | number;
  type?: string | null;
  title?: string | null;
  message?: string | null;
  is_read?: boolean | null;
  created_at?: string | null;
};

const LOOK: Record<string, { icon: string; tone: string }> = {
  success: { icon: "check", tone: "is-green" },
  warning: { icon: "warning", tone: "is-amber" },
  info: { icon: "info", tone: "is-blue" },
};

/** What ResQNow has told the technician: new ones first, then the ones already seen. */
export default function TechMessages({ messages, onBack }: { messages: TechMessage[]; onBack: () => void }) {
  const { lang, t } = useTechText();
  const fresh = messages.filter((message) => !message.is_read);
  const seen = messages.filter((message) => message.is_read);

  const group = (label: string, rows: TechMessage[]) =>
    rows.length === 0 ? null : (
      <>
        <p className="tp-day">{label}</p>
        <div className="tp-list">
          {rows.map((message) => {
            const look = LOOK[String(message.type || "")] ?? { icon: "notifications", tone: "" };
            const when = [techDayLabel(lang, message.created_at), techTime(lang, message.created_at)].filter(Boolean).join(" · ");
            return (
              <div key={message.id} className="tp-row is-tall">
                <span className={cn("tp-ic", look.tone)} aria-hidden="true"><MaterialSymbol name={look.icon} /></span>
                <span className="tp-text">
                  <b>{message.title}</b>
                  {message.message ? <span className="is-wrap">{message.message}</span> : null}
                  {when ? <span>{when}</span> : null}
                </span>
              </div>
            );
          })}
        </div>
      </>
    );

  return (
    <div id="dashboard-notifications" data-testid="technician-messages">
      <TechBack onClick={onBack} />
      <h1 className="tp-h1 tp-pj">{t("messages.title")}</h1>
      {messages.length === 0 ? (
        <div className="tp-list" style={{ marginTop: 14 }}><p className="tp-empty">{t("messages.none")}</p></div>
      ) : (
        <>
          {group(t("messages.new"), fresh)}
          {group(t("messages.before"), seen)}
        </>
      )}
    </div>
  );
}
