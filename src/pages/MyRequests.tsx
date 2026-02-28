import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Clock, MapPin, Car, Wrench, CheckCircle, AlertCircle, RefreshCw, Wifi, WifiOff, Star } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/components/ui/sonner";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import NotificationBanner from "@/components/notifications/NotificationBanner";
import TechnicianRatingDialog from "@/components/rating/TechnicianRatingDialog";

interface ServiceRequest {
  _id?: string;
  id: string;
  service_type: string;
  vehicle_type: string | null;
  vehicle_model: string | null;
  address: string | null;
  status: string | null;
  serviceStatus?: string | null;
  payment_status?: string | null;
  paymentStatus?: string | null;
  created_at: string;
  updated_at: string;
  technician_id: string | null;
  contact_phone: string | null;
  has_review?: boolean;
  technician?: {
    id: string;
    name: string;
    phone: string;
    rating: number | null;
  } | null;
}

const MyRequests = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [activeTab, setActiveTab] = useState("active");
  const [showNotificationBanner, setShowNotificationBanner] = useState(true);
  const [ratingDialog, setRatingDialog] = useState<{
    open: boolean;
    request: ServiceRequest | null;
  }>({ open: false, request: null });

  const { sendNotification, permission } = usePushNotifications();

  useEffect(() => {
    if (!user) return;

    const fetchRequests = async () => {
      // Don't set loading on poll updates to avoid UI flicker, only initial load
      // But we can check if requests is empty to set initial loading
      try {
        const res = await apiFetch("/api/service-requests");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();

        // Backend returns requests with technician object
        // Maps directly to our state roughly
        const mappedData = data.map((req: any) => ({
          ...req,
          has_review: !!req.has_review
        }));

        setRequests(mappedData);
        setIsConnected(true); // Connected to backend
      } catch (error) {
        console.error('Error fetching requests:', error);
        toast.error('Failed to load your requests');
        setIsConnected(false);

      } finally {
        setIsLoading(false);
      }
    };

    fetchRequests();

    // Poll every 3 seconds for smoother review/payment state updates
    const intervalId = setInterval(fetchRequests, 3000);

    return () => clearInterval(intervalId);

  }, [user]);

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Pending</Badge>;
      case 'assigned':
        return <Badge className="bg-blue-500 gap-1"><Wrench className="h-3 w-3" /> Assigned</Badge>;
      case 'en-route':
        return <Badge className="bg-amber-500 gap-1"><Car className="h-3 w-3" /> En Route</Badge>;
      case 'in-progress':
        return <Badge className="bg-purple-500 gap-1"><Wrench className="h-3 w-3" /> In Progress</Badge>;
      case 'completed':
        return <Badge className="bg-green-500 gap-1"><CheckCircle className="h-3 w-3" /> Completed</Badge>;
      case 'paid':
        return <Badge className="bg-green-600 gap-1"><CheckCircle className="h-3 w-3" /> Paid</Badge>;
      case 'cancelled':
        return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" /> Cancelled</Badge>;
      default:
        return <Badge>{status || 'Unknown'}</Badge>;
    }
  };

  const getServiceId = (request: ServiceRequest) => {
    const resolved = request._id || request.id;
    return String(resolved || "").trim();
  };

  const normalizeServiceStatus = (request: ServiceRequest) => {
    const rawStatus = String(request.serviceStatus || request.status || "").trim().toLowerCase();
    switch (rawStatus) {
      case "assigned":
      case "technician_assigned":
        return "technician_assigned";
      case "accepted":
        return "accepted";
      case "on-the-way":
      case "on_the_way":
      case "en-route":
      case "en_route":
        return "on_the_way";
      case "arrived":
        return "arrived";
      case "in-progress":
      case "in_progress":
        return "in_progress";
      case "payment_pending":
      case "completed":
      case "job_completed":
      case "paid":
        return "job_completed";
      case "cancelled":
        return "cancelled";
      case "pending":
        return "pending";
      default:
        return rawStatus || "pending";
    }
  };

  const normalizePaymentStatus = (request: ServiceRequest) => {
    const rawPaymentStatus = String(request.paymentStatus || request.payment_status || "").trim().toLowerCase();
    switch (rawPaymentStatus) {
      case "completed":
      case "paid":
        return "paid";
      case "pending":
      case "payment_pending":
        return "payment_pending";
      default:
        return rawPaymentStatus || "payment_pending";
    }
  };

  const isKnownRedirectStatus = (serviceStatus: string) => {
    return [
      "pending",
      "accepted",
      "technician_assigned",
      "on_the_way",
      "arrived",
      "in_progress",
      "job_completed",
      "cancelled",
    ].includes(serviceStatus);
  };

  const getServiceRedirectPath = (request: ServiceRequest) => {
    const serviceId = getServiceId(request);
    if (!serviceId) return null;

    const serviceStatus = normalizeServiceStatus(request);
    const paymentStatus = normalizePaymentStatus(request);

    switch (serviceStatus) {
      case "pending":
      case "accepted":
      case "technician_assigned":
      case "on_the_way":
      case "arrived":
      case "in_progress":
        return `/service-tracking/${serviceId}`;
      case "job_completed":
        return paymentStatus === "paid"
          ? `/service-summary/${serviceId}`
          : `/payment/${serviceId}`;
      case "cancelled":
        return `/service-summary/${serviceId}`;
      default:
        return `/service-tracking/${serviceId}`;
    }
  };

  const handleServiceCardClick = (request: ServiceRequest) => {
    const serviceId = getServiceId(request);
    if (!serviceId) {
      toast.error("Unable to open this service right now.");
      return;
    }
    const serviceStatus = normalizeServiceStatus(request);
    if (!isKnownRedirectStatus(serviceStatus)) {
      toast.info("Status updated. Opening live tracking.");
    }
    const redirectPath = getServiceRedirectPath(request);
    if (!redirectPath) {
      toast.error("Invalid service state. Please refresh and try again.");
      return;
    }
    navigate(redirectPath);
  };

  const activeRequests = requests.filter((request) => {
    const serviceStatus = normalizeServiceStatus(request);
    const paymentStatus = normalizePaymentStatus(request);
    if (serviceStatus === "cancelled") return false;
    return serviceStatus !== "job_completed" || paymentStatus !== "paid";
  });

  const completedRequests = requests.filter((request) => {
    const serviceStatus = normalizeServiceStatus(request);
    const paymentStatus = normalizePaymentStatus(request);
    if (serviceStatus === "cancelled") return true;
    return serviceStatus === "job_completed" && paymentStatus === "paid";
  });

  const renderRequestCard = (request: ServiceRequest) => {
    const serviceStatus = normalizeServiceStatus(request);
    const paymentStatus = normalizePaymentStatus(request);
    const canTrack =
      ["pending", "accepted", "technician_assigned", "on_the_way", "arrived", "in_progress"].includes(serviceStatus) ||
      (serviceStatus === "job_completed" && paymentStatus !== "paid");
    const isPaidCompleted = serviceStatus === "job_completed" && paymentStatus === "paid";

    return (
      <Card
        key={request.id}
        role="button"
        tabIndex={0}
        onClick={() => handleServiceCardClick(request)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleServiceCardClick(request);
          }
        }}
        className="cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-lg active:scale-[0.99] active:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="font-semibold text-lg">{request.service_type}</h4>
              <p className="text-sm text-muted-foreground">
                {request.vehicle_type} {request.vehicle_model && `- ${request.vehicle_model}`}
              </p>
            </div>
            {getStatusBadge(request.status)}
          </div>

          <div className="space-y-2 text-sm mb-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{request.address || "Address not specified"}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>{format(new Date(request.created_at), "PPp")}</span>
            </div>
            {request.technician && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Wrench className="h-4 w-4" />
                <span>{request.technician.name} - {request.technician.phone}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            {canTrack && (
              <div className="flex-1">
                <Button variant="outline" size="sm" className="w-full">
                  Track Request
                </Button>
              </div>
            )}
            {isPaidCompleted && request.technician && !request.has_review && (
              <Button
                size="sm"
                className="gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  setRatingDialog({ open: true, request });
                }}
              >
                <Star className="h-4 w-4" />
                Rate Service
              </Button>
            )}
            {isPaidCompleted && request.has_review && (
              <Badge variant="secondary" className="gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                Rated
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container py-6 max-w-4xl">
      {/* Notification permission banner */}
      {showNotificationBanner && permission === "default" && (
        <div className="mb-6">
          <NotificationBanner onDismiss={() => setShowNotificationBanner(false)} />
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Service Requests</h1>
          <p className="text-muted-foreground">Track and manage your roadside assistance requests</p>
        </div>
        <Badge
          variant="outline"

          className={`text-xs ${isConnected ? 'border-green-500 text-green-600' : 'border-yellow-500 text-yellow-600'}`}
        >
          {isConnected ? (
            <>
              <Wifi className="h-3 w-3 mr-1" />
              Live Updates
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 mr-1" />
              Connecting...
            </>
          )}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="active" className="gap-2">
            <Clock className="h-4 w-4" />
            Active ({activeRequests.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            History ({completedRequests.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {activeRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No active requests</h3>
                <p className="text-muted-foreground mb-6">
                  You don't have any ongoing service requests at the moment.
                </p>
                <Link to="/services">
                  <Button>Request Service</Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {activeRequests.map(renderRequestCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {completedRequests.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No completed requests</h3>
                <p className="text-muted-foreground">
                  Your completed service requests will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {completedRequests.map(renderRequestCard)}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Rating Dialog */}
      {ratingDialog.request && ratingDialog.request.technician && user && (
        <TechnicianRatingDialog
          isOpen={ratingDialog.open}
          onOpenChange={(open) => setRatingDialog({ ...ratingDialog, open })}
          requestId={ratingDialog.request.id}
          technicianId={ratingDialog.request.technician.id}
          technicianName={ratingDialog.request.technician.name}
          onSuccess={() => {
            // Mark the request as reviewed locally
            setRequests(prev => prev.map(r =>

              r.id === ratingDialog.request?.id ? { ...r, has_review: true } : r
            ));
          }}
        />
      )}
    </div>
  );
};

export default MyRequests;
