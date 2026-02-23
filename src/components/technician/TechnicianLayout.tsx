
import React from "react";
import { Outlet } from "react-router-dom";
import TechnicianHeader from "./TechnicianHeader";
import { TechnicianAuthProvider } from "@/contexts/TechnicianAuthContext";
import { SocketProvider } from "@/contexts/SocketContext";
import JobNotificationModal from "./JobNotificationModal";

const TechnicianLayout = () => {
  return (
    <SocketProvider>
      <div className="flex flex-col min-h-screen">
        <TechnicianHeader />
        <JobNotificationModal />
        <main className="flex-grow">
          <Outlet />
        </main>
        <footer className="border-t py-6 md:py-0">
          <div className="container flex flex-col md:h-16 items-center md:flex-row md:justify-between">
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} ResQNow Technician Portal. All rights reserved.
            </p>
            <div className="flex items-center gap-4 mt-4 md:mt-0">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Terms
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Contact
              </a>
            </div>
          </div>
        </footer>
      </div>
    </SocketProvider>
  );
};

export default TechnicianLayout;
