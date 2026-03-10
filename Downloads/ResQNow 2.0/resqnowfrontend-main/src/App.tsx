
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { TechnicianAuthProvider } from "@/contexts/TechnicianAuthContext";
import { AdminAuthProvider, AdminProtectedRoute } from "@/contexts/AdminAuthContext";
import { ThemeProvider } from "@/components/item-providers/ThemeProvider";
import { SocketProvider } from "@/contexts/SocketContext";
import { TechnicianJobProvider } from "@/contexts/TechnicianJobContext";
import { FCMWrapper } from "@/components/FCMWrapper";
import TechnicianProtectedRoute from "@/components/routing/TechnicianProtectedRoute";
import { APP_NAVIGATE_EVENT } from "@/lib/appNavigation";

import LoadingAnimation from "@/components/LoadingAnimation";
import ErrorBoundary from "@/components/ErrorBoundary";
import ScrollToTop from "@/components/ScrollToTop";
import { App as CapacitorApp } from '@capacitor/app';
import { Suspense, useEffect } from "react";
import { setupGlobalErrorHandlers } from "./lib/globalErrors"; // install once at startup

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
import JobDeepLink from "./pages/technician/JobDeepLink";

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
import { adminExtendedLazyRoutes } from "./pages/adminExtended/adminExtendedLazyRoutes";

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
import Notifications from "./pages/Notifications";
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
type AppNavigateEventDetail = { path?: string; replace?: boolean; state?: unknown };

const adminExtendedRouteFallback = (
  <div className="p-4 text-sm text-muted-foreground">Loading admin tools...</div>
);

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

const resolveRouteFromCustomUrl = (rawUrl: string): string | null => {
  if (!rawUrl) return null;

  try {
    const parsed = new URL(rawUrl);
    const protocol = String(parsed.protocol || "").toLowerCase();
    if (!protocol.startsWith("resqnow")) return null;

    const hostAndPath = `/${parsed.host}${parsed.pathname}`.replace(/\/{2,}/g, "/");
    let routePath = `${hostAndPath}${parsed.search}`;

    if (routePath.includes("auth/callback")) {
      routePath = routePath.replace("auth/callback", "auth/success");
      return routePath;
    }

    if (routePath.includes("auth/failed")) {
      const errorParam = parsed.searchParams.get("error") || "google_auth_failed";
      return `/login?error=${encodeURIComponent(errorParam)}`;
    }

    if (routePath === "/auth") {
      return "/";
    }

    if (routePath.startsWith("/auth/")) {
      routePath = routePath.replace(/^\/auth/, "");
    }

    if (!routePath.startsWith("/")) {
      routePath = `/${routePath}`;
    }

    return routePath;
  } catch {
    return null;
  }
};

const AppRuntimeBridge = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const navigateToPath = (path: string, options?: { replace?: boolean; state?: unknown }) => {
      const normalizedPath = String(path || "").trim();
      if (!normalizedPath) return;
      navigate(normalizedPath, {
        replace: options?.replace !== false,
        state: options?.state,
      });
    };

    const handleCustomUrl = (rawUrl?: string | null) => {
      const routePath = resolveRouteFromCustomUrl(String(rawUrl || "").trim());
      if (!routePath) return;
      navigateToPath(routePath, { replace: true });
    };

    const handleAppNavigate = (event: Event) => {
      const customEvent = event as CustomEvent<AppNavigateEventDetail>;
      const path = String(customEvent.detail?.path || "").trim();
      if (!path) return;
      navigateToPath(path, {
        replace: customEvent.detail?.replace,
        state: customEvent.detail?.state,
      });
    };

    const urlListener = CapacitorApp.addListener("appUrlOpen", (data) => {
      handleCustomUrl(data?.url);
    });

    CapacitorApp.getLaunchUrl()
      .then((launchData) => {
        handleCustomUrl(launchData?.url);
      })
      .catch((error) => {
        console.warn("Failed to resolve launch URL", error);
      });

    if (typeof window !== "undefined") {
      window.addEventListener(APP_NAVIGATE_EVENT, handleAppNavigate as EventListener);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener(APP_NAVIGATE_EVENT, handleAppNavigate as EventListener);
      }
      urlListener.then(listener => listener.remove());
    };
  }, [navigate]);

  return null;
};

