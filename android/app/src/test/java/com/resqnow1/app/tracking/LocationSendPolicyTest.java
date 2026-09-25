package com.resqnow1.app.tracking;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class LocationSendPolicyTest {

    private static final double METERS_PER_DEGREE = 111_195;
    private static final LocationSendPolicy.Reference LAST_SENT = new LocationSendPolicy.Reference(12.9716, 77.5946, 0L);

    private static TrackingFix fixAt(double northMeters, Double accuracy) {
        return new TrackingFix("7", "44", 12.9716 + northMeters / METERS_PER_DEGREE, 77.5946, 8.0, 0.0, accuracy, 0L, 1L);
    }

    @Test
    public void sendsTheFirstFixImmediately() {
        assertEquals(0L, LocationSendPolicy.waitBeforeSend(null, fixAt(0, 5.0), 0L));
    }

    @Test
    public void sendsMovementBeyondTenMetresAfterTheMovingInterval() {
        assertEquals(1_000L, LocationSendPolicy.waitBeforeSend(LAST_SENT, fixAt(15, 5.0), 1_500L));
        assertEquals(0L, LocationSendPolicy.waitBeforeSend(LAST_SENT, fixAt(15, 5.0), 2_500L));
    }

    @Test
    public void holdsJitterInsideTheAccuracyRadiusUntilTheHeartbeat() {
        assertEquals(8_000L, LocationSendPolicy.waitBeforeSend(LAST_SENT, fixAt(6, 5.0), 4_000L));
        assertEquals(8_000L, LocationSendPolicy.waitBeforeSend(LAST_SENT, fixAt(15, 25.0), 4_000L));
        assertEquals(0L, LocationSendPolicy.waitBeforeSend(LAST_SENT, fixAt(6, 5.0), 12_000L));
    }

    @Test
    public void capsTheAccuracyThresholdAtThirtyMetres() {
        assertEquals(0L, LocationSendPolicy.waitBeforeSend(LAST_SENT, fixAt(35, 200.0), 3_000L));
    }
}
