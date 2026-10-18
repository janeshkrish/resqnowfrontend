package com.resqnow1.app;

import android.Manifest;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.IconCompat;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.json.JSONObject;

/**
 * The customer's Live Update: one notification per request that changes as the job moves.
 * On Android 16 it is promoted to the top of the shade and the status bar shows its chip
 * ("6 min", "Here"); on older phones it is an ordinary ongoing notification with a progress
 * bar. A short alert with sound marks the moments that matter: a technician is found, has
 * arrived, the bill is ready, or the request was cancelled.
 */
public final class TripUpdateNotifier {

    private static final String TAG = "TripUpdateNotifier";
    private static final String PREFS = "resqnow_trip_updates";
    private static final String KEY_STATE = "state";
    private static final String KEY_ALERTED = "alerted_";
    private static final long ALERT_SHOWS_MS = 12000L;

    private TripUpdateNotifier() {}

    /** True for a server push about a customer's request (see notificationService.js). */
    public static boolean isTripPush(Map<String, String> data) {
        if (data == null) return false;
        return "TRIP_UPDATE".equalsIgnoreCase(value(data, "type")) && !value(data, "requestId").isEmpty();
    }

    public static void fromPush(Context context, Map<String, String> data, boolean appOnScreen) {
        TripState state = TripState.fromPush(
            value(data, "requestId"),
            value(data, "status"),
            value(data, "title"),
            value(data, "body"),
            value(data, "technicianName"),
            value(data, "technicianPhone"),
            value(data, "serviceType"),
            System.currentTimeMillis()
        );
        String path = value(data, "deepLinkPath");
        if (!path.isEmpty()) state.deepLinkPath = path;
        post(context, state, appOnScreen);
    }

    /** Shows or updates the trip, merged with what is already shown. */
    public static synchronized void post(Context context, TripState next, boolean appOnScreen) {
        if (next == null || next.requestId.isEmpty()) return;
        NotificationChannels.ensureAll(context);
        TripState previous = load(context);
        TripState state = TripState.merge(previous, next);
        save(context, state);

        if (!canNotify(context)) return;
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        try {
            manager.notify(liveId(state.requestId), buildLive(context, state));
            boolean newStage = previous == null || !previous.requestId.equals(state.requestId) || !previous.phase.equals(state.phase);
            String alertedKey = KEY_ALERTED + state.requestId;
            SharedPreferences prefs = prefs(context);
            if (newStage && !appOnScreen && state.deservesAlert() && !state.phase.equals(prefs.getString(alertedKey, ""))) {
                manager.notify(alertId(state.requestId), buildAlert(context, state));
                prefs.edit().putString(alertedKey, state.phase).apply();
            }
        } catch (SecurityException denied) {
            Log.w(TAG, "Notification permission was withdrawn", denied);
        }
    }

    public static void cancel(Context context, String requestId) {
        if (requestId == null || requestId.trim().isEmpty()) return;
        NotificationManagerCompat manager = NotificationManagerCompat.from(context);
        manager.cancel(liveId(requestId.trim()));
        manager.cancel(alertId(requestId.trim()));
        TripState stored = load(context);
        if (stored != null && stored.requestId.equals(requestId.trim())) {
            prefs(context).edit().remove(KEY_STATE).apply();
        }
    }

    static int liveId(String requestId) {
        return ("trip:" + requestId).hashCode();
    }

    static int alertId(String requestId) {
        return ("trip-alert:" + requestId).hashCode();
    }

    private static android.app.Notification buildLive(Context context, TripState state) {
        boolean active = state.isActive();
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, NotificationChannels.TRIP_LIVE)
            .setSmallIcon(R.drawable.ic_stat_resqnow)
            .setColor(ContextCompat.getColor(context, R.color.resq_crimson))
            .setContentTitle(state.title)
            .setContentText(state.text)
            .setSubText(serviceLabel(state.service))
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOnlyAlertOnce(true)
            .setOngoing(active)
            .setAutoCancel(!active)
            .setRequestPromotedOngoing(active)
            .setContentIntent(openApp(context, state.deepLinkPath, liveId(state.requestId)))
            .setLargeIcon(picture(context, state));

        String chip = state.chip;
        if (("way".equals(state.phase) || "accepted".equals(state.phase)) && TripState.SOURCE_PUSH.equals(state.source) && state.arrivalAt > 0L) {
            chip = TripState.minutesUntil(state.arrivalAt, System.currentTimeMillis());
        }
        if ("working".equals(state.phase) && state.startedAt > 0L && chip.isEmpty()) {
            // No words in the chip: Android shows the running work timer instead.
            builder.setWhen(state.startedAt).setShowWhen(true).setUsesChronometer(true);
        } else {
            builder.setShowWhen(false);
        }
        if (active && !chip.isEmpty()) builder.setShortCriticalText(chip);

        if (active) builder.setStyle(progressStyle(context, state));
        else builder.setStyle(new NotificationCompat.BigTextStyle().bigText(state.text));

