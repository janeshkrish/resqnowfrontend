import { Boxes, CheckCheck, CircleDot, Hourglass, PackageOpen } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type OrderOverviewGridProps = {
  counts: {
    newOrders: number;
    assigned: number;
    acknowledged: number;
    inProgress: number;
    completed: number;
  };
  onViewHistory: () => void;
};

const items = [
  {
    key: "newOrders",
    label: "New Orders",
    icon: PackageOpen,
    tint: "bg-sky-50 text-sky-700",
  },
  {
    key: "assigned",
    label: "Assigned",
    icon: Boxes,
    tint: "bg-amber-50 text-amber-700",
  },
  {
    key: "acknowledged",
    label: "Acknowledged",
    icon: CircleDot,
    tint: "bg-indigo-50 text-indigo-700",
  },
  {
    key: "inProgress",
    label: "In-Progress",
    icon: Hourglass,
    tint: "bg-violet-50 text-violet-700",
  },
  {
    key: "completed",
    label: "Completed",
    icon: CheckCheck,
    tint: "bg-emerald-50 text-emerald-700",
  },
] as const;

const OrderOverviewGrid = ({ counts, onViewHistory }: OrderOverviewGridProps) => {
  return (
    <Card className="rounded-[1.75rem] border-border/70 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Orders
          </p>
          <CardTitle className="text-xl font-black tracking-tight">Order Overview</CardTitle>
        </div>
        <Button variant="ghost" onClick={onViewHistory} className="rounded-full text-sm font-semibold">
          View History
        </Button>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5 md:p-5">
        {items.map((item) => {
          const Icon = item.icon;
          const value = counts[item.key];
          return (
            <div
              key={item.key}
              className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4 transition-transform hover:-translate-y-0.5"
            >
              <div className={`mb-6 flex h-12 w-12 items-center justify-center rounded-2xl ${item.tint}`}>
                <Icon className="h-5 w-5" />
              </div>
              <p className="text-4xl font-black tracking-tight text-foreground">{value}</p>
              <p className="mt-2 text-sm font-medium text-muted-foreground">{item.label}</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default OrderOverviewGrid;
