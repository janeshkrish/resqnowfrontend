package com.resqnow1.app.tracking;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.Before;
import org.junit.Test;

public class BackgroundLocationUploaderTest {

    private static final double START_LAT = 12.9716;
    private static final double START_LNG = 77.5946;
    private static final double METERS_PER_DEGREE = 111_195;

    private long now;
    private long sequence;
    private int autoAcknowledgeStatus;
    private final List<Scheduled> scheduled = new ArrayList<>();
    private final List<Sent> sent = new ArrayList<>();
    private final List<String> stopReasons = new ArrayList<>();
    private BackgroundLocationUploader uploader;

    private static final class Scheduled {
        final Runnable task;
        final long runAt;

        Scheduled(Runnable task, long runAt) {
            this.task = task;
            this.runAt = runAt;
        }
    }

    private static final class Sent {
        final TrackingFix fix;
        final long at;
        final BackgroundLocationUploader.Transport.Callback callback;

        Sent(TrackingFix fix, long at, BackgroundLocationUploader.Transport.Callback callback) {
            this.fix = fix;
            this.at = at;
            this.callback = callback;
        }
    }

    @Before
    public void setUp() {
        now = 1_790_000_000_000L;
        sequence = 0;
        autoAcknowledgeStatus = 0;
        uploader = new BackgroundLocationUploader(
            (fix, callback) -> {
                sent.add(new Sent(fix, now, callback));
                if (autoAcknowledgeStatus > 0) callback.onResponse(autoAcknowledgeStatus);
            },
            new BackgroundLocationUploader.Scheduler() {
                @Override
                public Object schedule(Runnable task, long delayMs) {
                    Scheduled entry = new Scheduled(task, now + delayMs);
                    scheduled.add(entry);
                    return entry;
                }

                @Override
                public void cancel(Object handle) {
                    scheduled.remove(handle);
                }
            },
            () -> now,
            new BackgroundLocationUploader.Listener() {
                @Override
                public void onStopRequired(String reason) {
                    stopReasons.add(reason);
                }

                @Override
                public void onEvent(String event, long sequenceId, String detail) {}
            }
        );
    }

    private TrackingFix fix(double northMeters, Double speed) {
        sequence += 1;
        return new TrackingFix("tech-1", "job-1", START_LAT + northMeters / METERS_PER_DEGREE, START_LNG,
            speed, 12.0, 5.0, now, now * 1000 + sequence);
    }

    private void advance(long ms) {
        long target = now + ms;
        while (true) {
            Scheduled next = null;
            for (Scheduled entry : scheduled) {
                if (entry.runAt <= target && (next == null || entry.runAt < next.runAt)) next = entry;
            }
            if (next == null) break;
            scheduled.remove(next);
            now = next.runAt;
            next.task.run();
        }
        now = target;
    }

    private List<Long> sendTimes() {
        List<Long> times = new ArrayList<>();
        for (Sent entry : sent) times.add(entry.at - sent.get(0).at);
        return times;
    }

    @Test
    public void sendsAMovingTechnicianAtTheMovingCadence() {
        autoAcknowledgeStatus = 200;
        // 10 m/s, one GPS fix per second.
        for (int second = 0; second <= 12; second += 1) {
            if (second > 0) advance(1_000);
            uploader.offer(fix(second * 10, 8.5));
        }
        assertEquals(List.of(0L, 2_500L, 5_000L, 7_500L, 10_000L), sendTimes());
    }

    @Test
    public void sendsAStationaryTechnicianOnlyOnTheHeartbeat() {
        autoAcknowledgeStatus = 200;
        // GPS jitter of up to 4 m around one spot.
        for (int second = 0; second <= 30; second += 1) {
            if (second > 0) advance(1_000);
            uploader.offer(fix((second % 3) * 2, 0.0));
        }
        assertEquals(List.of(0L, 12_000L, 24_000L), sendTimes());
    }

    @Test
    public void neverSendsAnOlderSequenceAfterANewerOne() {
        autoAcknowledgeStatus = 200;
        TrackingFix first = fix(0, 8.0);
        uploader.offer(first);
        advance(3_000);
        TrackingFix older = new TrackingFix("tech-1", "job-1", START_LAT + 0.01, START_LNG, 8.0, 0.0, 5.0, now, first.sequenceId - 1);
        uploader.offer(older);
        TrackingFix newer = fix(80, 8.0);
        uploader.offer(newer);

        assertEquals(2, sent.size());
        assertEquals(newer.sequenceId, sent.get(1).fix.sequenceId);
    }

