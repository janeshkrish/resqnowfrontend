package com.resqnow1.app;

import android.app.KeyguardManager;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationManagerCompat;

public class JobAlertActivity extends AppCompatActivity {

    public static final String EXTRA_NOTIFICATION_ID = "extra_notification_id";
    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_BODY = "extra_body";
    public static final String EXTRA_JOB_ID = "extra_job_id";
    public static final String EXTRA_DEEP_LINK_PATH = "extra_deep_link_path";
    public static final String EXTRA_ALERT_ACTION = "extra_alert_action";

    private static final String ALERT_ACTION_ACCEPT = "accept";
    private static final String ALERT_ACTION_REJECT = "reject";

    private static volatile JobAlertActivity activeAlertActivity = null;

    private int notificationId = -1;
    private String jobId = "";
    private String deepLinkPath = "";
    private String alertAction = "";
    private boolean handledAction = false;
    private boolean relayedToMainApp = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        activeAlertActivity = this;
        configureLockScreenBehavior();
        hydrateFromIntent();
        relayToMainApp();
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        hydrateFromIntent();
        relayedToMainApp = false;
        relayToMainApp();
    }

    @Override
    protected void onDestroy() {
        if (activeAlertActivity == this) {
            activeAlertActivity = null;
        }
        super.onDestroy();
    }

    public static void dismissActiveAlertForJob(String revokedJobId) {
        JobAlertActivity active = activeAlertActivity;
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
        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        );

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguardManager = getSystemService(KeyguardManager.class);
            if (keyguardManager != null) {
                keyguardManager.requestDismissKeyguard(this, null);
            }
        }
    }

    private void hydrateFromIntent() {
        android.content.Intent intent = getIntent();
        if (intent == null) return;
        notificationId = intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1);
        jobId = stringExtra(intent, EXTRA_JOB_ID);
        deepLinkPath = stringExtra(intent, EXTRA_DEEP_LINK_PATH);
        alertAction = stringExtra(intent, EXTRA_ALERT_ACTION).toLowerCase();
    }

    private void relayToMainApp() {
        if (relayedToMainApp) return;
        relayedToMainApp = true;

        String normalizedAction = String.valueOf(alertAction == null ? "" : alertAction).trim().toLowerCase();
        if (ALERT_ACTION_ACCEPT.equals(normalizedAction) || ALERT_ACTION_REJECT.equals(normalizedAction)) {
            handleAlertAction(normalizedAction);
            return;
        }

        launchMainActivity("");
        finishAlertActivity();
    }

    private void handleAlertAction(String action) {
        if (handledAction) return;
        handledAction = true;
        cancelEmergencyNotification();
        stopForegroundAlertService();

        String normalizedAction = String.valueOf(action == null ? "" : action).trim().toLowerCase();
        if (ALERT_ACTION_ACCEPT.equals(normalizedAction)) {
            playAcceptConfirmationTone();
        }

        launchMainActivity(normalizedAction);
        finishAlertActivity();
    }

    private void finishAlertActivity() {
        try {
            finishAndRemoveTask();
        } catch (Exception ignored) {
            finish();
        }
    }

    private void launchMainActivity(String action) {
        String inAppPath = buildInAppPath(action);
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
        if (!isBlank(action)) {
            intent.putExtra("alertAction", action);
        }
        if (!isBlank(jobId)) intent.putExtra("jobId", jobId);
        intent.putExtra("deepLinkPath", inAppPath);
        startActivity(intent);
    }

    private String buildInAppPath(String action) {
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

        return appendSystemAlertQuery(appendAlertActionQuery(normalizedPath, action));
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

    private String appendAlertActionQuery(String path, String action) {
        if (isBlank(action)) return path;
        String normalizedAction = action.trim().toLowerCase();
        if (!normalizedAction.equals(ALERT_ACTION_ACCEPT) && !normalizedAction.equals(ALERT_ACTION_REJECT)) {
            return path;
        }

        String normalizedPath = isBlank(path) ? "/technician/dashboard" : path.trim();
        if (!normalizedPath.startsWith("/")) {
            normalizedPath = "/" + normalizedPath;
        }
        if (normalizedPath.contains("alertAction=") || normalizedPath.contains("alert_action=")) {
            return normalizedPath;
        }
        String join = normalizedPath.contains("?") ? "&" : "?";
        return normalizedAction.isEmpty() ? path : (normalizedPath + join + "alertAction=" + Uri.encode(normalizedAction));
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

    private void playAcceptConfirmationTone() {
        ToneGenerator toneGenerator = null;
        try {
            toneGenerator = new ToneGenerator(AudioManager.STREAM_ALARM, 100);
            toneGenerator.startTone(ToneGenerator.TONE_PROP_ACK, 120);
            toneGenerator.startTone(ToneGenerator.TONE_PROP_BEEP2, 180);
        } catch (Exception ignored) {
            // best-effort only
        } finally {
            if (toneGenerator != null) {
                try {
                    toneGenerator.release();
                } catch (Exception ignored) {
                    // no-op
                }
            }
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
