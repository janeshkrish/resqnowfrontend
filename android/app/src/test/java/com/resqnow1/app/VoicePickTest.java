package com.resqnow1.app;

import static org.junit.Assert.assertEquals;

import java.util.Arrays;
import java.util.List;
import org.junit.Test;

public class VoicePickTest {

    private static final int NORMAL = 300;
    private static final int HIGH = 400;
    private static final int VERY_HIGH = 500;

    @Test
    public void picksTheClearestTamilVoiceOnThePhone() {
        List<VoicePick.Option> voices = Arrays.asList(
            new VoicePick.Option("en-IN", VERY_HIGH, false, true),
            new VoicePick.Option("ta-IN", NORMAL, false, true),
            new VoicePick.Option("ta-IN", VERY_HIGH, false, true),
            new VoicePick.Option("ta-LK", VERY_HIGH, false, true)
        );
        assertEquals(2, VoicePick.best(voices, "ta-IN"));
        assertEquals(0, VoicePick.best(voices, "en-IN"));
    }

    @Test
    public void prefersAVoiceThatWorksOfflineWhenTheyAreEquallyClear() {
        List<VoicePick.Option> voices = Arrays.asList(
            new VoicePick.Option("ta-IN", HIGH, true, true),
            new VoicePick.Option("ta_IN", HIGH, false, true)
        );
        assertEquals(1, VoicePick.best(voices, "ta-IN"));
    }

    @Test
    public void skipsVoicesNotInstalledAndOtherLanguages() {
        List<VoicePick.Option> voices = Arrays.asList(
            new VoicePick.Option("ta-IN", VERY_HIGH, false, false),
            new VoicePick.Option("hi-IN", VERY_HIGH, false, true)
        );
        assertEquals(-1, VoicePick.best(voices, "ta-IN"));
        // Another country's Tamil is better than none.
        assertEquals(0, VoicePick.best(Arrays.asList(new VoicePick.Option("ta-LK", NORMAL, false, true)), "ta-IN"));
    }
}
