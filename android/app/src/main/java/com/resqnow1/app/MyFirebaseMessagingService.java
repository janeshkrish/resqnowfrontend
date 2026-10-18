package com.resqnow1.app;

import android.Manifest;
import android.app.ActivityManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

public class MyFirebaseMessagingService extends MessagingService {

    private static final AtomicInteger NOTIFICATION_ID = new AtomicInteger(1000);
    private static final String FALLBACK_TITLE = "Emergency Service Request";
    private static final String FALLBACK_BODY = "A nearby customer needs immediate assistance.";

    private static final String EVENT_JOB_OFFER = "job_offer";
    private static final String EVENT_JOB_ASSIGNED = "job:assigned";
    private static final String EVENT_JOB_REVOKED = "job:revoked";
    private static final String PAYLOAD_TYPE_EMERGENCY = "EMERGENCY_JOB";
    private static final String PAYLOAD_TYPE_REVOKED = "JOB_REVOKED";
    private static final String ALERT_ACTION_ACCEPT = "accept";
    private static final String ALERT_ACTION_REJECT = "reject";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        NotificationChannels.ensureAll(this);

        // A customer's request moved on: update its Live Update, whether or not the app is open.
        if (TripUpdateNotifier.isTripPush(remoteMessage.getData())) {
            TripUpdateNotifier.fromPush(this, remoteMessage.getData(), MainActivity.isOnScreen());
            return;
        }

        if (isRevocationPayload(remoteMessage)) {
            dismissEmergencyAlert(remoteMessage);
            return;
        }

        if (isAcceptedAssignmentPayload(remoteMessage)) {
            dismissEmergencyAlert(remoteMessage);
            return;
        }

        if (isEmergencyPayload(remoteMessage)) {
            // With the app on screen the in-app card shows the offer: from the socket, or from
            // this push, which super.onMessageReceived passed to the web layer (useFCM).
            if (MainActivity.isOnScreen()) {
                return;
            }
            launchEmergencyForegroundAlert(remoteMessage);
            return;
        }

        boolean hasNotificationPayload = remoteMessage.getNotification() != null;
        if (hasNotificationPayload && !isAppInForeground()) {
            // For background/terminated notification payloads, let FCM/system render.
            return;
        }

        if (!hasRenderableContent(remoteMessage)) {
            return;
        }

