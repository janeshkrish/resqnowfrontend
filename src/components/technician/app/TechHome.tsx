import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import JobAlertsBanner from "@/components/technician/JobAlertsBanner";
import { TechLanguageSheet } from "@/components/technician/app/TechUi";
import { serviceArt } from "@/lib/services";
import { TECH_SUPPORT_PHONE, techInitials } from "@/lib/technicianApp";
import { techRupees, useTechText } from "@/lib/technicianLanguage";
import { TECH_LANGUAGES } from "@/lib/technicianText";
import { cn } from "@/lib/utils";

export type TechHomeProps = {
  name: string;
  photoUrl?: string | null;
  isOnline: boolean;
  unread: number;
  todayEarnings: number;
  jobsDoneToday: number;
  points: number;
  withdrawable: number;
  jobsDone: number;
  /** The average of the customers' ratings; null while there are none. */
  rating: number | null;
  pendingDues: number;
  /** Towing operators also keep vehicles and a team. */
  towing: boolean;
  fleetCount: number;
  teamCount: number;
  /** Something that has just happened and comes before everything else, such as a cancelled job. */
  notice?: ReactNode;
  onToggleAvailability: (online: boolean) => void;
  onOpenMessages: () => void;
  onPayDues: () => void;
  onOpenFleet: () => void;
  onOpenTeam: () => void;
};

