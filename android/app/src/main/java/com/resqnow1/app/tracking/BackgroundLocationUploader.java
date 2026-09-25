package com.resqnow1.app.tracking;

/**
 * Native background delivery with the same rules as src/lib/technicianLocationSender.ts:
 * adaptive cadence, only the newest unsent fix is kept, and nothing close to the
 * backend's 60 s staleness limit is replayed. It posts TrackingLocationV1 to the
 * existing canonical REST endpoint through {@link Transport}.
 *
 * Not thread-safe: every call, including transport and scheduler callbacks, must
 * run on the tracking service's single handler thread.
 */
public final class BackgroundLocationUploader {

    static final long PENDING_RETRY_INTERVAL_MS = 5_000L;
    static final long MAX_PENDING_LOCATION_AGE_MS = 45_000L;

    public static final String STOP_AUTH_FAILED = "AUTH_FAILED";
    public static final String STOP_FORBIDDEN = "FORBIDDEN";
    public static final String STOP_NO_ACTIVE_JOB = "NO_ACTIVE_JOB";

    public interface Transport {
        /** Deliver the fix; the callback runs later on the handler thread. */
        void send(TrackingFix fix, Callback callback);

        interface Callback {
            /** HTTP status of the response. */
            void onResponse(int status);

            /** The request never produced a response (offline, timeout, DNS). */
            void onNetworkError();
        }
    }

    public interface Scheduler {
        Object schedule(Runnable task, long delayMs);

        void cancel(Object handle);
    }

    public interface Clock {
        long now();
    }

    public interface Listener {
        /** Delivery cannot continue for this job; the service must stop. */
        void onStopRequired(String reason);

        /** Diagnostic hook; never receives tokens or payload bodies. */
        void onEvent(String event, long sequenceId, String detail);
    }

    enum Outcome { DELIVERED, REJECTED, RETRYABLE, STOP }

    private final Transport transport;
    private final Scheduler scheduler;
    private final Clock clock;
    private final Listener listener;

    private LocationSendPolicy.Reference lastReference = null;
    private TrackingFix candidate = null;
    private TrackingFix inFlight = null;
    private long highestSequenceId = 0;
    private boolean pendingAfterFailure = false;
    private long retryBlockedUntil = 0;
    private Object timer = null;
    private boolean disposed = false;

    public BackgroundLocationUploader(Transport transport, Scheduler scheduler, Clock clock, Listener listener) {
        this.transport = transport;
        this.scheduler = scheduler;
        this.clock = clock;
        this.listener = listener;
    }

    static Outcome classify(int status) {
        if (status >= 200 && status < 300) return Outcome.DELIVERED;
        if (status == 401 || status == 403 || status == 409) return Outcome.STOP;
        if (status == 429 || status >= 500) return Outcome.RETRYABLE;
        return Outcome.REJECTED;
    }

    static String stopReason(int status) {
        if (status == 401) return STOP_AUTH_FAILED;
        if (status == 403) return STOP_FORBIDDEN;
        return STOP_NO_ACTIVE_JOB;
    }

    /** Offer a new fix. Older or equal sequence ids are ignored. */
    public void offer(TrackingFix fix) {
        if (disposed || fix.sequenceId <= highestSequenceId) return;
        highestSequenceId = fix.sequenceId;
        candidate = fix;
        evaluate();
    }

    /** Foreground JS has taken over delivery: drop anything unsent here. */
    public void clearPending() {
        cancelTimer();
        candidate = null;
        pendingAfterFailure = false;
        retryBlockedUntil = 0;
    }

    public void dispose() {
        disposed = true;
        clearPending();
        inFlight = null;
    }

    public boolean hasPending() {
        return candidate != null || inFlight != null;
    }

    private void evaluate() {
        if (disposed || inFlight != null || candidate == null) return;
        long now = clock.now();
        if (now - candidate.recordedAtMs > MAX_PENDING_LOCATION_AGE_MS) {
            listener.onEvent("pending_dropped_stale", candidate.sequenceId, null);
            candidate = null;
            pendingAfterFailure = false;
            cancelTimer();
            return;
        }
        if (pendingAfterFailure) {
            if (now < retryBlockedUntil) {
                schedule(retryBlockedUntil - now);
                return;
            }
            attempt(candidate);
            return;
        }
        long waitMs = LocationSendPolicy.waitBeforeSend(lastReference, candidate, now);
        if (waitMs <= 0) attempt(candidate);
        else schedule(waitMs);
    }

    private void attempt(final TrackingFix fix) {
        cancelTimer();
        inFlight = fix;
        final long sentAt = clock.now();
        listener.onEvent("location_emitted", fix.sequenceId, "native_rest");
        transport.send(fix, new Transport.Callback() {
            @Override
            public void onResponse(int status) {
                settle(fix, sentAt, classify(status), status);
            }

            @Override
            public void onNetworkError() {
                settle(fix, sentAt, Outcome.RETRYABLE, 0);
            }
        });
    }

    private void settle(TrackingFix fix, long sentAt, Outcome outcome, int status) {
        if (disposed || inFlight != fix) return;
        inFlight = null;
        listener.onEvent("location_result", fix.sequenceId, outcome.name() + ":" + status);
        switch (outcome) {
            case DELIVERED:
            case REJECTED:
                lastReference = new LocationSendPolicy.Reference(fix.lat, fix.lng, sentAt);
                pendingAfterFailure = false;
                retryBlockedUntil = 0;
                if (candidate == fix) candidate = null;
                break;
            case RETRYABLE:
                pendingAfterFailure = true;
                retryBlockedUntil = clock.now() + PENDING_RETRY_INTERVAL_MS;
                listener.onEvent("pending_retained", candidate != null ? candidate.sequenceId : fix.sequenceId, null);
                break;
            case STOP:
                dispose();
                listener.onStopRequired(stopReason(status));
                return;
        }
        evaluate();
    }

    private void schedule(long delayMs) {
        cancelTimer();
        timer = scheduler.schedule(new Runnable() {
            @Override
            public void run() {
                timer = null;
                evaluate();
            }
        }, Math.max(0, delayMs));
    }

    private void cancelTimer() {
        if (timer != null) scheduler.cancel(timer);
        timer = null;
    }
}
