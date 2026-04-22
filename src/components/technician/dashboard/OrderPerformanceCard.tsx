import { Clock3, TimerOff } from "lucide-react";
import { Pie, PieChart, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type OrderPerformanceCardProps = {
  totalOrders: number;
  onTimeOrders: number;
  lateOrders: number;
  lastOrder: {
    id: string;
    serviceType: string;
    lateByMinutes: number | null;
    statusLabel: string;
  } | null;
};

const CHART_COLORS = {
  onTime: "#16a34a",
  late: "#dc2626",
  empty: "#e2e8f0",
};

const OrderPerformanceCard = ({
  totalOrders,
  onTimeOrders,
  lateOrders,
  lastOrder,
}: OrderPerformanceCardProps) => {
  const chartData =
    totalOrders > 0
      ? [
          { name: "On Time", value: onTimeOrders, color: CHART_COLORS.onTime },
          { name: "Late", value: lateOrders, color: CHART_COLORS.late },
        ]
      : [{ name: "No Orders", value: 1, color: CHART_COLORS.empty }];

  return (
    <Card className="rounded-[1.75rem] border-border/70 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]">
      <CardHeader className="space-y-1 pb-0">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
          Order Performance
        </p>
        <CardTitle className="text-xl font-black tracking-tight">Order Statistics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 p-4 md:p-5">
        <div className="grid items-center gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
          <div className="relative h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  innerRadius={48}
                  outerRadius={72}
                  startAngle={90}
                  endAngle={-270}
                  strokeWidth={0}
                  paddingAngle={totalOrders > 0 ? 4 : 0}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Total
              </span>
              <span className="text-4xl font-black tracking-tight text-foreground">{totalOrders}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-emerald-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-emerald-600" />
                <span className="text-sm font-semibold text-emerald-900">On Time</span>
              </div>
              <span className="text-sm font-black text-emerald-900">
                {totalOrders > 0 ? Math.round((onTimeOrders / totalOrders) * 100) : 0}%
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-rose-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full bg-rose-600" />
                <span className="text-sm font-semibold text-rose-900">Late</span>
              </div>
              <span className="text-sm font-black text-rose-900">
                {totalOrders > 0 ? Math.round((lateOrders / totalOrders) * 100) : 0}%
              </span>
            </div>
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Last Order
              </p>
              {lastOrder ? (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-bold text-foreground">#{lastOrder.id}</p>
                    <Badge variant="outline" className="rounded-full capitalize">
                      {lastOrder.statusLabel}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{lastOrder.serviceType}</p>
                  {lastOrder.lateByMinutes != null && lastOrder.lateByMinutes > 0 ? (
                    <div className="flex items-center gap-2 text-sm font-semibold text-rose-600">
                      <TimerOff className="h-4 w-4" />
                      Late by {lastOrder.lateByMinutes} mins
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                      <Clock3 className="h-4 w-4" />
                      Running on time
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No fulfilled orders yet.</p>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderPerformanceCard;
