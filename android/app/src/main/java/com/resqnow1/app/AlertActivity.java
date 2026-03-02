package com.resqnow1.app;

import android.app.KeyguardManager;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.TextView;
import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationManagerCompat;

public class AlertActivity extends AppCompatActivity {

    public static final String EXTRA_NOTIFICATION_ID = "extra_notification_id";
    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_BODY = "extra_body";
    public static final String EXTRA_JOB_ID = "extra_job_id";
    public static final String EXTRA_DEEP_LINK_PATH = "extra_deep_link_path";

    private MediaPlayer mediaPlayer;
    private Ringtone fallbackRingtone;
    private int notificationId = -1;
    private String jobId = "";
    private String deepLinkPath = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureLockScreenBehavior();
        setContentView(R.layout.activity_alert);
        hydrateFromIntent();
        wireUi();
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                onReject();
            }
        });
        startAlarmPlayback();
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        hydrateFromIntent();
        wireUi();
        startAlarmPlayback();
    }

    @Override
    protected void onDestroy() {
        stopAlarmPlayback();
        super.onDestroy();
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

    private void wireUi() {
        android.content.Intent intent = getIntent();
        String title = stringExtra(intent, EXTRA_TITLE);
        String body = stringExtra(intent, EXTRA_BODY);

        TextView titleView = findViewById(R.id.alertTitle);
        TextView bodyView = findViewById(R.id.alertBody);
        TextView jobMetaView = findViewById(R.id.alertJobMeta);
        Button acceptButton = findViewById(R.id.alertAcceptButton);
        Button rejectButton = findViewById(R.id.alertRejectButton);

        titleView.setText(isBlank(title) ? "Emergency Job Alert" : title);
        bodyView.setText(isBlank(body) ? "A new emergency service request is waiting." : body);

        if (!isBlank(jobId)) {
            jobMetaView.setText("Job #" + jobId);
        } else {
            jobMetaView.setText("Immediate response required");
        }

        acceptButton.setOnClickListener(v -> onAccept());
        rejectButton.setOnClickListener(v -> onReject());
    }

    private void onAccept() {
        stopAlarmPlayback();
        cancelEmergencyNotification();
        launchMainActivity("accept");
        finish();
    }

    private void onReject() {
        stopAlarmPlayback();
        cancelEmergencyNotification();
        launchMainActivity("reject");
        finish();
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
        intent.putExtra("alert_action", action);
        if (!isBlank(jobId)) intent.putExtra("jobId", jobId);
        intent.putExtra("deepLinkPath", inAppPath);
        startActivity(intent);
    }

    private String buildInAppPath(String action) {
        String normalizedAction = isBlank(action) ? "" : action.trim().toLowerCase();
        String encodedJobId = isBlank(jobId) ? "" : Uri.encode(jobId.trim());

        if ("accept".equals(normalizedAction)) {
            if (!isBlank(encodedJobId)) {
                return "/technician/dashboard?alertAction=accept&jobId=" + encodedJobId;
            }
            return "/technician/dashboard?alertAction=accept";
        }

        if (!isBlank(deepLinkPath)) {
            String normalizedPath = deepLinkPath.trim();
            return normalizedPath.startsWith("/") ? normalizedPath : "/" + normalizedPath;
        }

        if (!isBlank(encodedJobId)) {
            return "/job/" + encodedJobId;
        }

        return "/technician/dashboard";
    }

    private String buildAppUrl(String path) {
        String normalizedPath = isBlank(path) ? "/technician/dashboard" : path.trim();
        if (!normalizedPath.startsWith("/")) {
            normalizedPath = "/" + normalizedPath;
        }
        return "resqnow://auth" + normalizedPath;
    }

    private void cancelEmergencyNotification() {
        if (notificationId >= 0) {
            NotificationManagerCompat.from(this).cancel(notificationId);
        }
    }

    private void startAlarmPlayback() {
        stopAlarmPlayback();
        try {
            mediaPlayer = MediaPlayer.create(this, R.raw.emergency_alarm);
            if (mediaPlayer != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                    mediaPlayer.setAudioAttributes(audioAttributes);
                }

                mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                    stopAlarmPlayback();
                    startFallbackAlarm();
                    return true;
                });
                mediaPlayer.setLooping(true);
                mediaPlayer.setVolume(1f, 1f);
                mediaPlayer.start();
                return;
            }
        } catch (Exception ignored) {
            // Fall through to ringtone fallback.
        }

        startFallbackAlarm();
    }

    private void startFallbackAlarm() {
        try {
            Uri primaryUri = EmergencyNotificationHelper.getEmergencySoundUri(this);
            fallbackRingtone = RingtoneManager.getRingtone(this, primaryUri);
            if (fallbackRingtone == null) {
                fallbackRingtone = RingtoneManager.getRingtone(this, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM));
            }
            if (fallbackRingtone == null) {
                fallbackRingtone = RingtoneManager.getRingtone(this, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION));
            }
            if (fallbackRingtone == null) return;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                fallbackRingtone.setLooping(true);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                fallbackRingtone.setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build()
                );
            }
            fallbackRingtone.play();
        } catch (Exception ignored) {
            // Last-resort fallback failed; keep the UI visible for manual accept/reject.
        }
    }

    private void stopAlarmPlayback() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
            } catch (Exception ignored) {
                // Ignore stop failures for already-released player states.
            }
            mediaPlayer.release();
            mediaPlayer = null;
        }

        if (fallbackRingtone != null) {
            try {
                if (fallbackRingtone.isPlaying()) {
                    fallbackRingtone.stop();
                }
            } catch (Exception ignored) {
                // Ignore fallback ringtone stop errors.
            }
            fallbackRingtone = null;
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
