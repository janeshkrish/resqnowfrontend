
import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin } from "lucide-react";

const ServiceAreaTab = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Service Area</CardTitle>
        <CardDescription>
          View and manage your service coverage area
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[400px] rounded-md border flex items-center justify-center bg-muted">
          <div className="text-center p-6">
            <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Map view unavailable</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              This feature will be available soon. You'll be able to set your service area and view requests on a map.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ServiceAreaTab;
