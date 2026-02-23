
import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { LogOut, User, Settings, CreditCard, ClipboardList } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const UserMenu = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  
  const handleLogout = () => {
    logout();
    setOpen(false);
    navigate("/");
  };
  
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getSubscriptionBadge = () => {
    if (!user || user.subscription === "none") return null;
    
    const colors = {
      basic: "bg-blue-100 text-blue-800",
      premium: "bg-red-100 text-red-800",
      enterprise: "bg-purple-100 text-purple-800",
    };
    
    return (
      <span className={`text-xs font-semibold px-2 py-1 rounded-full ml-1 ${colors[user.subscription]}`}>
        {user.subscription.charAt(0).toUpperCase() + user.subscription.slice(1)}
      </span>
    );
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate("/login")}>
          Log in
        </Button>
        <Button className="bg-red-600 hover:bg-red-700" onClick={() => navigate("/register")}>
          Sign up
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-10 w-10 rounded-full">
          <Avatar className="h-10 w-10 border-2 border-gray-200">
            <AvatarFallback className="bg-red-100 text-red-800">
              {user ? getInitials(user.name) : "?"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user?.name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user?.email}
            </p>
            {getSubscriptionBadge()}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/my-requests" className="cursor-pointer flex w-full items-center">
            <ClipboardList className="mr-2 h-4 w-4" />
            <span>My Requests</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/profile" className="cursor-pointer flex w-full items-center">
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/subscription" className="cursor-pointer flex w-full items-center">
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Subscription</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings" className="cursor-pointer flex w-full items-center">
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
