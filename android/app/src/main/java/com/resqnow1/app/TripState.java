package com.resqnow1.app;

import java.util.Locale;

/**
 * One customer request as its Live Update shows it. Updates come from two places: the app,
 * while it runs (with the minutes and the trip bar worked out by src/lib/tripLiveUpdate.ts),
 * and pushes from the server, which carry only the new status. {@link #merge} keeps the most
 * complete picture: a late push never moves the trip backwards, and a push never wipes the
 * technician's name or minutes that the app already supplied.
 */
public final class TripState {

    public static final String SOURCE_APP = "app";
    public static final String SOURCE_PUSH = "push";

    public String requestId = "";
    public String phase = "other";
    public String title = "";
    public String text = "";
    /** The words or figure in the status-bar chip, e.g. "6 min". */
    public String chip = "";
    /** "", "ok" (green), "warn" (amber) or "hot" (crimson). */
    public String tone = "";
    /** 0 to 100 along the four steps: found, on the way, at the vehicle, done. */
    public int progress = 0;
    public boolean indeterminate = false;
    /** "bike", "truck", "check", "build" or "" for none. */
    public String tracker = "";
    public String technicianName = "";
    public String technicianPhone = "";
    public String service = "";
    public String amountLabel = "";
    /** When the technician should arrive, in epoch ms; 0 when unknown. */
    public long arrivalAt = 0L;
    /** When the work started, in epoch ms; 0 when unknown. */
    public long startedAt = 0L;
    public String alertTitle = "";
    public String alertText = "";
    public String deepLinkPath = "";
    public String source = SOURCE_APP;
    public long updatedAt = 0L;
    /** True while the words are the stand-in for a push that carried none. */
    boolean fallbackCopy = false;

    /** How far along each stage is; a trip only moves forward. */
    public static int rank(String phase) {
        switch (phase == null ? "" : phase) {
            case "search": return 0;
            case "accepted": return 1;
            case "way": return 2;
            case "arrived": return 3;
            case "working":
            case "loaded": return 4;
            case "towing": return 5;
            case "dropped": return 6;
            case "finished": return 7;
            case "pay": return 8;
            case "rate": return 9;
            case "closed": return 10;
            case "cancelled": return 11;
            default: return -1;
        }
    }

    /** The stage for a status the server sends, matching trackingPhase() in the app. */
    public static String phaseFromStatus(String status) {
        String value = status == null ? "" : status.trim().toLowerCase(Locale.ENGLISH);
        switch (value) {
            case "pending":
            case "searching":
                return "search";
            case "assigned":
            case "accepted":
                return "accepted";
            case "en-route":
            case "en_route":
            case "en_route_pickup":
            case "on-the-way":
                return "way";
            case "arrived":
            case "arrived_pickup":
                return "arrived";
            case "in-progress":
            case "in_progress":
            case "service_started":
                return "working";
            case "vehicle_loaded":
                return "loaded";
            case "enroute_drop":
                return "towing";
            case "arrived_drop":
                return "dropped";
            case "service_completed":
            case "completed":
            case "awaiting_payment":
            case "payment_pending":
                return "pay";
            case "paid":
                return "rate";
            case "closed":
                return "closed";
            case "cancelled":
            case "canceled":
                return "cancelled";
            default:
                return "other";
        }
    }

    /** True while the job is under way and the notification should stay pinned. */
    public boolean isActive() {
        int r = rank(phase);
        return r >= 0 && r <= rank("pay");
    }

    /** The stages worth a short alert with sound, besides the silent Live Update. */
    public boolean deservesAlert() {
        return "accepted".equals(phase) || "arrived".equals(phase) || "pay".equals(phase) || "cancelled".equals(phase);
    }

    /** "Arun", or "Your technician". */
    public String firstName() {
        String name = technicianName == null ? "" : technicianName.trim();
        if (name.isEmpty()) return "Your technician";
        int space = name.indexOf(' ');
        return space > 0 ? name.substring(0, space) : name;
    }

    /** "AK" for the badge on the picture; "" without a name. */
    public String initials() {
        String name = technicianName == null ? "" : technicianName.trim();
        if (name.isEmpty()) return "";
        String[] words = name.split("\\s+");
        StringBuilder out = new StringBuilder();
        for (int i = 0; i < words.length && out.length() < 2; i++) {
            if (!words[i].isEmpty()) out.append(Character.toUpperCase(words[i].charAt(0)));
        }
        return out.toString();
    }

    /**
     * The newer picture of the trip. Stages only move forward, except a cancellation, which
     * ends the trip from any stage. Within the same stage the newer words win, and details
     * the newer update lacks (name, phone, picture, minutes) are kept.
     */
    public static TripState merge(TripState previous, TripState next) {
        if (next == null) return previous;
        if (previous == null || !previous.requestId.equals(next.requestId)) return next;
        boolean cancelled = "cancelled".equals(next.phase);
        if ("cancelled".equals(previous.phase) && !cancelled) return previous;
        int before = rank(previous.phase);
        int after = rank(next.phase);
        if (!cancelled && (after < 0 || after < before)) {
            // An older status (often a late push): keep what is shown, but take new details.
            TripState kept = previous.copy();
            kept.fillFrom(next);
            return kept;
        }
        TripState merged = next.copy();
        merged.fillFrom(previous);
        // A push without the technician's name said "Your technician"; now the name is known.
        if (merged.fallbackCopy && next.technicianName.isEmpty() && !merged.technicianName.isEmpty()) {
            merged.applyFallbackCopy(merged.updatedAt);
        }
        if (after == before && SOURCE_PUSH.equals(next.source) && SOURCE_APP.equals(previous.source)) {
            // Same stage: the app's own words (with the minutes) say more than the push's.
            merged.title = previous.title;
            merged.text = previous.text;
            merged.chip = previous.chip;
            merged.progress = previous.progress;
            merged.tracker = previous.tracker;
            merged.indeterminate = previous.indeterminate;
            merged.source = SOURCE_APP;
        }
        return merged;
    }

