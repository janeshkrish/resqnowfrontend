import { readFileSync } from "node:fs";
import { expect, type Page, type Route, type WebSocketRoute } from "@playwright/test";

// One pretend back end for the admin portal. Every number on screen comes from these replies;
// writes are recorded in `calls` so a test can check what the portal asked the server to do.

const fakeMappls = readFileSync(new URL("./fakeMapplsSdk.js", import.meta.url), "utf8");
export const ADMIN_TOKEN = ["e30", Buffer.from(JSON.stringify({ role: "admin", type: "admin", email: "ops@resqnow.test" })).toString("base64url"), "e2e"].join(".");
const MIN = 60_000;
const DAY = 86_400_000;
export const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();

export function liveRequest(over: Record<string, unknown>) {
  return {
    id: 0, createdAt: iso(-10 * MIN), updatedAt: iso(-MIN), status: "on-the-way", phase: "on_the_way", steps: { done: 1, now: 1 },
    serviceType: "truck-lockout", vehicleType: "truck", vehicleModel: "Tata Yodha",
    customer: { id: 41, name: "Asha Raman", phoneMasked: "+91 98••• ••210" },
    technician: { id: 7, name: "Arun Kumar", rating: 4.8, serviceType: "mechanic" },
    address: "Bharathi Nagar, Coimbatore", location: { lat: 11.0268, lng: 76.9458 }, drop: null,
    fare: 110, paymentMethod: "cash", paymentStatus: "pending",
    acceptedAt: iso(-8 * MIN), promisedAt: iso(6 * MIN), promiseSource: "accepted", arrivedAt: null, workStartedAt: null, completedAt: null,
    search: { sent: 2, declined: 1, expired: 0, pending: 0, accepted: 1, startedAt: iso(-10 * MIN) },
    alerts: [],
    live: { lat: 11.02, lng: 76.95, heading: 90, speedKmh: 24, lastSeenAt: iso(-8_000), gpsStale: false, etaSeconds: 360, etaCalculatedAt: iso(-20_000), trafficAware: true, distanceKm: 2.4, distanceSource: "route" },
    ...over,
  };
}

const hours = (filled: Record<number, number>) => Array.from({ length: 24 }, (_, h) => filled[h] || 0);

