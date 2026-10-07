import React from "react";
import AdminAddTechnicianWizard from "@/components/admin/AdminAddTechnicianWizard";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const AddTechnician = () => {
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-muted/20 text-foreground">
        <header className="shrink-0 border-b border-border bg-card px-4 py-4 md:px-8">
          <div className="mx-auto flex max-w-7xl items-center gap-3 md:gap-4">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/technicians">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Link>
            </Button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold md:text-xl">Add New Technician</h1>
              <nav aria-label="Breadcrumb" className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Link to="/admin/dashboard" className="hover:text-foreground">Admin Portal</Link>
                <ChevronRight className="h-3 w-3" />
                <Link to="/admin/technicians" className="hover:text-foreground">Technicians</Link>
                <ChevronRight className="h-3 w-3" />
                <span aria-current="page">Add New</span>
              </nav>
            </div>
          </div>
        </header>
        <main className="mx-auto min-h-0 w-full max-w-7xl flex-1 p-3 md:p-6">
          <AdminAddTechnicianWizard />
        </main>
    </div>
  );
};

export default AddTechnician;
