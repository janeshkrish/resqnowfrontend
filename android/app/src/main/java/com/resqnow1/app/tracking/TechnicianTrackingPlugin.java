package com.resqnow1.app.tracking;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.LocationManager;
import androidx.core.content.ContextCompat;
import androidx.core.location.LocationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Bridge between the web app and {@link TechnicianLocationService}. Fixes reach
 * the web app only while the activity is resumed and the job screen listens;
 * otherwise the service delivers them natively.
 */
@CapacitorPlugin(name = "TechnicianTracking")
public class TechnicianTrackingPlugin extends Plugin implements TechnicianLocationService.DeliverySink {

    private volatile boolean resumed = true;

    @Override
    public void load() {
        TechnicianLocationService.setSink(this);
    }

    @Override
    protected void handleOnResume() {
        resumed = true;
    }

    @Override
    protected void handleOnPause() {
        resumed = false;
    }

    @Override
    protected void handleOnDestroy() {
        TechnicianLocationService.clearSink(this);
    }

    @PluginMethod
    public void start(PluginCall call) {
        String jobId = trimmed(call.getString("jobId"));
        String technicianId = trimmed(call.getString("technicianId"));
        String endpointUrl = trimmed(call.getString("endpointUrl"));
        String token = trimmed(call.getString("token"));
        Long sequenceFloor = call.getLong("sequenceFloor", 0L);

        if (jobId.isEmpty() || endpointUrl.isEmpty() || token.isEmpty()) {
            call.reject("jobId, endpointUrl and token are required.", "INVALID_CONFIGURATION");
            return;
        }
        if (!hasLocationPermission()) {
            call.reject("Location permission is required for live tracking.", "PERMISSION_DENIED");
            return;
        }
        LocationManager locationManager = (LocationManager) getContext().getSystemService(Context.LOCATION_SERVICE);
        if (locationManager == null || !LocationManagerCompat.isLocationEnabled(locationManager)) {
            call.reject("Location services are turned off.", "LOCATION_DISABLED");
            return;
        }
        if (!resumed) {
            // Android only grants while-in-use location to a location service started
            // from the foreground.
            call.reject("Live tracking must start while ResQNow is open.", "NOT_IN_FOREGROUND");
            return;
        }

        boolean alreadyRunning = jobId.equals(TechnicianLocationService.getRunningJobId());
        Intent intent = new Intent(getContext(), TechnicianLocationService.class)
            .setAction(TechnicianLocationService.ACTION_START)
            .putExtra(TechnicianLocationService.EXTRA_JOB_ID, jobId)
            .putExtra(TechnicianLocationService.EXTRA_TECHNICIAN_ID, technicianId)
            .putExtra(TechnicianLocationService.EXTRA_ENDPOINT_URL, endpointUrl)
            .putExtra(TechnicianLocationService.EXTRA_TOKEN, token)
            .putExtra(TechnicianLocationService.EXTRA_SEQUENCE_FLOOR, sequenceFloor == null ? 0L : sequenceFloor);
        try {
            ContextCompat.startForegroundService(getContext(), intent);
        } catch (RuntimeException error) {
            call.reject("Android refused to start live tracking.", "START_NOT_ALLOWED");
            return;
        }
        JSObject result = new JSObject();
        result.put("started", true);
        result.put("alreadyRunning", alreadyRunning);
        call.resolve(result);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        // Sent as an intent so it is ordered with start requests: a later start
        // (the next job) is never undone by an earlier stop.
        Intent intent = new Intent(getContext(), TechnicianLocationService.class)
            .setAction(TechnicianLocationService.ACTION_STOP)
            .putExtra(TechnicianLocationService.EXTRA_REASON, trimmed(call.getString("reason", "requested")))
            .putExtra(TechnicianLocationService.EXTRA_JOB_ID, trimmed(call.getString("jobId")));
        try {
            getContext().startService(intent);
        } catch (RuntimeException ignored) {
            // Background with no running service: there is nothing to stop.
        }
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        String runningJobId = TechnicianLocationService.getRunningJobId();
        JSObject result = new JSObject();
        result.put("running", runningJobId != null);
        result.put("jobId", runningJobId);
        result.put("lastSequenceId", TechnicianLocationService.getLastSequenceId(getContext()));
        call.resolve(result);
    }

    @Override
    public boolean deliverToJs(TrackingFix fix) {
        if (!resumed || !hasListeners("location")) return false;
        JSObject data = new JSObject();
        data.put("jobId", fix.jobId);
        data.put("latitude", fix.lat);
        data.put("longitude", fix.lng);
        data.put("accuracy", fix.accuracy);
        data.put("speed", fix.speed);
        data.put("heading", fix.heading);
        data.put("timestamp", fix.recordedAtMs);
        data.put("sequenceId", fix.sequenceId);
        notifyListeners("location", data);
        return true;
    }

    @Override
    public void onStatus(String state, String reason, String jobId) {
        JSObject data = new JSObject();
        data.put("state", state);
        data.put("reason", reason);
        data.put("jobId", jobId);
        notifyListeners("status", data);
    }

    private boolean hasLocationPermission() {
        Context context = getContext();
        return ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    private static String trimmed(String value) {
        return value == null ? "" : value.trim();
    }
}
