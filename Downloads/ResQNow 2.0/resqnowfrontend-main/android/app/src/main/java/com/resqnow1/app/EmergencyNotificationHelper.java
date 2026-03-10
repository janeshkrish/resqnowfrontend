package com.resqnow1.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;

public final class EmergencyNotificationHelper {

    private static final String TAG = "EmergencyNotifHelper";

    public static final String CHANNEL_ID = "high_priority_alarms";
    public static final String CHANNEL_NAME = "Emergency Alerts";
    public static final String CHANNEL_DESCRIPTION = "Critical job alerts for technicians";

    private EmergencyNotificationHelper() {}

    public static Uri getEmergencySoundUri(Context context) {
        return Uri.parse(
            ContentResolver.SCHEME_ANDROID_RESOURCE
                + "://"
                + context.getPackageName()
                + "/"
                + R.raw.emergency_alarm
        );
    }

    public static void ensureEmergencyChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }

        NotificationManager notificationManager = context.getSystemService(NotificationManager.class);
        if (notificationManager == null) {
            return;
        }

        Uri desiredSoundUri = getEmergencySoundUri(context);
        NotificationChannel existing = notificationManager.getNotificationChannel(CHANNEL_ID);

        if (existing != null && isDesiredConfiguration(existing, desiredSoundUri)) {
            return;
        }

        // Channel sound is immutable after first creation; recreate if config is wrong.
        if (existing != null) {
            notificationManager.deleteNotificationChannel(CHANNEL_ID);
        }

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            CHANNEL_NAME,
            NotificationManager.IMPORTANCE_HIGH
        );

        channel.setDescription(CHANNEL_DESCRIPTION);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] { 0L, 500L, 250L, 500L });

        AudioAttributes attributes = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        try {
            channel.setSound(desiredSoundUri, attributes);
        } catch (Exception exception) {
            Log.w(TAG, "Failed to assign emergency sound, using default notification sound.", exception);
            channel.setSound(Settings.System.DEFAULT_NOTIFICATION_URI, attributes);
        }

        notificationManager.createNotificationChannel(channel);
    }

    private static boolean isDesiredConfiguration(NotificationChannel channel, Uri desiredSoundUri) {
        Uri existingSound = channel.getSound();
        String existingSoundValue = existingSound == null ? "" : existingSound.toString();
        String desiredSoundValue = desiredSoundUri == null ? "" : desiredSoundUri.toString();

        return channel.getImportance() >= NotificationManager.IMPORTANCE_HIGH
            && desiredSoundValue.equals(existingSoundValue);
    }
}
