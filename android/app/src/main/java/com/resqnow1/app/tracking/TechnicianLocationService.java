package com.resqnow1.app.tracking;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.location.Location;
import android.os.Build;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.IBinder;
import android.util.Log;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationAvailability;
import com.google.android.gms.location.LocationCallback;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationResult;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.Priority;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * The single technician GPS source while an eligible job is active on Android.
 *
 * Fixes go to the web app (and its technicianLocationSender) while the job screen
 * is visible. When the app is backgrounded, locked, or its WebView is gone, the
 * service delivers the same TrackingLocationV1 payload itself to the existing
 * canonical REST endpoint, so delivery never depends on a throttled WebView.
 */
public class TechnicianLocationService extends Service {

    public static final String ACTION_START = "com.resqnow1.app.tracking.START";
    public static final String ACTION_STOP = "com.resqnow1.app.tracking.STOP";
    public static final String EXTRA_REASON = "reason";
    public static final String EXTRA_JOB_ID = "jobId";
    public static final String EXTRA_TECHNICIAN_ID = "technicianId";
    public static final String EXTRA_ENDPOINT_URL = "endpointUrl";
    public static final String EXTRA_TOKEN = "token";
    public static final String EXTRA_SEQUENCE_FLOOR = "sequenceFloor";

    public static final String STATUS_RUNNING = "running";
    public static final String STATUS_STOPPED = "stopped";
    public static final String STATUS_DELIVERY_JS = "delivery_js";
    public static final String STATUS_DELIVERY_NATIVE = "delivery_native";
    public static final String STATUS_LOCATION_UNAVAILABLE = "location_unavailable";
    public static final String STATUS_LOCATION_AVAILABLE = "location_available";

    static final String CHANNEL_ID = "live_location_tracking";
    private static final int NOTIFICATION_ID = 0x5E51;
    private static final long LOCATION_INTERVAL_MS = 1_000L;
    private static final int HTTP_TIMEOUT_MS = 10_000;
    private static final String PREFS = "resqnow_live_tracking";
    private static final String PREF_JOB_ID = "job_id";
    private static final String PREF_TECHNICIAN_ID = "technician_id";
    private static final String PREF_LAST_SEQUENCE_ID = "last_sequence_id";
    private static final String TAG = "ResQNowTracking";

    /** Implemented by the Capacitor plugin while the WebView is alive. */
    public interface DeliverySink {
        /** Returns true only when the visible job screen accepted the fix for delivery. */
        boolean deliverToJs(TrackingFix fix);

        void onStatus(String state, String reason, String jobId);
    }

    private static volatile DeliverySink sink;
    private static volatile String runningJobId;

    static void setSink(DeliverySink next) {
        sink = next;
    }

    static void clearSink(DeliverySink current) {
        if (sink == current) sink = null;
    }

    static String getRunningJobId() {
        return runningJobId;
    }

    static long getLastSequenceId(Context context) {
        return context.getSharedPreferences(PREFS, MODE_PRIVATE).getLong(PREF_LAST_SEQUENCE_ID, 0L);
    }

    private HandlerThread thread;
    private Handler handler;
    private ExecutorService network;
    private FusedLocationProviderClient locationClient;
    private SharedPreferences preferences;

    // Mutated only on the handler thread.
    private BackgroundLocationUploader uploader;
    private SequenceAllocator sequences;
    private boolean trackingStarted = false;
    private boolean jsDelivery = false;
    private String jobId;
    private String technicianId;
    // Read by the network thread; replaced when the web app refreshes credentials.
    private volatile String endpointUrl;
    private volatile String token;
    // Start and stop requests arrive as ordered intents; a stop never undoes a later start.
    private volatile int lastStartId;
    private volatile int latestStartRequestId;

