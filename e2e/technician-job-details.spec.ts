import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";

// What resqnowbackend/services/technicianJobDetails.js adds to offers and the active job.
const jobDetails = {
  vehicleBrand: "Maruti Suzuki",
  vehicleName: "Maruti Suzuki Swift",
  vehicleSubtype: "hatchback",
  vehicleSubtypeLabel: "Hatchback",
  vehicleLine: "Maruti Suzuki Swift · Hatchback",
  towTruckType: "flatbed",
  towTruckLabel: "Flatbed",
  problem: ["Accident", "Won’t move"],
  answers: [
    { id: "why", question: "What happened?", value: "accident", label: "Accident" },
    { id: "roll", question: "Can the vehicle be pushed?", value: "no", label: "Won’t move" },
  ],
  landmark: "Opposite the petrol bunk",
  plate: "TN 37 AB 1234",
  customerNote: "Front bumper is hanging",
  urgent: false,
  attachments: [
    { type: "photo", url: "/api/upload/files/1727-bumper.jpg" },
    { type: "voice", url: "/api/upload/files/1728-voice-note.webm" },
  ],
};

const PHOTO = readFileSync(new URL("../public/images/vehicles/car.webp", import.meta.url));

async function signIn(page: Page, extra: (path: string) => unknown | undefined) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  // A signed-in technician: the test token only ever reaches the mocked API below.
  await page.addInitScript(() => localStorage.setItem("resqnow_technician_token", "e2e-technician-token"));
  await page.route((url) => url.hostname === "api.e2e.test", async (route) => {
    const url = new URL(route.request().url());
    const reply = (status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname.startsWith("/api/upload/files/")) return route.fulfill({ contentType: "image/webp", body: PHOTO });
    if (url.pathname === "/api/technicians/me") {
      return reply(200, {
        id: 7, name: "Arun Kumar", email: "arun@example.test", phone: "9876500000", status: "approved", verification_status: "verified",
        is_active: true, is_available: true, service_type: "towing", specialties: ["towing"], vehicle_types: ["car", "bike"],
      });
    }
    const custom = extra(url.pathname);
    if (custom !== undefined) return reply(200, custom);
    return reply(404, {});
  });
  return { errors };
}

test("a job offer shows the vehicle, what the customer said, the truck and their photo", async ({ page }) => {
  await signIn(page, (path) => {
    if (path === "/api/service-requests/5501/technician-offer") {
      return {
        available: true,
        request: {
          id: "5501", requestId: "5501", serviceType: "car-towing", service_type: "car-towing", vehicleType: "car",
          vehicleModel: "Maruti Suzuki Swift", customerName: "Asha", address: "21, Race Course Road, Coimbatore",
          status: "pending", offer_status: "offered", location: { lat: 11.0168, lng: 76.9558, address: "21, Race Course Road, Coimbatore" },
          distance: 2.4, amount: 820, isTowing: true, description: "What happened?: Accident", ...jobDetails,
        },
      };
    }
    return undefined;
  });

  await page.goto("/technician/dashboard?jobId=5501");
  const offer = page.getByRole("dialog");
  await expect(offer.getByText("Maruti Suzuki Swift · Hatchback")).toBeVisible();
  const details = offer.getByTestId("job-details");
  await expect(details.getByRole("list", { name: "Customer says" })).toHaveText(/Accident\s*Won’t move/);
  // The truck sits on the card's top line, the landmark with the address, the note with the answers.
  await expect(offer).toContainText("New request · Flatbed needed");
  await expect(offer.getByTestId("job-location")).toContainText("21, Race Course Road, Coimbatore");
  await expect(offer.getByTestId("job-location")).toContainText("Opposite the petrol bunk");
  await expect(details).toContainText("“Front bumper is hanging”");
  const photo = details.getByRole("link", { name: "Open photo 1 from the customer" });
  await expect(photo).toHaveAttribute("href", "http://api.e2e.test/api/upload/files/1727-bumper.jpg");
  await expect.poll(() => photo.locator("img").evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  await expect(details.getByLabel("Voice note 1 from the customer")).toHaveAttribute("src", "http://api.e2e.test/api/upload/files/1728-voice-note.webm");
  if (process.env.REQUEST_SHOTS_DIR) await page.screenshot({ path: `${process.env.REQUEST_SHOTS_DIR}/${test.info().project.name}-tech-offer.png` });
});

test("the active job shows the same details, with urgent jobs flagged", async ({ page }) => {
  await signIn(page, (path) => {
    if (path === "/api/technicians/me/active-job") {
      return {
        requestId: "5502", id: "5502", jobStatus: "accepted", status: "accepted", customerName: "Asha", serviceType: "car-lockout",
        vehicleDetails: "Maruti Suzuki Swift · Hatchback", phoneNumber: "9876543210", address: "21, Race Course Road, Coimbatore",
        pickupLatitude: 11.0168, pickupLongitude: 76.9558, amount: 399, isTowing: false,
        ...jobDetails,
        towTruckType: null, towTruckLabel: null,
        problem: ["Someone inside", "Locked inside"],
        answers: [{ id: "inside", question: "Is a child, person or pet stuck inside?", value: "yes", label: "Someone inside" }],
        urgent: true,
      };
    }
    if (path === "/api/technicians/me/dues") return { dues: 0 };
    return undefined;
  });

  await page.goto("/technician/active-job/5502");
  const details = page.getByTestId("job-details");
  await expect(page.getByRole("alert")).toContainText("Urgent · Someone is stuck inside the vehicle");
  await expect(details.getByRole("list", { name: "Customer says" })).toHaveText(/Someone inside\s*Locked inside/);
  // The plate sits with the vehicle, and a lockout asks for no truck.
  await expect(page.getByTestId("job-vehicle")).toContainText("TN 37 AB 1234");
  await expect(page.getByTestId("job-vehicle")).not.toContainText("needed");
  await expect(page.getByText("Maruti Suzuki Swift · Hatchback").first()).toBeVisible();
  if (process.env.REQUEST_SHOTS_DIR) await page.screenshot({ path: `${process.env.REQUEST_SHOTS_DIR}/${test.info().project.name}-tech-active.png`, fullPage: true });
});
