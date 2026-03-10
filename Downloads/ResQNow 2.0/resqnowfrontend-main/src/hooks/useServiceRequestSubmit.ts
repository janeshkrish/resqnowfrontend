import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface ServiceRequestData {
  name: string;
  phone: string;
  email?: string;
  vehicleInfo: any;
  locationInfo: any;
  personalInfo?: any;
  details: string;
  urgency: string;
  serviceType: string;
}

export const useServiceRequestSubmit = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth(); // Ensure we have user context

  const submitServiceRequest = async (data: ServiceRequestData) => {
    setIsSubmitting(true);

    try {
      if (!user) {
        toast.error("Please login to submit a service request");
        navigate('/login');
        return;
      }

      // Extract Lat/Lng if available
      const lat = data.locationInfo?.lat || null;
      const lng = data.locationInfo?.lng || null;

      const payload = {
        service_type: data.serviceType,
        vehicle_type: data.vehicleInfo?.type || 'unknown',
        vehicle_model: data.vehicleInfo?.model || data.vehicleInfo?.brand || 'Unknown Model',
        address: data.locationInfo?.address || data.personalInfo?.address || 'Not specified',
        description: data.details || '',
        contact_phone: data.personalInfo?.phone || data.phone,
        location_lat: lat,
        location_lng: lng,
      };

      const res = await apiFetch("/api/service-requests", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Submission failed");
      }

      const result = await res.json();

      toast.success("Service request submitted successfully!");

      // Navigate to tracking page with the actual request ID
      navigate(`/request-service-tracking/${result.id}`);

      return result;
    } catch (error: any) {
      console.error('Error submitting request:', error);
      toast.error(error.message || "Failed to submit request. Please try again.");
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    submitServiceRequest,
    isSubmitting
  };
};