    private final LocationCallback locationCallback = new LocationCallback() {
        @Override
        public void onLocationResult(@NonNull LocationResult result) {
            for (Location location : result.getLocations()) handleLocation(location);
        }

        @Override
        public void onLocationAvailability(@NonNull LocationAvailability availability) {
            emitStatus(
                availability.isLocationAvailable() ? STATUS_LOCATION_AVAILABLE : STATUS_LOCATION_UNAVAILABLE,
                null
            );
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        thread = new HandlerThread("resqnow-live-tracking");
        thread.start();
        handler = new Handler(thread.getLooper());
        network = Executors.newSingleThreadExecutor();
        locationClient = LocationServices.getFusedLocationProviderClient(this);
        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
    }

    @Override
    public int onStartCommand(@Nullable Intent intent, int flags, final int startId) {
        lastStartId = startId;
        if (intent == null) {
            // START_NOT_STICKY: the system does not restart this service with a null intent.
            if (!trackingStarted) stopSelfResult(startId);
            return START_NOT_STICKY;
        }
        final String requestedJobId = trimmed(intent.getStringExtra(EXTRA_JOB_ID));

        if (ACTION_STOP.equals(intent.getAction())) {
            final String reason = trimmed(intent.getStringExtra(EXTRA_REASON));
            handler.post(new Runnable() {
                @Override
                public void run() {
                    // A start delivered after this stop (e.g. the next job) wins.
                    if (latestStartRequestId > startId) return;
                    if (!requestedJobId.isEmpty() && jobId != null && !requestedJobId.equals(jobId)) return;
                    stopTracking(reason.isEmpty() ? "requested" : reason, startId);
                }
            });
            return START_NOT_STICKY;
        }

        latestStartRequestId = startId;
        // Started through startForegroundService(): Android requires startForeground()
        // after every such call, even one that is about to be rejected below.
        try {
            enterForeground();
        } catch (RuntimeException error) {
            // Missing location permission (SecurityException) or a start from the
            // background that Android 12+ refuses.
            Log.w(TAG, "Foreground location service could not start: " + error.getClass().getSimpleName());
            notifySink(STATUS_STOPPED, error instanceof SecurityException ? "PERMISSION_DENIED" : "START_NOT_ALLOWED", requestedJobId);
            if (!trackingStarted) stopSelfResult(startId);
            return START_NOT_STICKY;
        }
        if (!ACTION_START.equals(intent.getAction()) || requestedJobId.isEmpty()) {
            handler.post(new Runnable() {
                @Override
                public void run() {
                    if (!trackingStarted) stopTracking("INVALID_CONFIGURATION", startId);
                }
            });
            return START_NOT_STICKY;
        }

        final String nextTechnicianId = trimmed(intent.getStringExtra(EXTRA_TECHNICIAN_ID));
        final String nextEndpoint = trimmed(intent.getStringExtra(EXTRA_ENDPOINT_URL));
        final String nextToken = trimmed(intent.getStringExtra(EXTRA_TOKEN));
        final long sequenceFloor = intent.getLongExtra(EXTRA_SEQUENCE_FLOOR, 0L);
        handler.post(new Runnable() {
            @Override
            public void run() {
                startOrUpdate(requestedJobId, nextTechnicianId, nextEndpoint, nextToken, sequenceFloor);
            }
        });
        // Without background-location permission a system restart could not read
        // location anyway; the web app starts tracking again when it is reopened.
        return START_NOT_STICKY;
    }

    private void startOrUpdate(String nextJobId, String nextTechnicianId, String nextEndpoint, String nextToken, long sequenceFloor) {
        if (!(nextEndpoint.startsWith("https://") || nextEndpoint.startsWith("http://")) || nextToken.isEmpty()) {
            stopTracking("INVALID_CONFIGURATION", lastStartId);
            return;
        }
        endpointUrl = nextEndpoint;
        token = nextToken;
        technicianId = nextTechnicianId;

        if (trackingStarted && nextJobId.equals(jobId)) {
            // Same job: only credentials were refreshed. One service, one watcher.
            return;
        }
        if (trackingStarted) {
            // Job changed: nothing unsent from the previous job may leak into this one.
            uploader.dispose();
            Log.i(TAG, "Live tracking switched job");
        }
        jobId = nextJobId;
        long floor = Math.max(sequenceFloor, preferences.getLong(PREF_LAST_SEQUENCE_ID, 0L));
        sequences = new SequenceAllocator(floor);
        uploader = createUploader();
        jsDelivery = false;
        preferences.edit()
            .putString(PREF_JOB_ID, jobId)
            .putString(PREF_TECHNICIAN_ID, technicianId)
            .apply();

        if (!trackingStarted) {
            LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, LOCATION_INTERVAL_MS)
                .setMinUpdateIntervalMillis(LOCATION_INTERVAL_MS)
                .build();
            try {
                // Re-assert foreground: an earlier stop in this same service instance
                // may have left it, while this later start superseded that stop.
                enterForeground();
                locationClient.requestLocationUpdates(request, locationCallback, thread.getLooper());
            } catch (RuntimeException error) {
                stopTracking(error instanceof SecurityException ? "PERMISSION_DENIED" : "START_NOT_ALLOWED", lastStartId);
                return;
            }
            trackingStarted = true;
        }
        runningJobId = jobId;
        emitStatus(STATUS_RUNNING, null);
    }

