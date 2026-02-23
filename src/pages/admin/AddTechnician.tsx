import React from "react";
// AdminSidebar removed as per user request
import AdminAddTechnicianWizard from "@/components/admin/AdminAddTechnicianWizard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const AddTechnician = () => {
  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="bg-white border-b px-8 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="sm" onClick={() => window.history.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Add New Technician</h1>
              <div className="text-sm text-slate-500">Admin Portal / Technicians / Add New</div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-hidden">
          <AdminAddTechnicianWizard />
        </main>
      </div>
    </div>
  );
};

export default AddTechnician;