export function portalWorld() {
  const live = {
    generatedAt: iso(0),
    kpis: { live: 3, finding: 1, needsAttention: 1, acceptSecondsToday: 34, arrivalMinutesToday: 12, arrivalsMeasuredToday: 9, completedToday: 46 },
    requests: [
      liveRequest({ id: 5502 }),
      liveRequest({
        id: 5499, serviceType: "bike-flat-tire", vehicleModel: "Honda Activa", customer: { id: 52, name: "Priya M", phoneMasked: "+91 97••• ••118" },
        technician: { id: 9, name: "Ravi N", rating: 4.6, serviceType: "mechanic" }, promisedAt: iso(-3 * MIN),
        alerts: [{ code: "movement_stationary", text: "Technician appears stationary for too long while the job is active.", level: "medium", since: iso(-5 * MIN), etaMinutes: 9 }],
        live: { lat: 11.0, lng: 76.93, heading: 0, speedKmh: 0, lastSeenAt: iso(-12_000), gpsStale: false, etaSeconds: null, etaCalculatedAt: null, trafficAware: false, distanceKm: 3.2, distanceSource: "straight" },
      }),
      liveRequest({
        id: 5503, status: "pending", phase: "finding", steps: { done: 0, now: 0 }, serviceType: "car-battery", vehicleModel: "Hyundai i20",
        customer: { id: 60, name: "Deepak V", phoneMasked: null }, technician: null, acceptedAt: null, promisedAt: null, live: null,
        search: { sent: 3, declined: 1, expired: 0, pending: 2, accepted: 0, startedAt: iso(-48_000) }, createdAt: iso(-48_000),
      }),
    ],
  };
  const today = {
    generatedAt: iso(0),
    completed: { today: 46, sameTimeLastWeek: 40 },
    cancelledToday: 4,
    requestsToday: 58,
    requestsByHour: { today: hours({ 6: 2, 7: 4, 8: 6, 9: 7, 10: 5, 11: 6, 12: 8, 13: 7, 14: 4, 15: 5, 16: 4 }), lastWeek: hours({ 6: 3, 7: 3, 8: 5, 9: 6, 10: 6, 11: 5, 12: 6, 13: 6, 14: 5, 15: 4, 16: 5 }), currentHour: 16 },
    serviceMix: [{ service: "towing", count: 14 }, { service: "flat-tire", count: 12 }, { service: "battery", count: 10 }, { service: "fuel", count: 7 }],
    money: {
      collected: 38420, payments: 46, online: { amount: 28560, count: 35 }, cash: { amount: 9860, count: 11 }, toTechnicians: 31150, toResqnow: 7270,
      payoutsWaiting: { amount: 14250, count: 3 }, cashDues: { amount: 2160, technicians: 5 },
    },
    technicians: { approved: 61, onDuty: 23, onJob: 9, free: 14, freePositions: [{ id: 12, name: "Murugan S", position: { lat: 11.01, lng: 76.96 } }, { id: 15, name: "Senthil P", position: { lat: 11.03, lng: 76.99 } }] },
    needs: {
      alerts: [{ requestId: 5499, code: "movement_stationary", text: "Stationary", level: "red", since: iso(-5 * MIN), service: "bike-flat-tire", customer: "Priya M", technician: "Ravi N" }],
      applications: { count: 4, oldest: { id: 90, name: "MK Tyre Works", since: iso(-2 * DAY) } },
      payouts: { count: 3, amount: 14250, names: ["Selvam R", "Vijay P", "Arjun D"] },
      complaints: { count: 5, olderThanDay: 1, latest: { id: 1042, title: "Technician asked for ₹200 extra in cash" } },
    },
  };
  const notifications = [
    { id: 3, type: "NEW_TECHNICIAN_APPLICATION", title: "New Technician Application", message: "MK Tyre Works submitted an application.", is_read: 0, created_at: iso(-2 * MIN) },
    { id: 2, type: "SYSTEM_ALERT", title: "Ops Reminder", message: "3 technicians went off duty during the evening peak.", is_read: 0, created_at: iso(-22 * MIN) },
    { id: 1, type: "TECHNICIAN_APPROVED", title: "Technician Approved", message: "Sri Murugan Towing has been approved.", is_read: 1, created_at: iso(-60 * MIN) },
  ];
  const record = {
    technician: { id: 42, name: "Squad Recovery", phone: "9443300507", phoneMasked: "+91 94••• ••507", serviceType: "car-towing", status: "approved", onDuty: true, available: false, currentRequestId: 5502, place: "Coimbatore", joinedAt: "2026-03-03T06:00:00.000Z", lastSeenAt: iso(-MIN) },
    kpis: {
      jobsCompleted: 207, jobsThisWeek: 19, jobsLastWeek: 17, offers: { sent: 248, accepted: 214, declined: 21, expired: 13, pending: 0 }, acceptanceRate: 214 / 248,
      removedByAdmin: 2, customerCancelledAfterAccepting: 3, onTimeRate: 0.92, arrivalsJudged: 25, averageMinutesToArrive: 11, arrivalsMeasured: 25,
      rating: 4.85, ratingCount: 164, lowRatings: 2, earnedThisMonth: 48600, earnedTotal: 412800, duesOwed: 0,
    },
    weekly: Array.from({ length: 12 }, (_, i) => ({ weekStart: new Date(Date.now() - (11 - i) * 7 * DAY).toISOString(), jobs: [11, 13, 12, 15, 14, 16, 15, 17, 16, 18, 17, 19][i] })),
    flags: [{ kind: "late", title: "2 late arrivals this week", text: "#5466 by 7 min, #5431 by 9 min", tab: "reliability" }],
    reliability: {
      offers: { sent: 248, accepted: 214, declined: 21, expired: 13, pending: 0 },
      removedByAdmin: [{ requestId: 5311, at: iso(-10 * DAY) }],
      customerCancelled: [{ requestId: 5420, at: iso(-2 * DAY), reason: "Found help nearby", serviceType: "car-towing" }],
      arrivals: { onTime: 23, late1to5: 1, late6to10: 1, lateOver10: 0 }, arrivalsJudged: 25,
      late: [{ requestId: 5466, serviceType: "car-winching", promisedAt: iso(-127 * MIN), arrivedAt: iso(-120 * MIN), lateMinutes: 7 }],
      alerts: [{ code: "arrival_delay", label: "ETA past the deadline", count: 4 }], alertsSince: iso(-90 * DAY),
    },
    reviews: { average: 4.85, count: 164, distribution: [{ stars: 5, count: 148 }, { stars: 4, count: 11 }, { stars: 3, count: 3 }, { stars: 2, count: 1 }, { stars: 1, count: 1 }] },
  };
  const profile: Record<string, unknown> = {
    id: 42, name: "Squad Recovery", proprietor_name: "Selvam Rajendran", email: "selvam@example.test", phone: "9443300507", alternate_phone: "",
    address: "14, Mettupalayam Road", locality: "Thudiyalur", district: "Coimbatore", region: "Coimbatore", state: "Tamil Nadu",
    aadhaar_number: "123456784410", gst_number: "", serviceAreaRange: 20, experience: 9, latitude: 11.07, longitude: 76.94,
    specialties: ["towing", "winching"], vehicle_types: { car: true, bike: true },
    working_hours: { is_24x7: true, opening_time: "", closing_time: "", weekly_off: "None" },
    payment_details: { modes: { cash: true, upi: true }, upi_id: "selvam.squad@okaxis", bank_name: "HDFC", bank_account_number: "50100099994410", ifsc_code: "HDFC0001234" },
    app_readiness: { has_smartphone: true, preferred_language: "Tamil" },
    documents: { garage_front: "/uploads/front.jpg", profile_photo: "/uploads/me.jpg", tools_photo: "", facilities_photo: "" },
    service_costs: [{ service_domain: "towing", vehicle_categories: ["car"], towing_fleet_types: ["flatbed", "wheel-lift"] }],
    verification_status: "verified", status: "approved", admin_hidden: false, is_active: true,
  };
  const template = {
    services: [{ id: 1, service_name: "Flat Tire Repair", service_slug: "flat_tire_repair" }, { id: 3, service_name: "Towing Services", service_slug: "towing_services" }, { id: 8, service_name: "Winching Services", service_slug: "winching_services" }],
    categories: [{ id: 1, category_name: "Bike" }, { id: 2, category_name: "Car" }, { id: 3, category_name: "Commercial" }, { id: 4, category_name: "EV" }],
    subcategories: [{ id: 5, vehicle_category_id: 2, subcategory_name: "Hatchback" }, { id: 6, vehicle_category_id: 2, subcategory_name: "Sedan" }, { id: 7, vehicle_category_id: 2, subcategory_name: "SUV" }],
    pricingFields: [
      { id: 1, service_id: 1, field_key: "visit_charge", field_label: "Visit Charge", required: 1 }, { id: 2, service_id: 1, field_key: "free_distance", field_label: "Free Distance", required: 1 },
      { id: 3, service_id: 1, field_key: "cost_per_km", field_label: "Cost Per KM", required: 1 }, { id: 4, service_id: 1, field_key: "tube_tyre_price", field_label: "Tube Tyre Price", required: 1 },
      { id: 5, service_id: 1, field_key: "tubeless_tyre_price", field_label: "Tubeless Tyre Price", required: 1 },
      { id: 6, service_id: 3, field_key: "base_charge", field_label: "Base Charge", required: 1 }, { id: 7, service_id: 3, field_key: "free_distance", field_label: "Free Distance", required: 1 },
      { id: 8, service_id: 3, field_key: "cost_per_km", field_label: "Cost Per KM", required: 1 },
      { id: 9, service_id: 8, field_key: "recovery_fee", field_label: "Recovery Fee", required: 1 }, { id: 10, service_id: 8, field_key: "visit_charge", field_label: "Visit Charge", required: 1 },
    ],
    fleets: [{ id: 1, fleet_name: "Flatbed Trucks" }, { id: 2, fleet_name: "Front Lift Trucks" }, { id: 3, fleet_name: "Heavy Duty Wreckers" }],
  };
  const pricing = [
    { id: 1, service_id: 3, vehicle_category_id: 2, vehicle_subcategory_id: 6, pricing_json: { service_domain: "towing", vehicle_type: "car", vehicle_subtype: "sedan", vehicle_subtype_label: "Sedan", base_charge: 700, free_distance: 5, cost_per_km: 40 } },
    { id: 2, service_id: 3, vehicle_category_id: 2, vehicle_subcategory_id: 7, pricing_json: { service_domain: "towing", vehicle_type: "car", vehicle_subtype: "suv", vehicle_subtype_label: "SUV", base_charge: 950, free_distance: 5, cost_per_km: 45 } },
  ];
  const medians = [
    { serviceId: 3, vehicleType: "car", subtype: "sedan", field: "base_charge", median: 650, technicians: 6 },
    { serviceId: 3, vehicleType: "car", subtype: "suv", field: "base_charge", median: 800, technicians: 5 },
  ];
  const payouts = {
    wallet: { totalEarned: 412800, withdrawable: 6420, paidOut: 406380, onHold: 0, lastActivityAt: iso(-2 * 60 * MIN) },
    requests: [{ id: 31, amount: 6420, status: "pending", upi: "selvam.squad@okaxis", reason: null, utr: null, at: iso(-2 * 60 * MIN), paidAt: null }],
    payouts: [{ id: 11, amount: 5200, status: "paid", method: "upi", utr: "428713390021", to: "selvam.squad@okaxis", at: iso(-3 * DAY) }],
    dues: [],
  };
  const activity = {
    technician: { technicianId: 42, name: "Squad Recovery", email: "", approvalStatus: "approved", availabilityStatus: "busy", loginStatus: "logged_in", visibility: "visible",
      lastLoginAt: iso(-6 * 60 * MIN), lastLogoutAt: iso(-20 * 60 * MIN), lastSeenAt: iso(-MIN), inactivityAlertSentAt: null, currentSessionStartedAt: iso(-6 * 60 * MIN), currentSessionHours: 6.7, loggedInHoursTotal: 1840 },
    sessions: [
      { sessionId: 3, loginAt: iso(-6 * 60 * MIN), lastSeenAt: iso(-MIN), logoutAt: null, isActive: true, endedReason: null, source: "app", durationSeconds: 24120, durationHours: 6.7, metadata: null, createdAt: null, updatedAt: null },
      { sessionId: 2, loginAt: iso(-DAY - 7 * 60 * MIN), lastSeenAt: null, logoutAt: iso(-DAY + 4 * 60 * MIN), isActive: false, endedReason: "logout", source: "app", durationSeconds: 39600, durationHours: 11, metadata: null, createdAt: null, updatedAt: null },
    ],
    alerts: [{ alertId: 1, alertType: "login_reminder", status: "sent", message: "Reminder to come on duty", sentAt: iso(-7 * 60 * MIN), createdAt: iso(-7 * 60 * MIN), metadata: null }],
  };
  const requestRow = (over: Record<string, unknown>) => ({
    id: 0, status: "completed", phase: "done", createdAt: iso(-3 * 60 * MIN), completedAt: iso(-2 * 60 * MIN), service: "car-winching", vehicleType: "car", vehicleModel: "Mahindra Bolero",
    area: "Thudiyalur, Coimbatore", drop: null, customer: { id: 77, name: "Ganesh P" }, technician: { id: 42, name: "Squad Recovery", rating: 4.9 },
    promisedAt: iso(-170 * MIN), arrivedAt: iso(-163 * MIN), lateMinutes: 7, workMinutes: 44, fare: 1100, margin: 132,
    payment: { method: "cash" as string | null, state: "completed" as string | null, paid: true, refunded: 0 }, priority: "normal", ...over,
  });
  const requests = {
    rows: [
      requestRow({ id: 5466 }),
      requestRow({ id: 5491, service: "commercial-winching", vehicleType: "commercial", vehicleModel: "Ashok Leyland Dost", customer: { id: 78, name: "Mohammed I" }, lateMinutes: 0, priority: "high" }),
      requestRow({ id: 5493, status: "cancelled", phase: "cancelled", service: "car-flat-tire", vehicleModel: "Hyundai Creta", customer: { id: 79, name: "Sanjay M" }, arrivedAt: null, lateMinutes: null, workMinutes: null, fare: 0, margin: null, payment: { method: null, state: null, paid: false, refunded: 0 } }),
      requestRow({ id: 5442, service: "car-battery", vehicleModel: "Hyundai i10", customer: { id: 80, name: "Harish B" }, lateMinutes: -2, fare: 450, margin: 54, payment: { method: "razorpay", state: "completed", paid: true, refunded: 450 } }),
    ],
    counts: { all: 412, live: 8, completed: 371, cancelled: 29, payment_due: 4, refunded: 1 }, total: 412, page: 1, limit: 20, totalPages: 21, from: iso(-7 * DAY), to: iso(0),
  };
  const replay = {
    ...liveRequest({ id: 5466, status: "completed", phase: "done", serviceType: "car-winching", vehicleType: "car", vehicleModel: "Mahindra Bolero", address: "Thudiyalur, Coimbatore",
      customer: { id: 77, name: "Ganesh P", phoneMasked: "+91 99••• ••342", phone: "9990011342", requestNumber: 6 },
      technician: { id: 42, name: "Squad Recovery", rating: 4.9, serviceType: "car-towing", phone: "9443300507", phoneMasked: "+91 94••• ••507", jobsCompleted: 207 },
      fare: 1100, paymentMethod: "cash", paymentStatus: "completed", promisedAt: iso(-170 * MIN), arrivedAt: iso(-163 * MIN), workStartedAt: iso(-161 * MIN), completedAt: iso(-117 * MIN), live: null }),
    bill: { total: 1100, base: 600, platformFee: 132, paymentMethod: "cash", paymentStatus: "completed" },
    cancellationReason: null,
    timeline: [
      { at: iso(-180 * MIN), kind: "created", title: "Request sent", description: "Winching · cash", actorType: "customer", actorId: null, meta: {}, source: "timeline" },
      { at: iso(-179 * MIN), kind: "accepted", title: "Squad Recovery accepted", description: null, actorType: "technician", actorId: null, meta: { promisedAt: iso(-170 * MIN) }, source: "timeline" },
      { at: iso(-174 * MIN), kind: "alert", title: "Not moving for 4 min", description: null, actorType: "system", actorId: null, meta: {}, source: "alerts" },
      { at: iso(-163 * MIN), kind: "arrived", title: "Arrived", description: null, actorType: "technician", actorId: null, meta: {}, source: "timeline" },
      { at: iso(-117 * MIN), kind: "completed", title: "Work done", description: "Vehicle pulled out of the ditch", actorType: "technician", actorId: null, meta: {}, source: "timeline" },
      { at: iso(-166 * MIN), kind: "admin_note", title: "Note", description: "Called Ganesh to say the truck is 7 min away.", actorType: "admin", actorId: "ops@resqnow.test", meta: {}, source: "timeline" },
    ] as Record<string, unknown>[],
    offers: [], trail: [],
    summary: { promisedAt: iso(-170 * MIN), arrivedAt: iso(-163 * MIN), lateMinutes: 7, distanceKm: 4.2, workMinutes: 44, rating: 4, ratingComment: "Good work but came a little late." },
  };
  const requestDetails = {
    request: { id: 5466, createdTime: iso(-180 * MIN), status: "completed", priority: "Normal", serviceType: "car-winching", description: "", paymentStatus: "completed", cancellationReason: null },
    customer: { id: 77, name: "Ganesh P", phone: "9990011342", email: "", notes: null },
    vehicle: { number: "TN 37 AB 1234", type: "car", category: "suv", model: "Mahindra Bolero" },
    location: { pickupAddress: "Thudiyalur, Coimbatore", destinationAddress: null, distanceKm: 4.2 },
    fare: { customerFare: 1100, technicianEarnings: 935, platformMargin: 132, tax: 33, total: 1100, breakdown: { base_charge: 600, distance_charge: 280, labour_charge: 220, final_estimated_price: 1100 } },
    attachments: [{ id: 1, fileName: "before.jpg", url: "/uploads/before.jpg", mimeType: "image/jpeg", type: "before_photo", uploadedByType: "technician", createdAt: iso(-160 * MIN) }],
  };
  const auditRow = (over: Record<string, unknown>) => ({ technician_id: 0, name: "", status: "approved", is_active: 1, is_available: 1, service_type: "car-battery", service_area_range: 10, distance_km: 1, eligible: false, reject_reasons: [] as string[], dispatch_offer_status: null as string | null, dispatch_offer_sent_at: null, dispatch_offer_expires_at: null, ...over });
  const dispatchAudit = {
    request: { id: 5503, status: "pending", service_type: "car-battery", vehicle_type: "car", canonical_service_domain: "battery", canonical_vehicle_type: "car", address: "Peelamedu", created_at: iso(-6 * MIN) },
    criteria: {}, summary: { total_technicians: 5, eligible_count: 2, rejected_count: 3, rejection_reason_counts: { inactive: 1, service_mismatch: 1, out_of_range: 1 } },
    technicians: [
      auditRow({ technician_id: 12, name: "Murugan S", service_type: "bike-battery", distance_km: 1.8, eligible: true, dispatch_offer_status: "declined" }),
      auditRow({ technician_id: 15, name: "Senthil P", service_area_range: 15, distance_km: 2.4, eligible: true }),
      auditRow({ technician_id: 21, name: "Bala S", is_active: 0, distance_km: 3.6, reject_reasons: ["inactive"] }),
      auditRow({ technician_id: 22, name: "Karthikeyan V", service_type: "car-towing", service_area_range: 20, distance_km: 4.2, reject_reasons: ["service_mismatch"] }),
      auditRow({ technician_id: 42, name: "Squad Recovery", service_type: "car-towing", service_area_range: 5, distance_km: 6.8, reject_reasons: ["out_of_range"] }),
    ],
  };
  const paymentChecks = {
    requestId: "5466", generatedAt: iso(0),
    request: { id: 5466, status: "completed", payment_status: "pending", payment_method: "cash", amount: 1100, service_type: "car-winching", updated_at: iso(-117 * MIN) },
    payments: [{ id: 901, payment_method: "cash", status: "completed", amount: "1100.00", platform_fee: "132.00", technician_amount: "935.00", is_settled: 0, created_at: iso(-116 * MIN), razorpay_order_id: null, razorpay_payment_id: null }],
    invoices: [] as Record<string, unknown>[], technicianDues: [{ id: 51, technician_id: 42, amount: "165.00", status: "pending", created_at: iso(-116 * MIN) }],
    checks: { request_exists: true, paid_status_consistent: false, payment_row_exists_if_paid: true, invoice_exists_if_paid: false, invoice_pdf_present: true, cash_due_record_present: true },
  };
  const exceptions = {
    title: "Exceptions", monitor: { running: true, intervalMs: 45_000, lastRunAt: iso(-20_000), lastError: null as string | null },
    data: [{
      requestId: 5499, jobId: 5499, serviceType: "bike-flat-tire", status: "on-the-way", customerLocation: { address: "21, Race Course Road", lat: 11.0, lng: 76.96 },
      technician: { id: 9, name: "Ravi N", phone: "9876500118", rating: 4.6, acceptanceRate: 88, currentLat: 11.0, currentLng: 76.93 },
      reasons: [{ id: 1, code: "movement_stationary", text: "Technician appears stationary for too long while the job is active.", riskLevel: "red", lastDetectedAt: iso(-MIN) },
                { id: 2, code: "arrival_delay", text: "ETA is past the deadline.", riskLevel: "yellow", lastDetectedAt: iso(-MIN) }],
      etaMinutes: 9, etaArrival: iso(9 * MIN), slaDeadline: iso(6 * MIN), timeRemainingMs: 360_000, riskLevel: "red", firstDetectedAt: iso(-5 * MIN), lastDetectedAt: iso(-MIN),
    }] as Record<string, unknown>[],
  };
  const handledAlerts = [
    { id: 7, requestId: 5488, code: "arrival_delay", text: "ETA past deadline", technician: "Kumar T", flaggedAt: iso(-60 * MIN), resolvedAt: iso(-40 * MIN), actions: [{ type: "addInternalNote", by: "ops@resqnow.test", at: iso(-50 * MIN) }] },
    { id: 6, requestId: 5480, code: "gps_inactive", text: "GPS stopped", technician: "Vijay P", flaggedAt: iso(-120 * MIN), resolvedAt: iso(-117 * MIN), actions: [] },
  ];
  const alertRules = { intervalSeconds: 45, rules: [
    { code: "start_delay", label: "Not moving after accepting", threshold: "3 min" },
    { code: "movement_stationary", label: "Stopped on the way", threshold: "Under 80 m in 8 min" },
    { code: "gps_inactive", label: "GPS stopped updating", threshold: "8 min" },
  ] };
  const techRow = (over: Record<string, unknown>) => ({
    id: 0, name: "", owner: null as string | null, phoneMasked: "+91 94••• ••507", area: "Coimbatore", services: ["towing"], vehicles: ["car"],
    now: { state: "free" } as Record<string, unknown>, hidden: false, jobs30: 20, onTimeRate: 0.92 as number | null, rating: 4.7 as number | null, reviews: 30, acceptRate: 0.86 as number | null, offers30: 40,
    onDutyTodayMinutes: 120, dues: 0, joinedAt: iso(-200 * DAY), needsLook: false, ...over,
  });
  const technicians = {
    rows: [
      techRow({ id: 42, name: "Squad Recovery", owner: "Selvam Rajendran", area: "Thudiyalur", services: ["towing", "winching"], now: { state: "on_job", jobId: 5501, jobStatus: "towing", jobService: "car-towing", alert: null }, jobs30: 72, onDutyTodayMinutes: 370 }),
      techRow({ id: 9, name: "Ravi N", area: "Race Course", services: ["flat-tire", "fuel"], now: { state: "on_job", jobId: 5499, jobStatus: "on-the-way", jobService: "bike-flat-tire", alert: { code: "movement_stationary", text: "Stopped on the way" } }, onTimeRate: 0.84, dues: 210, needsLook: true }),
      techRow({ id: 12, name: "Murugan S", area: "Ukkadam", services: ["flat-tire", "battery", "fuel", "lockout"], onDutyTodayMinutes: 125 }),
      techRow({ id: 21, name: "Bala S", area: "Singanallur", services: ["fuel"], now: { state: "offline", lastSeenAt: iso(-20 * MIN) }, hidden: true, acceptRate: 0.61, dues: 1240, onDutyTodayMinutes: 0, needsLook: true }),
    ],
    counts: { all: 61, on_duty: 23, on_job: 9, offline: 38, hidden: 2, needs_look: 4 }, total: 61, page: 1, limit: 20, totalPages: 4,
  };
  const applicant = (over: Record<string, unknown>) => ({
    id: "0", name: "", proprietor_name: "", phone: "9876543210", email: "", status: "pending", verification_status: "pending", created_at: iso(-2 * DAY),
    address: "", locality: "Ganapathy", district: "Coimbatore", state: "Tamil Nadu", latitude: 11.03, longitude: 76.97, aadhaar_number: "123412341234", gst_number: "",
    experience: 7, serviceAreaRange: 8, specialties: ["flat-tire", "battery"], vehicle_types: { bike: true, car: true },
    working_hours: { is_24x7: false, opening_time: "07:00", closing_time: "22:00", weekly_off: "None" }, app_readiness: { preferred_language: "Tamil" },
    payment_details: { upi_id: "mani.kandan@oksbi" }, documents: { garage_front: "/uploads/a.jpg", profile_photo: "/uploads/b.jpg" }, ...over,
  });
  const applicants = [
    applicant({ id: "90", name: "MK Tyre Works", proprietor_name: "Mani Kandan", specialties: ["towing"], vehicle_types: { car: true }, created_at: iso(-2 * DAY) }),
    applicant({ id: "91", name: "QuickFix Auto", proprietor_name: "Joseph D", aadhaar_number: "", latitude: null, longitude: null, documents: {}, created_at: iso(-7 * 60 * MIN) }),
    applicant({ id: "42", name: "Squad Recovery", proprietor_name: "Selvam Rajendran", status: "approved", verification_status: "verified" }),
    applicant({ id: "60", name: "Fake Garage", status: "rejected", verification_status: "rejected" }),
  ];
  const customerRow = (over: Record<string, unknown>) => ({
    id: 0, name: "", email: "", phoneMasked: "+91 98••• ••210", joinedAt: iso(-100 * DAY), plan: null as string | null, status: "approved",
    vehicles: ["car"], requests: 1, cancelled: 0, spent: 0, lastRequestAt: iso(-3 * DAY), liveRequestId: null as number | null, ...over,
  });
  const customers = {
    rows: [
      customerRow({ id: 41, name: "Asha Raman", email: "asha@example.test", plan: "smart_care", vehicles: ["truck", "car"], requests: 3, spent: 1010, liveRequestId: 5502 }),
      customerRow({ id: 80, name: "Harish B", email: "harish@example.test", phoneMasked: "+91 99••• ••830", requests: 6, cancelled: 4, spent: 1250 }),
      customerRow({ id: 81, name: "Ramesh K", email: "ramesh@example.test", requests: 0, lastRequestAt: null, vehicles: [] }),
    ],
    counts: { all: 8214, active: 1964, members: 286, live: 8 }, joinedThisMonth: 312, total: 8214, page: 1, limit: 20, totalPages: 411,
  };
  const customer = {
    id: 41, name: "Asha Raman", email: "asha@example.test", phoneMasked: "+91 98••• ••210", phone: "9876500210", joinedAt: "2026-06-12T06:00:00.000Z", plan: "smart_care", status: "approved",
    signsInWith: "phone", live: { id: 5502, status: "on-the-way", phase: "on_the_way", service: "truck-lockout", technician: "Arun Kumar" },
    totals: { requests: 3, cancelled: 0, spent: 1010, paidJobs: 2, ratingGiven: 5, ratings: 2 },
    requests: [
      { id: 5502, status: "on-the-way", phase: "on_the_way", service: "truck-lockout", vehicleType: "truck", vehicleModel: "Tata Yodha", createdAt: iso(-11 * MIN), fare: 110, technician: { id: 7, name: "Arun Kumar" }, rating: null },
      { id: 5318, status: "completed", phase: "done", service: "truck-battery", vehicleType: "truck", vehicleModel: "Tata Yodha", createdAt: iso(-13 * DAY), fare: 450, technician: { id: 15, name: "Vijay P" }, rating: 5 },
    ],
    payments: [{ id: 700, requestId: 5318, method: "razorpay", status: "completed", amount: 450, refunded: 0, reference: "pay_Q2kfA19xVb07", at: iso(-13 * DAY) }],
    vehicles: [{ id: 1, type: "commercial", make: "Tata", model: "Yodha", plate: "TN 38 CM 4471" }, { id: 2, type: "car", make: "Maruti", model: "Swift", plate: "TN 37 DK 0912" }],
    notes: [{ id: 1, by: "ops@resqnow.test", text: "Prefers a call over messages.", at: iso(-13 * DAY) }],
  };
  const payRecord = (over: Record<string, unknown>) => ({
    payment_id: 0, service_request_id: 0, payment_method: "razorpay", payment_row_status: "completed", payment_total_amount: "450.00", platform_fee: "67.00", technician_amount: "383.00",
    is_settled: 0, payment_created_at: iso(-20 * MIN), razorpay_order_id: "order_Q2kdF8TzLm41", razorpay_payment_id: "pay_Q2kfA19xVb07", request_status: "completed",
    request_payment_status: "paid", request_payment_method: "razorpay", service_type: "car-battery", customer_name: "Gokul R", technician_name: "Murugan S",
    checks: { request_paid_consistent: true, payment_method_consistent: true }, ...over,
  });
  const paymentRecords = [
    payRecord({ payment_id: 910, service_request_id: 5496 }),
    payRecord({ payment_id: 911, service_request_id: 5495, payment_method: "cash", payment_row_status: "pending", payment_total_amount: "240.00", platform_fee: "36.00", technician_amount: "204.00", razorpay_order_id: null, razorpay_payment_id: null, request_payment_method: "cash", customer_name: "Suresh B", technician_name: "Kumar T" }),
    payRecord({ payment_id: 912, service_request_id: 5479, customer_name: "Ajay K", technician_name: "Bala S", request_payment_status: "pending", checks: { request_paid_consistent: false, payment_method_consistent: true } }),
    payRecord({ payment_id: 913, service_request_id: 5442, customer_name: "Harish B", technician_name: "Vijay P", is_settled: 1 }),
  ];
  const refundHistory = { paymentId: 913, totalAmount: 450, refundedAmount: 0, remainingRefundable: 450, refundStatus: "none", paymentStatus: "completed", paymentMethod: "razorpay", paymentToTechnicianStatus: "completed", refunds: [] as Record<string, unknown>[] };
  const withdrawal = (over: Record<string, unknown>) => ({
    id: 0, technicianId: 0, technicianName: "", amount: 0, status: "pending", upiId: null as string | null, beneficiaryName: null, note: null, rejectionReason: null,
    externalReference: null, paidAt: null, createdAt: iso(-2 * 60 * MIN), upiLink: null as string | null, ...over,
  });
  const withdrawals = [
    withdrawal({ id: 31, technicianId: 42, technicianName: "Squad Recovery", amount: 6420, upiId: "selvam.squad@okaxis", createdAt: iso(-2 * 60 * MIN), upiLink: "upi://pay?pa=selvam.squad@okaxis&am=6420.00&cu=INR" }),
    withdrawal({ id: 30, technicianId: 18, technicianName: "Arjun D", amount: 3650, upiId: "arjun.d@ybl", createdAt: iso(-20 * 60 * MIN) }),
  ];
  const wallets = [
    { technicianId: 15, technicianName: "Vijay P", upiId: "vijayp.ev@oksbi", upiName: "Vijay P", totalEarned: 92000, withdrawableBalance: 1920, totalPaidOut: 90080, onHoldBalance: 0, lastTransactionAt: iso(-DAY) },
  ];
  const payoutHistory = [
    { id: 11, technicianId: 16, technicianName: "Senthil P", upiId: "senthil@okhdfc", amount: 5200, status: "paid", payoutMethod: "manual_upi", externalReference: "428713390021", processedBy: "ops@resqnow.test", processedAt: iso(-DAY), createdAt: iso(-DAY) },
  ];
  const unsettled = [
    { transactionId: 910, requestId: 5496, user: "Gokul R", technician: "Murugan S", upiId: "murugan@ybl", amount: 450, technicianAmount: 383, platformFee: 67, paymentToTechnicianStatus: "pending", status: "completed", date: iso(-20 * MIN) },
  ];
  const cashDues = [
    { technicianId: 22, name: "Dinesh M", phoneMasked: "+91 90••• ••771", jobs: 8, amount: 1240, oldest: iso(-9 * DAY) },
    { technicianId: 23, name: "Kumar T", phoneMasked: "+91 91••• ••185", jobs: 3, amount: 480, oldest: iso(-2 * DAY) },
  ];
  const complaints = [
    { id: 1042, title: "Technician asked for ₹200 extra in cash", description: "Request #5466. Customer says the technician asked ₹200 more for a new tube.", severity: "high", status: "assigned", assigned_admin_id: "kavya@resqnow.test", created_by: "ops@resqnow.test", created_at: iso(-66 * MIN), updated_at: iso(-30 * MIN) },
    { id: 1040, title: "Technician was rude on the phone", description: "Meera S called.", severity: "low", status: "open", assigned_admin_id: null as string | null, created_by: "ops@resqnow.test", created_at: iso(-26 * 60 * MIN), updated_at: iso(-26 * 60 * MIN) },
    { id: 1031, title: "Late arrival", description: null as string | null, severity: "medium", status: "resolved", assigned_admin_id: "ops@resqnow.test", created_by: "ops@resqnow.test", created_at: iso(-5 * DAY), updated_at: iso(-4 * DAY) },
  ];
  const complaintUpdates: Record<number, Record<string, unknown>[]> = {
    1042: [
      { id: 1, update_type: "create", note_text: "Complaint created", metadata: null, created_by: "ops@resqnow.test", created_at: iso(-66 * MIN) },
      { id: 2, update_type: "assign", note_text: "Handed to kavya@resqnow.test", metadata: { assignedAdminId: "kavya@resqnow.test" }, created_by: "ops@resqnow.test", created_at: iso(-60 * MIN) },
      { id: 3, update_type: "internal_note", note_text: "Called the customer: paid ₹550 in all.", metadata: null, created_by: "kavya@resqnow.test", created_at: iso(-50 * MIN) },
    ],
  };
  const audit = [
    { id: 90, by: "kavya@resqnow.test", type: "manualAssignTechnician", group: "requests", targetType: "service_request", targetId: "5483", metadata: { technicianId: 12 }, at: iso(-20 * MIN) },
    { id: 89, by: "kavya@resqnow.test", type: "sendTechnicianLoginReminder", group: "technicians", targetType: "technician", targetId: "21", metadata: null, at: iso(-26 * MIN) },
    { id: 88, by: "ops@resqnow.test", type: "overrideRequestPricing", group: "requests", targetType: "service_request", targetId: "5474", metadata: { base_amount: 780, override_reason: "A part was needed; the customer agreed" }, at: iso(-2 * 60 * MIN) },
    { id: 87, by: "ops@resqnow.test", type: "technicianBroadcast", group: "messages", targetType: "broadcast", targetId: "7,12,18", metadata: { title: "Flat tyre kits: collect from the office", technicianCount: 3 }, at: iso(-5 * 60 * MIN) },
    { id: 86, by: "ops@resqnow.test", type: "emergencyMessage", group: "messages", targetType: "broadcast", targetId: "all", metadata: { title: "Ukkadam flyover closed until noon" }, at: iso(-3 * DAY) },
    { id: 85, by: "ops@resqnow.test", type: "resolveComplaint", group: "complaints", targetType: "complaint", targetId: "1031", metadata: null, at: iso(-4 * DAY) },
  ];
  const serviceMaster = [
    { id: 1, service_name: "Flat Tire Repair", service_slug: "flat_tire_repair", description: null, icon: null, active: 1 },
    { id: 3, service_name: "Towing Services", service_slug: "towing_services", description: null, icon: null, active: 1 },
    { id: 8, service_name: "Winching Services", service_slug: "winching_services", description: null, icon: null, active: 0 },
  ];
  const serviceStats = [
    { id: 1, name: "Flat Tire Repair", slug: "flat_tire_repair", domain: "flat-tire", active: true, technicians: 26, priceMin: 230, priceMax: 450, requests30: 366 },
    { id: 3, name: "Towing Services", slug: "towing_services", domain: "towing", active: true, technicians: 14, priceMin: 400, priceMax: 950, requests30: 412 },
    { id: 8, name: "Winching Services", slug: "winching_services", domain: "winching", active: false, technicians: 6, priceMin: null, priceMax: null, requests30: 52 },
  ];
  const pricingFieldsAll = [
    { id: 6, service_id: 3, field_key: "base_charge", field_label: "Base Charge", field_type: "Number", required: 1, sort_order: 1 },
    { id: 7, service_id: 3, field_key: "free_distance", field_label: "Free Distance", field_type: "Number", required: 1, sort_order: 2 },
    { id: 1, service_id: 1, field_key: "visit_charge", field_label: "Visit Charge", field_type: "Number", required: 1, sort_order: 1 },
  ];
  const emailTemplates = [
    { eventType: "REQUEST_CONFIRMED", subject: "Your ResQNow help is booked · #{{requestId}}", content: "<h2>Your help is booked, {{name}}</h2><p>We have your request #{{requestId}} for {{serviceType}}.</p>", updatedAt: iso(-13 * DAY) },
    { eventType: "TECHNICIAN_APPROVED", subject: "You're approved", content: "<p>Welcome aboard, {{name}}.</p>", updatedAt: null },
  ];
  return {
    live, today, notifications, record, profile, template, pricing, medians, payouts, activity,
    requests, replay, requestDetails, dispatchAudit, paymentChecks,
    exceptions, handledAlerts, alertRules,
    technicians,
    applicants,
    customers, customer,
    paymentRecords, refundHistory,
    withdrawals, wallets, payoutHistory, unsettled, cashDues,
    complaints, complaintUpdates,
    audit,
    serviceMaster, serviceStats, pricingFieldsAll,
    emailTemplates,
    navCounts: { live: 3, alerts: 1, applications: 4, payouts: 3, complaints: 5 },
    calls: [] as { method: string; path: string; body: unknown }[],
  };
}
export type PortalWorld = ReturnType<typeof portalWorld>;

