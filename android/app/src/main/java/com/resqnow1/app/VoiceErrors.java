package com.resqnow1.app;

/** The speech recogniser's error codes as the short names the app shows help for (src/lib/voice/speech.ts). */
public final class VoiceErrors {

    private VoiceErrors() {}

    // android.speech.SpeechRecognizer error codes; numbers so this stays testable off the device.
    static final int NETWORK_TIMEOUT = 1;
    static final int NETWORK = 2;
    static final int AUDIO = 3;
    static final int SERVER = 4;
    static final int CLIENT = 5;
    static final int SPEECH_TIMEOUT = 6;
    static final int NO_MATCH = 7;
    static final int RECOGNIZER_BUSY = 8;
    static final int INSUFFICIENT_PERMISSIONS = 9;
    static final int TOO_MANY_REQUESTS = 10;
    static final int SERVER_DISCONNECTED = 11;
    static final int LANGUAGE_NOT_SUPPORTED = 12;
    static final int LANGUAGE_UNAVAILABLE = 13;

    public static String name(int code) {
        switch (code) {
            case SPEECH_TIMEOUT: return "silence";
            case NO_MATCH: return "no-match";
            case INSUFFICIENT_PERMISSIONS: return "permission";
            case NETWORK:
            case NETWORK_TIMEOUT:
            case SERVER:
            case SERVER_DISCONNECTED:
            case TOO_MANY_REQUESTS: return "network";
            case LANGUAGE_NOT_SUPPORTED:
            case LANGUAGE_UNAVAILABLE: return "language";
            case RECOGNIZER_BUSY: return "busy";
            case AUDIO: return "audio";
            case CLIENT: return "client";
            default: return "error";
        }
    }
}
