
import React, { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Users,
  Settings,
  BarChart3,
  CreditCard,
  Home,
  LogOut,
  Bell,
  ChevronLeft,
  ChevronRight,
  Shield
} from "lucide-react";
import { apiFetch, apiUrl, FRONTEND_ONLY_MODE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

import { useAdminAuth } from "@/contexts/AdminAuthContext";

const AdminDashboardLayout = () => {
  const { logoutAdmin } = useAdminAuth();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  // Notification State
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const LIMIT = 5;

  // 1. Initial Fetch & SSE Setup
  useEffect(() => {
    fetchNotifications(0, true);
    fetchUnreadCount();

    if (FRONTEND_ONLY_MODE) return;

    // SSE Connection
    const eventSource = new EventSource(apiUrl("/api/admin/notifications/stream"));

    eventSource.onmessage = (event) => {
      try {
        if (event.data === ": heartbeat") return;
        const data = JSON.parse(event.data);
        if (data.type === "notification") {
          // Add new notification to top
          setNotifications(prev => [data.data, ...prev]);
          setUnreadCount(prev => prev + 1);
          // Also update sidebar count if it's a technician application
          if (data.data.type === "technician_application") {
            setPendingCount(prev => prev + 1);
          }
        }
      } catch (err) {
        console.error("SSE Parse Error", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const fetchUnreadCount = async () => {
    try {
      const res = await apiFetch("/api/admin/notifications/count", { method: "GET", admin: true });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count || 0);
        setPendingCount(data.pendingApplications || 0);
      }
    } catch (err) {
      console.error("Failed to fetch notification count", err);
    }
  };

  const fetchNotifications = async (currentOffset: number, reset = false) => {
    setLoading(true);
    try {
      const res = await apiFetch(`/api/admin/notifications?limit=${LIMIT}&offset=${currentOffset}`, { method: "GET", admin: true });
      if (res.ok) {
        const newNotifs = await res.json();
        if (reset) {
          setNotifications(newNotifs);
        } else {
          setNotifications(prev => [...prev, ...newNotifs]);
        }
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    } finally {
      setLoading(false);
    }
  };

  const loadMoreNotifications = () => {
    const newOffset = offset + LIMIT;
    setOffset(newOffset);
    fetchNotifications(newOffset);
  };

  const markAsRead = async (id: number) => {
    try {
      await apiFetch(`/api/admin/notifications/${id}/read`, { method: "POST", admin: true });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark read", err);
    }
  };

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  return (
    <div className="flex min-h-screen bg-muted/10">
      {/* Sidebar - fixed on mobile, relative on desktop */}
      <aside
        className={cn(
          "bg-card border-r border-border transition-all duration-300 ease-in-out flex-shrink-0",
          "fixed md:relative z-40 h-screen md:h-auto md:min-h-screen",
          isSidebarCollapsed ? "w-16" : "w-64 md:w-64",
          "md:block"
        )}
      >
        <div className="p-4 border-b border-border flex items-center justify-between">
          {!isSidebarCollapsed && (
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <h2 className="text-xl font-bold text-primary">Admin</h2>
            </div>
          )}
          {isSidebarCollapsed && <Shield className="h-6 w-6 text-primary mx-auto" />}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className={cn("ml-auto", isSidebarCollapsed && "mx-auto")}
          >
            {isSidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 py-4">
          <div className="space-y-1 px-3">
            <Link
              to="/admin/dashboard"
              className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md transition-colors",
                isActive("/admin/dashboard")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Home className="w-5 h-5 mr-3" />
              {!isSidebarCollapsed && <span>Dashboard</span>}
            </Link>

            <Link
              to="/admin/technicians"
              className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md transition-colors",
                isActive("/admin/technicians") || isActive("/admin/technician/")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Users className="w-5 h-5 mr-3" />
              {!isSidebarCollapsed && <span>Technicians</span>}
            </Link>

            <Link
              to="/admin/users"
              className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md transition-colors",
                isActive("/admin/users")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Users className="w-5 h-5 mr-3" />
              {!isSidebarCollapsed && <span>Users</span>}
            </Link>

            <Link
              to="/admin/applications"
              className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md transition-colors",
                isActive("/admin/applications")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Users className="w-5 h-5 mr-3" />
              {!isSidebarCollapsed && (
                <div className="flex items-center justify-between w-full">
                  <span>Applications</span>
                  {pendingCount > 0 && (
                    <Badge className="bg-primary text-xs">New</Badge>
                  )}
                </div>
              )}
              {isSidebarCollapsed && pendingCount > 0 && (
                <Badge className="ml-auto bg-primary text-xs">{pendingCount}</Badge>
              )}
            </Link>

            <Link
              to="/admin/analytics"
              className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md transition-colors",
                isActive("/admin/analytics")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <BarChart3 className="w-5 h-5 mr-3" />
              {!isSidebarCollapsed && <span>Analytics</span>}
            </Link>

            <Link
              to="/admin/payments"
              className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md transition-colors",
                isActive("/admin/payments")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <CreditCard className="w-5 h-5 mr-3" />
              {!isSidebarCollapsed && <span>Payments</span>}
            </Link>

            <Link
              to="/admin/settings"
              className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md transition-colors",
                isActive("/admin/settings")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Settings className="w-5 h-5 mr-3" />
              {!isSidebarCollapsed && <span>Settings</span>}
            </Link>

            {/* Extended Tools Link */}
            <Link
              to="/admin/extended/dashboard"
              className={cn(
                "flex items-center px-3 py-2 text-sm rounded-md transition-colors",
                isActive("/admin/extended")
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Settings className="w-5 h-5 mr-3" />
              {!isSidebarCollapsed && <span>Extended Tools</span>}
            </Link>
          </div>
        </nav>

        <div className="p-4 border-t border-border">
          <Button variant="outline" className="w-full justify-start" asChild>
            <Link to="/">
              <LogOut className="w-4 h-4 mr-2" />
              {!isSidebarCollapsed && <span>Exit Admin</span>}
            </Link>
          </Button>
        </div>
      </aside>

      {/* Main content - add left margin on desktop to prevent sidebar overlap */}
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300 min-w-0",
        !isSidebarCollapsed ? "md:ml-64" : "md:ml-16"
      )}>
        {/* Top nav */}
        <header className="border-b border-border bg-card h-14 md:h-16 flex items-center px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                className="md:hidden"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <h1 className="text-lg font-semibold">Admin Dashboard</h1>
            </div>

            <div className="flex items-center space-x-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full px-1.5 flex items-center justify-center min-w-[1.25rem] h-5">
                        {unreadCount}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <div className="flex items-center justify-between px-4 py-2 border-b">
                    <span className="font-medium">Notifications</span>
                    {unreadCount > 0 ? (
                      <Badge variant="secondary" className="ml-2">{unreadCount} new</Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">No new notifications</span>
                    )}
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No notifications found.
                      </div>
                    ) : (
                      notifications.map((notif: any) => (
                        <div
                          key={notif.id}
                          className={cn(
                            "px-4 py-3 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors",
                            !notif.is_read && "bg-primary/5"
                          )}
                          onClick={() => !notif.is_read && markAsRead(notif.id)}
                        >
                          <div className="flex justify-between items-start">
                            <span className={cn("font-medium", !notif.is_read && "text-primary")}>
                              {notif.title}
                            </span>
                            <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                              {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{notif.message}</p>
                        </div>
                      ))
                    )}

                    {notifications.length > 0 && (
                      <div className="p-2 text-center border-t border-border">
                        <Button
                          variant="ghost"
                          className="text-xs w-full"
                          onClick={(e) => {
                            e.preventDefault();
                            loadMoreNotifications();
                          }}
                          disabled={loading}
                        >
                          {loading ? "Loading..." : "View more"}
                        </Button>
                      </div>
                    )}
                  </div>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary">A</AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <div className="flex items-center justify-start gap-2 p-2">
                    <div className="flex flex-col space-y-1 leading-none">
                      <p className="font-medium">Admin User</p>
                      <p className="w-[200px] truncate text-sm text-muted-foreground">
                        admin@resqnow.com
                      </p>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin/settings">Settings</Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => logoutAdmin()} className="cursor-pointer">
                    <span className="text-red-600">Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Content area - proper padding to prevent overlap */}
        <main className="flex-1 overflow-y-auto bg-muted/20 p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile overlay */}
      {!isSidebarCollapsed && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={() => setIsSidebarCollapsed(true)}
        />
      )}
    </div>
  );
};

export default AdminDashboardLayout;


