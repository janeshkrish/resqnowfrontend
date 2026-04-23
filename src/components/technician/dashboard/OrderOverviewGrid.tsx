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

const summaryItems = [
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
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-4">
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
      <CardContent className="space-y-3 p-4 pt-0 md:p-5 md:pt-0">
        <div className="overflow-hidden rounded-[1.5rem] bg-[linear-gradient(145deg,#eff6ff_0%,#dbeafe_52%,#c7d2fe_100%)] p-5 shadow-[0_20px_45px_-35px_rgba(37,99,235,0.8)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-900/55">
                New Orders
              </p>
              <p className="mt-5 text-5xl font-black tracking-tight text-slate-900">
                {counts.newOrders}
              </p>
              <p className="mt-3 text-sm font-medium text-slate-600">
                Fresh requests waiting in your queue
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-sky-700 shadow-sm">
              <PackageOpen className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {summaryItems.map((item) => {
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
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderOverviewGrid;
