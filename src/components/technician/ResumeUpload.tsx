
import React from "react";
import { Upload, Check } from "lucide-react";
import { FormLabel } from "@/components/ui/form";

interface ResumeUploadProps {
  resumeFile: File | null;
  handleResumeChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ResumeUpload = ({ resumeFile, handleResumeChange }: ResumeUploadProps) => {
  return (
    <div className="space-y-2">
      <FormLabel htmlFor="resume">Upload Your Resume (PDF or Word)</FormLabel>
      <div className="border-2 border-dashed border-gray-200 rounded-md p-4">
        <div className="flex items-center justify-center space-x-2">
          <label
            htmlFor="resume"
            className="flex items-center justify-center w-full cursor-pointer"
          >
            <div className="flex flex-col items-center space-y-2 text-center">
              <Upload className="h-6 w-6 text-gray-500" />
              <span className="text-sm text-gray-500">
                {resumeFile ? resumeFile.name : "Click to upload or drag and drop"}
              </span>
              <span className="text-xs text-gray-400">
                PDF, DOC or DOCX (max 5MB)
              </span>
            </div>
            <input
              id="resume"
              type="file"
              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              onChange={handleResumeChange}
            />
          </label>
        </div>
      </div>
      {resumeFile && (
        <div className="flex items-center space-x-2 text-sm text-green-600">
          <Check className="h-4 w-4" />
          <span>Resume uploaded successfully</span>
        </div>
      )}
    </div>
  );
};

export default ResumeUpload;