        postEmergencyNotification(remoteMessage);
    }

    private boolean isEmergencyPayload(RemoteMessage remoteMessage) {
        String type = value(remoteMessage.getData(), "type");
        if (PAYLOAD_TYPE_EMERGENCY.equalsIgnoreCase(type)) {
            return true;
        }

        String event = value(remoteMessage.getData(), "event");
        return EVENT_JOB_OFFER.equalsIgnoreCase(event) || EVENT_JOB_ASSIGNED.equalsIgnoreCase(event);
    }

    private boolean isRevocationPayload(RemoteMessage remoteMessage) {
        String type = value(remoteMessage.getData(), "type");
        if (PAYLOAD_TYPE_REVOKED.equalsIgnoreCase(type)) {
            return true;
        }

        String event = value(remoteMessage.getData(), "event");
        return EVENT_JOB_REVOKED.equalsIgnoreCase(event);
    }

    private boolean isAcceptedAssignmentPayload(RemoteMessage remoteMessage) {
        String event = value(remoteMessage.getData(), "event");
        if (!EVENT_JOB_ASSIGNED.equalsIgnoreCase(event)) {
            return false;
        }

        String status = value(remoteMessage.getData(), "status");
        return "accepted".equalsIgnoreCase(status);
    }

    private boolean hasRenderableContent(RemoteMessage remoteMessage) {
        if (remoteMessage.getNotification() != null) {
            return true;
        }

        Map<String, String> data = remoteMessage.getData();
        return data != null && !data.isEmpty();
    }

    private void launchEmergencyForegroundAlert(RemoteMessage remoteMessage) {
        String title = resolveTitle(remoteMessage);
        String body = resolveBody(remoteMessage);
        String jobId = resolveJobId(remoteMessage);
        String deepLinkPath = value(remoteMessage.getData(), "deepLinkPath");
        int notificationId = resolveNotificationId(remoteMessage, jobId);

        Intent serviceIntent = new Intent(this, JobAlertForegroundService.class);
        serviceIntent.setAction(JobAlertForegroundService.ACTION_SHOW_ALERT);
        serviceIntent.putExtra(JobAlertForegroundService.EXTRA_NOTIFICATION_ID, notificationId);
        serviceIntent.putExtra(JobAlertForegroundService.EXTRA_TITLE, title);
        serviceIntent.putExtra(JobAlertForegroundService.EXTRA_BODY, body);
        serviceIntent.putExtra(JobAlertForegroundService.EXTRA_JOB_ID, jobId);
        serviceIntent.putExtra(JobAlertForegroundService.EXTRA_DEEP_LINK_PATH, deepLinkPath);
        serviceIntent.putExtra(JobAlertForegroundService.EXTRA_SERVICE_TYPE, value(remoteMessage.getData(), "serviceType"));
        serviceIntent.putExtra(JobAlertForegroundService.EXTRA_PRICE_AMOUNT, value(remoteMessage.getData(), "priceAmount"));
        serviceIntent.putExtra(JobAlertForegroundService.EXTRA_DISTANCE, value(remoteMessage.getData(), "locationDistance"));
        serviceIntent.putExtra(JobAlertForegroundService.EXTRA_CUSTOMER_NAME, value(remoteMessage.getData(), "customerName"));
        serviceIntent.putExtra(JobAlertForegroundService.EXTRA_EXPIRES_AT, offerExpiresAt(remoteMessage));

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(this, serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (Exception serviceError) {
            // Fallback to direct full-screen notification if service start is blocked.
            postEmergencyFullScreenNotification(remoteMessage, jobId);
        }
    }

    private void dismissEmergencyAlert(RemoteMessage remoteMessage) {
        String jobId = resolveJobId(remoteMessage);
        int fallbackNotificationId = resolveNotificationId(remoteMessage, jobId);

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
        notificationManager.cancel(fallbackNotificationId);

        if (!isBlank(jobId)) {
            notificationManager.cancel(stableNotificationIdForJob(jobId));
        }

        Intent dismissIntent = new Intent(this, JobAlertForegroundService.class);
        dismissIntent.setAction(JobAlertForegroundService.ACTION_DISMISS_ALERT);
        dismissIntent.putExtra(JobAlertForegroundService.EXTRA_NOTIFICATION_ID, fallbackNotificationId);
        dismissIntent.putExtra(JobAlertForegroundService.EXTRA_JOB_ID, jobId);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(this, dismissIntent);
            } else {
                startService(dismissIntent);
            }
        } catch (Exception ignored) {
            // Best effort; direct notification cancellation already ran.
        }

        JobAlertActivity.dismissActiveAlertForJob(jobId);
    }

    /** When the offer closes: the push's own expiry when it has one, else 30 seconds from now. */
    private long offerExpiresAt(RemoteMessage remoteMessage) {
        long now = System.currentTimeMillis();
        String raw = value(remoteMessage.getData(), "expiresAt");
        if (raw.isEmpty()) raw = value(remoteMessage.getData(), "offerExpiresAt");
        long at = 0L;
        try {
            at = Long.parseLong(raw.trim());
        } catch (NumberFormatException notEpoch) {
            try {
                at = java.time.Instant.parse(raw.trim()).toEpochMilli();
            } catch (Exception notIso) {
                at = 0L;
            }
        }
        boolean usable = at > now + 3000L && at <= now + JobAlertForegroundService.ALERT_TIMEOUT_MS * 4;
        return usable ? at : now + JobAlertForegroundService.ALERT_TIMEOUT_MS;
    }

    private void postEmergencyFullScreenNotification(RemoteMessage remoteMessage, String jobId) {
        String title = resolveTitle(remoteMessage);
        String body = resolveBody(remoteMessage);
        JobOffer offer = new JobOffer(
            value(remoteMessage.getData(), "serviceType"),
            value(remoteMessage.getData(), "priceAmount"),
            value(remoteMessage.getData(), "locationDistance"),
            value(remoteMessage.getData(), "customerName")
        );
        if (!offer.serviceType.isEmpty() || !offer.priceLabel().isEmpty()) {
            title = offer.title();
            body = offer.text();
        }
        int notificationId = resolveNotificationId(remoteMessage, jobId);

        Intent alertIntent = buildAlertIntent(remoteMessage, title, body, notificationId, jobId);
        Intent acceptIntent = buildActionIntent(
            remoteMessage,
            title,
            body,
            notificationId,
            jobId,
            ALERT_ACTION_ACCEPT
        );
        Intent rejectIntent = buildActionIntent(
            remoteMessage,
            title,
            body,
            notificationId,
            jobId,
            ALERT_ACTION_REJECT
        );

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

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, NotificationChannels.JOB_OFFERS)
            .setSmallIcon(resolveSmallIcon())
            .setColor(ContextCompat.getColor(this, R.color.resq_crimson))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setTimeoutAfter(JobAlertForegroundService.ALERT_TIMEOUT_MS)
            .setFullScreenIntent(fullScreenIntent, true)
            .setContentIntent(fullScreenIntent)
            .addAction(0, "Accept", acceptPendingIntent)
            .addAction(0, "Not this one", rejectPendingIntent)
            .setVibrate(NotificationChannels.RING_VIBRATION);

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(NotificationChannels.jobRingUri(this), android.media.AudioManager.STREAM_ALARM);
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        // Without the service to loop it, the channel's ring repeats until the offer is answered.
        android.app.Notification notification = builder.build();
        notification.flags |= android.app.Notification.FLAG_INSISTENT;
        NotificationManagerCompat.from(this).notify(notificationId, notification);

        if (isAppInForeground()) {
            startActivity(alertIntent);
        }
    }

    private void postEmergencyNotification(RemoteMessage remoteMessage) {
        String title = resolveTitle(remoteMessage);
        String body = resolveBody(remoteMessage);
        Intent intent = buildLaunchIntent(remoteMessage);
        int notificationId = resolveNotificationId(remoteMessage, resolveJobId(remoteMessage));

        PendingIntent pendingIntent = PendingIntent.getActivity(this, notificationId, intent, pendingIntentFlags());

        // Receipts, ratings and messages: an ordinary notification, not the job ring.
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, NotificationChannels.UPDATES)
            .setSmallIcon(resolveSmallIcon())
            .setColor(ContextCompat.getColor(this, R.color.resq_crimson))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent);

        NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        notificationManager.notify(notificationId, builder.build());
    }

    private Intent buildAlertIntent(
        RemoteMessage remoteMessage,
        String title,
        String body,
        int notificationId,
        String resolvedJobId
    ) {
        Intent alertIntent = new Intent(this, JobAlertActivity.class);
        alertIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        alertIntent.putExtra(JobAlertActivity.EXTRA_NOTIFICATION_ID, notificationId);
        alertIntent.putExtra(JobAlertActivity.EXTRA_TITLE, title);
        alertIntent.putExtra(JobAlertActivity.EXTRA_BODY, body);
        alertIntent.putExtra(JobAlertActivity.EXTRA_JOB_ID, isBlank(resolvedJobId) ? resolveJobId(remoteMessage) : resolvedJobId);
        alertIntent.putExtra(JobAlertActivity.EXTRA_DEEP_LINK_PATH, value(remoteMessage.getData(), "deepLinkPath"));
        return alertIntent;
    }

    private Intent buildActionIntent(
        RemoteMessage remoteMessage,
        String title,
        String body,
        int notificationId,
        String resolvedJobId,
        String action
    ) {
        Intent actionIntent = buildAlertIntent(remoteMessage, title, body, notificationId, resolvedJobId);
        actionIntent.putExtra(JobAlertActivity.EXTRA_ALERT_ACTION, action);
        return actionIntent;
    }

    private int pendingIntentFlags() {
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return flags;
    }

    private Intent buildLaunchIntent(RemoteMessage remoteMessage) {
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

        String messageId = remoteMessage.getMessageId();
        if (isBlank(messageId)) {
            messageId = String.valueOf(System.currentTimeMillis());
        }
        intent.putExtra("google.message_id", messageId);

        for (Map.Entry<String, String> entry : remoteMessage.getData().entrySet()) {
            intent.putExtra(entry.getKey(), entry.getValue());
        }

        return intent;
    }

    private int resolveNotificationId(RemoteMessage remoteMessage, String stableJobId) {
        if (!isBlank(stableJobId)) {
            return stableNotificationIdForJob(stableJobId);
        }
        String messageId = remoteMessage.getMessageId();
        if (!isBlank(messageId)) {
            return messageId.hashCode();
        }
        return NOTIFICATION_ID.incrementAndGet();
    }

    private int stableNotificationIdForJob(String jobId) {
        return ("job:" + jobId.trim()).hashCode();
    }

    private int resolveSmallIcon() {
        return R.drawable.ic_stat_resqnow;
    }

    private String resolveTitle(RemoteMessage remoteMessage) {
        if (remoteMessage.getNotification() != null && !isBlank(remoteMessage.getNotification().getTitle())) {
            return remoteMessage.getNotification().getTitle();
        }

        String fromData = value(remoteMessage.getData(), "title");
        return isBlank(fromData) ? FALLBACK_TITLE : fromData;
    }

    private String resolveBody(RemoteMessage remoteMessage) {
        if (remoteMessage.getNotification() != null && !isBlank(remoteMessage.getNotification().getBody())) {
            return remoteMessage.getNotification().getBody();
        }

        String fromData = value(remoteMessage.getData(), "body");
        return isBlank(fromData) ? FALLBACK_BODY : fromData;
    }

    private String resolveJobId(RemoteMessage remoteMessage) {
        String fromJobId = value(remoteMessage.getData(), "jobId");
        if (!isBlank(fromJobId)) return fromJobId;
        return value(remoteMessage.getData(), "requestId");
    }

    private boolean isAppInForeground() {
        ActivityManager.RunningAppProcessInfo appProcessInfo = new ActivityManager.RunningAppProcessInfo();
        ActivityManager.getMyMemoryState(appProcessInfo);
        int importance = appProcessInfo.importance;
        return importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
            || importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_VISIBLE;
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private String value(Map<String, String> data, String key) {
        if (data == null || key == null) return "";
        String v = data.get(key);
        return v == null ? "" : v;
    }
}
