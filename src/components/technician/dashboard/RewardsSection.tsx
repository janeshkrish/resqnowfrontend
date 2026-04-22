import { Gift, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

type RewardItem = {
  id: string;
  title: string;
  subtitle: string;
  pointsRequired: number;
  progress: number;
  redeemable: boolean;
};

type RewardsSectionProps = {
  pointsBalance: number;
  items: RewardItem[];
};

const iconMap = [Gift, ShieldCheck, Sparkles];

const RewardsSection = ({ pointsBalance, items }: RewardsSectionProps) => {
  return (
    <Card
      id="dashboard-rewards"
      className="overflow-hidden rounded-[1.75rem] border-border/70 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]"
    >
      <div className="bg-[linear-gradient(135deg,#fde68a_0%,#fb7185_100%)] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-700/70">
              Current Balance
            </p>
            <p className="mt-3 text-4xl font-black tracking-tight text-slate-900">{pointsBalance}</p>
            <p className="mt-2 text-sm font-medium text-slate-800/70">Points available for redemption</p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/25 text-slate-900">
            <Trophy className="h-7 w-7" />
          </div>
        </div>
      </div>

      <CardContent className="space-y-4 p-4 md:p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Redeem Your Points
            </p>
            <h3 className="mt-1 text-lg font-black tracking-tight text-foreground">Rewards</h3>
          </div>
        </div>

        <div className="space-y-3">
          {items.map((item, index) => {
            const Icon = iconMap[index % iconMap.length];
            return (
              <div key={item.id} className="rounded-[1.5rem] border border-slate-200/80 bg-slate-50/80 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="mt-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground">{item.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{item.subtitle}</p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={item.redeemable ? "border-emerald-200 bg-emerald-50 text-emerald-700" : ""}
                  >
                    {item.pointsRequired} pts
                  </Badge>
                </div>
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span>{item.redeemable ? "Ready to redeem" : "Progress"}</span>
                    <span>{item.progress}%</span>
                  </div>
                  <Progress value={item.progress} className="h-2.5 bg-slate-200" />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default RewardsSection;
