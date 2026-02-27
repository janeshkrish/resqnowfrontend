import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, RefreshCw, Wifi, WifiOff, Bell } from "lucide-react";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { useRealtimeTechnicianRequests } from "@/hooks/useRealtimeTechnicianRequests";
import { useMemo } from "react";
import LiveRequestTracker from "./LiveRequestTracker";
import { toast } from "sonner";

const ServiceRequestsTab = () => {
  const { technician } = useTechnicianAuth();

  // Real-time subscription options
  const realtimeOptions = useMemo(() => ({
    onNewRequest: (request: any) => {
      console.log('New request notification:', request);
      toast.info(`New request: ${request.service_type}`);
    },
    onRequestUpdated: (request: any) => {
      console.log('Request updated:', request);
    }
  }), []);

  const {
    requests,
    isLoading,
    isConnected,
    refresh,
    updateRequestStatus
  } = useRealtimeTechnicianRequests(technician?.id, realtimeOptions);

  const handleStatusUpdate = async (requestId: string, newStatus: string) => {
    const success = await updateRequestStatus(requestId, newStatus);
    if (success) {
      await refresh();
    }

    return success;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Active Service Requests
              </CardTitle>
              <Badge
                variant="outline"
                className={`text-xs ${isConnected ? 'border-green-500 text-green-600' : 'border-yellow-500 text-yellow-600'}`}
              >
                {isConnected ? (
                  <>
                    <Wifi className="h-3 w-3 mr-1" />
                    Live
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3 w-3 mr-1" />
                    Connecting
                  </>
                )}
              </Badge>
            </div>
            <CardDescription>
              Track customer status and update progress in real-time
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardHeader>
      </Card>

      {/* Request Cards */}
      {requests.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <Clock className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-xl font-medium mb-2">No active requests</h3>
              <p className="text-muted-foreground max-w-md">
                You don't have any pending service requests. New requests will appear here with a notification when customers need assistance.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <LiveRequestTracker
              key={request.id}
              request={request}
              onStatusUpdate={handleStatusUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ServiceRequestsTab;
