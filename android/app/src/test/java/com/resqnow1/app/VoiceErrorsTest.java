package com.resqnow1.app;

import static org.junit.Assert.assertEquals;

import org.junit.Test;

public class VoiceErrorsTest {

    @Test
    public void namesTheErrorsTheAppExplains() {
        assertEquals("silence", VoiceErrors.name(6));
        assertEquals("no-match", VoiceErrors.name(7));
        assertEquals("permission", VoiceErrors.name(9));
        assertEquals("network", VoiceErrors.name(2));
        assertEquals("network", VoiceErrors.name(11));
        assertEquals("language", VoiceErrors.name(12));
        assertEquals("language", VoiceErrors.name(13));
        assertEquals("busy", VoiceErrors.name(8));
    }

    @Test
    public void unknownCodesAreGeneric() {
        assertEquals("error", VoiceErrors.name(99));
        assertEquals("error", VoiceErrors.name(-1));
    }
}
