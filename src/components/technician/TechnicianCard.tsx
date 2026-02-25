
import { Star, Shield, Clock, CheckCircle2 } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Technician } from "./types";
import { cn } from "@/lib/utils";

interface TechnicianCardProps {
  technician: Technician;
  isSelected: boolean;
  onSelect: (techId: string) => void;
}

export const renderStars = (rating: number) => {
  return (
    <div className="flex items-center">
      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
      <span className="ml-1 text-sm font-bold text-gray-900">{rating}</span>
    </div>
  );
};

const TechnicianCard = ({ technician, isSelected, onSelect }: TechnicianCardProps) => {
  // Limit shown specialties to prevent clutter
  const displayedSpecialties = technician.specialties.slice(0, 2);
  const remainingSpecialties = technician.specialties.length - 2;

  return (
    <div
      className={cn(
        "relative flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer active:scale-[0.98]",
        isSelected
          ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20"
          : "border-border/60 bg-card dark:bg-slate-900 hover:border-primary/30 hover:shadow-sm"
      )}
      onClick={() => onSelect(technician.id)}
    >
      {/* Avatar Section */}
      <div className="relative flex-shrink-0">
        <Avatar className="h-14 w-14 border-2 border-white shadow-sm">
          <AvatarImage src={technician.avatar} alt={technician.name} className="object-cover" />
          <AvatarFallback className="bg-primary/10 text-primary font-bold">
            {technician.name.substring(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {technician.verified && (
          <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-0.5 rounded-full border-2 border-white">
            <Shield className="h-3 w-3 fill-current" />
          </div>
        )}
      </div>

      {/* Main Info Section */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start">
          <div>
            <h4 className="font-bold text-gray-900 leading-tight truncate pr-2">
              {technician.name}
            </h4>
            <div className="flex items-center gap-2 mt-1 mb-1.5 text-xs text-gray-500">
              {renderStars(technician.rating)}
              <span>•</span>
              <span>{technician.completedJobs} jobs</span>
            </div>
          </div>

          {/* Price / Selection Indicator */}
          <div className="flex flex-col items-end flex-shrink-0">
            {typeof technician.price === 'number' ? (
              <div className="text-lg font-bold text-gray-900">{technician.currency}{technician.price}</div>
            ) : (
              <div className="text-xs text-gray-400 font-medium italic">Price TBD</div>
            )}
          </div>
        </div>

        {/* Badges & Specs - Compact */}
        <div className="flex items-center gap-2 mt-1">
          <div className="flex flex-wrap gap-1.5 overflow-hidden h-6">
            {displayedSpecialties.map((spec) => (
              <span key={spec} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                {spec}
              </span>
            ))}
            {remainingSpecialties > 0 && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-50 text-gray-500 border border-gray-200">
                +{remainingSpecialties}
              </span>
            )}
          </div>
        </div>

        {/* ETA with Icon */}
        <div className="flex items-center gap-1 mt-2 text-xs font-semibold text-green-600">
          <Clock className="h-3 w-3" />
          <span>~{technician.estimatedArrival}</span>
          <span className="text-gray-400 font-normal ml-1">({technician.distance} away)</span>
        </div>
      </div>

      {/* Selection Circle Indicator (Right side) */}
      <div className={cn(
        "absolute top-4 right-4 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
        isSelected ? "border-primary bg-primary text-white" : "border-gray-300"
      )}>
        {isSelected && <CheckCircle2 className="h-4 w-4" />}
      </div>
    </div>
  );
};

export default TechnicianCard;