    private BackgroundLocationUploader createUploader() {
        return new BackgroundLocationUploader(
            new BackgroundLocationUploader.Transport() {
                @Override
                public void send(TrackingFix fix, Callback callback) {
                    postFix(fix, callback);
                }
            },
            new BackgroundLocationUploader.Scheduler() {
                @Override
                public Object schedule(Runnable task, long delayMs) {
                    handler.postDelayed(task, delayMs);
                    return task;
                }

                @Override
                public void cancel(Object handle) {
                    handler.removeCallbacks((Runnable) handle);
                }
            },
            new BackgroundLocationUploader.Clock() {
                @Override
                public long now() {
                    return System.currentTimeMillis();
                }
            },
            new BackgroundLocationUploader.Listener() {
                @Override
                public void onStopRequired(String reason) {
                    stopTracking(reason, lastStartId);
                }

                @Override
                public void onEvent(String event, long sequenceId, String detail) {
                    Log.d(TAG, event + " sequenceId=" + sequenceId + (detail != null ? " " + detail : ""));
                }
            }
        );
    }

    private void handleLocation(Location location) {
        if (!trackingStarted || uploader == null) return;
        long recordedAtMs = location.getTime() > 0 ? location.getTime() : System.currentTimeMillis();
        long sequenceId = sequences.next(recordedAtMs);
        preferences.edit().putLong(PREF_LAST_SEQUENCE_ID, sequenceId).apply();
        TrackingFix fix = new TrackingFix(
            technicianId,
            jobId,
            location.getLatitude(),
            location.getLongitude(),
            location.hasSpeed() ? (double) location.getSpeed() : null,
            location.hasBearing() ? (double) location.getBearing() : null,
            location.hasAccuracy() ? (double) location.getAccuracy() : null,
            recordedAtMs,
            sequenceId
        );

        DeliverySink current = sink;
        boolean deliveredByJs = current != null && current.deliverToJs(fix);
        if (deliveredByJs) {
            if (!jsDelivery) {
                jsDelivery = true;
                // The visible job screen owns delivery again; drop native leftovers.
                uploader.clearPending();
                emitStatus(STATUS_DELIVERY_JS, null);
            }
            return;
        }
        if (jsDelivery) {
            jsDelivery = false;
            emitStatus(STATUS_DELIVERY_NATIVE, null);
        }
        uploader.offer(fix);
    }

