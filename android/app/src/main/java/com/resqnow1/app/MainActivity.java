package com.resqnow1.app;

import android.os.Bundle;
import android.util.Log;
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
        super.onCreate(savedInstanceState);
        ensureFirebaseInitialized();
        EmergencyNotificationHelper.ensureEmergencyChannel(this);
    }

    @Override
    public void onResume() {
        super.onResume();
        onScreen = true;
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
