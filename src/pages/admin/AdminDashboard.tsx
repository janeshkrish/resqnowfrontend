import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Check, Clock, UserCheck, Users, X, UserPlus } from "lucide-react";
import { Technician } from "@/types/technician";
import { apiFetch } from "@/lib/api";
import { mapTechnicianData } from "@/utils/technicianMappers";

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalTechnicians: 0,
    verifiedTechnicians: 0,
    pendingApplications: 0,
    rejectedApplications: 0,
    totalUsers: 0
  });
  const [recentApplications, setRecentApplications] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [techRes, usersRes] = await Promise.all([
          apiFetch("/api/technicians/list", { method: "GET", admin: true }),
          apiFetch("/api/admin/users", { method: "GET", admin: true })
        ]);

        if (!techRes.ok) return;
        const technicians = await techRes.json();
        const list = (Array.isArray(technicians) ? technicians : []).map(mapTechnicianData);
        const totalCount = list.length;
        const verifiedCount = list.filter(t => t.verification_status === "verified").length;
        const pendingCount = list.filter(t => t.verification_status === "pending").length;
        const rejectedCount = list.filter(t => t.verification_status === "rejected").length;
        setStats({
          totalTechnicians: totalCount,
          verifiedTechnicians: verifiedCount,
          pendingApplications: pendingCount,
          rejectedApplications: rejectedCount,
          totalUsers: usersRes.ok ? (await usersRes.json()).length : 0
        });
        const pending = list.filter(t => t.verification_status === "pending").slice(0, 5);
        setRecentApplications(pending);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
    const intervalId = window.setInterval(fetchDashboardData, 15000);
    return () => window.clearInterval(intervalId);
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary" className="ml-2">Pending</Badge>;
      case "verified":
        return <Badge variant="success" className="ml-2">Verified</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="ml-2">Rejected</Badge>;
      default:
        return <Badge className="ml-2">Unknown</Badge>;
    }
  };

  return (
    <div className="container py-4 md:py-8 animate-fade-in">
      <div className="px-4 md:px-0">
        <h1 className="text-2xl md:text-3xl font-bold mb-6">Admin Dashboard</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-8 px-4 md:px-0">
        <Card className="hover:shadow-md transition-all border-l-4 border-l-blue-600">
          <CardContent className="p-6 flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Users</p>
              <Users className="h-5 w-5 text-red-600 opacity-70" />
            </div>
            <h3 className="text-3xl font-bold mt-2">{stats.totalUsers}</h3>
            <p className="text-sm text-muted-foreground mt-2">Registered Users</p>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-all border-l-4 border-l-primary">
          <CardContent className="p-6 flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Total</p>
              <Users className="h-5 w-5 text-primary opacity-70" />
            </div>
            <h3 className="text-3xl font-bold mt-2">{stats.totalTechnicians}</h3>
            <p className="text-sm text-muted-foreground mt-2">Technicians</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-all border-l-4 border-l-green-500">
          <CardContent className="p-6 flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Verified</p>
              <UserCheck className="h-5 w-5 text-green-500 opacity-70" />
            </div>
            <h3 className="text-3xl font-bold mt-2">{stats.verifiedTechnicians}</h3>
            <p className="text-sm text-muted-foreground mt-2">Ready</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-all border-l-4 border-l-amber-500">
          <CardContent className="p-6 flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Pending</p>
              <Clock className="h-5 w-5 text-amber-500 opacity-70" />
            </div>
            <h3 className="text-3xl font-bold mt-2">{stats.pendingApplications}</h3>
            <p className="text-sm text-muted-foreground mt-2">Review</p>
          </CardContent>
        </Card>
        <Card className="hover:shadow-md transition-all border-l-4 border-l-red-500">
          <CardContent className="p-6 flex flex-col">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Rejected</p>
              <X className="h-5 w-5 text-red-500 opacity-70" />
            </div>
            <h3 className="text-3xl font-bold mt-2">{stats.rejectedApplications}</h3>
            <p className="text-sm text-muted-foreground mt-2">Failed</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 md:px-0">
        <Card>
          <CardHeader>
            <CardTitle>Recent Applications</CardTitle>
            <CardDescription>Latest technician applications awaiting review</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p>Loading recent applications...</p>
            ) : recentApplications.length > 0 ? (
              <div className="space-y-6">
                {recentApplications.map((technician) => (
                  <div
                    key={technician.id}
                    className="flex items-start justify-between border-b border-border pb-4"
                  >
                    <div>
                      <div className="flex items-center">
                        <h3 className="font-medium">{technician.name}</h3>
                        {getStatusBadge(technician.verification_status)}
                      </div>
                      <p className="text-sm text-muted-foreground">{technician.email}</p>
                      <p className="text-sm text-muted-foreground">
                        {(technician.specialties || []).join(", ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <Link
                        to={`/admin/technician/${technician.id}`}
                        className="text-sm text-primary hover:underline"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No pending applications</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link
              to="/admin/technicians/add"
              className="block p-4 border rounded-md hover:bg-muted/50 transition-colors bg-primary/5 border-primary/20"
            >
              <div className="flex items-center">
                <UserPlus className="h-5 w-5 text-primary mr-3" />
                <span className="font-medium">Add New Technician</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Manually add a technician with their services and pricing
              </p>
            </Link>
            <Link
              to="/admin/technicians"
              className="block p-4 border rounded-md hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center">
                <Users className="h-5 w-5 text-primary mr-3" />
                <span>Manage Technicians</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                View, edit and manage all technician profiles
              </p>
            </Link>
            <Link
              to="/admin/applications"
              className="block p-4 border rounded-md hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-amber-500 mr-3" />
                <span>Review Applications</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Review and process pending applications
              </p>
            </Link>
            <Link
              to="/admin/analytics"
              className="block p-4 border rounded-md hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center">
                <BarChart className="h-5 w-5 text-red-500 mr-3" />
                <span>Analytics Dashboard</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                View performance metrics and statistics
              </p>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
