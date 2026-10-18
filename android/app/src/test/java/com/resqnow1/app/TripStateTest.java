package com.resqnow1.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class TripStateTest {

    private static TripState app(String phase, String title, String chip) {
        TripState s = new TripState();
        s.requestId = "5318";
        s.phase = phase;
        s.title = title;
        s.text = "Arrives by 4:52 pm · 2.4 km away";
        s.chip = chip;
        s.technicianName = "Arun Kumar";
        s.technicianPhone = "+91 98765 43210";
        s.service = "lockout";
        s.source = TripState.SOURCE_APP;
        return s;
    }

    private static TripState push(String status) {
        return TripState.fromPush("5318", status, "", "", "", "", "", 1000L);
    }

    @Test
    public void statusesMapToTheSameStagesAsTheApp() {
        assertEquals("search", TripState.phaseFromStatus("pending"));
        assertEquals("accepted", TripState.phaseFromStatus("assigned"));
        assertEquals("accepted", TripState.phaseFromStatus("accepted"));
        assertEquals("way", TripState.phaseFromStatus("en-route"));
        assertEquals("way", TripState.phaseFromStatus("en_route_pickup"));
        assertEquals("arrived", TripState.phaseFromStatus("arrived_pickup"));
        assertEquals("working", TripState.phaseFromStatus("in-progress"));
        assertEquals("loaded", TripState.phaseFromStatus("vehicle_loaded"));
        assertEquals("towing", TripState.phaseFromStatus("enroute_drop"));
        assertEquals("dropped", TripState.phaseFromStatus("arrived_drop"));
        assertEquals("pay", TripState.phaseFromStatus("payment_pending"));
        assertEquals("pay", TripState.phaseFromStatus("completed"));
        assertEquals("rate", TripState.phaseFromStatus("paid"));
        assertEquals("cancelled", TripState.phaseFromStatus("CANCELLED"));
        assertEquals("other", TripState.phaseFromStatus("something_new"));
    }

    @Test
    public void aLatePushNeverMovesTheTripBackwards() {
        TripState shown = app("way", "Arun arrives in 6 min", "6 min");
        TripState merged = TripState.merge(shown, push("accepted"));
        assertEquals("way", merged.phase);
        assertEquals("Arun arrives in 6 min", merged.title);
        assertEquals("6 min", merged.chip);
    }

    @Test
    public void aPushForTheSameStageKeepsTheAppsMinutes() {
        TripState shown = app("way", "Arun arrives in 6 min", "6 min");
        TripState merged = TripState.merge(shown, push("en-route"));
        assertEquals("Arun arrives in 6 min", merged.title);
        assertEquals("6 min", merged.chip);
        assertEquals("Arun Kumar", merged.technicianName);
    }

    @Test
    public void aPushForTheNextStageTakesOverButKeepsTheTechnician() {
        TripState shown = app("way", "Arun arrives in 6 min", "6 min");
        TripState merged = TripState.merge(shown, push("arrived"));
        assertEquals("arrived", merged.phase);
        assertEquals("Here", merged.chip);
        assertEquals("ok", merged.tone);
        assertEquals("Arun Kumar", merged.technicianName);
        assertEquals("+91 98765 43210", merged.technicianPhone);
        assertEquals("lockout", merged.service);
        assertEquals("Arun is here", merged.title);
    }

    @Test
    public void aCancellationEndsTheTripFromAnyStageAndStaysEnded() {
        TripState cancelled = TripState.merge(app("way", "Arun arrives in 6 min", "6 min"), push("cancelled"));
        assertEquals("cancelled", cancelled.phase);
        assertFalse(cancelled.isActive());
        TripState after = TripState.merge(cancelled, app("way", "Arun arrives in 5 min", "5 min"));
        assertSame(cancelled, after);
    }

    @Test
    public void anotherRequestReplacesTheStoredOne() {
        TripState other = app("search", "Finding a technician", "Finding");
        other.requestId = "6101";
        TripState merged = TripState.merge(app("way", "Arun arrives in 6 min", "6 min"), other);
        assertEquals("6101", merged.requestId);
        assertEquals("search", merged.phase);
    }

    @Test
    public void onlyTheMomentsThatMatterRaiseAnAlert() {
        assertTrue(push("accepted").deservesAlert());
        assertTrue(push("arrived").deservesAlert());
        assertTrue(push("payment_pending").deservesAlert());
        assertTrue(push("cancelled").deservesAlert());
        assertFalse(push("en-route").deservesAlert());
        assertFalse(push("in-progress").deservesAlert());
        assertFalse(push("paid").deservesAlert());
    }

    @Test
    public void theTripStaysPinnedUntilItIsPaid() {
        assertTrue(push("pending").isActive());
        assertTrue(push("in-progress").isActive());
        assertTrue(push("payment_pending").isActive());
        assertFalse(push("paid").isActive());
        assertFalse(push("closed").isActive());
    }

    @Test
    public void thePushsOwnWordsWinOverTheFallback() {
        TripState s = TripState.fromPush("5318", "accepted", "Arun accepted your request", "Lockout · getting ready to leave", "Arun Kumar", "", "lockout", 1000L);
        assertEquals("Arun accepted your request", s.title);
        assertEquals("Lockout · getting ready to leave", s.text);
        assertEquals("/service-tracking/5318", s.deepLinkPath);
        TripState bare = TripState.fromPush("5318", "accepted", "", "", "Arun Kumar", "", "", 1000L);
        assertEquals("Arun accepted your request", bare.title);
        assertEquals("Your technician accepted your request", push("accepted").title);
    }

    @Test
    public void namesAndInitials() {
        TripState s = app("way", "", "");
        assertEquals("Arun", s.firstName());
        assertEquals("AK", s.initials());
        s.technicianName = "  ";
        assertEquals("Your technician", s.firstName());
        assertEquals("", s.initials());
    }

    @Test
    public void minutesUntilArrival() {
        assertEquals("", TripState.minutesUntil(0L, 1000L));
        assertEquals("6 min", TripState.minutesUntil(6L * 60000L + 1000L, 1000L));
        assertEquals("1 min", TripState.minutesUntil(1000L + 50000L, 1000L));
        assertEquals("Now", TripState.minutesUntil(1000L + 30000L, 1000L));
    }
}
