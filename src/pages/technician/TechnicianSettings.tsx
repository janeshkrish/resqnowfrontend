import React from "react";
import { Navigate } from "react-router-dom";

const TechnicianSettings = () => {
    // We have unified the Profile and Settings into the new TechnicianProfile component
    // Redirect legacy routes to the unified page on the 'appearance' tab.
    return <Navigate to="/technician/profile?tab=appearance" replace />;
};

export default TechnicianSettings;
