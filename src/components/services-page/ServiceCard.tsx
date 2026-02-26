
import { ArrowRight } from "lucide-react";
import { ServiceDetails } from "./types";

type ServiceCardProps = {
  service: ServiceDetails;
  onServiceClick: (serviceId: string) => void;
};

const ServiceCard = ({ service, onServiceClick }: ServiceCardProps) => {
  return (
    <div
      className="bg-card dark:bg-slate-900 border-b border-border last:border-0 p-4 transition-colors hover:bg-muted cursor-pointer flex items-center gap-4 active:bg-muted/50"
      onClick={() => onServiceClick(service.id)}
    >
      <div className="p-3.5 bg-rose-50 rounded-2xl shrink-0">
        {service.icon ? <service.icon className="h-6 w-6 text-rose-600" /> : null}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-base font-black text-foreground truncate tracking-tight">{service.name}</h3>
        <p className="text-xs font-medium text-muted-foreground/80 line-clamp-1 mt-1 pr-2">{service.description}</p>
      </div>

      <div className="shrink-0 pl-1">
        <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center">
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </div>
      </div>
    </div>
  );
};

export default ServiceCard;
