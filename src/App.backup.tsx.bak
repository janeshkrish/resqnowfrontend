
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { TechnicianAuthProvider } from "@/contexts/TechnicianAuthContext";
import { AdminAuthProvider, AdminProtectedRoute } from "@/contexts/AdminAuthContext";
import Index from "./pages/Index";
import ServicesPage from "./pages/ServicesPage";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Login from "./pages/Login";
import Register from "./pages/Register";
import AuthCallback from "./pages/AuthCallback";
import ServiceRequest from "./components/ServiceRequest";
import RequestTracking from "./components/RequestTracking";
import NotFound from "./pages/NotFound";
import AppLayout from "./components/AppLayout";
import Chatbot from "@/components/Chatbot";
import Emergency from "./pages/Emergency";
import Settings from "./pages/Settings";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";

// Technician pages
import TechnicianLayout from "./components/technician/TechnicianLayout";
import TechnicianLogin from "./pages/technician/TechnicianLogin";
import TechnicianRegister from "./pages/technician/TechnicianRegister";
import TechnicianVerification from "./pages/technician/TechnicianVerification";
import TechnicianDashboard from "./pages/technician/TechnicianDashboard";
import ActiveJob from "./pages/technician/ActiveJob";

// Admin pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboardLayout from "./components/admin/AdminDashboardLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminSettings from "./pages/admin/AdminSettings";
import ApproveTechnician from "./pages/admin/ApproveTechnician";
import RejectTechnician from "./pages/admin/RejectTechnician";
import TechnicianManagement from "./pages/admin/TechnicianManagement";
import TechnicianDetails from "./pages/admin/TechnicianDetails";
import AddTechnician from "./pages/admin/AddTechnician";
import MyRequests from "./pages/MyRequests";
import TechnicianApplications from "./pages/admin/TechnicianApplications";

import CarServiceRequest from "./components/vehicle-services/CarServiceRequest";
import BikeServiceRequest from "./components/vehicle-services/BikeServiceRequest";
import CommercialServiceRequest from "./components/vehicle-services/CommercialServiceRequest";
import EVServiceRequest from "./components/vehicle-services/EVServiceRequest";
import VehicleServiceSelector from "./components/VehicleServiceSelector";

// Marketplace pages
import Marketplace from "./pages/Marketplace";
import ProductDetail from "./pages/ProductDetail";
import ServiceCommunicationPage from "./pages/ServiceCommunicationPage";
import MapPage from "./pages/MapPage";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { isAuthenticated, loading } = useAuth();
    const location = window.location.pathname;

    if (loading) {
        return <div className="flex items-center justify-center h-screen">Loading...</div>;
    }

    if (!isAuthenticated) {
        // Store the current path to redirect back after login
        sessionStorage.setItem('returnUrl', location);
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
};

const App = () => (
    <QueryClientProvider client={queryClient}>
        <BrowserRouter>
            <AdminAuthProvider>
                <AuthProvider>
                    <TechnicianAuthProvider>
                        <TooltipProvider>
                            <Toaster />
                            <Sonner />
                            <Routes>
                                {/* Auth routes - separate from app layout */}
                                <Route path="/login" element={<Login />} />
                                <Route path="/register" element={<Register />} />
                                <Route path="/auth/callback" element={<AuthCallback />} />

                                {/* Main app routes with AppLayout */}
                                <Route path="/" element={<AppLayout />}>
                                    <Route index element={<Index />} />
                                    <Route path="services" element={<ServicesPage />} />
                                    <Route path="about" element={<About />} />
                                    <Route path="contact" element={<Contact />} />
                                    <Route path="emergency" element={<Emergency />} />
                                    <Route path="request-service/:serviceId" element={<VehicleServiceSelector />} />
                                    <Route path="request-service/:serviceId/car" element={<ProtectedRoute><CarServiceRequest /></ProtectedRoute>} />
                                    <Route path="request-service/:serviceId/bike" element={<ProtectedRoute><BikeServiceRequest /></ProtectedRoute>} />
                                    <Route path="request-service/:serviceId/commercial" element={<ProtectedRoute><CommercialServiceRequest /></ProtectedRoute>} />
                                    <Route path="request-service/:serviceId/ev" element={<ProtectedRoute><EVServiceRequest /></ProtectedRoute>} />
                                    <Route path="request-tracking/:requestId" element={<ProtectedRoute><RequestTracking /></ProtectedRoute>} />
                                    <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                                    <Route path="my-requests" element={<ProtectedRoute><MyRequests /></ProtectedRoute>} />
                                    <Route path="marketplace" element={<Marketplace />} />
                                    <Route path="marketplace/product/:id" element={<ProductDetail />} />
                                    <Route path="service-communication/:serviceId" element={<ProtectedRoute><ServiceCommunicationPage /></ProtectedRoute>} />
                                    <Route path="map" element={<MapPage />} />
                                </Route>

                                {/* Technician portal routes */}
                                <Route path="/technician" element={<TechnicianLayout />}>
                                    <Route path="login" element={<TechnicianLogin />} />
                                    <Route path="register" element={<TechnicianRegister />} />
                                    <Route path="verification" element={<TechnicianVerification />} />
                                    <Route path="dashboard" element={<TechnicianDashboard />} />
                                    <Route path="active-job" element={<ActiveJob />} />
                                </Route>

                                {/* Admin login route */}
                                <Route path="/admin/login" element={<AdminLogin />} />

                                {/* Admin routes with AdminDashboardLayout - protected by AdminProtectedRoute */}
                                <Route path="/admin" element={
                                    <AdminProtectedRoute>
                                        <AdminDashboardLayout />
                                    </AdminProtectedRoute>
                                }>
                                    <Route index element={<Navigate to="/admin/dashboard" replace />} />
                                    <Route path="dashboard" element={<AdminDashboard />} />
                                    <Route path="technicians" element={<TechnicianManagement />} />
                                    <Route path="technicians/add" element={<AddTechnician />} />
                                    <Route path="applications" element={<TechnicianApplications />} />
                                    <Route path="analytics" element={<AdminAnalytics />} />
                                    <Route path="settings" element={<AdminSettings />} />
                                    <Route path="technician/:technicianId" element={<TechnicianDetails />} />
                                </Route>

                                {/* Admin routes without layout (for approval/rejection processes) */}
                                <Route path="/admin/approve-technician/:technicianId" element={
                                    <AdminProtectedRoute>
                                        <ApproveTechnician />
                                    </AdminProtectedRoute>
                                } />
                                <Route path="/admin/reject-technician/:technicianId" element={
                                    <AdminProtectedRoute>
                                        <RejectTechnician />
                                    </AdminProtectedRoute>
                                } />

                                {/* 404 page */}
                                <Route path="*" element={<NotFound />} />
                            </Routes>
                        </TooltipProvider>
                    </TechnicianAuthProvider>
                </AuthProvider>
            </AdminAuthProvider>
        </BrowserRouter>
    </QueryClientProvider>
);

export default App;