const App = () => {

  useEffect(() => {
    // set up a global error listener so unhandled promise rejections
    // or runtime errors do not crash the webview and are logged to console
    setupGlobalErrorHandlers();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
          {/* v7_startTransition avoids sync-suspend crashes during lazy route navigation. */}
          <BrowserRouter future={{ v7_startTransition: true }}>
            <AppRuntimeBridge />
            <ScrollToTop />
            <AdminAuthProvider>
              <AuthProvider>
                <TechnicianAuthProvider>
                  <SocketProvider>
                    <TechnicianJobProvider>
                      <FCMWrapper>
                        <TooltipProvider>
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
                            <Route path="service-tracking/:serviceId" element={<ProtectedRoute><RequestTracking /></ProtectedRoute>} />
                            <Route path="payment/:serviceId" element={<ProtectedRoute><RequestTracking /></ProtectedRoute>} />
                            <Route path="service-summary/:serviceId" element={<ProtectedRoute><RequestTracking /></ProtectedRoute>} />
                            <Route path="settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                            <Route path="profile" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                            <Route path="subscription" element={<ProtectedRoute><Subscription /></ProtectedRoute>} />
                            <Route path="my-requests" element={<ProtectedRoute><MyRequests /></ProtectedRoute>} />
                            <Route path="notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
                            <Route path="marketplace" element={<Marketplace />} />
                            <Route path="marketplace/product/:id" element={<ProductDetail />} />
                            <Route path="service-communication/:serviceId" element={<ProtectedRoute><ServiceCommunicationPage /></ProtectedRoute>} />
                            <Route path="map" element={<MapPage />} />
                            <Route path="job/:jobId" element={<JobDeepLink />} />
                          </Route>

                          {/* Technician portal routes */}
                          <Route path="/technician" element={<TechnicianLayout />}>
                            <Route path="login" element={<TechnicianLogin />} />
                            <Route path="register" element={<TechnicianRegister />} />
                            <Route path="verification" element={<TechnicianProtectedRoute><TechnicianVerification /></TechnicianProtectedRoute>} />
                            <Route path="dashboard" element={<TechnicianProtectedRoute><TechnicianDashboard /></TechnicianProtectedRoute>} />
                            <Route path="active-job" element={<TechnicianProtectedRoute><ActiveJob /></TechnicianProtectedRoute>} />
                            <Route path="history" element={<TechnicianProtectedRoute><TechnicianHistoryPage /></TechnicianProtectedRoute>} />
                            <Route path="earnings" element={<TechnicianProtectedRoute><TechnicianEarningsPage /></TechnicianProtectedRoute>} />
                            <Route path="reviews" element={<TechnicianProtectedRoute><TechnicianReviewsPage /></TechnicianProtectedRoute>} />
                            <Route path="profile" element={<TechnicianProtectedRoute><TechnicianProfile /></TechnicianProtectedRoute>} />
                            <Route path="settings" element={<TechnicianProtectedRoute><TechnicianSettings /></TechnicianProtectedRoute>} />
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

                          {/* Admin Extended Routes */}
                          {adminExtendedLazyRoutes.map((route, i) => (
                            <Route
                              key={`extended-${i}`}
                              path={route.path}
                              element={
                                <AdminProtectedRoute>
                                  <Suspense fallback={adminExtendedRouteFallback}>{route.element ?? null}</Suspense>
                                </AdminProtectedRoute>
                              }
                            >
                              {route.children?.map((child, j) => (
                                <Route
                                  key={`extended-child-${j}`}
                                  index={child.index}
                                  path={child.path}
                                  element={
                                    <Suspense fallback={adminExtendedRouteFallback}>{child.element ?? null}</Suspense>
                                  }
                                />
                              ))}
                            </Route>
                          ))}

                          {/* 404 page */}
                          <Route path="*" element={<NotFound />} />
                          </Routes>
                        </TooltipProvider>
                      </FCMWrapper>
                    </TechnicianJobProvider>
                  </SocketProvider>
                </TechnicianAuthProvider>
              </AuthProvider>
            </AdminAuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;
