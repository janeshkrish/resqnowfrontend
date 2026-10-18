package com.resqnow1.app;

import android.animation.Keyframe;
import android.animation.ObjectAnimator;
import android.animation.PropertyValuesHolder;
import android.animation.ValueAnimator;
import android.app.KeyguardManager;
import android.media.AudioManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.LinearInterpolator;
import android.widget.ImageView;
import android.widget.TextView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.view.WindowCompat;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Opened by a job alert. With the phone locked it shows the offer itself, over the lock screen:
 * the job and the earning, a ring that empties over the 30 seconds, Accept, Not this one and
 * Silence (design canvas, board 12). Otherwise, and for the notification's Accept and Not this
 * one buttons, it hands over to the app, which shows the offer card and sends the answer.
 */
public class JobAlertActivity extends AppCompatActivity {

    public static final String EXTRA_NOTIFICATION_ID = "extra_notification_id";
    public static final String EXTRA_TITLE = "extra_title";
    public static final String EXTRA_BODY = "extra_body";
    public static final String EXTRA_JOB_ID = "extra_job_id";
    public static final String EXTRA_DEEP_LINK_PATH = "extra_deep_link_path";
    public static final String EXTRA_ALERT_ACTION = "extra_alert_action";
    public static final String EXTRA_SERVICE_TYPE = "extra_service_type";
    public static final String EXTRA_PRICE_AMOUNT = "extra_price_amount";
    public static final String EXTRA_DISTANCE = "extra_distance";
    public static final String EXTRA_CUSTOMER_NAME = "extra_customer_name";
    public static final String EXTRA_EXPIRES_AT = "extra_expires_at";
    /** Set by a tap on the notification itself: open the app at the offer. */
    public static final String EXTRA_OPEN_APP = "extra_open_app";

    private static final String ALERT_ACTION_ACCEPT = "accept";
    private static final String ALERT_ACTION_REJECT = "reject";

    private static volatile JobAlertActivity activeAlertActivity = null;

    private int notificationId = -1;
    private String jobId = "";
    private String deepLinkPath = "";
    private String alertAction = "";
    private boolean openApp = false;
    private JobOffer offer = new JobOffer("", "", "", "");
    private long expiresAt = 0L;
    private boolean handledAction = false;
    private boolean relayedToMainApp = false;
    private boolean showingOffer = false;
    private boolean silenced = false;

