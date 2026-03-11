import React, { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { apiFetch, apiUrl } from "@/lib/api";
import { Technician } from "@/types/technician";
import { mapTechnicianData } from "@/utils/technicianMappers";
import { io } from "socket.io-client";
import { FRONTEND_ONLY_MODE, getAdminToken, getRequiredApiBaseUrl } from "@/lib/api";
import TechnicianReviews from "@/components/rating/TechnicianReviews";
import {
  User,
  MapPin,
  Globe,
  Briefcase,
  Star,
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Smartphone,
  Wrench,
  Plus,
  Trash2
} from "lucide-react";

type EditableServiceCostRow = {
  service_name: string;
  vehicle_type_pricing: string;
  visit_charge: string;
  service_charge: string;
  delivery_charge: string;
  labour_min: string;
  labour_max: string;
  extra_km_charge: string;
};

type EditableTechnicianForm = {
  shop_name: string;
  proprietor_name: string;
  contact: string;
  address: string;
  services: string;
  service_costs: EditableServiceCostRow[];
  documents: {
    profile_photo: string;
    garage_front: string;
    tools_photo: string;
    facilities_photo: string;
  };
};

const EMPTY_SERVICE_COST_ROW: EditableServiceCostRow = {
  service_name: "",
  vehicle_type_pricing: "",
  visit_charge: "",
  service_charge: "",
  delivery_charge: "",
  labour_min: "",
  labour_max: "",
  extra_km_charge: "",
};

const toEditableServiceCostRows = (value: any): EditableServiceCostRow[] => {
  const rows: any[] = [];
  if (Array.isArray(value)) {
    rows.push(...value);
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([serviceName, config]) => {
      if (config && typeof config === "object") {
        rows.push({ service_name: serviceName, ...config });
      } else {
        rows.push({ service_name: serviceName, service_charge: config });
      }
    });
  }

  return rows.map((row) => ({
    service_name: String(row?.service_name || row?.service_domain || "").trim(),
    vehicle_type_pricing: String(row?.vehicle_type_pricing || row?.vehicle_type || "").trim(),
    visit_charge: String(row?.visit_charge ?? row?.visitCharge ?? row?.base_charge ?? ""),
    service_charge: String(row?.service_charge ?? row?.serviceCharge ?? row?.amount ?? row?.price ?? ""),
    delivery_charge: String(row?.delivery_charge ?? row?.deliveryCharge ?? ""),
    labour_min: String(row?.labour_min ?? row?.labourMin ?? ""),
    labour_max: String(row?.labour_max ?? row?.labourMax ?? ""),
    extra_km_charge: String(row?.extra_km_charge ?? row?.extraKmCharge ?? ""),
  }));
};

