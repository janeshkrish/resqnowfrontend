# Route map

Framework: React Router 6 configured in `src/App.tsx`.

## Relevant lazy imports

```tsx
const RequestTracking = lazyWithReload(() => import("./components/RequestTracking"));
const ActiveJob = lazyWithReload(() => import("./pages/technician/ActiveJob"));
```

## Customer tracking routes

- `/request-service-tracking/:requestId` → `src/components/RequestTracking.tsx` inside `AppLayout` and `ProtectedRoute`.
- `/service-tracking/:serviceId` → the same component and layout.
- `/payment/:serviceId` → the same component and layout.
- `/service-summary/:serviceId` → the same component and layout.

```tsx
<Route path="request-service-tracking/:requestId" element={<ProtectedRoute><RequestTracking /></ProtectedRoute>} />
<Route path="service-tracking/:serviceId" element={<ProtectedRoute><RequestTracking /></ProtectedRoute>} />
<Route path="payment/:serviceId" element={<ProtectedRoute><RequestTracking /></ProtectedRoute>} />
<Route path="service-summary/:serviceId" element={<ProtectedRoute><RequestTracking /></ProtectedRoute>} />
```

Mobile renders a full-screen map background and draggable status/payment sheet. Desktop renders a two-column page with a card map on the left.

## Technician active-job routes

- `/technician/active-job` → `src/pages/technician/ActiveJob.tsx` inside `TechnicianLayout` and `TechnicianProtectedRoute`.
- `/technician/active-job/:requestId` → the same component and layout with request identity.

```tsx
<Route path="active-job" element={<TechnicianProtectedRoute><ActiveJob /></TechnicianProtectedRoute>} />
<Route path="active-job/:requestId" element={<TechnicianProtectedRoute><ActiveJob /></TechnicianProtectedRoute>} />
```

The active-job page is a narrow mobile-first job card with a 240px map header, floating status/payout chips, customer/job details, Navigate/Call actions, and status progression buttons.
