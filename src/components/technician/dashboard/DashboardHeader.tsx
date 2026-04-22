import { Bell, Star, User2 } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type DashboardHeaderProps = {
  technicianName: string;
  technicianId: string;
  pointsBalance: number;
  unreadNotifications: number;
  isOnline: boolean;
  onToggleAvailability: (checked: boolean) => void;
  onOpenNotifications: () => void;
};

const getInitials = (name: string) =>
  String(name || "T")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] || "")
    .join("")
    .toUpperCase();

const DashboardHeader = ({
  technicianName,
  technicianId,
  pointsBalance,
  unreadNotifications,
  isOnline,
  onToggleAvailability,
  onOpenNotifications,
}: DashboardHeaderProps) => {
  return (
    <section
      id="dashboard-home"
      className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#0f172a_0%,#172554_42%,#2563eb_100%)] text-white shadow-[0_24px_60px_-28px_rgba(37,99,235,0.65)]"
    >
      <div className="space-y-5 p-5 md:p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="h-14 w-14 border border-white/20 bg-white/10 shadow-lg">
              <AvatarFallback className="bg-white/10 text-base font-bold text-white">
                {getInitials(technicianName) || <User2 className="h-5 w-5" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                Technician Dashboard
              </p>
              <h1 className="truncate text-2xl font-black tracking-tight md:text-3xl">
                Hello, {technicianName}
              </h1>
              <p className="mt-1 text-sm text-white/70">SP ID: {technicianId}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenNotifications}
              className="relative h-11 w-11 rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/15"
            >
              <Bell className="h-5 w-5" />
              {unreadNotifications > 0 ? (
                <span className="absolute right-2 top-2 inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
              ) : null}
            </Button>
            <Badge className="flex h-11 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/10">
              <Star className="h-4 w-4 fill-amber-300 text-amber-300" />
              {pointsBalance}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-[1.5rem] border border-white/10 bg-white/10 p-4 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
              Availability
            </p>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  isOnline ? "bg-emerald-400 shadow-[0_0_18px_rgba(74,222,128,0.9)]" : "bg-white/30"
                )}
              />
              <span className="text-sm font-semibold">
                {isOnline ? "Online and receiving jobs" : "Offline for new jobs"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-white/70">Go {isOnline ? "offline" : "online"}</span>
            <Switch
              checked={isOnline}
              onCheckedChange={onToggleAvailability}
              className="data-[state=checked]:bg-emerald-500"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default DashboardHeader;
