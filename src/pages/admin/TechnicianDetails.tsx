import React, { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { apiFetch } from "@/lib/api";
import { Technician } from "@/types/technician";
import { mapTechnicianData } from "@/utils/technicianMappers";
import { io } from "socket.io-client";
import { getAdminToken, getRequiredApiBaseUrl } from "@/lib/api";
import TechnicianReviews from "@/components/rating/TechnicianReviews";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Map,
  Globe,
  Briefcase,
  Star,
  CheckCircle,
  XCircle,
  Loader2,
  FileText,
  Key,
  Clock,
  Smartphone,
  Wrench
} from "lucide-react";

const TechnicianDetails = () => {
  const { technicianId } = useParams<{ technicianId: string }>();
  const [technician, setTechnician] = useState<Technician | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [decisionReason, setDecisionReason] = useState("");
  const [approvalAudit, setApprovalAudit] = useState<any[]>([]);

  useEffect(() => {
    const fetchTechnicianDetails = async () => {
      if (!technicianId) return;
      try {
        const res = await apiFetch(`/api/technicians/${technicianId}`, { method: "GET", admin: true });
        if (!res.ok) {
          setTechnician(null);
          return;
        }
        const data = await res.json();
        setTechnician(mapTechnicianData(data));
      } catch {
        toast.error("Failed to load technician details");
      } finally {
        setLoading(false);
      }
    };
    fetchTechnicianDetails();
  }, [technicianId]);

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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* --- PHOTOS SECTION --- */}
          <Card>
            <CardHeader><CardTitle>Shop & Identity Verification</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Profile", src: technician.documents?.profile_photo, icon: User },
                  { label: "Shop Front", src: technician.documents?.garage_front, icon: MapPin },
                  { label: "Tools", src: technician.documents?.tools_photo, icon: Wrench },
                  { label: "Facilities", src: technician.documents?.facilities_photo, icon: Briefcase },
                ].map((item, i) => (
                  <div key={i} className="border rounded-lg p-2 text-center">
                    <div className="mb-2 h-24 bg-slate-100 rounded flex items-center justify-center overflow-hidden">
                      {item.src ? (
                        <img src={item.src} alt={item.label} className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform" onClick={() => window.open(item.src, '_blank')} />
                      ) : (
                        <item.icon className="h-8 w-8 text-slate-300" />
                      )}
                    </div>
                    <p className="text-xs font-medium">{item.label}</p>
                  </div>
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
                  <div><p className="text-sm text-muted-foreground">Shop Name</p><p className="font-medium">{technician.name}</p></div>
                  <div><p className="text-sm text-muted-foreground">Proprietor Name</p><p className="font-medium">{technician.proprietor_name || "-"}</p></div>
                  <div><p className="text-sm text-muted-foreground">Contact</p><p className="font-medium">{technician.phone} / {technician.email}</p></div>
                </div>
                <div className="space-y-4">
                  <div><p className="text-sm text-muted-foreground">Address</p><p className="font-medium">{technician.address}</p></div>
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
                    <Smartphone className="w-4 h-4 text-slate-500" />
                    <span className="text-sm">{technician.app_readiness?.has_smartphone ? "Has Smartphone" : "No Smartphone"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-slate-500" />
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
              <div className="flex flex-wrap gap-2 mb-4">
                {(technician.specialties || []).map((s, i) => <Badge key={i}>{s}</Badge>)}
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                {Object.entries(technician.vehicle_types || {})
                  .filter(([, enabled]) => Boolean(enabled))
                  .map(([vehicleKey]) => <Badge key={vehicleKey} variant="outline">{vehicleKey}</Badge>)}
                {Object.entries(technician.vehicle_types || {}).filter(([, enabled]) => Boolean(enabled)).length === 0 && (
                  <span className="text-sm text-muted-foreground">Vehicle types not configured</span>
                )}
              </div>
              <div className="space-y-4">
                {technician.service_costs && Array.isArray(technician.service_costs) && technician.service_costs.map((sc: any, idx: number) => (
                  <div key={idx} className="border rounded p-3 bg-slate-50 text-sm">
                    <p className="font-bold text-slate-700">{sc.service_name}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-slate-600">
                      {Object.entries(sc).filter(([k]) => k !== 'service_name').map(([k, v]) => (
                        <div key={k}><span className="capitalize">{k.replace(/_/g, ' ')}:</span> <span className="font-medium text-slate-900">{String(v)}</span></div>
                      ))}
                    </div>
                  </div>
                ))}
                {technician.service_costs && !Array.isArray(technician.service_costs) && typeof technician.service_costs === "object" && (
                  <div className="border rounded p-3 bg-slate-50 text-sm">
                    <pre className="whitespace-pre-wrap break-words text-slate-700">{JSON.stringify(technician.service_costs, null, 2)}</pre>
                  </div>
                )}
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
                    <div key={item.id} className="border rounded p-3 bg-slate-50">
                      <div className="flex items-center justify-between gap-3">
                        <Badge variant={item.action === "approved" ? "success" : "destructive"}>
                          {item.action}
                        </Badge>
                        <span className="text-xs text-slate-500">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-sm mt-2"><span className="text-slate-500">Admin:</span> {item.admin_email}</div>
                      <div className="text-sm"><span className="text-slate-500">Status:</span> {item.previous_status} to {item.new_status}</div>
                      <div className="text-sm"><span className="text-slate-500">Reason:</span> {item.reason || "-"}</div>
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
              <div><span className="text-slate-500 text-sm">Accepted Modes:</span>
                <div className="flex gap-2 mt-1">
                  {technician.payment_details?.modes?.cash && <Badge variant="outline">Cash</Badge>}
                  {technician.payment_details?.modes?.upi && <Badge variant="outline">UPI</Badge>}
                </div>
              </div>
              {technician.payment_details?.upi_id && <div><span className="text-slate-500 text-sm">UPI ID:</span> <span className="font-medium">{technician.payment_details.upi_id}</span></div>}
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
