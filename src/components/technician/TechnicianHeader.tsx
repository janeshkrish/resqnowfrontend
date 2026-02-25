
import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User, Settings } from "lucide-react";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { apiUrl } from "@/lib/api";

import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
// Duplicate import removed

const TechnicianHeader = () => {
  const { technician, isAuthenticated, logout, token, isOnline, setIsOnline } = useTechnicianAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Use effect to fetch current status if needed, or just assume offline on load
  //Ideally we should fetch this from backend

  const handleLogout = () => {
    logout();
    navigate("/technician/login");
  };

  const toggleAvailability = async (checked: boolean) => {
    try {
      const response = await fetch(apiUrl("/api/technicians/me/status"), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ active: checked })
      });
      const data = await response.json();
      if (response.ok) {
        setIsOnline(checked);
        toast.success(checked ? "You are now Online" : "You are now Offline");
      } else {
        toast.error("Failed to update status");
      }
    } catch (error) {
      console.error("Status update error", error);
      toast.error("Network error");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };
  const isActive = (path: string) => {
    return location.pathname === path;
  };

  const navLinks = [
    { path: "/", label: "Home" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-slate-100 shadow-sm">
      <div className="container flex h-16 items-center justify-between px-4">

        {/* Logo / Brand */}
        <div className="flex items-center">
          <Link to="/technician/dashboard" className="flex items-center">
            <span className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-blue-900 drop-shadow-sm">
              ResQNow <span className="text-blue-600 ml-1 hidden sm:inline">Technician</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <nav className="ml-10 hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`font-bold transition-colors text-sm ${isActive(link.path)
                  ? "text-blue-700"
                  : "text-slate-500 hover:text-blue-600"
                  }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              {/* Online/Offline Toggle Pillar */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${isOnline ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'} transition-colors`}>
                <span className={`text-[11px] uppercase tracking-widest font-black ${isOnline ? "text-green-700" : "text-slate-500"}`}>
                  {isOnline ? "Online" : "Offline"}
                </span>
                <Switch
                  checked={isOnline}
                  onCheckedChange={toggleAvailability}
                  className="scale-90 data-[state=checked]:bg-green-600"
                />
              </div>

              {/* Profile Avatar Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 border-2 border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                    <Avatar className="h-full w-full">
                      <AvatarFallback className="bg-blue-50 text-blue-700 font-bold">
                        {technician ? getInitials(technician.name) : <User className="h-5 w-5" />}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 mt-2 rounded-2xl shadow-xl border-slate-100 p-2" align="end">
                  <DropdownMenuLabel className="font-normal px-2 py-1.5">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-bold leading-none text-slate-900">{technician?.name || "Technician"}</p>
                      <p className="text-xs font-medium text-slate-500">
                        {technician?.email}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator className="my-2 bg-slate-100" />
                  <DropdownMenuItem asChild className="rounded-xl focus:bg-slate-50 cursor-pointer">
                    <Link to="/technician/profile" className="flex w-full items-center px-2 py-2">
                      <User className="mr-3 h-4 w-4 text-slate-400" />
                      <span className="font-semibold text-slate-700">Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-xl focus:bg-slate-50 cursor-pointer">
                    <Link to="/technician/settings" className="flex w-full items-center px-2 py-2">
                      <Settings className="mr-3 h-4 w-4 text-slate-400" />
                      <span className="font-semibold text-slate-700">Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="my-2 bg-slate-100" />
                  <DropdownMenuItem onClick={handleLogout} className="rounded-xl focus:bg-red-50 focus:text-red-700 cursor-pointer px-2 py-2">
                    <LogOut className="mr-3 h-4 w-4 text-red-500" />
                    <span className="font-bold text-red-600">Log out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Removed the mobile hamburger menu button as we rely on TechnicianBottomNav */}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Button variant="ghost" className="font-bold text-slate-600 hover:text-slate-900 focus:bg-transparent" asChild>
                <Link to="/technician/login">Log in</Link>
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full px-6 shadow-md shadow-blue-600/20" asChild>
                <Link to="/technician/register">Sign up</Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default TechnicianHeader;
