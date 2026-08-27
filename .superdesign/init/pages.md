# Relevant page dependency trees

## `/technician/active-job/:requestId`
Entry: `src/pages/technician/ActiveJob.tsx`

Dependencies:
- `src/components/technician/ActiveJobMap.tsx`
  - `src/lib/geo.ts`
  - current Leaflet renderer to be replaced by `src/lib/mapProvider/`
- `src/components/technician/TechnicianJobCompletion.tsx`
- `src/components/technician/CancelledJobCard.tsx`
- `src/components/ui/button.tsx`
  - `src/lib/utils.ts`
- `src/contexts/SocketContext.tsx`
- `src/contexts/TechnicianAuthContext.tsx`
- `src/hooks/useTechnicianActiveJob.ts`
- `src/lib/api.ts`
- `src/lib/technicianActiveJobRoute.ts`
- `src/lib/towingActionState.ts`
- `src/utils/technicianStatus.ts`
- `src/components/technician/TechnicianLayout.tsx`
  - `src/components/technician/TechnicianHeader.tsx`

## `/request-service-tracking/:requestId`
Entry: `src/components/RequestTracking.tsx`

Dependencies relevant to the rendered tracking map:
- `src/components/user/LiveTrackingMap.tsx`
  - `src/components/ui/card.tsx`
  - `src/lib/geo.ts`
  - `src/lib/utils.ts`
  - current Leaflet renderer to be replaced by `src/lib/mapProvider/`
- `src/components/user/AmountCard.tsx`
- `src/components/ClientJobCompletion.tsx`
- `src/components/payments/PaymentSummaryDialog.tsx`
- `src/components/ui/button.tsx`
- `src/components/ui/card.tsx`
- `src/components/ui/badge.tsx`
- `src/components/ui/avatar.tsx`
- `src/hooks/useRealtimeServiceRequest.ts`
  - socket events `location_update` and `technician:location_update`
- `src/hooks/use-mobile.tsx`
- `src/hooks/usePricingConfig.ts`
- `src/lib/api.ts`
- `src/lib/geo.ts`
- `src/utils/serviceRequestPayment.ts`
- `src/components/AppLayout.tsx`

For design payloads, `RequestTracking.tsx` exceeds 900 lines, so use only the actual mobile render branch (`src/components/RequestTracking.tsx:1215:1714`) or desktop render branch (`src/components/RequestTracking.tsx:1716:2037`) according to target. `src/index.css` also exceeds 900 lines; use `.superdesign/init/theme.md` plus the tracking selector ranges recorded there.
