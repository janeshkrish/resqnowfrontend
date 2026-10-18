package com.resqnow1.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.ContentResolver;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

/**
 * The app's notification channels. Each kind of message has its own, so people can tune them in
 * Settings: a job offer rings like a phone, a trip update stays quiet, and only the moments that
 * matter on a trip make a sound.
 */
public final class NotificationChannels {

    /** A new job for a technician: rings like an old landline phone until answered. */
    public static final String JOB_OFFERS = "job_offers";
    /** The customer's request, one notification that updates as the job moves. Silent. */
    public static final String TRIP_LIVE = "trip_live";
    /** Short alerts on a trip: a technician is found, has arrived, the bill is ready. */
    public static final String TRIP_ALERTS = "trip_alerts";
    /** Everything else: receipts, ratings, messages from the team. */
    public static final String UPDATES = "updates";

    /** The single alarm channel earlier versions used for every message. */
    static final String LEGACY_ALARM_CHANNEL = "high_priority_alarms";

    /**
     * The landline ring: 0.4 s on, 0.2 s off, 0.4 s on, 2 s off. The vibration follows the same
     * rhythm, and the sound file (res/raw/job_ring.wav) is exactly one 3-second cycle.
     */
    public static final long[] RING_VIBRATION = new long[] { 0L, 400L, 200L, 400L, 2000L };
    public static final long RING_CYCLE_MS = 3000L;

    private NotificationChannels() {}

    public static Uri jobRingUri(Context context) {
        return Uri.parse(ContentResolver.SCHEME_ANDROID_RESOURCE + "://" + context.getPackageName() + "/" + R.raw.job_ring);
    }

    /** Audio for the job ring: the alarm stream, so it is heard with the ringer on silent. */
    public static AudioAttributes ringAttributes() {
        return new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
    }

    public static void ensureAll(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        if (manager == null) return;

        if (manager.getNotificationChannel(LEGACY_ALARM_CHANNEL) != null) {
            manager.deleteNotificationChannel(LEGACY_ALARM_CHANNEL);
        }

        if (manager.getNotificationChannel(JOB_OFFERS) == null) {
            NotificationChannel offers = new NotificationChannel(JOB_OFFERS, "Job offers", NotificationManager.IMPORTANCE_HIGH);
            offers.setDescription("Rings like a phone call when a new job comes in, until you answer.");
            offers.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            offers.enableVibration(true);
            offers.setVibrationPattern(RING_VIBRATION);
            offers.setSound(jobRingUri(context), ringAttributes());
            manager.createNotificationChannel(offers);
        }

        if (manager.getNotificationChannel(TRIP_LIVE) == null) {
            NotificationChannel live = new NotificationChannel(TRIP_LIVE, "Live trip", NotificationManager.IMPORTANCE_DEFAULT);
            live.setDescription("Your request, kept up to date at the top of the screen.");
            live.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            live.setSound(null, null);
            live.enableVibration(false);
            live.setShowBadge(false);
            manager.createNotificationChannel(live);
        }

        if (manager.getNotificationChannel(TRIP_ALERTS) == null) {
            NotificationChannel alerts = new NotificationChannel(TRIP_ALERTS, "Trip alerts", NotificationManager.IMPORTANCE_HIGH);
            alerts.setDescription("When a technician is found, arrives, or the bill is ready.");
            alerts.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            alerts.enableVibration(true);
            alerts.setVibrationPattern(new long[] { 0L, 180L, 120L, 180L });
            manager.createNotificationChannel(alerts);
        }

        if (manager.getNotificationChannel(UPDATES) == null) {
            NotificationChannel updates = new NotificationChannel(UPDATES, "Other updates", NotificationManager.IMPORTANCE_DEFAULT);
            updates.setDescription("Receipts, ratings and messages from ResQNow.");
            manager.createNotificationChannel(updates);
        }
    }
}
