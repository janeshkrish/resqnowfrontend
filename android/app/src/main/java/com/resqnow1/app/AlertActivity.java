package com.resqnow1.app;

import android.app.KeyguardManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationManagerCompat;

public class AlertActivity extends AppCompatActivity {

    public static final String EXTRA_NOTIFICATION_ID = "extra_notification_id";
    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_BODY = "extra_body";
    public static final String EXTRA_JOB_ID = "extra_job_id";
    public static final String EXTRA_DEEP_LINK_PATH = "extra_deep_link_path";

    private static volatile AlertActivity activeAlertActivity = null;

    private int notificationId = -1;
    private String jobId = "";
    private String deepLinkPath = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        activeAlertActivity = this;
        configureLockScreenBehavior();
        hydrateFromIntent();
        openExistingJobCardUi();
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        hydrateFromIntent();
        openExistingJobCardUi();
    }

    @Override
    protected void onDestroy() {
        if (activeAlertActivity == this) {
            activeAlertActivity = null;
        }
        super.onDestroy();
    }

    public static void dismissActiveAlertForJob(String revokedJobId) {
        AlertActivity active = activeAlertActivity;
        if (active == null) return;

        String normalizedRevoked = String.valueOf(revokedJobId == null ? "" : revokedJobId).trim();
        String activeJob = String.valueOf(active.jobId == null ? "" : active.jobId).trim();
        if (!normalizedRevoked.isEmpty() && !normalizedRevoked.equals(activeJob)) {
            return;
        }

        active.runOnUiThread(() -> {
            try {
                active.finishAndRemoveTask();
            } catch (Exception ignored) {
                active.finish();
            }
        });
    }

    @SuppressWarnings("deprecation")
    private void configureLockScreenBehavior() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguardManager = getSystemService(KeyguardManager.class);
            if (keyguardManager != null) {
                keyguardManager.requestDismissKeyguard(this, null);
            }
        } else {
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            );
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    private void hydrateFromIntent() {
        android.content.Intent intent = getIntent();
        if (intent == null) return;
        notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1);
        jobId = stringExtra(intent, EXTRA_JOB_ID);
        deepLinkPath = stringExtra(intent, EXTRA_DEEP_LINK_PATH);
    }

    private void openExistingJobCardUi() {
        cancelEmergencyNotification();
        stopForegroundAlertService();
        launchMainActivity();
        finish();
    }

    private void launchMainActivity() {
        String inAppPath = buildInAppPath();
        String appUrl = buildAppUrl(inAppPath);

        android.content.Intent intent = new android.content.Intent(this, MainActivity.class);
        intent.addFlags(
            android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP
                | android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP
                | android.content.Intent.FLAG_ACTIVITY_NEW_TASK
        );
        intent.setAction(android.content.Intent.ACTION_VIEW);
        intent.setData(Uri.parse(appUrl));
        intent.putExtra("launch_from_emergency_alert", true);
        intent.putExtra("alert_source", "system");
        if (!isBlank(jobId)) intent.putExtra("jobId", jobId);
        intent.putExtra("deepLinkPath", inAppPath);
        startActivity(intent);
    }

    private String buildInAppPath() {
        String normalizedPath;
        if (!isBlank(deepLinkPath)) {
            normalizedPath = deepLinkPath.trim();
            if (!normalizedPath.startsWith("/")) {
                normalizedPath = "/" + normalizedPath;
            }
        } else if (!isBlank(jobId)) {
            normalizedPath = "/job/" + Uri.encode(jobId.trim());
        } else {
            normalizedPath = "/technician/dashboard";
        }

        return appendSystemAlertQuery(normalizedPath);
    }

    private String appendSystemAlertQuery(String path) {
        String normalizedPath = isBlank(path) ? "/technician/dashboard" : path.trim();
        if (!normalizedPath.startsWith("/")) {
            normalizedPath = "/" + normalizedPath;
        }
        if (normalizedPath.contains("alertSource=system")) {
            return normalizedPath;
        }
        String join = normalizedPath.contains("?") ? "&" : "?";
        return normalizedPath + join + "alertSource=system";
    }

    private String buildAppUrl(String path) {
        String normalizedPath = isBlank(path) ? "/technician/dashboard?alertSource=system" : path.trim();
        if (!normalizedPath.startsWith("/")) {
            normalizedPath = "/" + normalizedPath;
        }
        return "resqnow://auth" + normalizedPath;
    }

    private void cancelEmergencyNotification() {
        if (notificationId >= 0) {
            NotificationManagerCompat.from(this).cancel(notificationId);
        }
        if (!isBlank(jobId)) {
            NotificationManagerCompat.from(this).cancel(("job:" + jobId.trim()).hashCode());
        }
    }

    private void stopForegroundAlertService() {
        try {
            android.content.Intent stopIntent = new android.content.Intent(this, JobAlertForegroundService.class);
            stopIntent.setAction(JobAlertForegroundService.ACTION_DISMISS_ALERT);
            stopIntent.putExtra(JobAlertForegroundService.EXTRA_NOTIFICATION_ID, notificationId);
            stopIntent.putExtra(JobAlertForegroundService.EXTRA_JOB_ID, jobId);
            startService(stopIntent);
        } catch (Exception ignored) {
            // Best effort only. Main activity launch should proceed regardless.
        }
    }

    private String stringExtra(android.content.Intent intent, String key) {
        if (intent == null || key == null) return "";
        String value = intent.getStringExtra(key);
        return value == null ? "" : value;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }
}
