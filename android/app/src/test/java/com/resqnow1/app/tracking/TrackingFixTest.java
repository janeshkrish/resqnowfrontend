package com.resqnow1.app.tracking;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class TrackingFixTest {

    @Test
    public void serialisesTheUnchangedTrackingLocationV1Body() {
        TrackingFix fix = new TrackingFix("7", "44", 12.9716, 77.5946, 8.5, 271.5, 6.0, 1_790_330_400_123L, 1_790_330_400_123_001L);

        assertEquals(
            "{\"version\":1,\"technicianId\":\"7\",\"jobId\":\"44\",\"lat\":12.9716,\"lng\":77.5946,"
                + "\"speed\":8.5,\"heading\":271.5,\"accuracy\":6.0,"
                + "\"recordedAt\":\"2026-09-25T10:00:00.123Z\",\"sequenceId\":1790330400123001}",
            fix.toJson()
        );
    }

    @Test
    public void sendsNullForMissingOrInvalidMotionFields() {
        TrackingFix fix = new TrackingFix("7", "44", 1.0, 2.0, null, Double.NaN, -1.0, 0L, 1L);

        assertTrue(fix.toJson().contains("\"speed\":null,\"heading\":null,\"accuracy\":null"));
    }

    @Test
    public void escapesIdentifiers() {
        TrackingFix fix = new TrackingFix("a\"b", "c\\d", 1.0, 2.0, null, null, null, 0L, 1L);

        assertTrue(fix.toJson().contains("\"technicianId\":\"a\\\"b\",\"jobId\":\"c\\\\d\""));
    }

    @Test
    public void allocatesStrictlyIncreasingSequenceIdsAboveTheFloor() {
        SequenceAllocator allocator = new SequenceAllocator(5_000_000L);

        long first = allocator.next(1_000L);
        long sameMillisecond = allocator.next(1_000L);
        long clockWentBack = allocator.next(900L);
        long later = allocator.next(10_000L);

        assertEquals(5_000_001L, first);
        assertEquals(5_000_002L, sameMillisecond);
        assertEquals(5_000_003L, clockWentBack);
        assertEquals(10_000_000L, later);
    }
}