    private final Handler ticker = new Handler(Looper.getMainLooper());
    private ObjectAnimator bellAnimator = null;
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            updateSeconds();
            if (showingOffer) ticker.postDelayed(this, 250L);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        activeAlertActivity = this;
        hydrateFromIntent();
        if (shouldShowOffer()) {
            showOffer();
            return;
        }
        configureLockScreenBehavior();
        relayToMainApp();
    }

    @Override
    protected void onNewIntent(android.content.Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        hydrateFromIntent();
        if (shouldShowOffer()) {
            showOffer();
            return;
        }
        configureLockScreenBehavior();
        relayedToMainApp = false;
        relayToMainApp();
    }

    @Override
    protected void onDestroy() {
        ticker.removeCallbacks(tick);
        if (bellAnimator != null) bellAnimator.cancel();
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

    /** The volume buttons silence the ring, as they do for a phone call. */
    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        boolean volumeKey = keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN || keyCode == KeyEvent.KEYCODE_VOLUME_MUTE;
        if (showingOffer && volumeKey && !silenced) {
            silence();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    /** The offer screen is for a locked phone; an unlocked one gets the app's own offer card. */
    private boolean shouldShowOffer() {
        if (openApp || !isBlank(alertAction)) return false;
        if (expiresAt > 0L && expiresAt <= System.currentTimeMillis()) return false;
        KeyguardManager keyguard = getSystemService(KeyguardManager.class);
        return keyguard != null && keyguard.isKeyguardLocked();
    }

    private void showOffer() {
        showingOffer = true;
        silenced = !JobAlertForegroundService.isRinging();
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        setContentView(R.layout.activity_alert);
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView()).setAppearanceLightStatusBars(true);

        String price = offer.priceLabel();
        ((TextView) findViewById(R.id.alertTitle)).setText(price.isEmpty() ? "New job" : price);
        findViewById(R.id.alertJobMeta).setVisibility(price.isEmpty() ? View.GONE : View.VISIBLE);
        ((TextView) findViewById(R.id.alertBody)).setText(offer.text());
        int picture = getResources().getIdentifier(offer.pictureName(), "drawable", getPackageName());
        if (picture != 0) ((ImageView) findViewById(R.id.alertPicture)).setImageResource(picture);

        long end = expiresAt > 0L ? expiresAt : System.currentTimeMillis() + 30000L;
        expiresAt = end;
        ((CountdownRingView) findViewById(R.id.alertRing)).start(SystemClock.elapsedRealtime() + (end - System.currentTimeMillis()));

        findViewById(R.id.alertAcceptButton).setOnClickListener(view -> acceptOnLockScreen());
        findViewById(R.id.alertRejectButton).setOnClickListener(view -> declineOnLockScreen());
        findViewById(R.id.alertSilence).setOnClickListener(view -> silence());

        ticker.removeCallbacks(tick);
        ticker.post(tick);
        renderRinging();
    }

    private void updateSeconds() {
        long left = Math.max(0L, (expiresAt - System.currentTimeMillis() + 999L) / 1000L);
        TextView seconds = findViewById(R.id.alertSeconds);
        if (seconds != null) {
            seconds.setText(String.format(Locale.ENGLISH, "%d:%02d", left / 60, left % 60));
            seconds.setContentDescription(left + " seconds left to accept");
        }
        if (left == 0L && showingOffer) {
            // The service closes the offer when its time is up; this only covers a missed signal.
            ticker.postDelayed(this::finishAlertActivity, 1500L);
            showingOffer = false;
        }
    }

    private void silence() {
        silenced = true;
        JobAlertForegroundService.silence(this);
        renderRinging();
    }

    private void renderRinging() {
        TextView silence = findViewById(R.id.alertSilence);
        TextView hint = findViewById(R.id.alertHint);
        View bell = findViewById(R.id.alertBell);
        if (silence == null || hint == null || bell == null) return;
        silence.setText(silenced ? "Silenced" : "Silence");
        silence.setEnabled(!silenced);
        silence.setAlpha(silenced ? 0.6f : 1f);
        hint.setText(silenced ? "Silenced · the offer is still open" : "Rings like a phone call · the volume button silences it");
        if (silenced) {
            if (bellAnimator != null) bellAnimator.cancel();
            bell.setRotation(0f);
        } else if (bellAnimator == null || !bellAnimator.isRunning()) {
            bellAnimator = bellTremble(bell);
            bellAnimator.start();
        }
    }

    /** The bell trembles in the ring's rhythm: two short shakes, then a pause, every 3 seconds. */
    private static ObjectAnimator bellTremble(View bell) {
        List<Keyframe> frames = new ArrayList<>();
        frames.add(Keyframe.ofFloat(0f, 0f));
        float[] bursts = { 0f, 0.6f / 3f };
        for (float start : bursts) {
            for (int i = 1; i <= 8; i++) {
                frames.add(Keyframe.ofFloat(start + i * 0.016f, i % 2 == 0 ? 13f : -13f));
            }
            frames.add(Keyframe.ofFloat(start + 0.4f / 3f, 0f));
        }
        frames.add(Keyframe.ofFloat(1f, 0f));
        // Swings from the top, like a bell on its hook (the icon is 20dp wide).
        bell.setPivotX(bell.getResources().getDisplayMetrics().density * 10f);
        bell.setPivotY(0f);
        ObjectAnimator animator = ObjectAnimator.ofPropertyValuesHolder(bell,
            PropertyValuesHolder.ofKeyframe(View.ROTATION, frames.toArray(new Keyframe[0])));
        animator.setDuration(NotificationChannels.RING_CYCLE_MS);
        animator.setRepeatCount(ValueAnimator.INFINITE);
        animator.setInterpolator(new LinearInterpolator());
        return animator;
    }

    /** Accept needs the app, so the phone is unlocked first; the ring stops at the tap. */
    private void acceptOnLockScreen() {
        silence();
        KeyguardManager keyguard = getSystemService(KeyguardManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && keyguard != null && keyguard.isKeyguardLocked()) {
            keyguard.requestDismissKeyguard(this, new KeyguardManager.KeyguardDismissCallback() {
                @Override
                public void onDismissSucceeded() {
                    handleAlertAction(ALERT_ACTION_ACCEPT);
                }
            });
            return;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD);
        }
        handleAlertAction(ALERT_ACTION_ACCEPT);
    }

    /**
     * Declining needs no unlock: the ring stops and the offer closes here. The server passes
     * it on when its time runs out, as it does for an offer left unanswered.
     */
    private void declineOnLockScreen() {
        if (handledAction) return;
        handledAction = true;
        showingOffer = false;
        cancelEmergencyNotification();
        stopForegroundAlertService();
        finishAlertActivity();
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
        openApp = intent.getBooleanExtra(EXTRA_OPEN_APP, false);
        offer = new JobOffer(
            stringExtra(intent, EXTRA_SERVICE_TYPE),
            stringExtra(intent, EXTRA_PRICE_AMOUNT),
            stringExtra(intent, EXTRA_DISTANCE),
            stringExtra(intent, EXTRA_CUSTOMER_NAME)
        );
        expiresAt = intent.getLongExtra(EXTRA_EXPIRES_AT, 0L);
    }

    private void relayToMainApp() {
        if (relayedToMainApp) return;
        relayedToMainApp = true;

        String normalizedAction = String.valueOf(alertAction == null ? "" : alertAction).trim().toLowerCase();
        if (ALERT_ACTION_ACCEPT.equals(normalizedAction) || ALERT_ACTION_REJECT.equals(normalizedAction)) {
            handleAlertAction(normalizedAction);
            return;
        }

        // Tapped on purpose: the technician is looking at the offer now, so the phone stops ringing.
        // (Opened by itself on a phone without a lock screen, it keeps ringing until answered.)
        if (openApp) JobAlertForegroundService.silence(this);
        launchMainActivity("");
        finishAlertActivity();
    }

    private void handleAlertAction(String action) {
        if (handledAction) return;
        handledAction = true;
        showingOffer = false;
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