/** Home when there is no job on: on or off duty, today's money, and the few places to go. */
export default function TechHome({
  name,
  photoUrl,
  isOnline,
  unread,
  todayEarnings,
  jobsDoneToday,
  points,
  withdrawable,
  jobsDone,
  rating,
  pendingDues,
  towing,
  fleetCount,
  teamCount,
  notice,
  onToggleAvailability,
  onOpenMessages,
  onPayDues,
  onOpenFleet,
  onOpenTeam,
}: TechHomeProps) {
  const { lang, t } = useTechText();
  const [languageOpen, setLanguageOpen] = useState(false);
  const languageName = TECH_LANGUAGES.find((language) => language.code === lang)?.name ?? "English";
  const dues = techRupees(pendingDues);
  const towArt = serviceArt("towing");
  const jobsToday =
    jobsDoneToday <= 0 ? t("home.todayNone") : jobsDoneToday === 1 ? t("home.todayJobOne") : t("home.todayJobs", { n: jobsDoneToday });

  return (
    <div id="dashboard-home" data-testid="technician-home">
      <div className="tp-top">
        <Link to="/technician/profile" className="tp-me">
          <span className="tp-face" aria-hidden="true">
            {photoUrl ? <img src={photoUrl} alt="" /> : techInitials(name)}
          </span>
          <span className="tp-who">
            <span>{t("home.hello")}</span>
            <b>{name}</b>
          </span>
        </Link>
        <button type="button" className="tp-lang tp-press" aria-label={t("lang.change")} onClick={() => setLanguageOpen(true)}>
          <MaterialSymbol name="translate" />
          <span lang={lang}>{languageName}</span>
        </button>
        <button
          type="button"
          className="tp-bell tp-press"
          aria-label={unread > 0 ? t("home.messagesNew", { n: unread }) : t("home.messages")}
          onClick={onOpenMessages}
        >
          <MaterialSymbol name="notifications" />
          {unread > 0 ? <i>{unread > 9 ? "9+" : unread}</i> : null}
        </button>
      </div>

      {notice}

      <JobAlertsBanner />

      {pendingDues > 0 ? (
        <section className="tp-note is-due" data-testid="technician-dues">
          <div className="tp-note-row">
            <MaterialSymbol name="receipt_long" />
            <div>
              <b>{t("home.dueTitle", { amount: dues })}</b>
              <span>{t("home.dueSub")}</span>
            </div>
          </div>
          <button type="button" className="tp-big is-red tp-press" onClick={onPayDues}>
            {t("home.duePay", { amount: dues })}
          </button>
        </section>
      ) : null}

      <section className={cn("tp-duty", !isOnline && "is-off")} data-testid="technician-duty" data-state={isOnline ? "on" : "off"}>
        <div className="tp-duty-row">
          <span className="tp-duty-mark" aria-hidden="true">
            <MaterialSymbol name={isOnline ? "check" : "close"} />
          </span>
          <span className="tp-duty-text" role="status">
            <b>{t(isOnline ? "home.on" : "home.off")}</b>
            <span>{t(isOnline ? "home.onSub" : "home.offSub")}</span>
          </span>
        </div>
        {isOnline ? (
          <>
            <p className="tp-wait">
              <MaterialSymbol name="notifications_active" />
              <span>{t("home.wait")}</span>
            </p>
            <button type="button" className="tp-big is-plain tp-press" onClick={() => onToggleAvailability(false)}>
              {t("home.goOff")}
            </button>
          </>
        ) : (
          <button type="button" className="tp-big tp-press" onClick={() => onToggleAvailability(true)}>
            <MaterialSymbol name="bolt" />
            {t("home.goOn")}
          </button>
        )}
      </section>

      <Link to="/technician/earnings" className="tp-today tp-press" data-testid="technician-today">
        <span className="tp-today-main">
          <small>{t("home.today")}</small>
          <b className="tp-pj">{techRupees(todayEarnings)}</b>
          <span>{jobsToday}</span>
        </span>
        <span className="tp-today-side">
          <span className="tp-pts">
            <MaterialSymbol name="workspace_premium" />
            {t("home.points", { n: points })}
          </span>
          <MaterialSymbol name="chevron_right" className="tp-go" />
        </span>
      </Link>

      <div className="tp-grid">
        <Link to="/technician/earnings" className="tp-tile tp-press">
          <span className="tp-ic is-green" aria-hidden="true"><MaterialSymbol name="account_balance_wallet" /></span>
          <b>{t("home.money")}</b>
          <span className="is-money">{t("home.moneySub", { amount: techRupees(withdrawable) })}</span>
        </Link>
        <Link to="/technician/history" className="tp-tile tp-press">
          <span className="tp-ic is-blue" aria-hidden="true"><MaterialSymbol name="build" /></span>
          <b>{t("home.jobs")}</b>
          <span>{t("home.jobsSub", { n: jobsDone })}</span>
        </Link>
        {towing ? (
          <>
            <button type="button" className="tp-tile tp-press" onClick={onOpenFleet}>
              <span className="tp-ic" aria-hidden="true">
                {towArt ? <img src={towArt} alt="" draggable={false} /> : <MaterialSymbol name="auto_towing" />}
              </span>
              <b>{t("home.vehicles")}</b>
              <span>{t("home.vehiclesSub", { n: fleetCount })}</span>
            </button>
            <button type="button" className="tp-tile tp-press" onClick={onOpenTeam}>
              <span className="tp-ic" aria-hidden="true"><MaterialSymbol name="groups" /></span>
              <b>{t("home.team")}</b>
              <span>{t("home.teamSub", { n: teamCount })}</span>
            </button>
          </>
        ) : null}
        <Link to="/technician/reviews" className="tp-tile tp-press">
          <span className="tp-ic is-amber" aria-hidden="true"><MaterialSymbol name="star" /></span>
          <b>{t("home.rating")}</b>
          <span>{rating == null ? t("home.ratingNone") : t("home.ratingSub", { n: rating.toFixed(1) })}</span>
        </Link>
        <a href={`tel:${TECH_SUPPORT_PHONE}`} className="tp-tile tp-press">
          <span className="tp-ic is-red" aria-hidden="true"><MaterialSymbol name="call" /></span>
          <b>{t("home.help")}</b>
          <span>{t("home.helpSub")}</span>
        </a>
      </div>

      <TechLanguageSheet open={languageOpen} onClose={() => setLanguageOpen(false)} />
    </div>
  );
}
