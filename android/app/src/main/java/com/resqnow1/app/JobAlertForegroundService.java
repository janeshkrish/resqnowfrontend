package com.resqnow1.app;

import android.app.KeyguardManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.res.AssetFileDescriptor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.IBinder;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

/**
 * Rings a job offer like an old landline phone (res/raw/job_ring.wav, the Indian double ring)
 * until the technician answers, the 30 seconds run out, or they silence it. The notification
 * shows the earning first, the job and the distance, a countdown, and Accept / Not this one.
 */
public class JobAlertForegroundService extends Service {

    public static final String ACTION_SHOW_ALERT = "com.resqnow1.app.action.SHOW_ALERT";
    public static final String ACTION_DISMISS_ALERT = "com.resqnow1.app.action.DISMISS_ALERT";
    /** Stops the ring and the vibration; the offer stays open. */
    public static final String ACTION_SILENCE = "com.resqnow1.app.action.SILENCE_ALERT";

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

    public static final long ALERT_TIMEOUT_MS = 30000L;
    private static final String ALERT_ACTION_ACCEPT = "accept";
    private static final String ALERT_ACTION_REJECT = "reject";

    private static volatile boolean ringing = false;

    private int activeNotificationId = -1;
    private String activeJobId = "";
    private MediaPlayer mediaPlayer = null;
    private Vibrator vibrator = null;
    private final Handler timeoutHandler = new Handler(Looper.getMainLooper());
    private final Handler ringHandler = new Handler(Looper.getMainLooper());
    private Runnable timeoutRunnable = null;
    private Runnable ringStarter = null;

    /** True while a job offer is ringing. */
    public static boolean isRinging() {
        return ringing;
    }

