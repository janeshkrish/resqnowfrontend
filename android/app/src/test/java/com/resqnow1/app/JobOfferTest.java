package com.resqnow1.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class JobOfferTest {

    @Test
    public void theEarningComesFirst() {
        JobOffer offer = new JobOffer("flat_tire", "350", "2.1 km", "Asha");
        assertEquals("New job · ₹350 for you", offer.title());
        assertEquals("Flat tyre · 2.1 km away", offer.text());
        assertEquals("Flat tyre · 2.1 km away\nFor Asha\nAccept before the time runs out.", offer.bigText());
    }

    @Test
    public void largeAmountsAreGroupedAndPaiseDropped() {
        assertEquals("₹1,240", new JobOffer("towing", "1240.40", "", "").priceLabel());
        assertEquals("New job · ₹1,240 for you", new JobOffer("towing", "1240.40", "", "").title());
    }

    @Test
    public void aMissingAmountSaysSoPlainly() {
        assertEquals("", new JobOffer("battery", "0", "", "").priceLabel());
        assertEquals("", new JobOffer("battery", "abc", "", "").priceLabel());
        assertEquals("New job near you", new JobOffer("battery", "", "", "").title());
    }

    @Test
    public void distanceReadsNaturally() {
        assertEquals("Nearby", new JobOffer("", "", "", "").distanceLabel());
        assertEquals("Nearby", new JobOffer("", "", "Nearby", "").distanceLabel());
        assertEquals("3.4 km away", new JobOffer("", "", "3.4 km away", "").distanceLabel());
    }

    @Test
    public void serviceNamesAndPictures() {
        String[][] cases = {
            { "flat_tire", "Flat tyre", "svc_flat_tire" },
            { "Towing Service", "Towing", "svc_towing" },
            { "winching_services", "Winching", "svc_winching" },
            { "ev_portable_charger", "EV charging", "svc_ev_charging" },
            { "battery_jump", "Battery", "svc_battery" },
            { "fuel_delivery", "Fuel delivery", "svc_fuel" },
            { "key_lockout", "Lockout", "svc_lockout" },
            { "mechanical_repair", "Mechanic", "svc_mechanical" },
        };
        for (String[] c : cases) {
            JobOffer offer = new JobOffer(c[0], "", "", "");
            assertArrayEquals(c, new String[] { c[0], offer.serviceName(), offer.pictureName() });
        }
        assertEquals("Roadside help", new JobOffer("", "", "", "").serviceName());
        assertEquals("svc_mechanical", JobOffer.servicePicture(null));
    }

    @Test
    public void aGenericCustomerNameIsLeftOut() {
        assertTrue(!new JobOffer("fuel", "200", "1 km", "Customer").bigText().contains("For Customer"));
    }

    @Test
    public void theVibrationFollowsTheLandlineRing() {
        long total = 0;
        for (long part : NotificationChannels.RING_VIBRATION) total += part;
        assertEquals(NotificationChannels.RING_CYCLE_MS, total);
        assertArrayEquals(new long[] { 0L, 400L, 200L, 400L, 2000L }, NotificationChannels.RING_VIBRATION);
    }
}
