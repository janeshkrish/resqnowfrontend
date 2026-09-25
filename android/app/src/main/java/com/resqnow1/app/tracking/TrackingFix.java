package com.resqnow1.app.tracking;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/** One raw GPS fix, serialised as the unchanged TrackingLocationV1 body. */
public final class TrackingFix {

    public final String technicianId;
    public final String jobId;
    public final double lat;
    public final double lng;
    public final Double speed;
    public final Double heading;
    public final Double accuracy;
    public final long recordedAtMs;
    public final long sequenceId;

    public TrackingFix(
        String technicianId,
        String jobId,
        double lat,
        double lng,
        Double speed,
        Double heading,
        Double accuracy,
        long recordedAtMs,
        long sequenceId
    ) {
        this.technicianId = technicianId;
        this.jobId = jobId;
        this.lat = lat;
        this.lng = lng;
        this.speed = nonNegative(speed);
        this.heading = nonNegative(heading);
        this.accuracy = nonNegative(accuracy);
        this.recordedAtMs = recordedAtMs;
        this.sequenceId = sequenceId;
    }

    /** Same shape and field rules as the TrackingLocationV1 payload built in ActiveJob.tsx. */
    public String toJson() {
        return "{"
            + "\"version\":1,"
            + "\"technicianId\":" + quote(technicianId) + ","
            + "\"jobId\":" + quote(jobId) + ","
            + "\"lat\":" + lat + ","
            + "\"lng\":" + lng + ","
            + "\"speed\":" + number(speed) + ","
            + "\"heading\":" + number(heading) + ","
            + "\"accuracy\":" + number(accuracy) + ","
            + "\"recordedAt\":" + quote(isoTimestamp(recordedAtMs)) + ","
            + "\"sequenceId\":" + sequenceId
            + "}";
    }

    static String isoTimestamp(long epochMs) {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date(epochMs));
    }

    private static Double nonNegative(Double value) {
        return value != null && !value.isNaN() && !value.isInfinite() && value >= 0 ? value : null;
    }

    private static String number(Double value) {
        return value == null ? "null" : String.valueOf(value);
    }

    private static String quote(String value) {
        String safe = value == null ? "" : value;
        StringBuilder builder = new StringBuilder("\"");
        for (char character : safe.toCharArray()) {
            if (character == '"' || character == '\\') builder.append('\\').append(character);
            else if (character < 0x20) builder.append(String.format(Locale.US, "\\u%04x", (int) character));
            else builder.append(character);
        }
        return builder.append('"').toString();
    }
}
