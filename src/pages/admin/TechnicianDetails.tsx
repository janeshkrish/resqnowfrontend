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
import TechnicianImageGallery from "@/components/admin/TechnicianImageGallery";
import AdminTechnicianPricingEditor from "@/components/admin/AdminTechnicianPricingEditor";
import {
  AdminTechnicianProfile,
  getAdminTechnicianProfile,
} from "@/services/adminDetailsService";
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
  Trash2,
  IndianRupee,
  CircleCheckBig,
  CircleX,
  ClipboardList,
  Truck
} from "lucide-react";

type EditableTechnicianForm = {
  shop_name: string;
  proprietor_name: string;
  contact: string;
  address: string;
  services: string;
  service_costs: any[];
  documents: {
    profile_photo: string;
    garage_front: string;
    tools_photo: string;
    facilities_photo: string;
  };
};


const formatLabel = (value: string) =>
  value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const displayValue = (value: any) => {
  if (value == null || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map((item) => displayValue(item)).join(", ") : "-";
  if (typeof value === "object") {
    const entries = Object.entries(value);
    return entries.length
      ? entries.map(([key, item]) => `${formatLabel(key)}: ${displayValue(item)}`).join(" | ")
      : "-";
  }
  return String(value);
};

const VerificationBadge = ({ status }: { status?: string }) => (
  <Badge
    variant={status === "verified" ? "success" : status === "rejected" ? "destructive" : "secondary"}
    className="capitalize"
  >
    {status || "pending"}
  </Badge>
);

const TechnicianDetails = () => {
  const { technicianId } = useParams<{ technicianId: string }>();
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPricingEditMode, setIsPricingEditMode] = useState(false);
  const [decisionReason, setDecisionReason] = useState("");
  const [approvalAudit, setApprovalAudit] = useState<any[]>([]);
  const [adminProfile, setAdminProfile] = useState<AdminTechnicianProfile | null>(null);
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

  const migrateServiceCostsToNested = (costs: any[]): any[] => {
    if (!costs || !costs.length) return [];
    if (costs.some(c => c.vehicle_categories)) return costs;
    const domains: Record<string, any> = {};
    costs.forEach(row => {
      const domain = row.service_domain || row.service_name;
      const vType = row.vehicle_type;
      if (!domain || !vType) return;
      if (!domains[domain]) {
        domains[domain] = { service_domain: domain, vehicle_categories: [], vehicle_pricing: {}, towing_fleet_types: [], towing_vehicle_pricing: {}, flat_tire_vehicle_pricing: {} };
      }
      const target = domains[domain];
      if (!target.vehicle_categories.includes(vType)) target.vehicle_categories.push(vType);
      
      if (domain === "towing") {
        const fleetType = row.fleet_type || row.fleet_category;
        if (fleetType) {
          if (!target.towing_fleet_types.includes(fleetType)) target.towing_fleet_types.push(fleetType);
          if (!target.towing_vehicle_pricing[vType]) target.towing_vehicle_pricing[vType] = { fleet_pricing: {} };
          if (!target.towing_vehicle_pricing[vType].fleet_pricing) target.towing_vehicle_pricing[vType].fleet_pricing = {};
          target.towing_vehicle_pricing[vType].fleet_pricing[fleetType] = { base_charge: row.base_price ?? row.visit_charge, extra_km_charge: row.extra_km_charge, free_distance: row.free_distance };
        }
      } else if (domain === "flat-tire") {
         const sub = row.service_name || row.subcategory;
         if (!target.flat_tire_vehicle_pricing[vType]) target.flat_tire_vehicle_pricing[vType] = { tyre_pricing: {}, selected_subcategories: [] };
         if (sub && sub !== "flat-tire") {
             if (!target.flat_tire_vehicle_pricing[vType].selected_subcategories.includes(sub)) target.flat_tire_vehicle_pricing[vType].selected_subcategories.push(sub);
             target.flat_tire_vehicle_pricing[vType].tyre_pricing[sub] = { repair: row.service_charge ?? row.labour_min, replacement: row.labour_max };
         }
         target.flat_tire_vehicle_pricing[vType].visit_charge = row.visit_charge;
         target.flat_tire_vehicle_pricing[vType].extra_km_charge = row.extra_km_charge;
         target.flat_tire_vehicle_pricing[vType].free_distance = row.free_distance;
      } else {
         if (!target.vehicle_pricing[vType]) target.vehicle_pricing[vType] = {};
         target.vehicle_pricing[vType] = { visit_charge: row.visit_charge ?? row.base_price, service_charge: row.service_charge, extra_km_charge: row.extra_km_charge, free_distance: row.free_distance };
      }
    });
    return Object.values(domains);
  };

  const fetchTechnicianDetails = useCallback(async () => {
    if (!technicianId) return;
    try {
      const [res, profile] = await Promise.all([
        apiFetch(`/api/technicians/${technicianId}`, { method: "GET", admin: true }),
        getAdminTechnicianProfile(technicianId).catch(() => null),
      ]);
      if (!res.ok) {
        setTechnician(null);
        return;
      }
      const data = await res.json();
      const mapped = mapTechnicianData(data);
      setTechnician(mapped);
      setAdminProfile(profile);
      setEditForm({
        shop_name: mapped.name || "",
        proprietor_name: mapped.proprietor_name || "",
        contact: mapped.phone || "",
        address: mapped.address || "",
        services: Array.isArray(mapped.specialties) ? mapped.specialties.join(", ") : "",
        service_costs: migrateServiceCostsToNested(Array.isArray(mapped.service_costs) ? mapped.service_costs : []),
        documents: {
          profile_photo: String(mapped.documents?.profile_photo || ""),
          garage_front: String(mapped.documents?.garage_front || ""),
          tools_photo: String(mapped.documents?.tools_photo || ""),
          facilities_photo: String(mapped.documents?.facilities_photo || ""),
        },
      });
      setIsPricingEditMode(false);
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
        service_costs: editForm.service_costs,
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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              { label: "Total Jobs", value: adminProfile?.statistics.totalJobs ?? technician.jobs_completed ?? 0, icon: ClipboardList },
              { label: "Completed", value: adminProfile?.statistics.completedJobs ?? technician.jobs_completed ?? 0, icon: CircleCheckBig },
              { label: "Cancelled", value: adminProfile?.statistics.cancelledJobs ?? 0, icon: CircleX },
              { label: "Rating", value: Number(adminProfile?.statistics.rating ?? technician.rating ?? 0).toFixed(1), icon: Star },
              {
                label: "Revenue",
                value: `INR ${Number(adminProfile?.statistics.revenueEarned ?? technician.total_earnings ?? 0).toLocaleString("en-IN")}`,
                icon: IndianRupee,
              },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-4">
                  <stat.icon className="mb-2 h-5 w-5 text-primary" />
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-lg font-bold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* --- PHOTOS SECTION --- */}
          <Card>
            <CardHeader><CardTitle>Image Gallery</CardTitle></CardHeader>
            <CardContent>
              <TechnicianImageGallery
                documents={adminProfile?.documents || editForm.documents}
                resolveUrl={resolveDocumentUrl}
              />
              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                {Object.keys(editForm.documents).map((key) => (
                  <label key={key} className="text-xs font-medium text-muted-foreground">
                    {formatLabel(key)}
                    <input
                      type="text"
                      className="mt-1 w-full rounded border border-input bg-transparent px-2 py-1.5 text-xs"
                      placeholder="Image URL / path"
                      value={editForm.documents[key as keyof EditableTechnicianForm["documents"]] || ""}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          documents: {
                            ...prev.documents,
                            [key]: e.target.value
                          }
                        }))
                      }
                    />
                  </label>
                ))}
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

              <div className="mt-8">
                <AdminTechnicianPricingEditor 
                  serviceCosts={editForm.service_costs}
                  onChange={(newCosts) => setEditForm(prev => ({ ...prev, service_costs: newCosts }))}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Services & Fleet</CardTitle></CardHeader>
            <CardContent className="space-y-5">
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Selected Services</p>
                <div className="flex flex-wrap gap-2">
                  {(adminProfile?.services || technician.specialties || []).map((service) => (
                    <Badge key={service} variant="secondary">{formatLabel(service)}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm text-muted-foreground">Fleet Selected</p>
                <div className="flex flex-wrap gap-2">
                  {adminProfile?.fleet.selectedTypes.length
                    ? adminProfile.fleet.selectedTypes.map((fleetType) => (
                        <Badge key={fleetType} variant="outline">
                          <Truck className="mr-1 h-3 w-3" /> {formatLabel(fleetType)}
                        </Badge>
                      ))
                    : <span className="text-sm text-muted-foreground">No towing fleet selected.</span>}
                </div>
              </div>
              {adminProfile?.fleet.vehicles.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {adminProfile.fleet.vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="rounded-xl border p-3 text-sm">
                      <p className="font-semibold">{formatLabel(vehicle.vehicleType)} - {vehicle.vehicleNumber}</p>
                      <p className="text-muted-foreground">Capacity: {vehicle.capacity || "-"} | Status: {formatLabel(vehicle.status)}</p>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Pricing Information</CardTitle></CardHeader>
            <CardContent>
              {adminProfile?.pricing.rows.length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {adminProfile.pricing.rows.map((price) => (
                    <div key={`${price.id}-${price.serviceDomain}-${price.vehicleType}`} className="rounded-xl border p-4">
                      <div className="mb-3 flex items-center justify-between gap-2">
                        <p className="font-semibold">{formatLabel(price.serviceDomain)}</p>
                        <Badge variant="outline">{formatLabel(price.vehicleType || "All Vehicles")}</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {Object.entries({
                          "Base Charge": price.baseCharge,
                          "Free Distance": price.freeDistance == null ? null : `${price.freeDistance} km`,
                          "Cost/KM": price.costPerKm,
                          "Delivery Charge": price.deliveryCharge,
                          "Service Charge": price.serviceCharge,
                          "Visit Charge": price.visitCharge,
                          "Labour Min": price.labourMin,
                          "Labour Max": price.labourMax,
                        }).map(([label, value]) => (
                          <div key={label} className="rounded-lg bg-muted/40 p-2">
                            <p className="text-xs text-muted-foreground">{label}</p>
                            <p className="font-medium">{value == null ? "-" : label === "Free Distance" ? String(value) : `INR ${value}`}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No structured pricing configured.</p>
              )}
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
              {[
                ["Aadhaar", adminProfile?.verification.aadhaar.number || technician.aadhaar_number, adminProfile?.verification.aadhaar.status],
                ["PAN", adminProfile?.verification.pan.number || technician.pan_number, adminProfile?.verification.pan.status],
                ["Driving License", adminProfile?.verification.drivingLicense.number, adminProfile?.verification.drivingLicense.status],
                ["GST", adminProfile?.verification.gst.number || technician.gst_number, adminProfile?.verification.gst.status],
                ["Business Registration", adminProfile?.verification.businessRegistration.number || technician.trade_license_number, adminProfile?.verification.businessRegistration.status],
              ].map(([label, number, status]) => (
                <div key={String(label)} className="flex items-center justify-between gap-3 border-b pb-2 text-sm">
                  <div>
                    <p>{label}</p>
                    <p className="text-xs text-muted-foreground">{number || "-"}</p>
                  </div>
                  <VerificationBadge status={String(status || technician.verification_status)} />
                </div>
              ))}
              {technician.resume_url && (
                <Button variant="outline" className="w-full" asChild>
                  <a href={technician.resume_url} target="_blank">View Resume</a>
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Complete Registration Data</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              {[
                ["Business Information", adminProfile?.businessInfo],
                ["Vehicle Categories", adminProfile?.fleet.vehicleCategories],
                ["Working Hours", adminProfile?.registration.workingHours || technician.working_hours],
                ["App Readiness", adminProfile?.appReadiness || technician.app_readiness],
                ["Payment Details", adminProfile?.paymentDetails || technician.payment_details],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-xl border p-3">
                  <p className="mb-2 font-semibold">{label}</p>
                  <p className="break-words text-muted-foreground">{displayValue(value)}</p>
                </div>
              ))}
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
