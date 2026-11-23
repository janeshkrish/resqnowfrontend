package com.resqnow1.app.maps;

import org.junit.Test;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import static org.junit.Assert.*;

public class MapSdkStartupTest {
    private static final class Clock implements MapSdkStartup.Scheduler {
        long now;
        Runnable pending;
        long next;

        @Override public long now() { return now; }
        @Override public void post(Runnable task, long delay) {
            assertNull(pending);
            pending=task;
            next=now+delay;
        }
        @Override public void remove(Runnable task) {
            if(pending==task) pending=null;
        }
        void advance() {
            Runnable task=pending;
            assertNotNull(task);
            pending=null;
            now=next;
            task.run();
        }
    }

    private final Clock clock=new Clock();
    private boolean configReady;
    private final MapSdkStartup startup=new MapSdkStartup(()->configReady,clock,2);
    private final List<String> results=new ArrayList<>();

    private void create(String id) {
        startup.await(()->results.add(id),results::add);
    }

    @Test public void createsImmediatelyWhenConfigurationIsAlreadyLoaded() {
        configReady=true;
        create("first");
        assertEquals(List.of("first"),results);
        assertNull(clock.pending);
    }

    @Test public void neverConstructsMapViewUntilConfigurationIsLoaded() {
        create("first");
        create("second");
        clock.advance();
        assertTrue(results.isEmpty());
        configReady=true;
        clock.advance();
        assertEquals(Arrays.asList("first","second"),results);
        assertNull(clock.pending);
    }

    @Test public void timesOutExplicitlyAndAllowsRetryOnceConfigurationIsLoaded() {
        create("first");
        while(clock.pending!=null && clock.now<6_000) clock.advance();
        assertEquals(List.of("SDK_INIT"),results);
        assertNull(clock.pending);
        configReady=true;
        create("retry");
        assertEquals(Arrays.asList("SDK_INIT","retry"),results);
    }

    @Test public void documentCleanupCancelsQueuedCreatesAndTheirPoll() {
        create("old");
        startup.cancel();
        assertNull(clock.pending);
        configReady=true;
        create("new");
        assertEquals(Arrays.asList("STALE_HANDLE","new"),results);
    }

    @Test public void limitsPendingCreatesWhileConfigurationLoads() {
        create("first");
        create("second");
        create("extra");
        assertEquals(List.of("LIMIT"),results);
        configReady=true;
        clock.advance();
        assertEquals(Arrays.asList("LIMIT","first","second"),results);
    }
}
