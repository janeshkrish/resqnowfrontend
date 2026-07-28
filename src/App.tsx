
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
import { lazyWithReload } from "@/lib/lazyWithReload";

import LoadingAnimation from "@/components/LoadingAnimation";
import ErrorBoundary from "@/components/ErrorBoundary";
import ScrollToTop from "@/components/ScrollToTop";
import { App as CapacitorApp } from '@capacitor/app';
import { Suspense, useEffect } from "react";
import { setupGlobalErrorHandlers } from "./lib/globalErrors"; // install once at startup
import { adminExtendedLazyRoutes } from "./pages/adminExtended/adminExtendedLazyRoutes";
import AppLayout from "./components/AppLayout";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
type AppNavigateEventDetail = { path?: string; replace?: boolean; state?: unknown };

const adminExtendedRouteFallback = (
  <div className="p-4 text-sm text-muted-foreground">Loading admin tools...</div>
);

const routeFallback = (
  <div className="flex min-h-[40vh] items-center justify-center p-6 text-sm text-muted-foreground">
    Loading...
  </div>
);

const Login = lazyWithReload(() => import("./pages/Login"));
const Register = lazyWithReload(() => import("./pages/Register"));
const OTPVerify = lazyWithReload(() => import("./pages/OTPVerify"));
const ConfirmEmail = lazyWithReload(() => import("./pages/ConfirmEmail"));
const AuthSuccess = lazyWithReload(() => import("./pages/AuthSuccess"));
const ServicesPage = lazyWithReload(() => import("./pages/ServicesPage"));
const About = lazyWithReload(() => import("./pages/About"));
const CitiesPage = lazyWithReload(() => import("./pages/CitiesPage"));
const WhyResQNow = lazyWithReload(() => import("./pages/WhyResQNow"));
const Contact = lazyWithReload(() => import("./pages/Contact"));
const Emergency = lazyWithReload(() => import("./pages/Emergency"));
const PrivacyPolicy = lazyWithReload(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazyWithReload(() => import("./pages/TermsOfService"));
const VehicleServiceSelector = lazyWithReload(() => import("./components/VehicleServiceSelector"));
const CarServiceRequest = lazyWithReload(() => import("./components/vehicle-services/CarServiceRequest"));
const BikeServiceRequest = lazyWithReload(() => import("./components/vehicle-services/BikeServiceRequest"));
const CommercialServiceRequest = lazyWithReload(() => import("./components/vehicle-services/CommercialServiceRequest"));
const EVServiceRequest = lazyWithReload(() => import("./components/vehicle-services/EVServiceRequest"));
const RequestTracking = lazyWithReload(() => import("./components/RequestTracking"));
const Settings = lazyWithReload(() => import("./pages/Settings"));
const Subscription = lazyWithReload(() => import("./pages/Subscription"));
const MyRequests = lazyWithReload(() => import("./pages/MyRequests"));
const Notifications = lazyWithReload(() => import("./pages/Notifications"));
const Marketplace = lazyWithReload(() => import("./pages/Marketplace"));
const MyGaragePage = lazyWithReload(() => import("./pages/MyGaragePage"));
const ProductDetail = lazyWithReload(() => import("./pages/ProductDetail"));
const ServiceCommunicationPage = lazyWithReload(() => import("./pages/ServiceCommunicationPage"));
const MapPage = lazyWithReload(() => import("./pages/MapPage"));
const TechnicianLayout = lazyWithReload(() => import("./components/technician/TechnicianLayout"));
const TechnicianLanding = lazyWithReload(() => import("./pages/technician/TechnicianLanding"));
const TechnicianLogin = lazyWithReload(() => import("./pages/technician/TechnicianLogin"));
const TechnicianRegister = lazyWithReload(() => import("./pages/technician/TechnicianRegister"));
const TechnicianVerification = lazyWithReload(() => import("./pages/technician/TechnicianVerification"));
const TechnicianDashboard = lazyWithReload(() => import("./pages/technician/TechnicianDashboard"));
const ActiveJob = lazyWithReload(() => import("./pages/technician/ActiveJob"));
const TechnicianHistoryPage = lazyWithReload(() => import("./pages/technician/TechnicianHistoryPage"));
const TechnicianEarningsPage = lazyWithReload(() => import("./pages/technician/TechnicianEarningsPage"));
const TechnicianReviewsPage = lazyWithReload(() => import("./pages/technician/TechnicianReviewsPage"));
const TechnicianProfile = lazyWithReload(() => import("./pages/technician/TechnicianProfile"));
const TechnicianSettings = lazyWithReload(() => import("./pages/technician/TechnicianSettings"));
const JobDeepLink = lazyWithReload(() => import("./pages/technician/JobDeepLink"));
const AdminLogin = lazyWithReload(() => import("./pages/admin/AdminLogin"));
const AdminDashboardLayout = lazyWithReload(() => import("./components/admin/AdminDashboardLayout"));
const AdminDashboard = lazyWithReload(() => import("./pages/admin/AdminDashboard"));
const TechnicianManagement = lazyWithReload(() => import("./pages/admin/TechnicianManagement"));
const UserManagement = lazyWithReload(() => import("./pages/admin/UserManagement"));
const AddUser = lazyWithReload(() => import("./pages/admin/AddUser"));
const AdminAnalytics = lazyWithReload(() => import("./pages/admin/AdminAnalytics"));
const AdminPaymentLogs = lazyWithReload(() => import("./pages/admin/AdminPaymentLogs"));
const AdminPayouts = lazyWithReload(() => import("./pages/admin/AdminPayouts"));
const AdminSettings = lazyWithReload(() => import("./pages/admin/AdminSettings"));
const EmailTemplates = lazyWithReload(() => import("./pages/admin/EmailTemplates"));
const TechnicianApplications = lazyWithReload(() => import("./pages/admin/TechnicianApplications"));
const TechnicianDetails = lazyWithReload(() => import("./pages/admin/TechnicianDetails"));
const AddTechnician = lazyWithReload(() => import("./pages/admin/AddTechnician"));
const ApproveTechnician = lazyWithReload(() => import("./pages/admin/ApproveTechnician"));
const RejectTechnician = lazyWithReload(() => import("./pages/admin/RejectTechnician"));

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
                          <Suspense fallback={routeFallback}>
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
                              <Route path="cities" element={<CitiesPage />} />
                              <Route path="why-resqnow" element={<WhyResQNow />} />
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
                              <Route path="my-garage" element={<ProtectedRoute><MyGaragePage /></ProtectedRoute>} />
                              <Route path="my-garage/add" element={<ProtectedRoute><MyGaragePage /></ProtectedRoute>} />
                              <Route path="marketplace" element={<Marketplace />} />
                              <Route path="marketplace/product/:id" element={<ProductDetail />} />
                              <Route path="service-communication/:serviceId" element={<ProtectedRoute><ServiceCommunicationPage /></ProtectedRoute>} />
                              <Route path="map" element={<MapPage />} />
                              <Route path="job/:jobId" element={<JobDeepLink />} />
                            </Route>

                            {/* Technician portal routes */}
                            <Route path="/technician" element={<TechnicianLayout />}>
                              <Route path="landing" element={<TechnicianLanding />} />
                              <Route path="login" element={<TechnicianLogin />} />
                              <Route path="register" element={<TechnicianRegister />} />
                              <Route path="verification" element={<TechnicianProtectedRoute><TechnicianVerification /></TechnicianProtectedRoute>} />
                              <Route path="dashboard" element={<TechnicianProtectedRoute><TechnicianDashboard /></TechnicianProtectedRoute>} />
                              <Route path="active-job" element={<TechnicianProtectedRoute><ActiveJob /></TechnicianProtectedRoute>} />
                              <Route path="active-job/:requestId" element={<TechnicianProtectedRoute><ActiveJob /></TechnicianProtectedRoute>} />
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
                              <Route path="payouts" element={<AdminPayouts />} />
                              <Route path="email-templates" element={<EmailTemplates />} />
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
                          </Suspense>
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