    /** Native network path: PATCH the canonical REST endpoint, never through the WebView. */
    private void postFix(final TrackingFix fix, final BackgroundLocationUploader.Transport.Callback callback) {
        final String url = endpointUrl;
        final String bearer = token;
        final byte[] body = fix.toJson().getBytes(StandardCharsets.UTF_8);
        network.execute(new Runnable() {
            @Override
            public void run() {
                int status = -1;
                HttpURLConnection connection = null;
                try {
                    connection = (HttpURLConnection) new URL(url).openConnection();
                    connection.setRequestMethod("PATCH");
                    connection.setConnectTimeout(HTTP_TIMEOUT_MS);
                    connection.setReadTimeout(HTTP_TIMEOUT_MS);
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/json");
                    connection.setRequestProperty("Accept", "application/json");
                    connection.setRequestProperty("Authorization", "Bearer " + bearer);
                    connection.setRequestProperty("x-client-platform", "android-background");
                    OutputStream output = connection.getOutputStream();
                    output.write(body);
                    output.close();
                    status = connection.getResponseCode();
                    drain(status >= 400 ? connection.getErrorStream() : connection.getInputStream());
                } catch (IOException | RuntimeException error) {
                    status = -1;
                } finally {
                    if (connection != null) connection.disconnect();
                }
                final int finalStatus = status;
                handler.post(new Runnable() {
                    @Override
                    public void run() {
                        if (finalStatus < 0) callback.onNetworkError();
                        else callback.onResponse(finalStatus);
                    }
                });
            }
        });
    }

    /** Runs on the handler thread. Stops unless a start newer than stopStartId has arrived. */
    private void stopTracking(String reason, int stopStartId) {
        if (trackingStarted) locationClient.removeLocationUpdates(locationCallback);
        if (uploader != null) uploader.dispose();
        String stoppedJobId = jobId;
        trackingStarted = false;
        jsDelivery = false;
        runningJobId = null;
        token = null;
        preferences.edit().remove(PREF_JOB_ID).remove(PREF_TECHNICIAN_ID).apply();
        Log.i(TAG, "Live tracking stopped: " + reason);
        notifySink(STATUS_STOPPED, reason, stoppedJobId);
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        // stopSelfResult() keeps the service alive when a newer start was already
        // delivered; that start re-enters the foreground in startOrUpdate().
        stopSelfResult(stopStartId);
    }

    private void enterForeground() {
        ServiceCompat.startForeground(
            this,
            NOTIFICATION_ID,
            buildNotification(),
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION : 0
        );
    }

    @Override
    public void onDestroy() {
        if (trackingStarted) locationClient.removeLocationUpdates(locationCallback);
        if (uploader != null) uploader.dispose();
        trackingStarted = false;
        runningJobId = null;
        token = null;
        network.shutdownNow();
        thread.quitSafely();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void emitStatus(String state, String reason) {
        notifySink(state, reason, jobId);
    }

    private static void notifySink(String state, String reason, String statusJobId) {
        DeliverySink current = sink;
        if (current != null) current.onStatus(state, reason, statusJobId);
    }

    private Notification buildNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager != null && manager.getNotificationChannel(CHANNEL_ID) == null) {
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "Live job tracking", NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Shown while your location is shared with the customer for an active job");
            channel.setShowBadge(false);
            manager.createNotificationChannel(channel);
        }
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent contentIntent = launch == null
            ? null
            : PendingIntent.getActivity(this, NOTIFICATION_ID, launch, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        int icon = getApplicationInfo().icon != 0 ? getApplicationInfo().icon : android.R.drawable.ic_menu_mylocation;
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(icon)
            .setContentTitle("Sharing live location")
            .setContentText("ResQNow is sharing your location with the customer for your active job.")
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(false)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(contentIntent)
            .build();
    }

    private static void drain(InputStream stream) throws IOException {
        if (stream == null) return;
        byte[] buffer = new byte[1024];
        while (stream.read(buffer) != -1) {
            // Discard: only the status code drives the delivery decision.
        }
        stream.close();
    }

    private static String trimmed(String value) {
        return value == null ? "" : value.trim();
    }
}
