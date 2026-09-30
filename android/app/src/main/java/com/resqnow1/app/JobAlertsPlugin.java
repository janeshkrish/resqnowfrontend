package com.resqnow1.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * What stops a job alert from reaching a technician with the screen off, for the dashboard's
 * job alerts banner (src/lib/jobAlertReadiness.ts), and the settings screens that fix it.
 */
@CapacitorPlugin(name = "JobAlerts")
public class JobAlertsPlugin extends Plugin {

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context context = getContext();
        JSObject status = new JSObject();
        status.put("notificationsEnabled", notificationsEnabled(context));
        status.put("fullScreenAllowed", fullScreenAllowed(context));
        status.put("ignoringBatteryOptimizations", ignoringBatteryOptimizations(context));
        call.resolve(status);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        Context context = getContext();
        Intent intent = settingsIntent(context, call.getString("target", "notifications"));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            context.startActivity(intent);
        } catch (ActivityNotFoundException missing) {
            // Some phones drop the specific screens; the app's own page links to all of them.
            Intent appDetails = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri(context));
            appDetails.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            context.startActivity(appDetails);
        }
        call.resolve();
    }

    static boolean notificationsEnabled(Context context) {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        EmergencyNotificationHelper.ensureEmergencyChannel(context);
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        NotificationChannel channel = manager == null ? null : manager.getNotificationChannel(EmergencyNotificationHelper.CHANNEL_ID);
        return channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }

    /** Android 14 lets people turn off the full-screen alert that wakes a locked phone. */
    static boolean fullScreenAllowed(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return true;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        return manager == null || manager.canUseFullScreenIntent();
    }

    static boolean ignoringBatteryOptimizations(Context context) {
        PowerManager power = context.getSystemService(PowerManager.class);
        return power == null || power.isIgnoringBatteryOptimizations(context.getPackageName());
    }

    private static Intent settingsIntent(Context context, String target) {
        if ("fullScreen".equals(target) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            return new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, packageUri(context));
        }
        if ("battery".equals(target)) {
            // The list screen needs no extra permission, unlike asking to be exempted directly.
            return new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            return new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.getPackageName());
        }
        return new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, packageUri(context));
    }

    private static Uri packageUri(Context context) {
        return Uri.fromParts("package", context.getPackageName(), null);
    }
}
