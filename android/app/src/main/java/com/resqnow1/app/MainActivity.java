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
        registerPlugin(AppInstallationPlugin.class);
        registerPlugin(AppUpdaterPlugin.class);
        if (BuildConfig.MAPPLS_ENABLED) registerPlugin(com.resqnow1.app.maps.ResqnowMapplsPlugin.class);
        bridgeBuilder.addWebViewListener(new com.resqnow1.app.updates.NativeCodeRefresh(this));
        super.onCreate(savedInstanceState);
        if (nativeMaps() != null) nativeMaps().restoreMaps(savedInstanceState);
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

    private com.resqnow1.app.maps.ResqnowMapplsPlugin nativeMaps() {
        if (!BuildConfig.MAPPLS_ENABLED) return null;
        if (getBridge() == null || getBridge().getPlugin("ResqnowMappls") == null) return null;
        return (com.resqnow1.app.maps.ResqnowMapplsPlugin) getBridge().getPlugin("ResqnowMappls").getInstance();
    }

    @Override public void onSaveInstanceState(Bundle state) {
        if (nativeMaps() != null) nativeMaps().saveMaps(state);
        super.onSaveInstanceState(state);
    }

    @Override public void onLowMemory() {
        super.onLowMemory();
        if (nativeMaps() != null) nativeMaps().lowMemory();
    }
}
