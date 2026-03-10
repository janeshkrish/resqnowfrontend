import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/sonner";
import { apiFetch } from "@/lib/api";
import { technicianAdminService } from "@/services/technicianAdminService";
import { Loader2 } from "lucide-react";

const RejectTechnician = () => {
  const { technicianId } = useParams();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [technicianName, setTechnicianName] = useState("");
  const [technicianEmail, setTechnicianEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTechnicianData = async () => {
      if (!technicianId) return;
      try {
        const res = await apiFetch(`/api/technicians/${technicianId}`, { method: "GET", admin: true });
        if (!res.ok) {
          setError("Technician not found.");
          return;
        }
        const technician = await res.json();
        setTechnicianName(technician.name);
        setTechnicianEmail(technician.email);
        if (technician.verification_status === "rejected") {
          setError("This technician application has already been rejected.");
        }
      } catch {
        setError("An error occurred while fetching technician data");
      } finally {
        setIsLoading(false);
      }
    };
    fetchTechnicianData();
  }, [technicianId]);

  const handleRejection = async () => {
    if (!technicianId) return;
    setIsSubmitting(true);
    try {
      const success = await technicianAdminService.rejectTechnician(technicianId);
      if (success) {
        toast.success("Technician application rejected");
        navigate("/admin/applications");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-12 max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Reject Technician Application</CardTitle>
          <CardDescription>
            Review and reject this technician application
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          ) : (
            <div className="space-y-4">
              <p>
                You are about to reject <strong>{technicianName}</strong>&apos;s application.
              </p>
              <p>
                An email notification will be sent to {technicianEmail} informing them about this decision.
              </p>
              <p className="text-amber-600">
                This action cannot be undone. Please confirm to proceed.
              </p>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => navigate("/admin/applications")}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRejection}
            disabled={!!error || isSubmitting}
            variant="destructive"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
              </>
            ) : (
              "Reject Application"
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default RejectTechnician;
