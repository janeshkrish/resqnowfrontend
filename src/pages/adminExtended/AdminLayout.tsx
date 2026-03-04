import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  CircleDollarSign,
  Gauge,
  MessageSquareWarning,
  Users,
  Wrench,
  Menu,
  LogOut,
} from "lucide-react";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const navItems: NavItem[] = [
  { to: "/admin/extended/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/admin/extended/requests", label: "Requests", icon: Wrench },
  { to: "/admin/extended/technicians", label: "Technicians", icon: Users },
  { to: "/admin/extended/finance", label: "Finance", icon: CircleDollarSign },
  { to: "/admin/extended/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/extended/complaints", label: "Complaints", icon: MessageSquareWarning },
  { to: "/admin/extended/notifications", label: "Notifications", icon: Bell },
];

export default function AdminLayout() {
  const { adminUser, logoutAdmin } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const activePage = useMemo(
    () => navItems.find((item) => location.pathname.startsWith(item.to))?.label || "Admin",
    [location.pathname]
  );

  const renderNavLink = (item: NavItem, compact = false) => {
    const Icon = item.icon;
    return (
      <NavLink
        key={item.to}
        to={item.to}
        onClick={() => setMobileSidebarOpen(false)}
        className={({ isActive }) =>
          `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            isActive
              ? "bg-slate-900 text-white shadow-lg shadow-slate-900/20"
              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          } ${compact ? "justify-center px-2" : ""}`
        }
      >
        <Icon className="h-4 w-4" />
        {!compact ? <span>{item.label}</span> : null}
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen bg-slate-100/70">
      <div className="mx-auto grid min-h-screen max-w-[1600px] grid-cols-1 md:grid-cols-[260px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-white p-5 md:flex md:flex-col">
          <button
            type="button"
            onClick={() => navigate("/admin/dashboard")}
            className="mb-8 rounded-2xl bg-slate-900 p-4 text-left text-white transition hover:bg-slate-800"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-slate-300">ResQNow</p>
            <h1 className="mt-2 text-lg font-semibold">Extended Admin</h1>
            <p className="mt-1 text-xs text-slate-300">Operations control center</p>
          </button>
          <nav className="space-y-1">{navItems.map((item) => renderNavLink(item))}</nav>
          <div className="mt-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
            Live environment dashboards with API-backed controls.
          </div>
        </aside>

        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMobileSidebarOpen((prev) => !prev)}
                  className="inline-flex items-center justify-center rounded-lg border border-slate-200 p-2 text-slate-700 md:hidden"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Admin Panel</p>
                  <h2 className="text-lg font-semibold text-slate-900">{activePage}</h2>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold text-slate-900">{adminUser?.name || "Administrator"}</p>
                  <p className="text-xs text-slate-500">{adminUser?.email || "admin@resqnow.org"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void logoutAdmin()}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  <LogOut className="h-4 w-4" /> Logout
                </button>
              </div>
            </div>

            {mobileSidebarOpen ? (
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 md:hidden">
                {navItems.map((item) => renderNavLink(item, true))}
              </div>
            ) : null}
          </header>

          <main className="flex-1 p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
