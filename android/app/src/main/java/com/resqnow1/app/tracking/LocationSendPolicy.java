package com.resqnow1.app.tracking;

/**
 * Native mirror of decideLocationSend() in src/lib/technicianLocationSender.ts.
 * Keep these constants identical to the TypeScript ones so foreground (JS) and
 * background (native) delivery send at the same cadence.
 */
final class LocationSendPolicy {

    static final long MOVING_SEND_INTERVAL_MS = 2_500L;
    static final long STATIONARY_SEND_INTERVAL_MS = 12_000L;
    static final double MIN_SEND_DISTANCE_METERS = 10;
    static final double MAX_ACCURACY_DISTANCE_METERS = 30;

    private static final double EARTH_RADIUS_METERS = 6_371_000;

    private LocationSendPolicy() {}

    static final class Reference {
        final double lat;
        final double lng;
        final long sentAt;

        Reference(double lat, double lng, long sentAt) {
            this.lat = lat;
            this.lng = lng;
            this.sentAt = sentAt;
        }
    }

    /** Returns 0 when the fix is due now, otherwise how long to wait before re-evaluating. */
    static long waitBeforeSend(Reference lastSent, TrackingFix candidate, long now) {
        if (lastSent == null) return 0;
        long elapsedMs = now - lastSent.sentAt;
        double accuracy = candidate.accuracy == null ? 0 : candidate.accuracy;
        double thresholdMeters = Math.max(
            MIN_SEND_DISTANCE_METERS,
            Math.min(accuracy, MAX_ACCURACY_DISTANCE_METERS)
        );
        boolean moved = distanceMeters(lastSent.lat, lastSent.lng, candidate.lat, candidate.lng) >= thresholdMeters;

        if (moved && elapsedMs >= MOVING_SEND_INTERVAL_MS) return 0;
        if (elapsedMs >= STATIONARY_SEND_INTERVAL_MS) return 0;
        return (moved ? MOVING_SEND_INTERVAL_MS : STATIONARY_SEND_INTERVAL_MS) - elapsedMs;
    }

    static double distanceMeters(double lat1, double lng1, double lat2, double lng2) {
        double deltaLat = Math.toRadians(lat2 - lat1);
        double deltaLng = Math.toRadians(lng2 - lng1);
        double haversine = Math.pow(Math.sin(deltaLat / 2), 2)
            + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) * Math.pow(Math.sin(deltaLng / 2), 2);
        return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
    }
}
