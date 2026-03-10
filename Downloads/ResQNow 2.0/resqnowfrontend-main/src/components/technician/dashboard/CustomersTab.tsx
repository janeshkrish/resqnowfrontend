
import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users } from "lucide-react";

const CustomersTab = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer History</CardTitle>
        <CardDescription>
          View details of customers you've assisted
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">No customer history</h3>
          <p className="text-muted-foreground max-w-md">
            Once you complete service requests, your customer history will appear here.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CustomersTab;
