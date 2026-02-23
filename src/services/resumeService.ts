import { toast } from "@/components/ui/sonner";
import { apiUrl } from "@/lib/api";

export const resumeService = {
  /**
   * Upload technician resume file
   */
  uploadResume: async (technicianId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      // We'll trust the server to handle naming effectively, or assume standard resumes logic
      const response = await fetch(apiUrl("/api/upload"), {
        method: "POST",
        body: formData,
        headers: {
          "Authorization": `Bearer ${localStorage.getItem('resqnow_user_token') || ''}`
        }
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const data = await response.json();
      return true; // Simple success/fail
    } catch (error) {
      console.error("Error uploading resume:", error);
      toast.error("Failed to upload resume");
      return false;
    }
  },

  /**
   * Get technician resume URL
   */
  getResumeUrl: async (technicianId: string) => {
    // This would likely be part of the technician profile fetch, or we need a specific endpoint to list files.
    // For now, returning null as we don't have a direct "list resume" endpoint in the upload service yet.
    // The profile endpoint returns 'resume_url' col, which we should use.
    console.warn("Resume URL fetching via separate service is deprecated. Use technician profile data.");
    return null;
  },

  /**
   * Check if technician has uploaded a resume
   */
  hasResume: async (technicianId: string) => {
    // Similar to above, rely on profile data
    return false;
  }
};
