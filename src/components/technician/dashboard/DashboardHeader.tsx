import { Bell, Palette, MoreVertical, Shield, SlidersHorizontal, User2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type DashboardHeaderProps = {
  technicianName: string;
  technicianId: string;
  profileImageUrl?: string | null;
  pointsBalance: number;
  unreadNotifications: number;
  isOnline: boolean;
  onToggleAvailability: (checked: boolean) => void;
  onOpenNotifications: () => void;
  onViewProfile: () => void;
  onOpenAppearanceSettings: () => void;
  onOpenNotificationSettings: () => void;
  onOpenSecuritySettings: () => void;
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
  profileImageUrl,
  pointsBalance,
  unreadNotifications,
  isOnline,
  onToggleAvailability,
  onOpenNotifications,
  onViewProfile,
  onOpenAppearanceSettings,
  onOpenNotificationSettings,
  onOpenSecuritySettings,
}: DashboardHeaderProps) => {
  const controlItems = [
    {
      key: "profile",
      label: "View Profile",
      description: "Open technician details",
      icon: User2,
      onClick: onViewProfile,
    },
    {
      key: "appearance",
      label: "Appearance",
      description: "Theme and navigation",
      icon: Palette,
      onClick: onOpenAppearanceSettings,
    },
    {
      key: "notifications",
      label: "Notification Settings",
      description: "Alert preferences",
      icon: Bell,
      onClick: onOpenNotificationSettings,
    },
    {
      key: "security",
      label: "Security",
      description: "Password and app data",
      icon: Shield,
      onClick: onOpenSecuritySettings,
    },
  ];

  return (
    <section
      id="dashboard-home"
      className="overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#0f172a_0%,#172554_42%,#2563eb_100%)] text-white shadow-[0_24px_60px_-28px_rgba(37,99,235,0.65)]"
    >
      <div className="space-y-5 p-5 md:p-7">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="h-14 w-14 border border-white/20 bg-white/10 shadow-lg">
              {profileImageUrl ? (
                <AvatarImage src={profileImageUrl} alt={`${technicianName} profile`} />
              ) : null}
              <AvatarFallback className="bg-white/10 text-base font-bold text-white">
                {getInitials(technicianName) || <User2 className="h-5 w-5" />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-white/12 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-white/90">
                  ResQNow
                </span>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                  Technician Dashboard
                </p>
              </div>
              <h1 className="mt-3 max-w-[18rem] text-2xl font-black leading-tight tracking-tight break-words md:max-w-[24rem] md:text-3xl">
                Hello, {technicianName}
              </h1>
              <p className="mt-2 text-sm text-white/70">SP ID: {technicianId}</p>
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
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/15"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[88vw] max-w-sm border-l border-slate-200 bg-slate-50 p-0"
              >
                <div className="flex h-full flex-col">
                  <SheetHeader className="gap-0 border-b border-slate-200 bg-white px-5 pb-5 pt-10 text-left">
                    <div className="flex items-center gap-4 pr-8">
                      <Avatar className="h-16 w-16 border border-slate-200 bg-slate-100 shadow-sm">
                        {profileImageUrl ? (
                          <AvatarImage src={profileImageUrl} alt={`${technicianName} profile`} />
                        ) : null}
                        <AvatarFallback className="bg-slate-100 text-lg font-black text-slate-900">
                          {getInitials(technicianName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <SheetTitle className="truncate text-xl font-black tracking-tight text-slate-900">
                          {technicianName}
                        </SheetTitle>
                        <SheetDescription className="mt-1 text-sm text-slate-500">
                          SP ID: {technicianId}
                        </SheetDescription>
                        <p className="mt-3 inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                          {isOnline ? "Online" : "Offline"}
                        </p>
                      </div>
                    </div>
                  </SheetHeader>

                  <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
                    <div className="rounded-[1.5rem] bg-[linear-gradient(160deg,#0f172a_0%,#111827_100%)] p-5 text-white shadow-[0_18px_40px_-25px_rgba(15,23,42,0.9)]">
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-400/15 text-amber-300">
                          <SlidersHorizontal className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/55">
                            Points System
                          </p>
                          <p className="mt-1 text-sm text-white/70">
                            Calculated from live earnings and completed jobs
                          </p>
                        </div>
                      </div>
                      <p className="mt-6 text-4xl font-black tracking-tight">{pointsBalance}</p>
                    </div>

                    <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        UCP Controls
                      </p>
                      <div className="mt-4 grid gap-3">
                        {controlItems.map((item) => {
                          const Icon = item.icon;
                          return (
                            <SheetClose asChild key={item.key}>
                              <Button
                                variant="ghost"
                                onClick={item.onClick}
                                className="h-auto justify-start rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-4 text-left hover:bg-slate-100"
                              >
                                <span className="mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                                  <Icon className="h-5 w-5" />
                                </span>
                                <span className="flex min-w-0 flex-col">
                                  <span className="text-sm font-bold text-slate-900">{item.label}</span>
                                  <span className="text-xs text-slate-500">{item.description}</span>
                                </span>
                              </Button>
                            </SheetClose>
                          );
                        })}
                      </div>
                    </div>

                    <SheetClose asChild>
                      <Button
                        onClick={onViewProfile}
                        className="w-full rounded-[1.25rem] bg-gradient-to-r from-slate-900 to-red-950 text-white hover:from-slate-800 hover:to-red-900"
                      >
                        Open Profile Panel
                      </Button>
                    </SheetClose>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
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
