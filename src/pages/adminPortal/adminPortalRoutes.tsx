import { Suspense } from "react";
import { Navigate, Route, useParams } from "react-router-dom";

import { AdminProtectedRoute } from "@/contexts/AdminAuthContext";
import { lazyWithReload } from "@/lib/lazyWithReload";

const AdminPortalLayout = lazyWithReload(() => import("./AdminPortalLayout"));
const AdminLoginPage = lazyWithReload(() => import("./pages/AdminLoginPage"));
const TodayPage = lazyWithReload(() => import("./pages/TodayPage"));
const LivePage = lazyWithReload(() => import("./pages/LivePage"));
const RequestsPage = lazyWithReload(() => import("./pages/RequestsPage"));
const ReplayPage = lazyWithReload(() => import("./pages/ReplayPage"));
const AlertsPage = lazyWithReload(() => import("./pages/AlertsPage"));
const WatchPage = lazyWithReload(() => import("./pages/WatchPage"));
const TechniciansPage = lazyWithReload(() => import("./pages/TechniciansPage"));
const TechnicianPage = lazyWithReload(() => import("./pages/TechnicianPage"));
const TechnicianFormPage = lazyWithReload(() => import("./pages/TechnicianFormPage"));
const ApplicationsPage = lazyWithReload(() => import("./pages/ApplicationsPage"));
const CustomersPage = lazyWithReload(() => import("./pages/CustomersPage"));
const CustomerPage = lazyWithReload(() => import("./pages/CustomerPage"));
const PaymentsPage = lazyWithReload(() => import("./pages/PaymentsPage"));
const PayoutsPage = lazyWithReload(() => import("./pages/PayoutsPage"));
const ReportsPage = lazyWithReload(() => import("./pages/ReportsPage"));
const AppInstallsPage = lazyWithReload(() => import('./pages/AppInstallsPage'));
const ComplaintsPage = lazyWithReload(() => import("./pages/ComplaintsPage"));
const MessagesPage = lazyWithReload(() => import("./pages/MessagesPage"));
const ServicesPage = lazyWithReload(() => import("./pages/ServicesPage"));
const SettingsPage = lazyWithReload(() => import("./pages/SettingsPage"));
const AuditPage = lazyWithReload(() => import("./pages/AuditPage"));

const fallback = <div className="p-4 text-sm text-muted-foreground" role="status">Loading admin…</div>;
const lazy = (element: JSX.Element) => <Suspense fallback={fallback}>{element}</Suspense>;

/** /admin/x/:id/y → a new address that keeps the id. */
function RedirectWithId({ to }: { to: (id: string) => string }) {
  const { id = "" } = useParams();
  return <Navigate to={to(id)} replace />;
}

// The whole admin portal: one side bar for everything. Old /admin and /admin/extended addresses lead to the new pages.
export const adminPortalRoutes = [
  <Route key="admin-login" path="/admin/login" element={lazy(<AdminLoginPage />)} />,
  <Route key="admin" path="/admin" element={<AdminProtectedRoute>{lazy(<AdminPortalLayout />)}</AdminProtectedRoute>}>
    <Route index element={<Navigate to="/admin/today" replace />} />
    <Route path="today" element={lazy(<TodayPage />)} />
    <Route path="live" element={lazy(<LivePage />)} />
    <Route path="requests/:requestId?" element={lazy(<RequestsPage />)} />
    <Route path="requests/:requestId/replay" element={lazy(<ReplayPage />)} />
    <Route path="alerts" element={lazy(<AlertsPage />)} />
    <Route path="watch" element={lazy(<WatchPage />)} />
    <Route path="technicians" element={lazy(<TechniciansPage />)} />
    <Route path="technicians/new" element={lazy(<TechnicianFormPage mode="add" />)} />
    <Route path="technicians/:technicianId" element={lazy(<TechnicianPage />)} />
    <Route path="technicians/:technicianId/edit" element={lazy(<TechnicianFormPage mode="edit" />)} />
    <Route path="applications/:technicianId?" element={lazy(<ApplicationsPage />)} />
    <Route path="customers" element={lazy(<CustomersPage />)} />
    <Route path="customers/:customerId" element={lazy(<CustomerPage />)} />
    <Route path="payments" element={lazy(<PaymentsPage />)} />
    <Route path="payouts" element={lazy(<PayoutsPage />)} />
    <Route path="reports" element={lazy(<ReportsPage />)} />
    <Route path="app-installs" element={lazy(<AppInstallsPage />)} />
    <Route path="complaints/:complaintId?" element={lazy(<ComplaintsPage />)} />
    <Route path="messages" element={lazy(<MessagesPage />)} />
    <Route path="services" element={lazy(<ServicesPage />)} />
    <Route path="settings" element={lazy(<SettingsPage section="general" />)} />
    <Route path="settings/emails" element={lazy(<SettingsPage section="emails" />)} />
    <Route path="audit" element={lazy(<AuditPage />)} />

    {/* The old portal's addresses */}
    <Route path="dashboard" element={<Navigate to="/admin/today" replace />} />
    <Route path="users" element={<Navigate to="/admin/customers" replace />} />
    <Route path="users/add" element={<Navigate to="/admin/customers?add=1" replace />} />
    <Route path="analytics" element={<Navigate to="/admin/reports" replace />} />
    <Route path="email-templates" element={<Navigate to="/admin/settings/emails" replace />} />
    <Route path="technician/:id" element={<RedirectWithId to={(id) => `/admin/technicians/${id}?tab=profile`} />} />
    <Route path="technicians/add" element={<Navigate to="/admin/technicians/new" replace />} />
    <Route path="approve-technician/:id" element={<RedirectWithId to={(id) => `/admin/applications/${id}`} />} />
    <Route path="reject-technician/:id" element={<RedirectWithId to={(id) => `/admin/applications/${id}`} />} />
    <Route path="extended" element={<Navigate to="/admin/today" replace />} />
    <Route path="extended/dashboard" element={<Navigate to="/admin/today" replace />} />
    <Route path="extended/requests" element={<Navigate to="/admin/live" replace />} />
    <Route path="extended/requests/:id/replay" element={<RedirectWithId to={(id) => `/admin/requests/${id}/replay`} />} />
    <Route path="extended/watch" element={<Navigate to="/admin/watch" replace />} />
    <Route path="extended/command-center" element={<Navigate to="/admin/alerts" replace />} />
    <Route path="extended/technicians" element={<Navigate to="/admin/technicians" replace />} />
    <Route path="extended/technicians/:id/activity" element={<RedirectWithId to={(id) => `/admin/technicians/${id}?tab=activity`} />} />
    <Route path="extended/technicians/:id/record" element={<RedirectWithId to={(id) => `/admin/technicians/${id}`} />} />
    <Route path="extended/finance" element={<Navigate to="/admin/payments" replace />} />
    <Route path="extended/analytics" element={<Navigate to="/admin/reports" replace />} />
    <Route path="extended/complaints" element={<Navigate to="/admin/complaints" replace />} />
    <Route path="extended/notifications" element={<Navigate to="/admin/messages" replace />} />
    <Route path="*" element={<Navigate to="/admin/today" replace />} />
  </Route>,
];
