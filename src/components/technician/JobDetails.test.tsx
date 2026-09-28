import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { readJobDetails } from "@/lib/technicianJobDetails";
import { JobDetailsList } from "./JobDetails";

describe("readJobDetails", () => {
  it("reads the details the backend adds to job alerts", () => {
    const details = readJobDetails({
      vehicleLine: "Maruti Suzuki Swift · Hatchback",
      towTruckType: "wheel-lift",
      towTruckLabel: "Wheel-lift",
      problem: ["Breakdown", "Can be pushed"],
      answers: [{ id: "why", value: "breakdown", label: "Breakdown" }],
      landmark: "Opposite the petrol bunk",
      plate: "TN 37 AB 1234",
      customerNote: null,
      urgent: false,
      attachments: [
        { type: "photo", url: "/api/upload/files/1-tyre.jpg" },
        { type: "voice", url: "https://elsewhere.example/voice.webm" },
      ],
    });
    expect(details).toMatchObject({
      vehicleLine: "Maruti Suzuki Swift · Hatchback",
      towTruckLabel: "Wheel-lift",
      problem: ["Breakdown", "Can be pushed"],
      landmark: "Opposite the petrol bunk",
      urgent: false,
      // Only our own uploads are shown.
      attachments: [{ type: "photo", url: "/api/upload/files/1-tyre.jpg" }],
    });
  });

  it("reads a raw request row with the stored JSON", () => {
    const details = readJobDetails({
      vehicle_brand: "Tata Motors",
      vehicle_model: "Tata Motors Nexon",
      vehicle_subtype: "compact-suv",
      request_details_json: JSON.stringify({
        answers: [{ id: "inside", value: "yes", label: "Someone inside" }, { id: "what", value: "inside", label: "Locked inside" }],
        note: "Baby in the back seat",
      }),
    });
    expect(details).toMatchObject({
      vehicleLine: "Tata Motors Nexon · Small SUV",
      problem: ["Someone inside", "Locked inside"],
      customerNote: "Baby in the back seat",
      urgent: true,
      urgentReason: "Someone is stuck inside the vehicle",
    });
  });

  it("has nothing to show for requests made before the new form", () => {
    expect(readJobDetails({ vehicle_type: "car", vehicle_model: "SUV - Creta", description: "Flat tyre" })).toBeNull();
    expect(readJobDetails(null)).toBeNull();
  });
});

describe("JobDetailsList", () => {
  it("shows the urgency, answers, truck, landmark, plate, photo and voice note", () => {
    render(
      <JobDetailsList
        details={{
          vehicleLine: "Honda Activa 125 · Scooter",
          towTruckLabel: "Flatbed",
          problem: ["Someone hurt", "Accident"],
          landmark: "Gate 2",
          plate: "KA 05 HX 7781",
          customerNote: "Near the bus stop",
          urgent: true,
          urgentReason: "Someone is hurt",
          attachments: [
            { type: "photo", url: "/api/upload/files/1-photo.jpg" },
            { type: "voice", url: "/api/upload/files/2-voice.webm" },
          ],
        }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("Urgent · Someone is hurt");
    expect(screen.getByRole("list", { name: "Customer says" })).toHaveTextContent("Someone hurtAccident");
    expect(screen.getByText("Flatbed")).toBeInTheDocument();
    expect(screen.getByText("Gate 2")).toBeInTheDocument();
    expect(screen.getByText("KA 05 HX 7781")).toBeInTheDocument();
    expect(screen.getByText("Near the bus stop")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open photo 1 from the customer" })).toHaveAttribute("href", expect.stringContaining("/api/upload/files/1-photo.jpg"));
    expect(screen.getByLabelText("Voice note 1 from the customer")).toHaveAttribute("src", expect.stringContaining("/api/upload/files/2-voice.webm"));
  });
});
