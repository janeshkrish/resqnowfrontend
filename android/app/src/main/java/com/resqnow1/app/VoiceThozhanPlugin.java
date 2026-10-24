package com.resqnow1.app;

import android.Manifest;
import android.content.Intent;
import android.os.Bundle;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.speech.tts.Voice;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * ResQNow-Thozhan's ears and voice (src/lib/voice/speech.ts): the phone's own speech recogniser,
 * in Tamil or Indian English, and its own text-to-speech. Nothing is recorded or uploaded by the app.
 */
@CapacitorPlugin(
    name = "VoiceThozhan",
    permissions = { @Permission(alias = "microphone", strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class VoiceThozhanPlugin extends Plugin {

    private SpeechRecognizer recognizer;
    private TextToSpeech tts;
    private boolean ttsReady;
    private final Map<String, PluginCall> speaking = new HashMap<>();
    private int utterances = 0;

    @PluginMethod
    public void available(PluginCall call) {
        JSObject result = new JSObject();
        result.put("listen", SpeechRecognizer.isRecognitionAvailable(getContext()));
        result.put("speak", true);
        call.resolve(result);
    }

    @PluginMethod
    public void listen(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "afterMicrophonePermission");
            return;
        }
        startListening(call);
    }

    @PermissionCallback
    private void afterMicrophonePermission(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) startListening(call);
        else call.reject("Microphone permission was not given", "permission");
    }

    private void startListening(PluginCall call) {
        String lang = call.getString("lang", "ta-IN");
        getActivity().runOnUiThread(() -> {
            if (!SpeechRecognizer.isRecognitionAvailable(getContext())) {
                call.reject("Speech recognition is not available on this phone", "unavailable");
                return;
            }
            if (recognizer != null) recognizer.destroy();
            recognizer = SpeechRecognizer.createSpeechRecognizer(getContext());
            recognizer.setRecognitionListener(new Listener());
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, lang);
            intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            intent.putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 1800L);
            recognizer.startListening(intent);
            call.resolve();
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            if (recognizer != null) recognizer.stopListening();
            call.resolve();
        });
    }

    private class Listener implements RecognitionListener {
        @Override public void onReadyForSpeech(Bundle params) {}
        @Override public void onBeginningOfSpeech() {}
        @Override public void onRmsChanged(float rmsdB) {}
        @Override public void onBufferReceived(byte[] buffer) {}
        @Override public void onEndOfSpeech() {}
        @Override public void onEvent(int eventType, Bundle params) {}

        @Override
        public void onPartialResults(Bundle results) {
            emit("partial", firstResult(results));
        }

        @Override
        public void onResults(Bundle results) {
            emit("final", firstResult(results));
            finish();
        }

        @Override
        public void onError(int error) {
            JSObject data = new JSObject();
            data.put("error", VoiceErrors.name(error));
            notifyListeners("error", data);
            finish();
        }
    }

    private void emit(String event, String text) {
        JSObject data = new JSObject();
        data.put("text", text);
        notifyListeners(event, data);
    }

    private void finish() {
        notifyListeners("end", new JSObject());
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
    }

    private static String firstResult(Bundle results) {
        if (results == null) return "";
        ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
        return matches == null || matches.isEmpty() || matches.get(0) == null ? "" : matches.get(0);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        String lang = call.getString("lang", "en-IN");
        if (text == null || text.trim().isEmpty()) {
            call.resolve();
            return;
        }
        call.setKeepAlive(true);
        withVoice(() -> {
            Locale locale = Locale.forLanguageTag(lang);
            int set = tts.setLanguage(locale);
            if (set == TextToSpeech.LANG_MISSING_DATA || set == TextToSpeech.LANG_NOT_SUPPORTED) {
                // No voice for this language on the phone: the words are already on screen.
                release(call);
                return;
            }
            Voice voice = bestVoice(lang);
            if (voice != null) tts.setVoice(voice);
            // A touch slower than the default reads Tamil more clearly.
            tts.setSpeechRate(0.95f);
            String id = "thozhan-" + (++utterances);
            speaking.put(id, call);
            tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id);
        }, () -> release(call));
    }

    @PluginMethod
    public void silence(PluginCall call) {
        if (tts != null) tts.stop();
        for (PluginCall pending : speaking.values()) release(pending);
        speaking.clear();
        call.resolve();
    }

    private void withVoice(Runnable ready, Runnable unavailable) {
        if (tts != null && ttsReady) {
            ready.run();
            return;
        }
        if (tts != null) {
            unavailable.run();
            return;
        }
        tts = new TextToSpeech(getContext(), (status) -> {
            ttsReady = status == TextToSpeech.SUCCESS;
            if (!ttsReady) {
                unavailable.run();
                return;
            }
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override public void onStart(String utteranceId) {}
                @Override public void onDone(String utteranceId) { release(speaking.remove(utteranceId)); }
                @Override public void onError(String utteranceId) { release(speaking.remove(utteranceId)); }
                @Override public void onStop(String utteranceId, boolean interrupted) { release(speaking.remove(utteranceId)); }
            });
            ready.run();
        });
    }

    /** The phone's clearest installed voice for the language (VoicePick), or null to keep the engine's own choice. */
    private Voice bestVoice(String lang) {
        try {
            Set<Voice> all = tts.getVoices();
            if (all == null) return null;
            List<Voice> voices = new ArrayList<>(all);
            List<VoicePick.Option> options = new ArrayList<>();
            for (Voice voice : voices) {
                Set<String> features = voice.getFeatures();
                boolean installed = features == null || !features.contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED);
                options.add(new VoicePick.Option(voice.getLocale().toLanguageTag(), voice.getQuality(), voice.isNetworkConnectionRequired(), installed));
            }
            int best = VoicePick.best(options, lang);
            return best < 0 ? null : voices.get(best);
        } catch (RuntimeException error) {
            // Some speech engines fail to list their voices; the default voice still speaks.
            return null;
        }
    }

    private void release(PluginCall call) {
        if (call == null) return;
        call.setKeepAlive(false);
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        if (recognizer != null) {
            recognizer.destroy();
            recognizer = null;
        }
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        super.handleOnDestroy();
    }
}