    @Test
    public void retainsOnlyTheNewestFixWhileOfflineAndRetriesIt() {
        uploader.offer(fix(0, 8.0));
        sent.get(0).callback.onNetworkError();
        TrackingFix newest = null;
        for (int index = 1; index <= 4; index += 1) {
            advance(500);
            newest = fix(index * 30, 8.0);
            uploader.offer(newest);
        }
        assertEquals(1, sent.size());

        advance(BackgroundLocationUploader.PENDING_RETRY_INTERVAL_MS);

        assertEquals(2, sent.size());
        assertEquals(newest.sequenceId, sent.get(1).fix.sequenceId);
        sent.get(1).callback.onResponse(200);
        assertFalse(uploader.hasPending());
    }

    @Test
    public void treatsServerErrorsAndRateLimitsAsRetryable() {
        assertEquals(BackgroundLocationUploader.Outcome.RETRYABLE, BackgroundLocationUploader.classify(503));
        assertEquals(BackgroundLocationUploader.Outcome.RETRYABLE, BackgroundLocationUploader.classify(429));
        assertEquals(BackgroundLocationUploader.Outcome.REJECTED, BackgroundLocationUploader.classify(400));
        assertEquals(BackgroundLocationUploader.Outcome.DELIVERED, BackgroundLocationUploader.classify(200));
    }

    @Test
    public void dropsAPendingFixInsteadOfReplayingItNearTheIngestionAgeLimit() {
        uploader.offer(fix(0, 8.0));
        sent.get(0).callback.onNetworkError();
        for (long elapsed = 0; elapsed <= BackgroundLocationUploader.MAX_PENDING_LOCATION_AGE_MS; elapsed += 5_000) {
            advance(BackgroundLocationUploader.PENDING_RETRY_INTERVAL_MS);
            sent.get(sent.size() - 1).callback.onNetworkError();
        }
        int attempts = sent.size();
        advance(60_000);

        assertFalse(uploader.hasPending());
        assertEquals(attempts, sent.size());
    }

    @Test
    public void rejectedFixesAreDroppedWithoutARetryLoop() {
        uploader.offer(fix(0, 8.0));
        sent.get(0).callback.onResponse(400);
        assertFalse(uploader.hasPending());
        uploader.offer(fix(0, 0.0));

        assertEquals(1, sent.size());
        assertTrue(stopReasons.isEmpty());
    }

    @Test
    public void stopsOnAuthenticationFailure() {
        uploader.offer(fix(0, 8.0));
        sent.get(0).callback.onResponse(401);

        assertEquals(List.of(BackgroundLocationUploader.STOP_AUTH_FAILED), stopReasons);
        advance(60_000);
        uploader.offer(fix(100, 8.0));
        assertEquals(1, sent.size());
    }

    @Test
    public void stopsWhenTheJobIsNoLongerLiveOrNotOwned() {
        uploader.offer(fix(0, 8.0));
        sent.get(0).callback.onResponse(409);
        assertEquals(List.of(BackgroundLocationUploader.STOP_NO_ACTIVE_JOB), stopReasons);
        assertEquals(BackgroundLocationUploader.STOP_FORBIDDEN, BackgroundLocationUploader.stopReason(403));
    }

    @Test
    public void clearingPendingForAForegroundHandoverCancelsTimersAndLeftovers() {
        uploader.offer(fix(0, 8.0));
        sent.get(0).callback.onNetworkError();
        uploader.offer(fix(40, 8.0));
        assertFalse(scheduled.isEmpty());

        uploader.clearPending();

        assertTrue(scheduled.isEmpty());
        assertFalse(uploader.hasPending());
        advance(60_000);
        assertEquals(1, sent.size());
    }

    @Test
    public void ignoresLateResponsesAfterDispose() {
        uploader.offer(fix(0, 8.0));
        uploader.dispose();
        sent.get(0).callback.onResponse(401);

        assertTrue(stopReasons.isEmpty());
        assertTrue(scheduled.isEmpty());
    }
}
