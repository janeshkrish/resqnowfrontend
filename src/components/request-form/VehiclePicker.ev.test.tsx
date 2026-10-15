import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VehiclePicker from "./VehiclePicker";
import { choiceFromCatalog, manualChoice, searchCatalog, type VehicleChoice } from "@/lib/vehicleChoice";

function Picker({ initial }: { initial: VehicleChoice }) {
  const [choice, setChoice] = useState(initial);
  return <><VehiclePicker family="ev" garage={[]} choice={choice} onChange={patch => setChoice(previous => ({ ...previous, ...patch }))} /><output data-testid="vehicle-choice">{JSON.stringify(choice)}</output></>;
}
const choice = () => JSON.parse(screen.getByTestId("vehicle-choice").textContent || "{}");

describe("EV body selection", () => {
  it("retains the selected brand when its EV model is not listed and while the manual name changes", () => {
    const model = searchCatalog("ev", "ather 450x").find(entry => entry.model === "450X")!;
    render(<Picker initial={choiceFromCatalog(model, "ev")} />);
    fireEvent.click(screen.getByRole("button", { name: /^Model/ }));
    fireEvent.click(screen.getByRole("button", { name: /Model not listed/ }));
    expect(choice()).toMatchObject({ vehicleBrand: "Ather Energy", vehicleSource: "manual", catalogModelId: null, catalogBrandId: null, vehicleSubtype: "", vehicleBaseSubtype: "" });
    fireEvent.change(screen.getByRole("textbox", { name: "Name of your EV" }), { target: { value: "Prototype X" } });
    expect(choice()).toMatchObject({ vehicleBrand: "Ather Energy", vehicleModel: "Prototype X", catalogModelId: null, vehicleSubtype: "", vehicleBaseSubtype: "" });
  });

  it("lets a customer enter a brand for a completely unknown manual EV", () => {
    render(<Picker initial={{ ...manualChoice("Prototype X"), vehicleSubtype: "electric-bike", vehicleBaseSubtype: "sports-bike" }} />);
    fireEvent.change(screen.getByRole("textbox", { name: "EV brand" }), { target: { value: "Local Motors" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Name of your EV" }), { target: { value: "Prototype Y" } });
    expect(choice()).toMatchObject({ vehicleBrand: "Local Motors", vehicleModel: "Prototype Y", catalogModelId: null, vehicleSubtype: "", vehicleBaseSubtype: "" });
  });

  it("keeps the known catalogue body when a customer selects an electric car", () => {
    render(<Picker initial={{}} />);
    fireEvent.click(screen.getByRole("button", { name: "Type your EV’s name" }));
    fireEvent.change(screen.getByRole("searchbox", { name: "Type your EV’s name" }), { target: { value: "Tiago EV" } });
    fireEvent.click(screen.getByRole("button", { name: /Tata Tiago EV/ }));
    expect(choice()).toMatchObject({ vehicleSubtype: "electric-car", vehicleBaseSubtype: "hatchback", vehicleModel: "Tata Motors Tiago EV" });
  });

  it("offers only relevant body choices for a manually named EV and clears stale choices on a class change", () => {
    render(<Picker initial={{ ...manualChoice("Prototype EV"), vehicleSubtype: "electric-car" }} />);
    let body = screen.getByRole("radiogroup", { name: /^EV body type/ });
    expect(within(body).getAllByRole("radio").map(option => option.textContent)).toEqual(["Hatchback", "Sedan", "Not sure"]);
    fireEvent.click(within(body).getByRole("radio", { name: "Sedan" }));
    expect(choice()).toMatchObject({ vehicleSubtype: "electric-car", vehicleBaseSubtype: "sedan" });

    fireEvent.click(screen.getByRole("radio", { name: "E-bike" }));
    expect(choice()).toMatchObject({ vehicleSubtype: "electric-bike", vehicleBaseSubtype: "" });
    body = screen.getByRole("radiogroup", { name: /^EV body type/ });
    expect(within(body).queryByRole("radio", { name: "Sedan" })).toBeNull();
    fireEvent.click(within(body).getByRole("radio", { name: "Sports" }));
    expect(choice()).toMatchObject({ vehicleSubtype: "electric-bike", vehicleBaseSubtype: "sports-bike" });

    fireEvent.click(screen.getByRole("radio", { name: "E-SUV" }));
    body = screen.getByRole("radiogroup", { name: /^EV body type/ });
    expect(within(body).getByRole("radio", { name: "Small SUV" })).toBeInTheDocument();
    expect(within(body).getByRole("radio", { name: "SUV / MUV" })).toBeInTheDocument();
    fireEvent.click(within(body).getByRole("radio", { name: "Not sure" }));
    expect(choice().vehicleBaseSubtype).toBe("");
  });
});
