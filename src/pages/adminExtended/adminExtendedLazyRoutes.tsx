import { Navigate, type RouteObject } from "react-router-dom";
import { lazyWithReload } from "@/lib/lazyWithReload";

const AdminExtendedLayout = lazyWithReload(() => import("./AdminExtendedLayout"));
const AdminExtendedDashboardPage = lazyWithReload(() => import("./AdminExtendedDashboardPage"));
const AdminExtendedRequestsPage = lazyWithReload(() => import("./AdminExtendedRequestsPage"));
const AdminExtendedCommandCenterPage = lazyWithReload(() => import("./AdminExtendedCommandCenterPage"));
const AdminExtendedTechniciansPage = lazyWithReload(() => import("./AdminExtendedTechniciansPage"));
const AdminExtendedTechnicianActivityPage = lazyWithReload(() => import("./AdminExtendedTechnicianActivityPage"));
const AdminExtendedFinancePage = lazyWithReload(() => import("./AdminExtendedFinancePage"));
const AdminExtendedAnalyticsPage = lazyWithReload(() => import("./AdminExtendedAnalyticsPage"));
const AdminExtendedComplaintsPage = lazyWithReload(() => import("./AdminExtendedComplaintsPage"));
const AdminExtendedNotificationsPage = lazyWithReload(() => import("./AdminExtendedNotificationsPage"));

export const adminExtendedLazyRoutes: RouteObject[] = [
  {
    path: "/admin/extended",
    element: <AdminExtendedLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/extended/dashboard" replace /> },
      { path: "dashboard", element: <AdminExtendedDashboardPage /> },
      { path: "requests", element: <AdminExtendedRequestsPage /> },
      { path: "command-center", element: <AdminExtendedCommandCenterPage /> },
      { path: "technicians", element: <AdminExtendedTechniciansPage /> },
      { path: "technicians/:technicianId/activity", element: <AdminExtendedTechnicianActivityPage /> },
      { path: "finance", element: <AdminExtendedFinancePage /> },
      { path: "analytics", element: <AdminExtendedAnalyticsPage /> },
      { path: "complaints", element: <AdminExtendedComplaintsPage /> },
      { path: "notifications", element: <AdminExtendedNotificationsPage /> },
    ],
  },
];

