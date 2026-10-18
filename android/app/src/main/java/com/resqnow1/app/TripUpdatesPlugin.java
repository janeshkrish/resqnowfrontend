package com.resqnow1.app;

import android.app.NotificationManager;
import android.content.Context;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Lets the app keep the customer's Live Update in step with the tracking screen
 * (src/lib/tripUpdates.ts). Pushes from the server update the same notification when the
 * app is closed; see TripUpdateNotifier.
 */
@CapacitorPlugin(name = "TripUpdates")
public class TripUpdatesPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        TripState state = new TripState();
        state.requestId = call.getString("requestId", "").trim();
        if (state.requestId.isEmpty()) {
            call.reject("requestId is required");
            return;
        }
        state.phase = call.getString("phase", "other");
        state.title = call.getString("title", "");
        state.text = call.getString("text", "");
        state.chip = call.getString("chip", "");
        state.tone = call.getString("tone", "");
        state.progress = call.getInt("progress", 0);
        state.indeterminate = Boolean.TRUE.equals(call.getBoolean("indeterminate", false));
        state.tracker = call.getString("tracker", "");
        state.technicianName = call.getString("technicianName", "");
        state.technicianPhone = call.getString("technicianPhone", "");
        state.service = call.getString("service", "");
        state.amountLabel = call.getString("amountLabel", "");
        state.arrivalAt = number(call, "arrivalAt");
        state.startedAt = number(call, "startedAt");
        state.alertTitle = call.getString("alertTitle", "");
        state.alertText = call.getString("alertText", "");
        state.deepLinkPath = call.getString("deepLinkPath", "");
        state.source = TripState.SOURCE_APP;
        state.updatedAt = System.currentTimeMillis();
        TripUpdateNotifier.post(getContext(), state, MainActivity.isOnScreen());
        call.resolve();
    }

    @PluginMethod
    public void end(PluginCall call) {
        TripUpdateNotifier.cancel(getContext(), call.getString("requestId", ""));
        call.resolve();
    }

    /** Whether the Live Update can show, and whether Android 16 may pin it with its chip. */
    @PluginMethod
    public void getStatus(PluginCall call) {
        Context context = getContext();
        JSObject status = new JSObject();
        status.put("notificationsEnabled", NotificationManagerCompat.from(context).areNotificationsEnabled());
        boolean promoted = false;
        if (Build.VERSION.SDK_INT >= 36) {
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            promoted = manager != null && manager.canPostPromotedNotifications();
        }
        status.put("liveUpdatesAllowed", promoted);
        call.resolve(status);
    }

    private static long number(PluginCall call, String key) {
        Double value = call.getDouble(key);
        return value == null || value.isNaN() ? 0L : Math.round(value);
    }
}
