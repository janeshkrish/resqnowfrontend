package com.resqnow1.app;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.Build;
import android.os.IBinder;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class JobAlertForegroundService extends Service {

    public static final String ACTION_SHOW_ALERT = "com.resqnow1.app.action.SHOW_ALERT";
    public static final String ACTION_DISMISS_ALERT = "com.resqnow1.app.action.DISMISS_ALERT";

    public static final String EXTRA_NOTIFICATION_ID = "extra_notification_id";
    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_BODY = "extra_body";
    public static final String EXTRA_JOB_ID = "extra_job_id";
    public static final String EXTRA_DEEP_LINK_PATH = "extra_deep_link_path";

    private int activeNotificationId = -1;
    private String activeJobId = "";

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        EmergencyNotificationHelper.ensureEmergencyChannel(this);

        String action = intent != null ? String.valueOf(intent.getAction()) : "";
        if (ACTION_DISMISS_ALERT.equals(action)) {
            dismissCurrentAlert(intent);
            return START_NOT_STICKY;
        }

        showEmergencyAlert(intent);
        return START_NOT_STICKY;
    }

    private void showEmergencyAlert(Intent intent) {
        int notificationId = intent != null ? intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1) : -1;
        String title = intent != null ? value(intent.getStringExtra(EXTRA_TITLE), "Emergency Job Alert") : "Emergency Job Alert";
        String body = intent != null ? value(intent.getStringExtra(EXTRA_BODY), "A new emergency service request is waiting.") : "A new emergency service request is waiting.";
        String jobId = intent != null ? value(intent.getStringExtra(EXTRA_JOB_ID), "") : "";
        String deepLinkPath = intent != null ? value(intent.getStringExtra(EXTRA_DEEP_LINK_PATH), "") : "";

        if (notificationId < 0) {
            notificationId = stableNotificationIdForJob(jobId);
        }

        Intent alertIntent = new Intent(this, AlertActivity.class);
        alertIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        alertIntent.putExtra(AlertActivity.EXTRA_NOTIFICATION_ID, notificationId);
        alertIntent.putExtra(AlertActivity.EXTRA_TITLE, title);
        alertIntent.putExtra(AlertActivity.EXTRA_BODY, body);
        alertIntent.putExtra(AlertActivity.EXTRA_JOB_ID, jobId);
        alertIntent.putExtra(AlertActivity.EXTRA_DEEP_LINK_PATH, deepLinkPath);

        PendingIntent fullScreenIntent = PendingIntent.getActivity(
            this,
            notificationId,
            alertIntent,
            pendingIntentFlags()
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, EmergencyNotificationHelper.CHANNEL_ID)
            .setSmallIcon(resolveSmallIcon())
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenIntent, true)
            .setContentIntent(fullScreenIntent)
            .setVibrate(new long[] { 0L, 500L, 250L, 500L, 250L, 500L });

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(EmergencyNotificationHelper.getEmergencySoundUri(this));
        }

        Notification notification = builder.build();
        startForeground(notificationId, notification);
        NotificationManagerCompat.from(this).notify(notificationId, notification);

        activeNotificationId = notificationId;
        activeJobId = jobId;
    }

    private void dismissCurrentAlert(Intent intent) {
        int notificationId = intent != null ? intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1) : -1;
        String jobId = intent != null ? value(intent.getStringExtra(EXTRA_JOB_ID), "") : "";

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
        if (notificationId >= 0) {
            notificationManager.cancel(notificationId);
        }
        if (!isBlank(jobId)) {
            notificationManager.cancel(stableNotificationIdForJob(jobId));
        }
        if (activeNotificationId >= 0) {
            notificationManager.cancel(activeNotificationId);
        }
        if (!isBlank(activeJobId)) {
            notificationManager.cancel(stableNotificationIdForJob(activeJobId));
        }

        AlertActivity.dismissActiveAlertForJob(jobId);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    private int pendingIntentFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }

    private int stableNotificationIdForJob(String jobId) {
        if (isBlank(jobId)) {
            return ("job:unknown:" + System.currentTimeMillis()).hashCode();
        }
        return ("job:" + jobId.trim()).hashCode();
    }

    private int resolveSmallIcon() {
        int applicationIcon = getApplicationInfo().icon;
        return applicationIcon != 0 ? applicationIcon : android.R.drawable.ic_dialog_alert;
    }

    private String value(String input, String fallback) {
        String normalized = String.valueOf(input == null ? "" : input).trim();
        return normalized.isEmpty() ? fallback : normalized;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
