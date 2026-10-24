package com.resqnow1.app;

import java.util.List;
import java.util.Locale;

/**
 * Picks the phone's clearest voice for a language when ResQNow-Thozhan speaks without the server's
 * natural voice (VoiceThozhanPlugin). Plain values, so this stays testable off the device.
 */
public final class VoicePick {

    private VoicePick() {}

    /** One of the phone's voices: its language tag (ta-IN), android.speech.tts.Voice quality, and where it runs. */
    public static final class Option {
        final String tag;
        final int quality;
        final boolean network;
        final boolean installed;

        public Option(String tag, int quality, boolean network, boolean installed) {
            this.tag = tag == null ? "" : tag;
            this.quality = quality;
            this.network = network;
            this.installed = installed;
        }
    }

    private static String norm(String tag) {
        return tag.toLowerCase(Locale.ROOT).replace('_', '-');
    }

    /**
     * The index of the best voice, or -1 when none speaks the language: installed, the exact
     * language and country first, then the highest quality, then one that works without the internet.
     */
    public static int best(List<Option> options, String wanted) {
        String want = norm(wanted);
        String language = want.split("-")[0];
        int best = -1;
        int bestScore = Integer.MIN_VALUE;
        for (int i = 0; i < options.size(); i++) {
            Option option = options.get(i);
            if (!option.installed) continue;
            String tag = norm(option.tag);
            boolean exact = tag.equals(want);
            if (!exact && !tag.split("-")[0].equals(language)) continue;
            int score = (exact ? 100000 : 0) + option.quality * 2 + (option.network ? 0 : 1);
            if (score > bestScore) {
                best = i;
                bestScore = score;
            }
        }
        return best;
    }
}
