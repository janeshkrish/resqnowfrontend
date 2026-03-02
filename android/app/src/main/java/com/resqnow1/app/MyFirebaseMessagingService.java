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
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

public class MyFirebaseMessagingService extends MessagingService {

    private static final AtomicInteger NOTIFICATION_ID = new AtomicInteger(1000);
    private static final String FALLBACK_TITLE = "Emergency Service Request";
    private static final String FALLBACK_BODY = "A nearby customer needs immediate assistance.";
    private static final String PAYLOAD_TYPE_EMERGENCY = "EMERGENCY_JOB";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        EmergencyNotificationHelper.ensureEmergencyChannel(this);

        if (isEmergencyPayload(remoteMessage)) {
            postEmergencyFullScreenNotification(remoteMessage);
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
        return "job_offer".equalsIgnoreCase(event) || "job:assigned".equalsIgnoreCase(event);
    }

    private boolean hasRenderableContent(RemoteMessage remoteMessage) {
        if (remoteMessage.getNotification() != null) {
            return true;
        }

        Map<String, String> data = remoteMessage.getData();
        return data != null && !data.isEmpty();
    }

    private void postEmergencyFullScreenNotification(RemoteMessage remoteMessage) {
        String title = resolveTitle(remoteMessage);
        String body = resolveBody(remoteMessage);
        int notificationId = resolveNotificationId(remoteMessage);

        Intent alertIntent = new Intent(this, AlertActivity.class);
        alertIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        alertIntent.putExtra(AlertActivity.EXTRA_NOTIFICATION_ID, notificationId);
        alertIntent.putExtra(AlertActivity.EXTRA_TITLE, title);
        alertIntent.putExtra(AlertActivity.EXTRA_BODY, body);
        alertIntent.putExtra(AlertActivity.EXTRA_JOB_ID, value(remoteMessage.getData(), "jobId"));
        alertIntent.putExtra(AlertActivity.EXTRA_DEEP_LINK_PATH, value(remoteMessage.getData(), "deepLinkPath"));

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

        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, intent, pendingIntentFlags());

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

        notificationManager.notify(resolveNotificationId(remoteMessage), builder.build());
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

    private int resolveNotificationId(RemoteMessage remoteMessage) {
        String messageId = remoteMessage.getMessageId();
        if (!isBlank(messageId)) {
            return messageId.hashCode();
        }
        return NOTIFICATION_ID.incrementAndGet();
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
