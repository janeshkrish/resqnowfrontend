package com.resqnow1.app.maps;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;

/** Gates MapView construction on the SDK's local configuration. Main thread only. */
final class MapSdkStartup {
    private static final long TIMEOUT_MS = 5_000;
    private static final long CHECK_INTERVAL_MS = 25;

    interface Scheduler {
        long now();
        void post(Runnable task, long delay);
        void remove(Runnable task);
    }

    private record Request(Runnable create, Consumer<String> reject) {}

    private final BooleanSupplier configReady;
    private final Scheduler scheduler;
    private final int limit;
    private final List<Request> pending = new ArrayList<>();
    private final Runnable check = this::check;
    private long deadline;

    MapSdkStartup(BooleanSupplier configReady, Scheduler scheduler, int limit) {
        this.configReady = configReady;
        this.scheduler = scheduler;
        this.limit = limit;
    }

    void await(Runnable create, Consumer<String> reject) {
        if (pending.isEmpty() && configReady.getAsBoolean()) {
            create.run();
            return;
        }
        if (pending.size() >= limit) {
            reject.accept("LIMIT");
            return;
        }
        pending.add(new Request(create, reject));
        if (pending.size() == 1) {
            deadline = scheduler.now() + TIMEOUT_MS;
            scheduler.post(check, CHECK_INTERVAL_MS);
        }
    }

    private void check() {
        if (configReady.getAsBoolean()) finish(null);
        else if (scheduler.now() >= deadline) finish("SDK_INIT");
        else scheduler.post(check, CHECK_INTERVAL_MS);
    }

    void cancel() {
        scheduler.remove(check);
        finish("STALE_HANDLE");
    }

    private void finish(String code) {
        List<Request> requests = new ArrayList<>(pending);
        pending.clear();
        for (Request request : requests) {
            if (code == null) request.create().run();
            else request.reject().accept(code);
        }
    }
}