export async function fakeAdminSocket(page: Page) {
  const sockets = new Set<WebSocketRoute>();
  await page.routeWebSocket(/\/socket\.io\//, (ws) => {
    sockets.add(ws);
    ws.send(`0${JSON.stringify({ sid: `e2e-${sockets.size}`, upgrades: [], pingInterval: 25000, pingTimeout: 20000, maxPayload: 1e6 })}`);
    ws.onClose(() => sockets.delete(ws));
    ws.onMessage((message) => {
      const text = String(message);
      if (text === "2") return ws.send("3");
      if (text.startsWith("40")) return ws.send(`40${JSON.stringify({ sid: `e2e-socket-${sockets.size}` })}`);
      const match = /^42(\d+)(\[.*\])$/.exec(text);
      if (match) ws.send(`43${match[1]}${JSON.stringify([{ ok: true, location: null }])}`);
    });
  });
  return { send: (event: string, data: unknown) => sockets.forEach((ws) => ws.send(`42${JSON.stringify([event, data])}`)) };
}

type Handler = (args: { path: string; url: URL; method: string; body: unknown; reply: (status: number, body: unknown) => Promise<void>; w: PortalWorld; route: Route }) => Promise<void> | void | Promise<boolean> | boolean;

/** Opens an admin page with the pretend back end. `extra` answers anything a test adds; return true when handled. */
export async function openPortal(page: Page, path: string, { world = portalWorld(), extra, signedOut = false }: { world?: PortalWorld; extra?: Handler; signedOut?: boolean } = {}) {
  const w = world;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  if (!signedOut) await page.addInitScript((token) => {
    localStorage.setItem("resqnow_admin_token", token);
    localStorage.setItem("resqnow_admin_user", JSON.stringify({ id: "admin", name: "Admin", email: "ops@resqnow.test", role: "admin" }));
  }, ADMIN_TOKEN);
  await page.route(/\/src\/lib\/mapProvider\/mapplsSdk\.ts(\?.*)?$/, (route) => route.fulfill({ contentType: "application/javascript", body: fakeMappls }));
  const socket = await fakeAdminSocket(page);
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const call = route.request();
    const url = new URL(call.url());
    const method = call.method();
    const p = url.pathname;
    let body: unknown = null;
    try { body = call.postData() ? JSON.parse(call.postData() || "null") : null; } catch { body = call.postData(); }
    const reply = (status: number, data: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    if (method !== "GET") w.calls.push({ method, path: p, body });
    if (extra && (await extra({ path: p, url, method, body, reply, w, route }))) return;
    if (p === "/api/admin/login" && method === "POST") {
      const input = body as { email: string; password: string };
      if (input.email !== "ops@resqnow.test" || input.password !== "right-password") return reply(401, { error: "Invalid email or password." });
      return reply(200, { token: ADMIN_TOKEN, admin: { email: "ops@resqnow.test", name: "Admin", role: "admin", id: "admin" } });
    }
    if (p === "/api/admin/portal/nav-counts") return reply(200, w.navCounts);
    if (p === "/api/admin/portal/today") return reply(200, w.today);
    if (p === "/api/admin/monitor/live") return reply(200, w.live);
    if (p === "/api/admin/notifications/count") return reply(200, { count: w.notifications.filter((n) => !n.is_read).length, pendingApplications: w.navCounts.applications });
    if (p === "/api/admin/notifications") return reply(200, w.notifications);
    if (/^\/api\/admin\/notifications\/\d+\/read$/.test(p)) { const id = Number(p.split("/")[4]); w.notifications = w.notifications.map((n) => (n.id === id ? { ...n, is_read: 1 } : n)); return reply(200, { success: true }); }
    if (p === "/api/admin/portal/notifications/read-all") { w.notifications = w.notifications.map((n) => ({ ...n, is_read: 1 })); return reply(200, { ok: true }); }
    if (p === "/api/admin/portal/search") {
      const q = (url.searchParams.get("q") || "").toLowerCase();
      return reply(200, {
        query: q,
        requests: q.includes("asha") || q.includes("5502") ? [{ id: 5502, status: "on-the-way", phase: "on_the_way", service: "truck-lockout", vehicleType: "truck", vehicleModel: "Tata Yodha", area: "Bharathi Nagar", createdAt: iso(-11 * MIN), fare: 110, customer: "Asha Raman", technician: "Arun Kumar" }] : [],
        customers: q.includes("asha") ? [{ id: 41, name: "Asha Raman", email: "asha@example.test", phoneMasked: "+91 98••• ••210", joinedAt: iso(-100 * DAY), plan: "smart_care", requests: 3 }] : [],
        technicians: q.includes("selvam") ? [{ id: 42, name: "Squad Recovery", owner: "Selvam Rajendran", phoneMasked: "+91 94••• ••507", status: "approved", onDuty: true, currentJobId: 5501, service: "towing" }] : [],
        payments: [],
      });
    }
    if (p === "/api/admin/portal/requests") {
      const tab = url.searchParams.get("tab") || "all";
      const rows = w.requests.rows.filter((row) => tab === "all" || (tab === "cancelled" ? row.phase === "cancelled" : tab === "completed" ? row.phase === "done" : tab === "refunded" ? row.payment.refunded > 0 : false));
      return reply(200, { ...w.requests, rows });
    }
    if (/^\/api\/admin\/monitor\/requests\/\d+\/replay$/.test(p)) return reply(200, { ...w.replay, id: Number(p.split("/")[5]) });
    if (/^\/api\/admin\/requests\/\d+$/.test(p) && method === "GET") return reply(200, w.requestDetails);
    if (/^\/api\/admin\/dispatch-audit\/\d+$/.test(p)) return reply(200, w.dispatchAudit);
    if (/^\/api\/payments\/diagnostics\/request\/\d+$/.test(p)) {
      const id = Number(p.split("/").pop());
      if (id === 5442) return reply(200, { ...w.paymentChecks, requestId: "5442", request: { ...w.paymentChecks.request, id: 5442, payment_status: "paid", payment_method: "razorpay", service_type: "car-battery" }, payments: [{ id: 913, payment_method: "razorpay", status: "completed", amount: "450.00", platform_fee: "67.00", technician_amount: "383.00", is_settled: 1, created_at: iso(-DAY), razorpay_order_id: "order_X", razorpay_payment_id: "pay_PxH3k2LmQ9" }], technicianDues: [], checks: { ...w.paymentChecks.checks, paid_status_consistent: true } });
      return reply(200, w.paymentChecks);
    }
    if (p === "/api/admin/requests/high-priority" && method === "POST") { w.requestDetails = { ...w.requestDetails, request: { ...w.requestDetails.request, priority: "High" } }; return reply(200, { success: true }); }
    if (/^\/api\/admin\/monitor\/requests\/\d+\/notes$/.test(p) && method === "POST") {
      w.replay = { ...w.replay, timeline: [...w.replay.timeline, { at: iso(0), kind: "admin_note", title: "Note", description: (body as { note: string }).note, actorType: "admin", actorId: "ops@resqnow.test", meta: {}, source: "timeline" }] };
      return reply(201, { success: true });
    }
    if (p === "/api/admin/command-center/exceptions") return reply(200, w.exceptions);
    if (p === "/api/admin/portal/alerts/handled") return reply(200, w.handledAlerts);
    if (p === "/api/admin/portal/alerts/rules") return reply(200, w.alertRules);
    if (p === "/api/admin/command-center/monitor/run" && method === "POST") return reply(200, { success: true, trigger: "manual", jobsScanned: 3, alertsDetected: 1, alertsResolved: 0 });
    if (p === "/api/admin/command-center/actions/remind-technician" && method === "POST") return reply(200, { success: true });
    if (p === "/api/admin/command-center/actions/reassign" && method === "POST") { w.exceptions = { ...w.exceptions, data: [] }; return reply(200, { success: true, requestId: 5499, candidatesFound: 2, candidates: [] }); }
    if (/^\/api\/admin\/requests\/\d+\/assign$/.test(p) && method === "POST") return reply(200, { success: true });
    if (p === "/api/admin/portal/technicians") {
      const tab = url.searchParams.get("tab") || "all";
      const rows = w.technicians.rows.filter((row) => tab === "all" || (tab === "hidden" ? row.hidden : tab === "needs_look" ? row.needsLook : tab === "offline" ? row.now.state === "offline" : tab === "on_job" ? row.now.state === "on_job" : row.now.state !== "offline"));
      return reply(200, { ...w.technicians, rows });
    }
    if (/^\/api\/admin\/technicians\/\d+$/.test(p) && method === "DELETE") { const id = Number(p.split("/")[4]); w.technicians = { ...w.technicians, rows: w.technicians.rows.filter((row) => row.id !== id) }; return reply(200, { success: true }); }
    if (p === "/api/public/location-search") return reply(200, { results: [{ id: "sg", lat: 10.9989, lng: 77.027, label: "Trichy Road, Singanallur, Coimbatore", name: "Singanallur", address: "12/4, Trichy Road, Singanallur, Coimbatore" }] });
    if (p === "/api/public/reverse-geocode") return reply(200, { display_name: "Trichy Road, Singanallur, Coimbatore, Tamil Nadu, 641005", address: { suburb: "Singanallur", city: "Coimbatore", county: "Coimbatore", state: "Tamil Nadu", postcode: "641005" } });
    if (p === "/api/upload" && method === "POST") return reply(200, { url: "/uploads/technicians/shop-front.jpg" });
    if (p === "/api/technicians/create" && method === "POST") return reply(201, { id: "77", status: (body as { status?: string })?.status || "pending" });
    if (p === "/api/technicians/42/profile" && method === "PUT") return reply(200, { success: true, id: "42" });
    if (p === "/api/technicians/list") return reply(200, w.applicants);
    if (p === "/api/technicians/90/service-pricing") return reply(200, w.pricing.map((row) => ({ ...row, pricing_json: JSON.stringify(row.pricing_json) })));
    if (p === "/api/technicians/91/service-pricing") return reply(200, []);
    if (/^\/api\/technicians\/\d+\/approval-audit$/.test(p) && !p.includes("/42/")) return reply(200, []);
    if (/^\/api\/technicians\/\d+\/(approve|reject)$/.test(p) && method === "PATCH") {
      const id = p.split("/")[3];
      const approve = p.endsWith("/approve");
      w.applicants = w.applicants.map((row) => (row.id === id ? { ...row, status: approve ? "approved" : "rejected", verification_status: approve ? "verified" : "rejected" } : row));
      return reply(200, { success: true });
    }
    if (p === "/api/admin/portal/customers") {
      const tab = url.searchParams.get("tab") || "all";
      return reply(200, { ...w.customers, rows: w.customers.rows.filter((row) => tab === "all" || (tab === "live" ? row.liveRequestId != null : tab === "members" ? Boolean(row.plan) : true)) });
    }
    if (p === "/api/admin/portal/customers/41") return reply(200, w.customer);
    if (/^\/api\/admin\/portal\/customers\/\d+$/.test(p)) return reply(200, { ...w.customer, id: Number(p.split("/").pop()), name: "Lakshmi Narayanan", email: "lakshmi.n@example.test", plan: null, live: null, signsInWith: "email", totals: { requests: 0, cancelled: 0, spent: 0, paidJobs: 0, ratingGiven: null, ratings: 0 }, requests: [], payments: [], vehicles: [], notes: [] });
    if (p === "/api/admin/portal/customers/41/notes" && method === "POST") {
      w.customer = { ...w.customer, notes: [{ id: 2, by: "ops@resqnow.test", text: (body as { note: string }).note, at: iso(0) }, ...w.customer.notes] };
      return reply(201, { ok: true });
    }
    if (p === "/api/admin/users" && method === "POST") return reply(201, { id: 99, message: "User created." });
    if (/^\/api\/admin\/users\/\d+$/.test(p) && method === "PUT") { w.customer = { ...w.customer, name: (body as { name: string }).name }; return reply(200, { message: "User updated successfully." }); }
    if (/^\/api\/admin\/users\/\d+$/.test(p) && method === "DELETE") return reply(200, { message: "deleted" });
    if (p === "/api/payments/diagnostics/overview") return reply(200, { generatedAt: iso(0), stats: {}, records: w.paymentRecords });
    if (p === "/api/admin-extended/finance/flagged-payments") return reply(200, { flaggedPayments: [{ payment_id: 911, service_request_id: 5495, flag_reason: "stale_pending" }], totalFlagged: 1 });
    if (/^\/api\/admin\/finance\/refunds\/\d+$/.test(p)) return reply(200, w.refundHistory);
    if (/^\/api\/admin\/finance\/refund\/\d+$/.test(p) && method === "POST") {
      const amount = (body as { refundAmount: number }).refundAmount;
      w.refundHistory = { ...w.refundHistory, refundedAmount: amount, remainingRefundable: 450 - amount, refunds: [{ id: 1, refundReference: "rfnd_1", amount, technicianAdjustmentAmount: Math.round(383 * amount / 450), status: "processed", reason: (body as { reason: string }).reason, requestedBy: "ops@resqnow.test", createdAt: iso(0) }] };
      return reply(200, { success: true, refundStatus: "partial" });
    }
    if (p === "/api/admin/finance/export") return route.fulfill({ status: 200, contentType: "text/csv", body: "payment_id\n910\n" });
    const paged = (data: unknown[]) => ({ data, pagination: { page: 1, limit: 100, total: data.length, totalPages: 1 } });
    if (p === "/api/admin/finance/withdrawal-requests") return reply(200, paged(w.withdrawals.filter((row) => row.status === (url.searchParams.get("status") || "pending"))));
    if (/^\/api\/admin\/finance\/withdrawal-requests\/\d+\/(mark-paid|reject)$/.test(p) && method === "POST") {
      const id = Number(p.split("/")[5]);
      const paid = p.endsWith("mark-paid");
      w.withdrawals = w.withdrawals.map((row) => (row.id === id ? { ...row, status: paid ? "paid" : "rejected" } : row));
      if (paid) w.payoutHistory = [{ id: 12, technicianId: 42, technicianName: "Squad Recovery", upiId: "selvam.squad@okaxis", amount: 6420, status: "paid", payoutMethod: "manual_upi", externalReference: (body as { externalReference: string }).externalReference, processedBy: "ops@resqnow.test", processedAt: iso(0), createdAt: iso(0) }, ...w.payoutHistory];
      return reply(201, { success: true });
    }
    if (p === "/api/admin/finance/wallets") return reply(200, paged(w.wallets));
    if (p === "/api/admin/finance/payouts" && method === "GET") return reply(200, paged(w.payoutHistory));
    if (p === "/api/admin/finance/payouts" && method === "POST") return reply(201, { success: true, payoutId: 13 });
    if (p === "/api/admin/finance/transactions") return reply(200, paged(w.unsettled));
    if (/^\/api\/admin\/pay-technician\/\d+$/.test(p) && method === "POST") { w.unsettled = []; return reply(200, { success: true }); }
    if (p === "/api/admin/portal/cash-dues") return reply(200, w.cashDues);
    if (/^\/api\/admin-extended\/notifications\/(technician-broadcast|system-announcement|emergency-message)$/.test(p) && method === "POST") {
      const ids = (body as { technicianIds?: number[] }).technicianIds;
      return reply(200, { success: true, payload: { technicianIds: ids || [], targetCount: ids?.length || 61, title: (body as { title: string }).title } });
    }
    if (p === "/api/admin/finance/payout-queue/export") return route.fulfill({ status: 200, contentType: "text/csv", body: "technician_id,amount\n42,6420\n" });
    if (p === "/api/admin/portal/reports") {
      const days = Number(url.searchParams.get("days") || 30);
      const heat = Array.from({ length: 7 }, (_, day) => Array.from({ length: 24 }, (_, hour) => (day === 5 && (hour === 18 || hour === 19) ? 9 : hour >= 8 && hour <= 21 ? 2 : 0)));
      return reply(200, {
        days, from: iso(-(days - 1) * DAY), to: iso(0),
        kpis: { requests: 1748, previousRequests: 1560, completed: 1571, completedRate: 0.899, averageArrivalMinutes: 13.2, collected: 1190000, previousCollected: 1091000, margin: 143000, cancelledRate: 0.074, previousCancelledRate: 0.082 },
        perDay: Array.from({ length: days }, (_, i) => ({ date: new Date(Date.now() - (days - 1 - i) * DAY).toISOString().slice(0, 10), completed: 50 + (i % 7), cancelled: 4, other: 1 })),
        funnel: [{ step: "requested", count: 1748 }, { step: "offered", count: 1731 }, { step: "accepted", count: 1690 }, { step: "arrived", count: 1612 }, { step: "completed", count: 1571 }, { step: "paid", count: 1566 }],
        busyHours: heat,
        serviceMix: [{ service: "towing", count: 412 }, { service: "flat-tire", count: 366 }, { service: "battery", count: 301 }],
        cancellations: { total: 129, reasons: [{ reason: "Found help nearby", count: 41 }, { reason: "Took too long to find one", count: 33 }, { reason: "Technician cancelled", count: 14 }] },
      });
    }
    if (p === "/api/admin-extended/complaints" && method === "GET") return reply(200, { complaints: w.complaints, pagination: { limit: 200, offset: 0, total: w.complaints.length } });
    if (p === "/api/admin-extended/complaints" && method === "POST") {
      const input = body as { title: string; description?: string; severity: string };
      w.complaints = [{ id: 1050, title: input.title, description: input.description || null, severity: input.severity, status: "open", assigned_admin_id: null, created_by: "ops@resqnow.test", created_at: iso(0), updated_at: iso(0) }, ...w.complaints];
      w.complaintUpdates[1050] = [{ id: 9, update_type: "create", note_text: "Complaint created", metadata: null, created_by: "ops@resqnow.test", created_at: iso(0) }];
      return reply(201, { success: true, complaintId: 1050, status: "open" });
    }
    if (/^\/api\/admin-extended\/complaints\/\d+$/.test(p)) {
      const id = Number(p.split("/").pop());
      return reply(200, { complaint: w.complaints.find((row) => row.id === id), updates: w.complaintUpdates[id] || [] });
    }
    if (/^\/api\/admin-extended\/complaints\/\d+\/(assign|resolve|internal-note)$/.test(p) && method === "POST") {
      const id = Number(p.split("/")[4]);
      const kind = p.split("/").pop();
      const input = body as { assignedAdminId?: string; resolutionNote?: string; note?: string };
      w.complaints = w.complaints.map((row) => (row.id !== id ? row : kind === "assign" ? { ...row, status: "assigned", assigned_admin_id: input.assignedAdminId || null } : kind === "resolve" ? { ...row, status: "resolved" } : row));
      w.complaintUpdates[id] = [...(w.complaintUpdates[id] || []), { id: Date.now(), update_type: kind === "internal-note" ? "internal_note" : kind, note_text: input.note || input.resolutionNote || null, metadata: kind === "assign" ? { assignedAdminId: input.assignedAdminId } : null, created_by: "ops@resqnow.test", created_at: iso(0) }];
      return reply(200, { success: true });
    }
    if (p === "/api/admin/portal/audit") {
      const group = url.searchParams.get("group") || "";
      const search = (url.searchParams.get("search") || "").toLowerCase();
      const rows = w.audit.filter((row) => (!group || group === "all" || row.group === group) && (!search || JSON.stringify(row).toLowerCase().includes(search)));
      const counts = { all: w.audit.length, requests: 2, technicians: 1, complaints: 1, messages: 2, other: 0 };
      return reply(200, { rows, total: rows.length, page: 1, limit: 25, totalPages: 1, days: Number(url.searchParams.get("days") || 7), counts });
    }
    if (p === "/api/admin/services" && method === "GET") return reply(200, w.serviceMaster);
    if (p === "/api/admin/services" && method === "POST") { w.serviceMaster = [...w.serviceMaster, { id: 20, service_name: (body as { service_name: string }).service_name, service_slug: "new", description: null, icon: null, active: 1 }]; return reply(200, { id: 20 }); }
    if (/^\/api\/admin\/services\/\d+$/.test(p) && method === "PUT") { const id = Number(p.split("/").pop()); w.serviceMaster = w.serviceMaster.map((row) => (row.id === id ? { ...row, active: (body as { active: boolean }).active ? 1 : 0 } : row)); return reply(200, { success: true }); }
    if (/^\/api\/admin\/services\/\d+$/.test(p) && method === "DELETE") { const id = Number(p.split("/").pop()); w.serviceMaster = w.serviceMaster.filter((row) => row.id !== id); return reply(200, { success: true }); }
    if (p === "/api/admin/portal/services/stats") return reply(200, w.serviceStats);
    if (p === "/api/admin/vehicle-categories" && method === "GET") return reply(200, w.template.categories);
    if (p === "/api/admin/vehicle-subcategories" && method === "GET") return reply(200, w.template.subcategories);
    if (p === "/api/admin/pricing-fields" && method === "GET") return reply(200, w.pricingFieldsAll);
    if (p === "/api/admin/pricing-fields" && method === "POST") { const input = body as { service_id: number; field_key: string; field_label: string; required: boolean }; w.pricingFieldsAll = [...w.pricingFieldsAll, { id: 99, service_id: input.service_id, field_key: input.field_key, field_label: input.field_label, field_type: "Number", required: input.required ? 1 : 0, sort_order: 3 }]; return reply(200, { id: 99 }); }
    if (/^\/api\/admin\/pricing-fields\/\d+$/.test(p) && method === "DELETE") { const id = Number(p.split("/").pop()); w.pricingFieldsAll = w.pricingFieldsAll.filter((row) => row.id !== id); return reply(200, { success: true }); }
    if (p === "/api/admin/fleets" && method === "GET") return reply(200, w.template.fleets);
    if (p === "/api/admin/portal/settings") return reply(200, {
      admin: { email: "ops@resqnow.test" },
      dispatch: { offerTimeoutSeconds: 10, retryDelaySeconds: 30, maxRetries: 5, recoveryWindowMinutes: 30 },
      monitoring: { intervalSeconds: 45, rules: [{ code: "start_delay", label: "Not moving after accepting", threshold: "3 min" }, { code: "gps_inactive", label: "GPS stopped updating", threshold: "8 min" }] },
      phoneSignIn: { configured: true },
    });
    if (p === "/api/admin/email-templates" && method === "GET") return reply(200, w.emailTemplates);
    if (/^\/api\/admin\/email-templates\/[A-Z_]+$/.test(p) && method === "PUT") {
      const eventType = p.split("/").pop() as string;
      const input = body as { subject: string; content: string };
      w.emailTemplates = w.emailTemplates.map((row) => (row.eventType === eventType ? { ...row, ...input, updatedAt: iso(0) } : row));
      return reply(200, w.emailTemplates.find((row) => row.eventType === eventType));
    }
    if (p === "/api/admin/monitor/technicians/42/record") return reply(200, w.record);
    if (p === "/api/admin/monitor/technicians/42/jobs") return reply(200, { data: [], pagination: { page: 1, limit: 12, total: 0, totalPages: 1 } });
    if (p === "/api/admin/monitor/technicians/42/reviews") return reply(200, { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } });
    if (p === "/api/technicians/42" && method === "GET") return reply(200, w.profile);
    if (p === "/api/technicians/42/approval-audit") return reply(200, [{ id: 1, technician_id: 42, action: "approved", previous_status: "pending", new_status: "approved", reason: "Documents checked", admin_email: "ops@resqnow.test", created_at: "2026-03-03T06:00:00.000Z" }]);
    if (p === "/api/admin-extended/technicians/42/admin-notes") return reply(200, { technicianId: 42, notes: [{ id: 1, adminId: "ops@resqnow.test", noteType: "note", note: "Good with night jobs.", metadata: null, createdAt: iso(-20 * DAY) }] });
    if (p === "/api/technicians/42/service-pricing") return reply(200, w.pricing);
    if (p === "/api/technicians/pricing-template") return reply(200, w.template);
    if (p === "/api/admin/portal/prices/medians") return reply(200, w.medians);
    if (p === "/api/admin/portal/technicians/42/payouts") return reply(200, w.payouts);
    if (p === "/api/admin/technician/42/login-activity") return reply(200, w.activity);
    if (p === "/api/admin/technician/toggle" && method === "POST") {
      const { technicianId, isVisible } = body as { technicianId: number; isVisible: boolean };
      if (technicianId === 42) w.profile = { ...w.profile, admin_hidden: !isVisible };
      w.technicians = { ...w.technicians, rows: w.technicians.rows.map((row) => (row.id === technicianId ? { ...row, hidden: !isVisible } : row)) };
      return reply(200, { success: true });
    }
    if (p === "/api/admin/technician/note" && method === "POST") return reply(200, { success: true });
    if (p === "/api/admin/technician/send-login-reminder" && method === "POST") return reply(200, { success: true });
    return reply(200, {});
  });
  await page.goto(path);
  return { w, socket, errors };
}

/** Waits until the app's launch splash is gone and nothing covers the middle of the page. */
export async function ready(page: Page) {
  await expect.poll(() => page.evaluate(() => !document.elementFromPoint(innerWidth / 2, innerHeight / 2)?.closest(".fixed.inset-0.z-50"))).toBe(true);
}
/** True when nothing makes the page wider than the screen. Uses the layout width: on phones innerWidth grows with the overflow. */
export const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
export async function shot(page: Page, name: string, project: string) {
  const dir = process.env.ADMIN_SHOTS_DIR;
  if (!dir) return;
  await ready(page);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${dir}/${project}-${name}.png`, animations: "disabled", fullPage: true });
}
