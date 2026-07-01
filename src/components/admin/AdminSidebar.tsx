import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Users, UserPlus, LogOut, Settings } from "lucide-react";

const AdminSidebar = () => {
    const location = useLocation();

    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="w-64 bg-slate-900 text-white min-h-screen flex flex-col">
            <div className="p-6 border-b border-slate-700">
                <h2 className="text-xl font-bold">Admin Portal</h2>
            </div>
            <nav className="flex-1 p-4 space-y-2">
                <Link
                    to="/admin/technicians"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive("/admin/technicians") ? "bg-red-600 text-white" : "text-slate-300 hover:bg-slate-800"
                        }`}
                >
                    <Users size={20} />
                    <span>Technicians</span>
                </Link>
                <Link
                    to="/admin/add-technician"
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive("/admin/add-technician") ? "bg-red-600 text-white" : "text-slate-300 hover:bg-slate-800"
                        }`}
                >
                    <UserPlus size={20} />
                    <span>Add Technician</span>
                </Link>
            </nav>
            <div className="p-4 border-t border-slate-700">
                <button className="flex items-center gap-3 px-4 py-3 w-full text-slate-300 hover:bg-slate-800 rounded-lg transition-colors">
                    <LogOut size={20} />
                    <span>Logout</span>
                </button>
            </div>
        </div>
    );
};

export default AdminSidebar;
