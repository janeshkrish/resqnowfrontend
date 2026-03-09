package com.resqnow1.app;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
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
    public static final String EXTRA_ALERT_ACTION = "extra_alert_action";

    private static final long ALERT_TIMEOUT_MS = 30000L;
    private static final String ALERT_ACTION_ACCEPT = "accept";
    private static final String ALERT_ACTION_REJECT = "reject";
    private static final long[] ALERT_VIBRATION_PATTERN = new long[] { 0L, 600L, 300L, 600L, 300L, 600L };

    private int activeNotificationId = -1;
    private String activeJobId = "";
    private MediaPlayer mediaPlayer = null;
    private Vibrator vibrator = null;
    private final Handler timeoutHandler = new Handler(Looper.getMainLooper());
    private Runnable timeoutRunnable = null;

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

        Intent alertIntent = new Intent(this, JobAlertActivity.class);
        alertIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        alertIntent.putExtra(JobAlertActivity.EXTRA_NOTIFICATION_ID, notificationId);
        alertIntent.putExtra(JobAlertActivity.EXTRA_TITLE, title);
        alertIntent.putExtra(JobAlertActivity.EXTRA_BODY, body);
        alertIntent.putExtra(JobAlertActivity.EXTRA_JOB_ID, jobId);
        alertIntent.putExtra(JobAlertActivity.EXTRA_DEEP_LINK_PATH, deepLinkPath);

        Intent acceptIntent = new Intent(this, JobAlertActivity.class);
        acceptIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        acceptIntent.putExtra(JobAlertActivity.EXTRA_NOTIFICATION_ID, notificationId);
        acceptIntent.putExtra(JobAlertActivity.EXTRA_TITLE, title);
        acceptIntent.putExtra(JobAlertActivity.EXTRA_BODY, body);
        acceptIntent.putExtra(JobAlertActivity.EXTRA_JOB_ID, jobId);
        acceptIntent.putExtra(JobAlertActivity.EXTRA_DEEP_LINK_PATH, deepLinkPath);
        acceptIntent.putExtra(JobAlertActivity.EXTRA_ALERT_ACTION, ALERT_ACTION_ACCEPT);

        Intent rejectIntent = new Intent(this, JobAlertActivity.class);
        rejectIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        rejectIntent.putExtra(JobAlertActivity.EXTRA_NOTIFICATION_ID, notificationId);
        rejectIntent.putExtra(JobAlertActivity.EXTRA_TITLE, title);
        rejectIntent.putExtra(JobAlertActivity.EXTRA_BODY, body);
        rejectIntent.putExtra(JobAlertActivity.EXTRA_JOB_ID, jobId);
        rejectIntent.putExtra(JobAlertActivity.EXTRA_DEEP_LINK_PATH, deepLinkPath);
        rejectIntent.putExtra(JobAlertActivity.EXTRA_ALERT_ACTION, ALERT_ACTION_REJECT);

        PendingIntent fullScreenIntent = PendingIntent.getActivity(
            this,
            notificationId,
            alertIntent,
            pendingIntentFlags()
        );
        PendingIntent acceptPendingIntent = PendingIntent.getActivity(
            this,
            notificationId + 1000,
            acceptIntent,
            pendingIntentFlags()
        );
        PendingIntent rejectPendingIntent = PendingIntent.getActivity(
            this,
            notificationId + 2000,
            rejectIntent,
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
            .addAction(resolveSmallIcon(), "Accept", acceptPendingIntent)
            .addAction(resolveSmallIcon(), "Reject", rejectPendingIntent)
            .setVibrate(ALERT_VIBRATION_PATTERN);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(EmergencyNotificationHelper.getEmergencySoundUri(this));
        }

        Notification notification = builder.build();
        startForeground(notificationId, notification);
        NotificationManagerCompat.from(this).notify(notificationId, notification);

        activeNotificationId = notificationId;
        activeJobId = jobId;

        startAlertFeedbackLoop();
        scheduleAlertTimeout(notificationId, jobId);
    }

    private void startAlertFeedbackLoop() {
        stopAlertFeedbackLoop();

        try {
            mediaPlayer = MediaPlayer.create(this, R.raw.emergency_alarm);
            if (mediaPlayer != null) {
                mediaPlayer.setLooping(true);
                mediaPlayer.setVolume(1.0f, 1.0f);
                mediaPlayer.start();
            }
        } catch (Exception ignored) {
            stopAlertFeedbackLoop();
        }

        try {
            vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (vibrator == null || !vibrator.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(ALERT_VIBRATION_PATTERN, 0));
            } else {
                vibrator.vibrate(ALERT_VIBRATION_PATTERN, 0);
            }
        } catch (Exception ignored) {
            // vibration is best-effort only.
        }
    }

    private void stopAlertFeedbackLoop() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
            } catch (Exception ignored) {
                // no-op
            }
            try {
                mediaPlayer.release();
            } catch (Exception ignored) {
                // no-op
            }
            mediaPlayer = null;
        }

        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Exception ignored) {
                // no-op
            }
            vibrator = null;
        }
    }

    private void scheduleAlertTimeout(int notificationId, String jobId) {
        clearAlertTimeout();
        timeoutRunnable = () -> {
            Intent timeoutDismissIntent = new Intent(this, JobAlertForegroundService.class);
            timeoutDismissIntent.setAction(ACTION_DISMISS_ALERT);
            timeoutDismissIntent.putExtra(EXTRA_NOTIFICATION_ID, notificationId);
            timeoutDismissIntent.putExtra(EXTRA_JOB_ID, jobId);
            dismissCurrentAlert(timeoutDismissIntent);
        };
        timeoutHandler.postDelayed(timeoutRunnable, ALERT_TIMEOUT_MS);
    }

    private void clearAlertTimeout() {
        if (timeoutRunnable == null) return;
        timeoutHandler.removeCallbacks(timeoutRunnable);
        timeoutRunnable = null;
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

        stopAlertFeedbackLoop();
        clearAlertTimeout();

        JobAlertActivity.dismissActiveAlertForJob(jobId);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }

        activeNotificationId = -1;
        activeJobId = "";
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

    @Override
    public void onDestroy() {
        stopAlertFeedbackLoop();
        clearAlertTimeout();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
