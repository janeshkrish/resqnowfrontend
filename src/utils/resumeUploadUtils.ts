import { toast } from "@/components/ui/sonner";
import { apiUrl } from "@/lib/api";

export const validateResumeFile = (file: File): boolean => {
  // Check if file is PDF or document
  if (
    file.type === 'application/pdf' ||
    file.type === 'application/msword' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.type.startsWith('image/')
  ) {
    return true;
  } else {
    toast.error("Invalid file type. Please upload a PDF, Word document, or Image");
    return false;
  }
};

export const uploadResume = async (technicianId: string, resumeFile: File): Promise<string | null> => {
  if (!resumeFile) return null;

  try {
    const formData = new FormData();
    formData.append("file", resumeFile);

    // We append technicianId just in case we enhance the backend to use it for folders later,
    // though the current simple upload route might ignore it.
    // Actually, Multer doesn't support "folders" dynamically easily without configuration.
    // We'll rely on the backend generating a unique filename.

    const response = await fetch(apiUrl("/api/upload"), {
      method: "POST",
      body: formData,
      // No Content-Type header needed for FormData, browser sets it with boundary
      headers: {
        "Authorization": `Bearer ${localStorage.getItem('resqnow_user_token') || ''}`
      }
    });

    if (!response.ok) {
      throw new Error("Upload failed");
    }

    const data = await response.json();
    return data.url; // The relative URL returned by backend
  } catch (error) {
    console.error("Error in resume upload:", error);
    return null;
  }
};
