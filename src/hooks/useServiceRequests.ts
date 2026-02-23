import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "@/components/ui/sonner";
import { useAuth } from "@/contexts/AuthContext";
import { ServiceRequestFormData } from "@/components/service-request/types";

export const useServiceRequests = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeRequests, setActiveRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  const submitServiceRequest = async (formData: ServiceRequestFormData, serviceType: string) => {
    if (!user) {
      toast.error("You must be logged in to request service");
      return null;
    }
    setIsSubmitting(true);

    try {
      let lat = 0, lng = 0;
      const locationParts = formData.location.match(/Latitude: ([\d.]+), Longitude: ([\d.]+)/);
      if (locationParts && locationParts.length === 3) {
        lat = parseFloat(locationParts[1]);
        lng = parseFloat(locationParts[2]);
      }
      const payload = {
        service_type: serviceType,
        vehicle_type: `${formData.vehicleType} - ${formData.vehicleSubtype}`,
        vehicle_model: formData.vehicleModel,
        address: formData.location,
        description: formData.details,
        technician_id: formData.selectedTechnicianId,
        contact_phone: user.email, // placeholder or fetch from profile
        location_lat: lat,
        location_lng: lng
      };

      const res = await apiFetch("/api/service-requests", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit");
      }

      const data = await res.json();

      toast.success("Service request submitted successfully!");
      return data;
    } catch (error: any) {
      console.error("Error submitting service request:", error);
      toast.error(error.message || "Failed to submit service request");
      return null;
    } finally {
      setIsSubmitting(false);
    }
  };
  const getUserRequests = async () => {
    if (!user) return [];

    setIsLoading(true);
    try {
      const res = await apiFetch("/api/service-requests");
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      return data || [];
    } catch (error) {
      console.error("Error fetching user requests:", error);
      toast.error("Failed to load your service requests");
      return [];
    } finally {
      setIsLoading(false);
    }
  };
  const getTechnicianRequests = async (technicianId: string) => {
    setIsLoading(true);
    try {
      // Stub or implement endpoint
      console.warn("getTechnicianRequests not fully implemented in backend yet");
      return [];
    } catch (error) {
      console.error("Error fetching technician requests:", error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };
  const updateRequestStatus = async (requestId: string, status: string) => {
    try {
      const res = await apiFetch(`/api/service-requests/${requestId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status })
      });

      if (!res.ok) throw new Error("Update failed");

      toast.success(`Request ${status} successfully`);
      return true;
    } catch (error) {
      console.error(`Error updating request to ${status}:`, error);
      toast.error(`Failed to update request status`);
      return false;
    }
  };

  return {
    submitServiceRequest,
    getUserRequests,
    getTechnicianRequests,
    updateRequestStatus,
    isSubmitting,
    isLoading,
  };
};
