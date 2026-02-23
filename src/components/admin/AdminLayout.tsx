
import React from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { 
  Users, 
  Settings, 
  BarChart3, 
  Home, 
  LogOut, 
  Bell 
} from "lucide-react";
import { Button } from "@/components/ui/button";

const AdminLayout = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };
  
  return (
    <div className="flex min-h-screen bg-muted/20">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-primary">ResQNow Admin</h2>
          <p className="text-sm text-muted-foreground">Management Dashboard</p>
        </div>
        
        <nav className="flex-1 px-3 space-y-1">
          <Link
            to="/admin/dashboard"
            className={cn(
              "flex items-center px-3 py-2 text-sm rounded-md",
              isActive("/admin/dashboard")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            <Home className="w-4 h-4 mr-3" />
            Dashboard
          </Link>
          
          <Link
            to="/admin/technicians"
            className={cn(
              "flex items-center px-3 py-2 text-sm rounded-md",
              isActive("/admin/technician")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            <Users className="w-4 h-4 mr-3" />
            Technicians
          </Link>
          
          <Link
            to="/admin/analytics"
            className={cn(
              "flex items-center px-3 py-2 text-sm rounded-md",
              isActive("/admin/analytics")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            <BarChart3 className="w-4 h-4 mr-3" />
            Analytics
          </Link>
          
          <Link
            to="/admin/settings"
            className={cn(
              "flex items-center px-3 py-2 text-sm rounded-md",
              isActive("/admin/settings")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            <Settings className="w-4 h-4 mr-3" />
            Settings
          </Link>
        </nav>
        
        <div className="p-4 border-t">
          <Button variant="outline" className="w-full justify-start" asChild>
            <Link to="/">
              <LogOut className="w-4 h-4 mr-2" />
              Exit Admin
            </Link>
          </Button>
        </div>
      </aside>
      
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Top nav */}
        <header className="border-b bg-card h-14 flex items-center px-6 sticky top-0 z-10">
          <nav className="flex-1 flex items-center">
            <div className="md:hidden">
              <Button variant="ghost" size="sm">
                <span className="sr-only">Open sidebar</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                >
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="4" x2="20" y1="18" y2="18" />
                </svg>
              </Button>
            </div>
            
            <div className="flex items-center ml-auto">
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
              </Button>
              
              <div className="ml-4 flex items-center">
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-white">
                  A
                </div>
              </div>
            </div>
          </nav>
        </header>
        
        {/* Content area */}
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
