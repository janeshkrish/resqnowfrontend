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

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        EmergencyNotificationHelper.ensureEmergencyChannel(this);

        if (isRevocationPayload(remoteMessage)) {
            dismissEmergencyAlert(remoteMessage);
            return;
        }

        if (isEmergencyPayload(remoteMessage)) {
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

        AlertActivity.dismissActiveAlertForJob(jobId);
    }

    private void postEmergencyFullScreenNotification(RemoteMessage remoteMessage, String jobId) {
        String title = resolveTitle(remoteMessage);
        String body = resolveBody(remoteMessage);
        int notificationId = resolveNotificationId(remoteMessage, jobId);

        Intent alertIntent = buildAlertIntent(remoteMessage, title, body, notificationId, jobId);
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
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(false)
            .setFullScreenIntent(fullScreenIntent, true)
            .setContentIntent(fullScreenIntent)
            .setVibrate(new long[] { 0L, 500L, 250L, 500L, 250L, 500L });

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(EmergencyNotificationHelper.getEmergencySoundUri(this));
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ActivityCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        NotificationManagerCompat.from(this).notify(notificationId, builder.build());

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

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, EmergencyNotificationHelper.CHANNEL_ID)
            .setSmallIcon(resolveSmallIcon())
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .setDefaults(NotificationCompat.DEFAULT_VIBRATE)
            .setVibrate(new long[] { 0L, 500L, 250L, 500L });

        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            builder.setSound(EmergencyNotificationHelper.getEmergencySoundUri(this));
        }

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
        Intent alertIntent = new Intent(this, AlertActivity.class);
        alertIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        alertIntent.putExtra(AlertActivity.EXTRA_NOTIFICATION_ID, notificationId);
        alertIntent.putExtra(AlertActivity.EXTRA_TITLE, title);
        alertIntent.putExtra(AlertActivity.EXTRA_BODY, body);
        alertIntent.putExtra(AlertActivity.EXTRA_JOB_ID, isBlank(resolvedJobId) ? resolveJobId(remoteMessage) : resolvedJobId);
        alertIntent.putExtra(AlertActivity.EXTRA_DEEP_LINK_PATH, value(remoteMessage.getData(), "deepLinkPath"));
        return alertIntent;
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
        return ("job:" + String(jobId).trim()).hashCode();
    }

    private int resolveSmallIcon() {
        int applicationIcon = getApplicationInfo().icon;
        return applicationIcon != 0 ? applicationIcon : android.R.drawable.ic_dialog_alert;
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
