import { ArrowRight, CircleSlash2, Landmark, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/utils/technicianDashboard";

type EarningsSectionProps = {
  totalEarnings: number;
  withdrawableBalance: number;
  breakdown: {
    pending: number;
    paid: number;
    disputed: number;
  };
  onOpenFinancialReport: () => void;
};

const EarningsSection = ({
  totalEarnings,
  withdrawableBalance,
  breakdown,
  onOpenFinancialReport,
}: EarningsSectionProps) => {
  return (
    <Card
      id="dashboard-earnings"
      className="overflow-hidden rounded-[1.75rem] border-none bg-[linear-gradient(160deg,#0f172a_0%,#111827_100%)] text-white shadow-[0_24px_60px_-30px_rgba(15,23,42,0.85)]"
    >
      <CardHeader className="pb-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/50">
              Earnings
            </p>
            <CardTitle className="mt-2 text-3xl font-black tracking-tight text-white">
              {formatCurrency(totalEarnings)}
            </CardTitle>
            <p className="mt-2 text-sm text-white/70">
              Withdrawable now: {formatCurrency(withdrawableBalance)}
            </p>
          </div>
          <Button
            onClick={onOpenFinancialReport}
            className="rounded-full bg-white px-5 font-semibold text-slate-900 hover:bg-slate-100"
          >
            Financial Report
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 md:p-5 md:pt-0">
        <Tabs defaultValue="pending">
          <TabsList className="grid h-auto w-full grid-cols-3 rounded-2xl bg-white/10 p-1 text-white/70">
            <TabsTrigger value="pending" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-900">
              Pending
            </TabsTrigger>
            <TabsTrigger value="paid" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-900">
              Paid
            </TabsTrigger>
            <TabsTrigger value="disputed" className="rounded-xl data-[state=active]:bg-white data-[state=active]:text-slate-900">
              Disputed
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.5rem] bg-white/10 p-5">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
                  <Wallet className="h-5 w-5" />
                </div>
                <p className="text-3xl font-black tracking-tight">{formatCurrency(breakdown.pending)}</p>
                <p className="mt-2 text-sm text-white/65">Held in current payout cycle</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 p-5">
                <p className="text-sm font-semibold text-white">What this means</p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Pending balance reflects withdrawal requests and amounts still being processed by the payout team.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="paid" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.5rem] bg-white/10 p-5">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
                  <Landmark className="h-5 w-5" />
                </div>
                <p className="text-3xl font-black tracking-tight">{formatCurrency(breakdown.paid)}</p>
                <p className="mt-2 text-sm text-white/65">Settled to your account so far</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 p-5">
                <p className="text-sm font-semibold text-white">Payouts</p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Paid totals come from wallet debits recorded after manual payout settlement by the admin team.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="disputed" className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-[1.5rem] bg-white/10 p-5">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-400/15 text-rose-300">
                  <CircleSlash2 className="h-5 w-5" />
                </div>
                <p className="text-3xl font-black tracking-tight">{formatCurrency(breakdown.disputed)}</p>
                <p className="mt-2 text-sm text-white/65">Rejected or disputed requests</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 p-5">
                <p className="text-sm font-semibold text-white">Follow-up</p>
                <p className="mt-2 text-sm leading-6 text-white/70">
                  Disputed totals are derived from rejected or failed withdrawal requests so they stay visible in the dashboard.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default EarningsSection;
