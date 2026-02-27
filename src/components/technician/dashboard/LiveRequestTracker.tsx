import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  MapPin, Phone, Mail, Car, Clock, User,
  Navigation, CheckCircle, AlertCircle, Play,
  ArrowRight, MessageCircle
} from "lucide-react";
import { format } from "date-fns";
import { TechnicianServiceRequest } from "@/hooks/useRealtimeTechnicianRequests";
import { normalizeTechnicianStatus, formatTechnicianStatus } from "@/utils/technicianStatus";

interface LiveRequestTrackerProps {
  request: TechnicianServiceRequest;
  onStatusUpdate: (requestId: string, newStatus: string) => Promise<boolean>;
}

const statusFlow = ['pending', 'assigned', 'accepted', 'en-route', 'arrived', 'in-progress', 'payment_pending', 'paid', 'completed'] as const;

const LiveRequestTracker: React.FC<LiveRequestTrackerProps> = ({ request, onStatusUpdate }) => {
  const normalizedStatus = normalizeTechnicianStatus(request.status || 'pending');
  const currentStatusIndex = statusFlow.indexOf(normalizedStatus as any);
  const progress = ((currentStatusIndex + 1) / statusFlow.length) * 100;

  const getNextStatus = () => {
    const currentIndex = statusFlow.indexOf(normalizedStatus as any);
    if (currentIndex < statusFlow.length - 1) {
      return statusFlow[currentIndex + 1];
    }
    return null;
  };

  const getNextAction = () => {
    const nextStatus = getNextStatus();
    switch (nextStatus) {
      case 'en-route':
        return { label: 'Start Journey', icon: Navigation };
      case 'arrived':
        return { label: 'Mark Arrived', icon: MapPin };
      case 'in-progress':
        return { label: 'Start Service', icon: Play };
      case 'payment_pending':
        return { label: 'Complete Service', icon: CheckCircle };
      case 'paid':
        return { label: 'Close Job', icon: CheckCircle };
      default:
        return null;
    }
  };

  const handleNextAction = async () => {
    const nextStatus = getNextStatus();
    if (nextStatus) {
      await onStatusUpdate(request.id, nextStatus);
    }
  };

  const nextAction = getNextAction();

  return (
    <Card className="border-2 border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Car className="h-5 w-5" />
              {request.service_type}
            </CardTitle>
            <CardDescription>
              {request.vehicle_type} {request.vehicle_model && `• ${request.vehicle_model}`}
            </CardDescription>
          </div>
          <Badge className={
            normalizedStatus === 'in-progress' ? 'bg-purple-500 animate-pulse' :
              normalizedStatus === 'en-route' ? 'bg-amber-500' :
                normalizedStatus === 'arrived' ? 'bg-blue-500' :
                  normalizedStatus === 'payment_pending' ? 'bg-orange-500' :
                    normalizedStatus === 'paid' ? 'bg-green-600' :
                      'bg-primary'
          }>
            {formatTechnicianStatus(normalizedStatus).toUpperCase()}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs">
            {statusFlow.map((status, index) => (
              <span
                key={status}
                className={`${index <= currentStatusIndex ? 'text-primary font-medium' : 'text-muted-foreground'}`}
              >
                {index === 0 ? '•' : index === statusFlow.length - 1 ? '✓' : '○'}
              </span>
            ))}
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <User className="h-4 w-4" />
            Customer Details
          </h4>
          <div className="grid grid-cols-1 gap-2 text-sm">
            {request.contact_name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{request.contact_name}</span>
              </div>
            )}
            {request.contact_phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${request.contact_phone}`} className="text-primary hover:underline">
                  {request.contact_phone}
                </a>
              </div>
            )}
            {request.contact_email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{request.contact_email}</span>
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-3">
          <h4 className="font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Service Location
          </h4>
          <p className="text-sm">{request.address || 'Address not provided'}</p>
          {request.location_lat && request.location_lng && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => {
                const destLat = request.location_lat;
                const destLng = request.location_lng;

                if (!navigator.geolocation) {
                  // Fallback: open maps with destination only
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`,'_blank');
                  return;
                }

                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    const originLat = pos.coords.latitude;
                    const originLng = pos.coords.longitude;
                    const url = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}`;
                    window.open(url, '_blank');
                  },
                  (err) => {
                    // Permission denied or other error - open destination only
                    console.warn('Geolocation failed:', err?.message || err);
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`,'_blank');
                  },
                  { enableHighAccuracy: true, timeout: 5000 }
                );
              }}
            >
              <Navigation className="h-4 w-4 mr-2" />
              Navigate to Location
            </Button>
          )}
        </div>

        {/* Request Info */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>{format(new Date(request.created_at || new Date()), 'PPp')}</span>
          </div>
        </div>

        {/* Problem Description */}
        {request.description && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <h4 className="font-medium flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2">
              <AlertCircle className="h-4 w-4" />
              Problem Description
            </h4>
            <p className="text-sm">{request.description}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {request.contact_phone && (
            <a href={`tel:${request.contact_phone}`} className="flex-1">
              <Button variant="outline" className="w-full">
                <Phone className="h-4 w-4 mr-2" />
                Call Customer
              </Button>
            </a>
          )}

          {nextAction && (
            <Button
              onClick={handleNextAction}
              className="flex-1"
            >
              <nextAction.icon className="h-4 w-4 mr-2" />
              {nextAction.label}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveRequestTracker;
