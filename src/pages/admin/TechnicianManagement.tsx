
import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Technician } from "@/types/technician";
import { apiFetch } from "@/lib/api";
import { Edit, Trash2, Search, Filter, UserPlus, Eye } from "lucide-react";
import { toast } from "sonner";
import { mapTechnicianData } from "@/utils/technicianMappers";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";

type FilterStatus = "all" | "pending" | "verified" | "rejected";

const statusToApi: Record<FilterStatus, string> = {
  all: "",
  pending: "pending",
  verified: "approved",
  rejected: "rejected",
};

const TechnicianManagement = () => {
  const navigate = useNavigate();
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [search, setSearch] = useState("");

  // Edit State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<Technician | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    service_type: "",
    status: "",
  });

  // Delete State
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTechnicians();
  }, [filter]);

  const fetchTechnicians = async () => {
    setLoading(true);
    try {
      const status = statusToApi[filter];
      const path = status ? `/api/technicians/list?status=${status}` : "/api/technicians/list";
      const res = await apiFetch(path, { method: "GET", admin: true });
      if (!res.ok) return;
      const data = await res.json();
      const mappedTechnicians = (Array.isArray(data) ? data : []).map(mapTechnicianData);
      setTechnicians(mappedTechnicians);
    } catch {
      toast.error("Failed to load technicians");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (tech: Technician) => {
    setEditingTech(tech);
    setEditForm({
      name: tech.name,
      email: tech.email,
      phone: tech.phone,
      service_type: tech.specialties?.[0] || "",
      status: tech.verification_status === "verified" ? "approved" : tech.verification_status,
    });
    setIsEditOpen(true);
  };

  const handleDeleteClick = (id: string) => {
    setDeletingId(id);
    setIsDeleteOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTech) return;

    try {
      const res = await apiFetch(`/api/admin/technicians/${editingTech.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
        admin: true,
      });

      if (res.ok) {
        toast.success("Technician updated successfully");
        setIsEditOpen(false);
        fetchTechnicians();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update technician");
      }
    } catch (err) {
      toast.error("An error occurred");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;

    try {
      const res = await apiFetch(`/api/admin/technicians/${deletingId}`, {
        method: "DELETE",
        admin: true,
      });

      if (res.ok) {
        toast.success("Technician deleted successfully");
        setTechnicians(prev => prev.filter(t => t.id !== deletingId));
      } else {
        toast.error("Failed to delete technician");
      }
    } catch (err) {
      toast.error("An error occurred");
    } finally {
      setIsDeleteOpen(false);
      setDeletingId(null);
    }
  };

  const filteredTechnicians = technicians.filter(technician =>
    technician.name.toLowerCase().includes(search.toLowerCase()) ||
    technician.email.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">Pending</Badge>;
      case 'verified':
        return <Badge className="bg-green-500 hover:bg-green-600">Verified</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const formatVehicleTypes = (vehicleTypes: any) => {
    if (!vehicleTypes || typeof vehicleTypes !== "object") return "-";
    const selected = Object.entries(vehicleTypes)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([name]) => name);
    return selected.length ? selected.join(", ") : "-";
  };

  const handleFilterChange = (value: string) => {
    setFilter(value as FilterStatus);
  };

  return (
    <div className="container py-8">
      <div className="mb-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Technician Management</h1>
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Input
              type="search"
              placeholder="Search technicians..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10 w-64"
            />
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
          </div>

          <Select value={filter} onValueChange={handleFilterChange}>
            <SelectTrigger className="w-[150px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => navigate("/admin/technicians/add")}>
            <UserPlus className="h-4 w-4 mr-2" />
            Add Technician
          </Button>
        </div>
      </div>

      <Card>
        <CardContent>
          {loading ? (
            <p>Loading technicians...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Services
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Vehicle Types
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTechnicians.map((technician) => (
                    <tr key={technician.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {technician.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {technician.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {(technician.specialties || []).join(", ") || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap max-w-[220px] truncate" title={formatVehicleTypes(technician.vehicle_types)}>
                        {formatVehicleTypes(technician.vehicle_types)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(technician.verification_status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="View Details"
                          asChild
                        >
                          <Link to={`/admin/technician/${technician.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditClick(technician)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteClick(technician.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Technician</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={editForm.phone}
                onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_type">Service Type</Label>
              <Input
                id="service_type"
                value={editForm.service_type}
                onChange={(e) => setEditForm({ ...editForm, service_type: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={editForm.status}
                onValueChange={(value) => setEditForm({ ...editForm, status: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Verified</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="submit">Save Changes</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the technician account
              and remove their data from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TechnicianManagement;
