import MaterialSymbol from "@/components/home/MaterialSymbol";
import { techDayLabel, techServiceName, techTime, useTechText } from "@/lib/technicianLanguage";
import { cn } from "@/lib/utils";

export interface CancelledJobDetails {
  id: string;
  contactName?: string | null;
  address?: string | null;
  cancellationReason?: string | null;
  serviceType?: string | null;
  cancelledAt?: string | null;
}

interface CancelledJobCardProps {
  job: CancelledJobDetails;
  onViewDetails?: (job: CancelledJobDetails) => void;
  className?: string;
}

const CancelledJobCard = ({
  job,
  onViewDetails,
  className,
}: CancelledJobCardProps) => {
  const { lang, t } = useTechText();
  const customerLabel = String(job.contactName || "").trim() || t("cancelled.customer");
  const serviceLabel = techServiceName(lang, job.serviceType);
  const locationLabel = String(job.address || "").trim();
  const reasonLabel = String(job.cancellationReason || "").trim();
  const cancelledAtLabel = [techDayLabel(lang, job.cancelledAt), techTime(lang, job.cancelledAt)].filter(Boolean).join(" · ");

  return (
    <section className={cn("tp-note is-due", className)} data-testid="cancelled-job">
      <div className="tp-note-row">
        <MaterialSymbol name="cancel" />
        <div>
          <b>{t("cancelled.title")}</b>
          <span>{t("cancelled.text", { name: customerLabel, service: serviceLabel })}</span>
          {reasonLabel ? <span>{t("cancelled.reason", { reason: reasonLabel })}</span> : null}
          <span>{[`#${job.id}`, locationLabel, cancelledAtLabel].filter(Boolean).join(" · ")}</span>
        </div>
      </div>
      <button type="button" className="tp-big is-plain tp-press" onClick={() => onViewDetails?.(job)}>
        {t("cancelled.see")}
      </button>
    </section>
  );
};

export default CancelledJobCard;
