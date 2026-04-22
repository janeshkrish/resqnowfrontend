import { Bell, Globe2, LayoutDashboard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type QuickActionsProps = {
  notificationCount: number;
  selectedLanguage: string;
  onOpenUcp: () => void;
  onOpenNotifications: () => void;
  onLanguageChange: (value: string) => void;
};

const QuickActions = ({
  notificationCount,
  selectedLanguage,
  onOpenUcp,
  onOpenNotifications,
  onLanguageChange,
}: QuickActionsProps) => {
  return (
    <Card id="dashboard-quick-actions" className="rounded-[1.75rem] border-border/70 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)]">
      <CardHeader className="pb-2">
        <CardTitle className="text-xl font-black tracking-tight">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 p-4 sm:grid-cols-3 md:p-5">
        <Button
          variant="ghost"
          onClick={onOpenUcp}
          className="h-auto flex-col rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-5 hover:bg-slate-100"
        >
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <LayoutDashboard className="h-5 w-5" />
          </span>
          <span className="text-sm font-bold text-foreground">UCP</span>
          <span className="mt-1 text-xs text-muted-foreground">Open control panel</span>
        </Button>

        <Button
          variant="ghost"
          onClick={onOpenNotifications}
          className="relative h-auto flex-col rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-5 hover:bg-slate-100"
        >
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <Bell className="h-5 w-5" />
          </span>
          {notificationCount > 0 ? (
            <span className="absolute right-4 top-4 inline-flex min-w-6 items-center justify-center rounded-full bg-rose-500 px-2 py-1 text-[10px] font-bold text-white">
              {notificationCount}
            </span>
          ) : null}
          <span className="text-sm font-bold text-foreground">Notifications</span>
          <span className="mt-1 text-xs text-muted-foreground">View latest alerts</span>
        </Button>

        <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
            <Globe2 className="h-5 w-5" />
          </div>
          <p className="text-sm font-bold text-foreground">Language</p>
          <p className="mt-1 text-xs text-muted-foreground">Choose your dashboard language</p>
          <Select value={selectedLanguage} onValueChange={onLanguageChange}>
            <SelectTrigger className="mt-4 h-11 rounded-xl border-white bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">EN</SelectItem>
              <SelectItem value="hi">HI</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
};

export default QuickActions;
