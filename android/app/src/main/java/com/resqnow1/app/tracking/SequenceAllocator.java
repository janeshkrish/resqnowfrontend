package com.resqnow1.app.tracking;

/** Same rule as ActiveJob.tsx: max(timestamp * 1000, previous + 1), never decreasing. */
final class SequenceAllocator {

    private long last;

    SequenceAllocator(long floor) {
        this.last = Math.max(0, floor);
    }

    long next(long timestampMs) {
        last = Math.max(timestampMs * 1000L, last + 1);
        return last;
    }

    long last() {
        return last;
    }
}
