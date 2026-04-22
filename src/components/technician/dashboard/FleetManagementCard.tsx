import { Truck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type FleetManagementCardProps = {
  activeVehicles: number;
  onManageFleet: () => void;
  onAddVehicle: () => void;
};

const FleetManagementCard = ({
  activeVehicles,
  onManageFleet,
  onAddVehicle,
}: FleetManagementCardProps) => {
  return (
    <Card className="overflow-hidden rounded-[1.75rem] border-border/70 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]">
      <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(180px,0.92fr)] md:p-5">
        <div className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
            <Truck className="h-5 w-5" />
          </div>
          <div className="mt-8">
            <p className="text-4xl font-black tracking-tight text-foreground">{activeVehicles}</p>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              Active vehicle classes
            </p>
          </div>
          <Button
            variant="ghost"
            onClick={onManageFleet}
            className="mt-6 h-auto px-0 text-sm font-semibold text-slate-600 hover:bg-transparent hover:text-slate-900"
          >
            Manage
          </Button>
        </div>

        <div className="flex min-h-[220px] flex-col justify-between rounded-[1.5rem] bg-[linear-gradient(165deg,#2563eb_0%,#1d4ed8_48%,#1e3a8a_100%)] p-5 text-white shadow-[0_18px_45px_-25px_rgba(37,99,235,0.85)]">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10">
            <Plus className="h-6 w-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black tracking-tight">Add Vehicle</h3>
            <p className="text-sm text-blue-100">Update your supported fleet and service coverage.</p>
          </div>
          <Button
            onClick={onAddVehicle}
            className="w-fit rounded-full bg-white px-5 text-sm font-bold text-blue-700 hover:bg-blue-50"
          >
            Start Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FleetManagementCard;
