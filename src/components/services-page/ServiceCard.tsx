
import { ArrowRight } from "lucide-react";
import { ServiceDetails } from "./types";

type ServiceCardProps = {
  service: ServiceDetails;
  onServiceClick: (serviceId: string) => void;
};

const ServiceCard = ({ service, onServiceClick }: ServiceCardProps) => {
  return (
    <div
      className="bg-white border-b border-slate-100 last:border-0 p-4 transition-colors hover:bg-slate-50 cursor-pointer flex items-center gap-4 active:bg-slate-100"
      onClick={() => onServiceClick(service.id)}
    >
      <div className="p-3.5 bg-rose-50 rounded-2xl shrink-0">
        {service.icon ? <service.icon className="h-6 w-6 text-rose-600" /> : null}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-base font-black text-slate-900 truncate tracking-tight">{service.name}</h3>
        <p className="text-xs font-medium text-slate-500 line-clamp-1 mt-1 pr-2">{service.description}</p>
      </div>

      <div className="shrink-0 pl-1">
        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center">
          <ArrowRight className="h-4 w-4 text-slate-400" />
        </div>
      </div>
    </div>
  );
};

export default ServiceCard;