    /** Silences a ringing offer, e.g. from the volume buttons; the offer stays open. */
    public static void silence(Context context) {
        if (!ringing) return;
        try {
            context.startService(new Intent(context, JobAlertForegroundService.class).setAction(ACTION_SILENCE));
        } catch (Exception ignored) {
            // The service is gone already, so nothing is ringing.
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        NotificationChannels.ensureAll(this);

        String action = intent != null ? String.valueOf(intent.getAction()) : "";
        if (ACTION_DISMISS_ALERT.equals(action)) {
            dismissCurrentAlert(intent);
            return START_NOT_STICKY;
        }
        if (ACTION_SILENCE.equals(action)) {
            stopAlertFeedbackLoop();
            return START_NOT_STICKY;
        }

        showEmergencyAlert(intent);
        return START_NOT_STICKY;
    }

    private void showEmergencyAlert(Intent intent) {
        int notificationId = intent != null ? intent.getIntExtra(EXTRA_NOTIFICATION_ID, -1) : -1;
        String title = intent != null ? value(intent.getStringExtra(EXTRA_TITLE), "New job near you") : "New job near you";
        String body = intent != null ? value(intent.getStringExtra(EXTRA_BODY), "A customer nearby needs help.") : "A customer nearby needs help.";
        String jobId = intent != null ? value(intent.getStringExtra(EXTRA_JOB_ID), "") : "";
        String deepLinkPath = intent != null ? value(intent.getStringExtra(EXTRA_DEEP_LINK_PATH), "") : "";
        JobOffer offer = new JobOffer(
            intent != null ? intent.getStringExtra(EXTRA_SERVICE_TYPE) : "",
            intent != null ? intent.getStringExtra(EXTRA_PRICE_AMOUNT) : "",
            intent != null ? intent.getStringExtra(EXTRA_DISTANCE) : "",
            intent != null ? intent.getStringExtra(EXTRA_CUSTOMER_NAME) : ""
        );
        long now = System.currentTimeMillis();
        long expiresAt = intent != null ? intent.getLongExtra(EXTRA_EXPIRES_AT, 0L) : 0L;
        if (expiresAt <= now || expiresAt > now + ALERT_TIMEOUT_MS * 4) {
            expiresAt = now + ALERT_TIMEOUT_MS;
        }

        if (notificationId < 0) {
            notificationId = stableNotificationIdForJob(jobId);
        }

        Intent alertIntent = alertIntent(notificationId, title, body, jobId, deepLinkPath, offer, expiresAt);
        Intent openIntent = alertIntent(notificationId, title, body, jobId, deepLinkPath, offer, expiresAt)
            .putExtra(JobAlertActivity.EXTRA_OPEN_APP, true);
        Intent acceptIntent = alertIntent(notificationId, title, body, jobId, deepLinkPath, offer, expiresAt)
            .putExtra(JobAlertActivity.EXTRA_ALERT_ACTION, ALERT_ACTION_ACCEPT);
        Intent rejectIntent = alertIntent(notificationId, title, body, jobId, deepLinkPath, offer, expiresAt)
            .putExtra(JobAlertActivity.EXTRA_ALERT_ACTION, ALERT_ACTION_REJECT);

        PendingIntent fullScreenIntent = PendingIntent.getActivity(this, notificationId, alertIntent, pendingIntentFlags());
        PendingIntent openPendingIntent = PendingIntent.getActivity(this, notificationId + 3000, openIntent, pendingIntentFlags());
        PendingIntent acceptPendingIntent = PendingIntent.getActivity(this, notificationId + 1000, acceptIntent, pendingIntentFlags());
        PendingIntent rejectPendingIntent = PendingIntent.getActivity(this, notificationId + 2000, rejectIntent, pendingIntentFlags());

        // Older servers send only the title and body; newer ones the fields the offer is built from.
        boolean described = !offer.serviceType.isEmpty() || !offer.priceLabel().isEmpty();
        String shownTitle = described ? offer.title() : title;
        String shownText = described ? offer.text() : body;
        String shownBigText = described ? offer.bigText() : body;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, NotificationChannels.JOB_OFFERS)
            .setSmallIcon(R.drawable.ic_stat_resqnow)
            .setColor(ContextCompat.getColor(this, R.color.resq_crimson))
            .setContentTitle(shownTitle)
            .setContentText(shownText)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(shownBigText))
            .setSubText("New job")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            // The seconds left count down beside the app name.
            .setWhen(expiresAt)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setTimeoutAfter(expiresAt - now + 2000L)
            .setFullScreenIntent(fullScreenIntent, true)
            .setContentIntent(openPendingIntent)
            .addAction(0, "Accept", acceptPendingIntent)
            .addAction(0, "Not this one", rejectPendingIntent)
            .setVibrate(NotificationChannels.RING_VIBRATION);
        Bitmap picture = servicePicture(offer);
        if (picture != null) builder.setLargeIcon(picture);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(NotificationChannels.jobRingUri(this), AudioManager.STREAM_ALARM);
        }

        Notification notification = builder.build();
        startForeground(notificationId, notification);
        NotificationManagerCompat.from(this).notify(notificationId, notification);

        // A locked or sleeping phone gets the whole-screen offer. In use, the alert drops in at
        // the top instead of taking the screen away from what the technician is doing.
        if (lockedOrAsleep()) {
            try {
                startActivity(alertIntent);
            } catch (Exception ignored) {
                // Some phones block this; the full-screen notification still opens the offer.
            }
        }

        activeNotificationId = notificationId;
        activeJobId = jobId;

        startAlertFeedbackLoop();
        scheduleAlertTimeout(notificationId, jobId, expiresAt - now);
    }

    private Intent alertIntent(int notificationId, String title, String body, String jobId, String deepLinkPath, JobOffer offer, long expiresAt) {
        Intent intent = new Intent(this, JobAlertActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        intent.putExtra(JobAlertActivity.EXTRA_NOTIFICATION_ID, notificationId);
        intent.putExtra(JobAlertActivity.EXTRA_TITLE, title);
        intent.putExtra(JobAlertActivity.EXTRA_BODY, body);
        intent.putExtra(JobAlertActivity.EXTRA_JOB_ID, jobId);
        intent.putExtra(JobAlertActivity.EXTRA_DEEP_LINK_PATH, deepLinkPath);
        intent.putExtra(JobAlertActivity.EXTRA_SERVICE_TYPE, offer.serviceType);
        intent.putExtra(JobAlertActivity.EXTRA_PRICE_AMOUNT, offer.priceAmount);
        intent.putExtra(JobAlertActivity.EXTRA_DISTANCE, offer.distance);
        intent.putExtra(JobAlertActivity.EXTRA_CUSTOMER_NAME, offer.customerName);
        intent.putExtra(JobAlertActivity.EXTRA_EXPIRES_AT, expiresAt);
        return intent;
    }

    private boolean lockedOrAsleep() {
        KeyguardManager keyguard = getSystemService(KeyguardManager.class);
        PowerManager power = getSystemService(PowerManager.class);
        return (keyguard != null && keyguard.isKeyguardLocked()) || (power != null && !power.isInteractive());
    }

    private Bitmap servicePicture(JobOffer offer) {
        int res = getResources().getIdentifier(offer.pictureName(), "drawable", getPackageName());
        return res == 0 ? null : BitmapFactory.decodeResource(getResources(), res);
    }

    /**
     * Starts the ring and the vibration. When the channel itself rings (its first cycle plays
     * as the alert is posted), the loop picks up one cycle later, so the two never overlap.
     */
    private void startAlertFeedbackLoop() {
        stopAlertFeedbackLoop();
        ringing = true;
        long delay = channelRingsFirstCycle() ? NotificationChannels.RING_CYCLE_MS : 0L;
        ringStarter = () -> {
            startRing();
            startVibration();
        };
        ringHandler.postDelayed(ringStarter, delay);
    }

    private boolean channelRingsFirstCycle() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return false;
        NotificationChannel channel = manager.getNotificationChannel(NotificationChannels.JOB_OFFERS);
        boolean doNotDisturb = manager.getCurrentInterruptionFilter() != NotificationManager.INTERRUPTION_FILTER_ALL;
        return channel != null && !doNotDisturb && channel.getSound() != null && channel.getImportance() >= NotificationManager.IMPORTANCE_DEFAULT;
    }

    private void startRing() {
        try {
            MediaPlayer player = new MediaPlayer();
            player.setAudioAttributes(NotificationChannels.ringAttributes());
            AssetFileDescriptor file = getResources().openRawResourceFd(R.raw.job_ring);
            player.setDataSource(file.getFileDescriptor(), file.getStartOffset(), file.getLength());
            file.close();
            player.setLooping(true);
            player.setVolume(1.0f, 1.0f);
            player.prepare();
            player.start();
            mediaPlayer = player;
        } catch (Exception ignored) {
            releasePlayer();
        }
    }

    private void startVibration() {
        try {
            vibrator = (Vibrator) getSystemService(VIBRATOR_SERVICE);
            if (vibrator == null || !vibrator.hasVibrator()) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(NotificationChannels.RING_VIBRATION, 0));
            } else {
                vibrator.vibrate(NotificationChannels.RING_VIBRATION, 0);
            }
        } catch (Exception ignored) {
            // vibration is best-effort only.
        }
    }

    private void stopAlertFeedbackLoop() {
        ringing = false;
        if (ringStarter != null) {
            ringHandler.removeCallbacks(ringStarter);
            ringStarter = null;
        }
        releasePlayer();

        if (vibrator != null) {
            try {
                vibrator.cancel();
            } catch (Exception ignored) {
                // no-op
            }
            vibrator = null;
        }
    }

    private void releasePlayer() {
        if (mediaPlayer == null) return;
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

    private void scheduleAlertTimeout(int notificationId, String jobId, long afterMs) {
        clearAlertTimeout();
        timeoutRunnable = () -> {
            Intent timeoutDismissIntent = new Intent(this, JobAlertForegroundService.class);
            timeoutDismissIntent.setAction(ACTION_DISMISS_ALERT);
            timeoutDismissIntent.putExtra(EXTRA_NOTIFICATION_ID, notificationId);
            timeoutDismissIntent.putExtra(EXTRA_JOB_ID, jobId);
            dismissCurrentAlert(timeoutDismissIntent);
        };
        timeoutHandler.postDelayed(timeoutRunnable, Math.max(1000L, afterMs));
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
