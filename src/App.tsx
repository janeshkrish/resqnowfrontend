
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TechnicianAuthProvider } from "@/contexts/TechnicianAuthContext";
import { AdminAuthProvider, AdminProtectedRoute } from "@/contexts/AdminAuthContext";
import { ThemeProvider } from "@/components/item-providers/ThemeProvider";
import { SocketProvider } from "@/contexts/SocketContext";

import LoadingAnimation from "@/components/LoadingAnimation";
import ErrorBoundary from "@/components/ErrorBoundary";
import ScrollToTop from "@/components/ScrollToTop";

// Technician pages
import TechnicianLayout from "./components/technician/TechnicianLayout";
import TechnicianLogin from "./pages/technician/TechnicianLogin";
import TechnicianRegister from "./pages/technician/TechnicianRegister";
import TechnicianVerification from "./pages/technician/TechnicianVerification";
import TechnicianDashboard from "./pages/technician/TechnicianDashboard";
import TechnicianHistoryPage from "./pages/technician/TechnicianHistoryPage";
import TechnicianEarningsPage from "./pages/technician/TechnicianEarningsPage";
import TechnicianReviewsPage from "./pages/technician/TechnicianReviewsPage";
import ActiveJob from "./pages/technician/ActiveJob";
import TechnicianProfile from "./pages/technician/TechnicianProfile";
import TechnicianSettings from "./pages/technician/TechnicianSettings";

// Admin pages
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboardLayout from "./components/admin/AdminDashboardLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminAnalytics from "./pages/admin/AdminAnalytics";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminPaymentLogs from "./pages/admin/AdminPaymentLogs";
import ApproveTechnician from "./pages/admin/ApproveTechnician";
import RejectTechnician from "./pages/admin/RejectTechnician";
import TechnicianManagement from "./pages/admin/TechnicianManagement";
import TechnicianDetails from "./pages/admin/TechnicianDetails";
import AddTechnician from "./pages/admin/AddTechnician";
import UserManagement from "./pages/admin/UserManagement";
import AddUser from "./pages/admin/AddUser";
import MyRequests from "./pages/MyRequests";
import TechnicianApplications from "./pages/admin/TechnicianApplications";

import Login from "./pages/Login";
import Register from "./pages/Register";
import OTPVerify from "./pages/OTPVerify";
import ConfirmEmail from "./pages/ConfirmEmail";
import AuthSuccess from "./pages/AuthSuccess";
import AppLayout from "./components/AppLayout";
import Index from "./pages/Index";
import ServicesPage from "./pages/ServicesPage";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Emergency from "./pages/Emergency";
import RequestTracking from "./components/RequestTracking";
import Settings from "./pages/Settings";
import Subscription from "./pages/Subscription";
import NotFound from "./pages/NotFound";

import CarServiceRequest from "./components/vehicle-services/CarServiceRequest";
import BikeServiceRequest from "./components/vehicle-services/BikeServiceRequest";
import CommercialServiceRequest from "./components/vehicle-services/CommercialServiceRequest";
import EVServiceRequest from "./components/vehicle-services/EVServiceRequest";
import VehicleServiceSelector from "./components/VehicleServiceSelector";

// Marketplace pages
import Marketplace from "./pages/Marketplace";
import ProductDetail from "./pages/ProductDetail";
import ServiceCommunicationPage from "./pages/ServiceCommunicationPage";

import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

import MapPage from "./pages/MapPage";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = window.location.pathname;

  if (loading) {
    return <LoadingAnimation />;
  }

  if (!isAuthenticated) {
    sessionStorage.setItem('returnUrl', location);
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <BrowserRouter>
          <ScrollToTop />
          <AdminAuthProvider>
            <AuthProvider>
              <TechnicianAuthProvider>
                <SocketProvider>
                  <TooltipProvider>
                    <Toaster />
                    <Sonner />
                    <LoadingAnimation />
                    <Routes>
                    {/* Auth routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/otp-verify" element={<OTPVerify />} />
                    <Route path="/confirm-email" element={<ConfirmEmail />} />
                    <Route path="/auth/success" element={<AuthSuccess />} />

                    {/* Main app routes with AppLayout */}
                    <Route path="/" element={<AppLayout />}>
                      <Route index element={<Index />} />
                      <Route path="services" element={<ServicesPage />} />
                      <Route path="about" element={<About />} />
                      <Route path="contact" element={<Contact />} />
                      <Route path="emergency" element={<Emergency />} />
                      <Route path="privacy-policy" element={<PrivacyPolicy />} />
                      <Route path="terms-of-service" element={<TermsOfService />} />

                      <Route path="request-service/:serviceId" element={<VehicleServiceSelector />} />
                      <Route path="request-service/:serviceId/car" element={<ProtectedRoute><CarServiceRequest /></ProtectedRoute>} />
                      <Route path="request-service/:serviceId/bike" element={<ProtectedRoute><BikeServiceRequest /></ProtectedRoute>} />
                      <Route path="request-service/:serviceId/commercial" element={<ProtectedRoute><CommercialServiceRequest /></ProtectedRoute>} />
                      <Route path="request-service/:serviceId/ev" element={<ProtectedRoute><EVServiceRequest /></ProtectedRoute>} />
                      <Route path="request-service-tracking/:requestId" element={<ProtectedRoute><RequestTracking /></ProtectedRoute>} />
                      <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                      <Route path="profile" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                      <Route path="subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
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
                      <Route path="history" element={<TechnicianHistoryPage />} />
                      <Route path="earnings" element={<TechnicianEarningsPage />} />
                      <Route path="reviews" element={<TechnicianReviewsPage />} />
                      <Route path="profile" element={<TechnicianProfile />} />
                      <Route path="settings" element={<TechnicianSettings />} />
                    </Route>

                    {/* Admin login route */}
                    <Route path="/admin/login" element={<AdminLogin />} />

                    {/* Admin routes with separate Layout */}
                    <Route path="/admin" element={
                      <AdminProtectedRoute>
                        <AdminDashboardLayout />
                      </AdminProtectedRoute>
                    }>
                      <Route index element={<Navigate to="/admin/dashboard" replace />} />
                      <Route path="dashboard" element={<AdminDashboard />} />
                      <Route path="technicians" element={<TechnicianManagement />} />
                      {/* AddTechnician moved to standalone route below to remove sidebar */}
                      <Route path="users" element={<UserManagement />} />
                      <Route path="users/add" element={<AddUser />} />
                      <Route path="applications" element={<TechnicianApplications />} />
                      <Route path="analytics" element={<AdminAnalytics />} />
                      <Route path="payments" element={<AdminPaymentLogs />} />
                      <Route path="settings" element={<AdminSettings />} />
                      <Route path="technician/:technicianId" element={<TechnicianDetails />} />
                    </Route>

                    {/* Standalone Add Technician Page (No Sidebar) */}
                    <Route path="/admin/technicians/add" element={
                      <AdminProtectedRoute>
                        <AddTechnician />
                      </AdminProtectedRoute>
                    } />

                    {/* Admin Approval Routes */}
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
                </SocketProvider>
              </TechnicianAuthProvider>
            </AuthProvider>
          </AdminAuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
