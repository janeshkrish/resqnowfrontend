package com.resqnow1.app;

import android.os.Bundle;
import android.util.Log;
import android.view.KeyEvent;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.resqnow1.app.tracking.TechnicianTrackingPlugin;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";

    private static volatile boolean onScreen = false;

    /** True while the app is open on an unlocked screen, where the in-app card shows job offers. */
    public static boolean isOnScreen() {
        return onScreen;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins must be registered before the bridge is created.
        registerPlugin(TechnicianTrackingPlugin.class);
        registerPlugin(JobAlertsPlugin.class);
        registerPlugin(TripUpdatesPlugin.class);
        registerPlugin(VoiceThozhanPlugin.class);
        super.onCreate(savedInstanceState);
        ensureFirebaseInitialized();
        NotificationChannels.ensureAll(this);
    }

    @Override
    public void onResume() {
        super.onResume();
        onScreen = true;
    }

    /** The volume buttons silence a ringing job offer, as they do for a phone call. */
    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        int key = event.getKeyCode();
        boolean volumeKey = key == KeyEvent.KEYCODE_VOLUME_UP || key == KeyEvent.KEYCODE_VOLUME_DOWN || key == KeyEvent.KEYCODE_VOLUME_MUTE;
        if (volumeKey && JobAlertForegroundService.isRinging()) {
            if (event.getAction() == KeyEvent.ACTION_DOWN) JobAlertForegroundService.silence(this);
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onPause() {
        onScreen = false;
        super.onPause();
    }

    private void ensureFirebaseInitialized() {
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseApp app = FirebaseApp.initializeApp(this);
                if (app == null) {
                    Log.e(TAG, "Firebase init failed. Check android/app/google-services.json package_name and plugin setup.");
                }
            }
        } catch (Exception exception) {
            Log.e(TAG, "Firebase initialization error", exception);
        }
    }
}
