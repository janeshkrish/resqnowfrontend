package com.resqnow1.app;

import java.util.Locale;

/**
 * What a job offer says, worked out from the push's fields (serviceType, priceAmount,
 * locationDistance). The earning comes first, then the job and how far it is, as on the design
 * canvas: "New job · ₹350 for you", "Flat tyre · 2.1 km away".
 */
public final class JobOffer {

    public final String serviceType;
    public final String priceAmount;
    public final String distance;
    public final String customerName;

    public JobOffer(String serviceType, String priceAmount, String distance, String customerName) {
        this.serviceType = clean(serviceType);
        this.priceAmount = clean(priceAmount);
        this.distance = clean(distance);
        this.customerName = clean(customerName);
    }

    /** "₹350", or "" when the push carried no usable amount. */
    public String priceLabel() {
        try {
            double amount = Double.parseDouble(priceAmount);
            if (amount <= 0 || Double.isNaN(amount) || Double.isInfinite(amount)) return "";
            return "₹" + String.format(Locale.ENGLISH, "%,d", Math.round(amount));
        } catch (NumberFormatException notNumber) {
            return "";
        }
    }

    public String title() {
        String price = priceLabel();
        return price.isEmpty() ? "New job near you" : "New job · " + price + " for you";
    }

    /** "Flat tyre", from "flat_tire", "Flat Tire Repair" and the like. */
    public String serviceName() {
        String type = serviceType.toLowerCase(Locale.ENGLISH);
        if (type.isEmpty()) return "Roadside help";
        if (type.contains("tow")) return "Towing";
        if (type.contains("winch")) return "Winching";
        if (type.contains("flat") || type.contains("tyre") || type.contains("tire") || type.contains("puncture")) return "Flat tyre";
        if (type.contains("ev") && type.contains("charg")) return "EV charging";
        if (type.contains("battery") || type.contains("jump")) return "Battery";
        if (type.contains("fuel")) return "Fuel delivery";
        if (type.contains("lock") || type.contains("key")) return "Lockout";
        if (type.contains("mechan") || type.contains("repair") || type.contains("engine")) return "Mechanic";
        String words = serviceType.replace('_', ' ').replace('-', ' ').trim();
        return words.isEmpty() ? "Roadside help" : Character.toUpperCase(words.charAt(0)) + words.substring(1);
    }

    /** "2.1 km away", or "Nearby" when the distance is unknown. */
    public String distanceLabel() {
        String raw = distance.replaceAll("(?i)\\s*away$", "").trim();
        if (raw.isEmpty() || raw.equalsIgnoreCase("nearby")) return "Nearby";
        return raw + " away";
    }

    public String text() {
        return serviceName() + " · " + distanceLabel();
    }

    /** The expanded alert: the job line, then who it is for and how they pay. */
    public String bigText() {
        StringBuilder text = new StringBuilder(text());
        if (!customerName.isEmpty() && !customerName.equalsIgnoreCase("customer")) {
            text.append("\nFor ").append(customerName);
        }
        text.append("\nAccept before the time runs out.");
        return text.toString();
    }

    /** The name of the 3D service picture in res/drawable-nodpi, e.g. "svc_flat_tire". */
    public String pictureName() {
        return servicePicture(serviceType);
    }

    public static String servicePicture(String serviceType) {
        String type = clean(serviceType).toLowerCase(Locale.ENGLISH);
        if (type.contains("tow")) return "svc_towing";
        if (type.contains("winch")) return "svc_winching";
        if (type.contains("flat") || type.contains("tyre") || type.contains("tire") || type.contains("puncture")) return "svc_flat_tire";
        if (type.contains("ev") && type.contains("charg")) return "svc_ev_charging";
        if (type.contains("battery") || type.contains("jump")) return "svc_battery";
        if (type.contains("fuel")) return "svc_fuel";
        if (type.contains("lock") || type.contains("key")) return "svc_lockout";
        return "svc_mechanical";
    }

    private static String clean(String value) {
        return value == null ? "" : value.trim();
    }
}
