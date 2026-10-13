import { Link, Navigate } from "react-router-dom";

import MaterialSymbol from "@/components/home/MaterialSymbol";
import { TechPage } from "@/components/technician/app/TechUi";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { TECH_SUPPORT_PHONE } from "@/lib/technicianApp";
import { useTechText } from "@/lib/technicianLanguage";

const TechnicianVerification = () => {
  const { technician, isAuthenticated } = useTechnicianAuth();
  const { t } = useTechText();

  if (!isAuthenticated) {
    return <Navigate to="/technician/login" replace />;
  }

  const renderStatusContent = () => {
    switch (technician?.verification_status) {
      case "pending":
        return (
          <>
            <div className="tp-status" data-status="pending">
              <MaterialSymbol name="hourglass_top" />
              <h2 className="tp-pj">{t("verify.waitTitle")}</h2>
              <p>{t("verify.waitSub")}</p>
            </div>
            <h2 className="tp-h2 tp-pj">{t("verify.next")}</h2>
            <div className="tp-list">
              <ol className="tp-steps">
                <li><i aria-hidden="true">1</i>{t("verify.step1")}</li>
                <li><i aria-hidden="true">2</i>{t("verify.step2")}</li>
                <li><i aria-hidden="true">3</i>{t("verify.step3")}</li>
              </ol>
            </div>
          </>
        );
      case "verified":
        return (
          <>
            <div className="tp-status is-ok" data-status="verified">
              <MaterialSymbol name="check" />
              <h2 className="tp-pj">{t("verify.okTitle")}</h2>
              <p>{t("verify.okSub")}</p>
            </div>
            <Link to="/technician/dashboard" className="tp-big tp-press" style={{ marginTop: 16 }}>
              {t("verify.okGo")}
            </Link>
          </>
        );
      case "rejected":
        return (
          <>
            <div className="tp-status is-no" data-status="rejected">
              <MaterialSymbol name="close" />
              <h2 className="tp-pj">{t("verify.noTitle")}</h2>
              <p>{t("verify.noSub")}</p>
            </div>
            <h2 className="tp-h2 tp-pj">{t("verify.canDo")}</h2>
            <p className="tp-fine" style={{ marginTop: 0 }}>{t("verify.canDoText")}</p>
            <Link to="/contact" className="tp-big is-ink tp-press" style={{ marginTop: 16 }}>
              {t("verify.contact")}
            </Link>
          </>
        );
      default:
        return (
          <div className="tp-status" data-status="unknown">
            <MaterialSymbol name="info" />
            <p>{t("verify.unknown")}</p>
          </div>
        );
    }
  };

  return (
    <TechPage tab="home" bare testId="technician-verification">
      <h1 className="tp-h1 tp-pj">{t("verify.title")}</h1>
      <p className="tp-sub">{[technician?.name, technician?.email].filter(Boolean).join(" · ")}</p>
      {renderStatusContent()}
      <a className="tp-big is-plain is-help tp-press" href={`tel:${TECH_SUPPORT_PHONE}`} style={{ marginTop: 16 }}>
        <MaterialSymbol name="call" />
        {t("common.callHelp")}
      </a>
      <p className="tp-fine" style={{ textAlign: "center" }}>{t("verify.write")}</p>
    </TechPage>
  );
};

export default TechnicianVerification;