const TechnicianDetails = () => {
  const { technicianId } = useParams<{ technicianId: string }>();
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [decisionReason, setDecisionReason] = useState("");
  const [approvalAudit, setApprovalAudit] = useState<any[]>([]);
  const [editForm, setEditForm] = useState<EditableTechnicianForm>({
    shop_name: "",
    proprietor_name: "",
    contact: "",
    address: "",
    services: "",
    service_costs: [],
    documents: {
      profile_photo: "",
      garage_front: "",
      tools_photo: "",
      facilities_photo: "",
    },
  });

  const resolveDocumentUrl = (value?: string) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
    if (raw.startsWith("/api/")) return apiUrl(raw);
    return raw.startsWith("/") ? raw : `/${raw}`;
  };

  const fetchTechnicianDetails = useCallback(async () => {
    if (!technicianId) return;
    try {
      const res = await apiFetch(`/api/technicians/${technicianId}`, { method: "GET", admin: true });
      if (!res.ok) {
        setTechnician(null);
        return;
      }
      const data = await res.json();
      const mapped = mapTechnicianData(data);
      setTechnician(mapped);
      setEditForm({
        shop_name: mapped.name || "",
        proprietor_name: mapped.proprietor_name || "",
        contact: mapped.phone || "",
        address: mapped.address || "",
        services: Array.isArray(mapped.specialties) ? mapped.specialties.join(", ") : "",
        service_costs: toEditableServiceCostRows(mapped.service_costs),
        documents: {
          profile_photo: String(mapped.documents?.profile_photo || ""),
          garage_front: String(mapped.documents?.garage_front || ""),
          tools_photo: String(mapped.documents?.tools_photo || ""),
          facilities_photo: String(mapped.documents?.facilities_photo || ""),
        },
      });
    } catch {
      toast.error("Failed to load technician details");
    } finally {
      setLoading(false);
    }
  }, [technicianId]);

  useEffect(() => {
    fetchTechnicianDetails();
  }, [fetchTechnicianDetails]);

  useEffect(() => {
    const fetchApprovalAudit = async () => {
      if (!technicianId) return;
      try {
        const res = await apiFetch(`/api/technicians/${technicianId}/approval-audit`, { method: "GET", admin: true });
        if (!res.ok) return;
        const rows = await res.json();
        setApprovalAudit(Array.isArray(rows) ? rows : []);
      } catch {
        // ignore
      }
    };
    fetchApprovalAudit();
  }, [technicianId]);

  useEffect(() => {
    if (!technicianId) return;
    if (FRONTEND_ONLY_MODE) return;

    const socketBaseUrl = getRequiredApiBaseUrl();
    const socket = io(socketBaseUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: { token: getAdminToken() || undefined },
    });

    const onAuditUpdate = (event: any) => {
      if (!event || String(event.technicianId) !== String(technicianId)) return;
      apiFetch(`/api/technicians/${technicianId}/approval-audit`, { method: "GET", admin: true })
        .then((res) => (res.ok ? res.json() : []))
        .then((rows) => setApprovalAudit(Array.isArray(rows) ? rows : []))
        .catch(() => { });
    };

    socket.on("admin:technician_audit_update", onAuditUpdate);
    return () => {
      socket.off("admin:technician_audit_update", onAuditUpdate);
      socket.disconnect();
    };
  }, [technicianId]);

  const handleApprove = async () => {
    if (!technicianId) return;
    setIsApproving(true);
    try {
      const res = await apiFetch(`/api/technicians/${technicianId}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ reason: decisionReason.trim() || "Approved by admin" }),
        admin: true
      });

      if (res.ok) {
        toast.success("Technician approved successfully");
        setTechnician(prev => prev ? { ...prev, verification_status: "verified" } : prev);
        setDecisionReason("");
        const auditRes = await apiFetch(`/api/technicians/${technicianId}/approval-audit`, { method: "GET", admin: true });
        if (auditRes.ok) setApprovalAudit(await auditRes.json());
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to approve technician");
      }
    } catch (e) {
      toast.error("An error occurred while approving");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!technicianId) return;
    setIsRejecting(true);
    try {
      const res = await apiFetch(`/api/technicians/${technicianId}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason: decisionReason.trim() || "Rejected by admin" }),
        admin: true
      });

      if (res.ok) {
        toast.success("Technician rejected successfully");
        setTechnician(prev => prev ? { ...prev, verification_status: "rejected" } : prev);
        setDecisionReason("");
        const auditRes = await apiFetch(`/api/technicians/${technicianId}/approval-audit`, { method: "GET", admin: true });
        if (auditRes.ok) setApprovalAudit(await auditRes.json());
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to reject technician");
      }
    } catch (e) {
      toast.error("An error occurred while rejecting");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleServiceCostChange = (
    index: number,
    field: keyof EditableServiceCostRow,
    value: string
  ) => {
    setEditForm((prev) => {
      const nextRows = [...prev.service_costs];
      nextRows[index] = { ...nextRows[index], [field]: value };
      return { ...prev, service_costs: nextRows };
    });
  };

  const addServiceCostRow = () => {
    setEditForm((prev) => ({
      ...prev,
      service_costs: [...prev.service_costs, { ...EMPTY_SERVICE_COST_ROW }]
    }));
  };

  const removeServiceCostRow = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      service_costs: prev.service_costs.filter((_, i) => i !== index)
    }));
  };

  const handleSaveChanges = async () => {
    if (!technicianId) return;
    setIsSaving(true);
    try {
      const toNumberOrNull = (value: string) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
      };

      const payload = {
        shop_name: editForm.shop_name.trim(),
        proprietor_name: editForm.proprietor_name.trim(),
        contact: editForm.contact.trim(),
        address: editForm.address.trim(),
        services: editForm.services
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        service_costs: editForm.service_costs
          .map((row) => ({
            service_name: row.service_name.trim(),
            vehicle_type_pricing: row.vehicle_type_pricing.trim() || null,
            visit_charge: toNumberOrNull(row.visit_charge),
            service_charge: toNumberOrNull(row.service_charge),
            delivery_charge: toNumberOrNull(row.delivery_charge),
            labour_min: toNumberOrNull(row.labour_min),
            labour_max: toNumberOrNull(row.labour_max),
            extra_km_charge: toNumberOrNull(row.extra_km_charge),
          }))
          .filter((row) => row.service_name),
        verification_images: { ...editForm.documents },
      };

      const res = await apiFetch(`/api/admin/update-technician/${technicianId}`, {
        method: "PUT",
        admin: true,
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to update technician.");
      }

      toast.success("Technician updated successfully");
      await fetchTechnicianDetails();
    } catch (error: any) {
      toast.error(error?.message || "Failed to update technician.");
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2 text-lg">Loading technician details...</span>
        </div>
      </div>
    );
  }

  if (!technician) {
    return (
      <div className="container py-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">Technician not found</h2>
              <p className="text-muted-foreground">
                The technician you are looking for does not exist or has been removed.
              </p>
              <Button className="mt-4" asChild>
                <Link to="/admin/technicians">Back to Technicians</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8 animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Technician Profile</h1>
          <p className="text-muted-foreground">Review application details and make decisions</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={
              technician.verification_status === "pending" ? "secondary" :
                technician.verification_status === "verified" ? "success" : "destructive"
            }
            className="text-sm py-1 px-3"
          >
            {technician.verification_status === "pending" && "Pending"}
            {technician.verification_status === "verified" && "Approved"}
            {technician.verification_status === "rejected" && "Rejected"}
          </Badge>
          <Button onClick={handleSaveChanges} disabled={isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* --- PHOTOS SECTION --- */}
          <Card>
            <CardHeader><CardTitle>Shop & Identity Verification</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { key: "profile_photo", label: "Profile", icon: User },
                  { key: "garage_front", label: "Shop Front", icon: MapPin },
                  { key: "tools_photo", label: "Tools", icon: Wrench },
                  { key: "facilities_photo", label: "Facilities", icon: Briefcase },
                ].map((item, i) => {
                  const imageSrc = resolveDocumentUrl(editForm.documents[item.key as keyof EditableTechnicianForm["documents"]]);
                  return (
                  <div key={i} className="border rounded-lg p-2 text-center">
                    <div className="mb-2 h-24 bg-muted/50 rounded flex items-center justify-center overflow-hidden">
                      {imageSrc ? (
                        <img src={imageSrc} alt={item.label} className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform" onClick={() => window.open(imageSrc, "_blank", "noopener,noreferrer")} />
                      ) : (
                        <item.icon className="h-8 w-8 text-slate-300" />
                      )}
                    </div>
                    <p className="text-xs font-medium">{item.label}</p>
                    <input
                      type="text"
                      className="mt-2 w-full rounded border border-input bg-transparent px-2 py-1 text-[11px]"
                      placeholder="Image URL / path"
                      value={editForm.documents[item.key as keyof EditableTechnicianForm["documents"]] || ""}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          documents: {
                            ...prev.documents,
                            [item.key]: e.target.value
                          }
                        }))
                      }
                    />
                  </div>
                )})}
              </div>
            </CardContent>
          </Card>

          {/* --- PERSONAL INFO --- */}
          <Card>
            <CardHeader><CardTitle>Business Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Shop Name</p>
                    <input
                      className="w-full rounded border border-input bg-transparent px-3 py-2 text-sm"
                      value={editForm.shop_name}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, shop_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Proprietor Name</p>
                    <input
                      className="w-full rounded border border-input bg-transparent px-3 py-2 text-sm"
                      value={editForm.proprietor_name}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, proprietor_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Contact Number</p>
                    <input
                      className="w-full rounded border border-input bg-transparent px-3 py-2 text-sm"
                      value={editForm.contact}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, contact: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Email: {technician.email}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Address</p>
                    <textarea
                      className="w-full min-h-[96px] rounded border border-input bg-transparent px-3 py-2 text-sm"
                      value={editForm.address}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                    />
                  </div>
                  <div><p className="text-sm text-muted-foreground">Location</p><p className="font-medium">{technician.district}, {technician.state} ({technician.locality})</p></div>
                  <div><p className="text-sm text-muted-foreground">Experience</p><p className="font-medium">{technician.experience} Years (Range: {technician.serviceAreaRange}km)</p></div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* --- OPERATIONS --- */}
          <Card>
            <CardHeader><CardTitle>Operational Details</CardTitle></CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Working Hours</p>
                <div className="flex items-center gap-2 font-medium">
                  <Clock className="w-4 h-4" />
                  {technician.working_hours?.opening_time || "09:00"} - {technician.working_hours?.closing_time || "20:00"}
                  {technician.working_hours?.is_24x7 && <Badge className="ml-2" variant="secondary">24x7</Badge>}
                </div>
                <p className="text-sm text-muted-foreground mt-1">Weekly Off: {technician.working_hours?.weekly_off || "-"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">App Readiness</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-muted-foreground/80" />
                    <span className="text-sm">{technician.app_readiness?.has_smartphone ? "Has Smartphone" : "No Smartphone"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground/80" />
                    <span className="text-sm">Lang: {technician.app_readiness?.preferred_language || "English"}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* --- SERVICES CONFIG --- */}
          <Card>
            <CardHeader><CardTitle>Service Configuration</CardTitle></CardHeader>
            <CardContent>
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-1">Services (comma separated)</p>
                <input
                  className="w-full rounded border border-input bg-transparent px-3 py-2 text-sm"
                  value={editForm.services}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, services: e.target.value }))}
                  placeholder="battery, flat_tire, fuel"
                />
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {editForm.services
                  .split(",")
                  .map((service) => service.trim())
                  .filter(Boolean)
                  .map((service) => (
                    <Badge key={service}>{service}</Badge>
                  ))}
              </div>

              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium">Service Pricing</p>
                <Button type="button" variant="outline" size="sm" onClick={addServiceCostRow}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Service Price
                </Button>
              </div>

              <div className="space-y-3">
                {editForm.service_costs.length === 0 && (
                  <div className="rounded border border-dashed p-4 text-sm text-muted-foreground">
                    No service pricing configured. Add at least one service pricing row.
                  </div>
                )}

                {editForm.service_costs.map((row, idx) => (
                  <div key={`service-cost-${idx}`} className="rounded border p-3">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Service Domain</p>
                        <input
                          className="w-full rounded border border-input bg-transparent px-3 py-2 text-sm"
                          value={row.service_name}
                          onChange={(e) => handleServiceCostChange(idx, "service_name", e.target.value)}
                          placeholder="battery"
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Vehicle Type</p>
                        <input
                          className="w-full rounded border border-input bg-transparent px-3 py-2 text-sm"
                          value={row.vehicle_type_pricing}
                          onChange={(e) => handleServiceCostChange(idx, "vehicle_type_pricing", e.target.value)}
                          placeholder="2w / 4w / both"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3 md:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Visit Charge</p>
                        <input
                          type="number"
                          min="0"
                          className="w-full rounded border border-input bg-transparent px-3 py-2 text-sm"
                          value={row.visit_charge}
                          onChange={(e) => handleServiceCostChange(idx, "visit_charge", e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Service Charge</p>
                        <input
                          type="number"
                          min="0"
                          className="w-full rounded border border-input bg-transparent px-3 py-2 text-sm"
                          value={row.service_charge}
                          onChange={(e) => handleServiceCostChange(idx, "service_charge", e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Delivery Charge</p>
                        <input
                          type="number"
                          min="0"
                          className="w-full rounded border border-input bg-transparent px-3 py-2 text-sm"
                          value={row.delivery_charge}
                          onChange={(e) => handleServiceCostChange(idx, "delivery_charge", e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Extra KM Charge</p>
                        <input
                          type="number"
                          min="0"
                          className="w-full rounded border border-input bg-transparent px-3 py-2 text-sm"
                          value={row.extra_km_charge}
                          onChange={(e) => handleServiceCostChange(idx, "extra_km_charge", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3 md:grid-cols-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Labour Min</p>
                        <input
                          type="number"
                          min="0"
                          className="w-full rounded border border-input bg-transparent px-3 py-2 text-sm"
                          value={row.labour_min}
                          onChange={(e) => handleServiceCostChange(idx, "labour_min", e.target.value)}
                        />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Labour Max</p>
                        <input
                          type="number"
                          min="0"
                          className="w-full rounded border border-input bg-transparent px-3 py-2 text-sm"
                          value={row.labour_max}
                          onChange={(e) => handleServiceCostChange(idx, "labour_max", e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeServiceCostRow(idx)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* --- CUSTOMER REVIEWS (HEAD Feature) --- */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400" />
                Customer Reviews
              </CardTitle>
            </CardHeader>
            <CardContent>
              <TechnicianReviews technicianId={technician.id} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Application Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {technician.verification_status === "pending" ? (
                  <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                    <h3 className="font-medium flex items-center">
                      <Star className="w-4 h-4 text-amber-500 mr-2" />
                      Application Pending Review
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      This application requires your review and decision.
                    </p>
                  </div>
                ) : technician.verification_status === "verified" ? (
                  <div className="bg-green-50 border border-green-200 rounded-md p-4">
                    <h3 className="font-medium flex items-center">
                      <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                      Application Approved
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      This technician has been approved and can accept service requests.
                    </p>
                  </div>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <h3 className="font-medium flex items-center">
                      <XCircle className="w-4 h-4 text-red-500 mr-2" />
                      Application Rejected
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      This application has been rejected.
                    </p>
                  </div>
                )}

                {technician.verification_status === "pending" && (
                  <div className="flex flex-col space-y-2">
                    <textarea
                      className="min-h-[84px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                      placeholder="Reason for approval/rejection (stored in audit trail)"
                      value={decisionReason}
                      onChange={(e) => setDecisionReason(e.target.value)}
                    />
                    <Button onClick={handleApprove} disabled={isApproving} className="w-full">
                      {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />} Approve
                    </Button>
                    <Button variant="outline" onClick={handleReject} disabled={isRejecting} className="w-full">
                      {isRejecting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />} Reject
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Approval Audit Trail</CardTitle></CardHeader>
            <CardContent>
              {approvalAudit.length === 0 ? (
                <p className="text-sm text-muted-foreground">No approval actions recorded yet.</p>
              ) : (
                <div className="space-y-3">
                  {approvalAudit.map((item) => (
                    <div key={item.id} className="border rounded p-3 bg-muted">
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant={item.action === "approved" ? "success" : "destructive"}>
                          {item.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground/80">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm mt-2"><span className="text-muted-foreground/80">Admin:</span> {item.admin_email}</div>
                      <div className="text-sm"><span className="text-muted-foreground/80">Status:</span> {item.previous_status} to {item.new_status}</div>
                      <div className="text-sm"><span className="text-muted-foreground/80">Reason:</span> {item.reason || "-"}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Documents & IDs</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between border-b pb-2"><span>Aadhaar</span> <span className="font-medium">{technician.aadhaar_number || "-"}</span></div>
              <div className="flex justify-between border-b pb-2"><span>PAN</span> <span className="font-medium">{technician.pan_number || "-"}</span></div>
              <div className="flex justify-between border-b pb-2"><span>GST</span> <span className="font-medium">{technician.gst_number || "-"}</span></div>
              {technician.resume_url && (
                <Button variant="outline" className="w-full" asChild>
                  <a href={technician.resume_url} target="_blank">View Resume</a>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Payment & Bank</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <div><span className="text-muted-foreground/80 text-sm">Accepted Modes:</span>
                <div className="flex gap-2 mt-1">
                  {technician.payment_details?.modes?.cash && <Badge variant="outline">Cash</Badge>}
                  {technician.payment_details?.modes?.upi && <Badge variant="outline">UPI</Badge>}
                </div>
              </div>
              {technician.payment_details?.upi_id && <div><span className="text-muted-foreground/80 text-sm">UPI ID:</span> <span className="font-medium">{technician.payment_details.upi_id}</span></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Admin Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <textarea
                className="min-h-[150px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Add notes about this technician here..."
              />
              <Button className="w-full mt-2">Save Notes</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default TechnicianDetails;
