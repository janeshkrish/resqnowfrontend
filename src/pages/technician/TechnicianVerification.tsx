import React from "react";
import { Link, Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTechnicianAuth } from "@/contexts/TechnicianAuthContext";
import { CheckCircle, Clock, XCircle, FileText, ShieldCheck } from "lucide-react";

const TechnicianVerification = () => {
  const { technician, isAuthenticated } = useTechnicianAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/technician/login" replace />;
  }

  const renderStatusContent = () => {
    switch (technician?.verification_status) {
      case "pending":
        return (
          <div className="flex flex-col items-center py-6">
            <Clock size={64} className="text-yellow-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Verification In Progress</h2>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Your application is currently being reviewed by our team. This process typically takes 1-3 business days.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 w-full max-w-md">
              <h3 className="font-medium text-yellow-800 mb-2 flex items-center">
                <FileText className="mr-2 h-5 w-5" />
                Next Steps
              </h3>
              <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                <li>We'll review your qualifications and experience</li>
                <li>We may contact you for additional information</li>
                <li>You'll receive an email when your verification is complete</li>
              </ul>
            </div>
          </div>
        );
        
      case "verified":
        return (
          <div className="flex flex-col items-center py-6">
            <CheckCircle size={64} className="text-green-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Verification Complete</h2>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Congratulations! Your account has been verified. You're now an official ResQNow technician.
            </p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 w-full max-w-md">
              <h3 className="font-medium text-green-800 mb-2 flex items-center">
                <ShieldCheck className="mr-2 h-5 w-5" />
                You're all set!
              </h3>
              <p className="text-sm text-green-700">
                You can now access the technician dashboard and start accepting service requests.
              </p>
            </div>
            <Button className="mt-6" asChild>
              <Link to="/technician/dashboard">
                Go to Dashboard
              </Link>
            </Button>
          </div>
        );
        
      case "rejected":
        return (
          <div className="flex flex-col items-center py-6">
            <XCircle size={64} className="text-red-500 mb-4" />
            <h2 className="text-2xl font-bold mb-2">Verification Unsuccessful</h2>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Unfortunately, we couldn't verify your account at this time. This could be due to incomplete information or not meeting our requirements.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 w-full max-w-md">
              <h3 className="font-medium text-red-800 mb-2">What can you do?</h3>
              <p className="text-sm text-red-700 mb-4">
                Please contact our support team for more details about why your verification was unsuccessful and how to proceed.
              </p>
              <Button variant="outline" className="w-full" asChild>
                <Link to="/contact">
                  Contact Support
                </Link>
              </Button>
            </div>
          </div>
        );
        
      default:
        return (
          <div className="flex flex-col items-center py-6">
            <p className="text-muted-foreground">Verification status not available.</p>
          </div>
        );
    }
  };

  return (
    <div className="container py-12 flex flex-col items-center">
      <div className="max-w-3xl w-full">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">Account Verification</h1>
          <p className="text-muted-foreground mt-2">Check the status of your technician account verification</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Verification Status</CardTitle>
            <CardDescription>
              {technician?.name} • {technician?.email}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {renderStatusContent()}
          </CardContent>
          <CardFooter className="flex justify-center border-t pt-6">
            <p className="text-sm text-muted-foreground text-center">
              Need help? Contact us at <span className="font-medium">support@resqnow.com</span>
            </p>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default TechnicianVerification;