    /** Fills only the empty details from another update of the same trip. */
    private void fillFrom(TripState other) {
        if (technicianName.isEmpty()) technicianName = other.technicianName;
        if (technicianPhone.isEmpty()) technicianPhone = other.technicianPhone;
        if (service.isEmpty()) service = other.service;
        if (amountLabel.isEmpty()) amountLabel = other.amountLabel;
        if (deepLinkPath.isEmpty()) deepLinkPath = other.deepLinkPath;
        if (arrivalAt == 0L && rank(phase) <= rank("way")) arrivalAt = other.arrivalAt;
        if (startedAt == 0L) startedAt = other.startedAt;
    }

    public TripState copy() {
        TripState c = new TripState();
        c.requestId = requestId;
        c.phase = phase;
        c.title = title;
        c.text = text;
        c.chip = chip;
        c.tone = tone;
        c.progress = progress;
        c.indeterminate = indeterminate;
        c.tracker = tracker;
        c.technicianName = technicianName;
        c.technicianPhone = technicianPhone;
        c.service = service;
        c.amountLabel = amountLabel;
        c.arrivalAt = arrivalAt;
        c.startedAt = startedAt;
        c.alertTitle = alertTitle;
        c.alertText = alertText;
        c.deepLinkPath = deepLinkPath;
        c.source = source;
        c.updatedAt = updatedAt;
        c.fallbackCopy = fallbackCopy;
        return c;
    }

    /**
     * A trip as a push describes it: the status, the server's two lines, and the technician.
     * The bar and the chip follow from the stage; the minutes come from the app when it runs.
     */
    public static TripState fromPush(String requestId, String status, String title, String body, String technicianName,
                                     String technicianPhone, String service, long now) {
        TripState s = new TripState();
        s.requestId = requestId == null ? "" : requestId.trim();
        s.phase = phaseFromStatus(status);
        s.technicianName = technicianName == null ? "" : technicianName.trim();
        s.technicianPhone = technicianPhone == null ? "" : technicianPhone.trim();
        s.service = service == null ? "" : service.trim();
        s.source = SOURCE_PUSH;
        s.updatedAt = now;
        s.deepLinkPath = s.requestId.isEmpty() ? "" : "/service-tracking/" + s.requestId;
        s.applyFallbackCopy(now);
        // The server's own words, when it sent them, say it best.
        if (title != null && !title.trim().isEmpty()) {
            s.title = title.trim();
            s.fallbackCopy = false;
        }
        if (body != null && !body.trim().isEmpty()) s.text = body.trim();
        return s;
    }

    /** The words, chip and bar for the stage, when only the status is known. */
    void applyFallbackCopy(long now) {
        TripState s = this;
        s.fallbackCopy = true;
        String first = s.firstName();
        switch (s.phase) {
            case "search":
                s.set("Finding a technician", "We’re checking nearby partners for you.", "Finding", "", 0, true, "");
                break;
            case "accepted":
                s.set(first + " accepted your request", "Getting ready to leave.", "Found", "", 25, false, "bike");
                break;
            case "way":
                s.set(first + " is on the way", "Open the app to see the minutes.", "On way", "", 32, false, "bike");
                break;
            case "arrived":
                s.set(first + " is here", "Meet your technician at the vehicle.", "Here", "ok", 50, false, "check");
                break;
            case "working":
                s.set("Work in progress", first + " is working on your vehicle.", "", "", 62, false, "build");
                if (s.startedAt == 0L) s.startedAt = now;
                break;
            case "loaded":
                s.set("Vehicle loaded", "Your vehicle is secured on the tow truck.", "Loaded", "", 55, false, "truck");
                break;
            case "towing":
                s.set("Towing to the drop point", "Open the app to see the minutes.", "Towing", "", 65, false, "truck");
                break;
            case "dropped":
                s.set("Reached the drop point", "Final confirmation is next.", "Dropped", "", 75, false, "truck");
                break;
            case "pay":
                s.set("Work done · payment is next", "Pay online, or give cash to " + first + ".", "Pay", "hot", 75, false, "check");
                break;
            case "rate":
                s.set("Paid · thank you", "How was " + first + "? One tap is enough.", "", "ok", 100, false, "");
                break;
            case "closed":
                s.set("Request closed", "Thank you for choosing ResQNow.", "", "", 100, false, "");
                break;
            case "cancelled":
                s.set("Request cancelled", "You can send a new request any time.", "", "", 0, false, "");
                break;
            default:
                s.set("Your request was updated", "Open the app to see where it is.", "", "", 0, false, "");
        }
    }

    private void set(String title, String text, String chip, String tone, int progress, boolean indeterminate, String tracker) {
        this.title = title;
        this.text = text;
        this.chip = chip;
        this.tone = tone;
        this.progress = progress;
        this.indeterminate = indeterminate;
        this.tracker = tracker;
    }

    /** "6 min" until the arrival time, for a chip rebuilt without the app; "" when not known. */
    public static String minutesUntil(long arrivalAt, long now) {
        if (arrivalAt <= 0L) return "";
        long minutes = Math.max(1L, Math.round((arrivalAt - now) / 60000.0));
        if (arrivalAt - now < 45000L) return "Now";
        return minutes + " min";
    }
}