        for (NotificationCompat.Action action : actions(context, state)) builder.addAction(action);

        if (!active) {
            // A finished trip stays a while for the receipt or the rating, then goes.
            builder.setTimeoutAfter("cancelled".equals(state.phase) ? 30L * 60000L : 45L * 60000L);
        }
        return builder.build();
    }

    private static NotificationCompat.Style progressStyle(Context context, TripState state) {
        int color = ContextCompat.getColor(context, "ok".equals(state.tone) ? R.color.resq_green : "warn".equals(state.tone) ? R.color.resq_amber : R.color.resq_crimson);
        List<NotificationCompat.ProgressStyle.Segment> segments = new ArrayList<>();
        for (int i = 0; i < 4; i++) segments.add(new NotificationCompat.ProgressStyle.Segment(25).setColor(color));
        List<NotificationCompat.ProgressStyle.Point> points = new ArrayList<>();
        for (int at = 25; at < 100; at += 25) points.add(new NotificationCompat.ProgressStyle.Point(at).setColor(color));
        NotificationCompat.ProgressStyle style = new NotificationCompat.ProgressStyle()
            .setStyledByProgress(true)
            .setProgressSegments(segments)
            .setProgressPoints(points)
            .setProgress(Math.max(0, Math.min(100, state.progress)))
            .setProgressIndeterminate(state.indeterminate)
            .setProgressStartIcon(IconCompat.createWithResource(context, R.drawable.ic_trip_person))
            .setProgressEndIcon(IconCompat.createWithResource(context, R.drawable.ic_trip_pin));
        int tracker = trackerIcon(state.tracker);
        if (tracker != 0 && !state.indeterminate) style.setProgressTrackerIcon(IconCompat.createWithResource(context, tracker));
        return style;
    }

    private static int trackerIcon(String tracker) {
        switch (tracker == null ? "" : tracker) {
            case "bike": return R.drawable.ic_trip_bike;
            case "truck": return R.drawable.ic_trip_truck;
            case "check": return R.drawable.ic_trip_check;
            case "build": return R.drawable.ic_trip_build;
            default: return 0;
        }
    }

    private static List<NotificationCompat.Action> actions(Context context, TripState state) {
        List<NotificationCompat.Action> list = new ArrayList<>();
        String base = state.deepLinkPath.isEmpty() ? "/service-tracking/" + state.requestId : state.deepLinkPath;
        boolean technicianMatters = "accepted".equals(state.phase) || "way".equals(state.phase) || "arrived".equals(state.phase)
            || "working".equals(state.phase) || "loaded".equals(state.phase) || "towing".equals(state.phase);
        if (technicianMatters && !state.technicianPhone.isEmpty()) {
            Intent dial = new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + state.technicianPhone.replaceAll("[^0-9+]", "")));
            dial.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            PendingIntent call = PendingIntent.getActivity(context, liveId(state.requestId) + 11, dial, flags());
            list.add(new NotificationCompat.Action.Builder(0, "Call " + state.firstName(), call).build());
        }
        if ("pay".equals(state.phase)) {
            String label = state.amountLabel.isEmpty() ? "Pay now" : "Pay " + state.amountLabel;
            list.add(new NotificationCompat.Action.Builder(0, label, openApp(context, base, liveId(state.requestId) + 12)).build());
        }
        if ("rate".equals(state.phase)) {
            list.add(new NotificationCompat.Action.Builder(0, "Rate " + state.firstName(), openApp(context, base, liveId(state.requestId) + 13)).build());
        }
        return list;
    }

    private static android.app.Notification buildAlert(Context context, TripState state) {
        String title = state.alertTitle.isEmpty() ? state.title : state.alertTitle;
        String text = state.alertText.isEmpty() ? state.text : state.alertText;
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, NotificationChannels.TRIP_ALERTS)
            .setSmallIcon(R.drawable.ic_stat_resqnow)
            .setColor(ContextCompat.getColor(context, R.color.resq_crimson))
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setSubText(serviceLabel(state.service))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setLargeIcon(picture(context, state))
            .setContentIntent(openApp(context, state.deepLinkPath, alertId(state.requestId)));
        // It says its piece and folds back into the Live Update, except a cancellation.
        if (!"cancelled".equals(state.phase)) builder.setTimeoutAfter(ALERT_SHOWS_MS);
        for (NotificationCompat.Action action : actions(context, state)) builder.addAction(action);
        return builder.build();
    }

    private static PendingIntent openApp(Context context, String path, int requestCode) {
        String route = path == null || path.trim().isEmpty() ? "/" : path.trim();
        if (!route.startsWith("/")) route = "/" + route;
        Intent intent = new Intent(context, MainActivity.class);
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("resqnow://auth" + route));
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(context, requestCode, intent, flags());
    }

    private static int flags() {
        return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    }

    /** The 3D service picture, with the technician's initials on a small badge once known. */
    private static Bitmap picture(Context context, TripState state) {
        int size = Math.round(context.getResources().getDisplayMetrics().density * 64);
        Bitmap out = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(out);
        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        paint.setColor(0xFFF2F4F8);
        float radius = size * 0.3f;
        canvas.drawRoundRect(new RectF(0, 0, size, size), radius, radius, paint);
        int res = context.getResources().getIdentifier(JobOffer.servicePicture(state.service), "drawable", context.getPackageName());
        Bitmap art = res == 0 ? null : BitmapFactory.decodeResource(context.getResources(), res);
        if (art != null) {
            float box = size * 0.78f;
            float scale = Math.min(box / art.getWidth(), box / art.getHeight());
            float w = art.getWidth() * scale;
            float h = art.getHeight() * scale;
            float left = (size - w) / 2f;
            float top = (size - h) / 2f;
            canvas.drawBitmap(art, new Rect(0, 0, art.getWidth(), art.getHeight()), new RectF(left, top, left + w, top + h), new Paint(Paint.FILTER_BITMAP_FLAG));
        }
        String initials = state.initials();
        boolean showBadge = !initials.isEmpty() && TripState.rank(state.phase) >= TripState.rank("accepted") && TripState.rank(state.phase) <= TripState.rank("towing");
        if (showBadge) {
            float r = size * 0.2f;
            float cx = r + size * 0.04f;
            float cy = size - r - size * 0.04f;
            paint.setColor(0xFFFFFFFF);
            canvas.drawCircle(cx, cy, r + size * 0.035f, paint);
            paint.setColor("ok".equals(state.tone) ? 0xFF067647 : 0xFF283048);
            canvas.drawCircle(cx, cy, r, paint);
            Paint text = new Paint(Paint.ANTI_ALIAS_FLAG);
            text.setColor(0xFFFFFFFF);
            text.setTypeface(Typeface.DEFAULT_BOLD);
            text.setTextSize(r * 0.95f);
            text.setTextAlign(Paint.Align.CENTER);
            Paint.FontMetrics metrics = text.getFontMetrics();
            canvas.drawText(initials, cx, cy - (metrics.ascent + metrics.descent) / 2f, text);
        }
        return out;
    }

    /** "Flat tyre", for the line beside the app name. */
    private static String serviceLabel(String service) {
        if (service == null || service.trim().isEmpty()) return null;
        return new JobOffer(service, "", "", "").serviceName();
    }

    private static boolean canNotify(Context context) {
        if (!NotificationManagerCompat.from(context).areNotificationsEnabled()) return false;
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU
            || ActivityCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static TripState load(Context context) {
        String raw = prefs(context).getString(KEY_STATE, null);
        if (raw == null) return null;
        try {
            JSONObject json = new JSONObject(raw);
            TripState s = new TripState();
            s.requestId = json.optString("requestId", "");
            s.phase = json.optString("phase", "other");
            s.title = json.optString("title", "");
            s.text = json.optString("text", "");
            s.chip = json.optString("chip", "");
            s.tone = json.optString("tone", "");
            s.progress = json.optInt("progress", 0);
            s.indeterminate = json.optBoolean("indeterminate", false);
            s.tracker = json.optString("tracker", "");
            s.technicianName = json.optString("technicianName", "");
            s.technicianPhone = json.optString("technicianPhone", "");
            s.service = json.optString("service", "");
            s.amountLabel = json.optString("amountLabel", "");
            s.arrivalAt = json.optLong("arrivalAt", 0L);
            s.startedAt = json.optLong("startedAt", 0L);
            s.deepLinkPath = json.optString("deepLinkPath", "");
            s.source = json.optString("source", TripState.SOURCE_APP);
            s.updatedAt = json.optLong("updatedAt", 0L);
            return s;
        } catch (Exception broken) {
            return null;
        }
    }

    private static void save(Context context, TripState s) {
        try {
            JSONObject json = new JSONObject();
            json.put("requestId", s.requestId);
            json.put("phase", s.phase);
            json.put("title", s.title);
            json.put("text", s.text);
            json.put("chip", s.chip);
            json.put("tone", s.tone);
            json.put("progress", s.progress);
            json.put("indeterminate", s.indeterminate);
            json.put("tracker", s.tracker);
            json.put("technicianName", s.technicianName);
            json.put("technicianPhone", s.technicianPhone);
            json.put("service", s.service);
            json.put("amountLabel", s.amountLabel);
            json.put("arrivalAt", s.arrivalAt);
            json.put("startedAt", s.startedAt);
            json.put("deepLinkPath", s.deepLinkPath);
            json.put("source", s.source);
            json.put("updatedAt", s.updatedAt);
            prefs(context).edit().putString(KEY_STATE, json.toString()).apply();
        } catch (Exception ignored) {
            // The notification still shows; only the merge with the next update is lost.
        }
    }

    private static String value(Map<String, String> data, String key) {
        String v = data == null ? null : data.get(key);
        return v == null ? "" : v.trim();
    }
}
