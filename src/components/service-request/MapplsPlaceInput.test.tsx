import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MapplsPlaceInput from "./MapplsPlaceInput";
import type { MapplsPlaceSearchResult } from "@/lib/mapProvider/mapplsSdk";

const { searchMapplsPlaces } = vi.hoisted(() => ({
  searchMapplsPlaces: vi.fn(),
}));

vi.mock("@/lib/mapProvider/mapplsSdk", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/mapProvider/mapplsSdk")>();
  return { ...original, searchMapplsPlaces };
});

function result(name: string): MapplsPlaceSearchResult {
  return {
    id: name,
    placeId: name,
    label: `${name}, Coimbatore`,
    name,
    address: `${name}, Coimbatore`,
    lat: 11.01,
    lng: 76.95,
    provider: "mappls",
    category: "LOCALITY",
  };
}

function Harness({ onPlaceSelect = vi.fn() }: { onPlaceSelect?: ReturnType<typeof vi.fn> }) {
  const [value, setValue] = useState("");
  return (
    <MapplsPlaceInput
      id="pickup"
      name="location"
      value={value}
      placeholder="Search pickup address..."
      onTextChange={(_name, nextValue) => setValue(nextValue)}
      onPlaceSelect={onPlaceSelect}
    />
  );
}

describe("Mappls place input", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    searchMapplsPlaces.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not let a slower, stale response replace the latest suggestions", async () => {
    const pending = new Map<string, (places: MapplsPlaceSearchResult[]) => void>();
    searchMapplsPlaces.mockImplementation((query: string) => new Promise((resolve) => {
      pending.set(query, resolve);
    }));
    render(<Harness />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "Old Place" } });
    await act(async () => { vi.advanceTimersByTime(300); });
    fireEvent.change(input, { target: { value: "New Place" } });
    await act(async () => { vi.advanceTimersByTime(300); });

    await act(async () => { pending.get("New Place")?.([result("New Place")]); });
    expect(screen.getByRole("option", { name: /New Place/i })).toBeInTheDocument();

    await act(async () => { pending.get("Old Place")?.([result("Old Place")]); });
    expect(screen.queryByRole("option", { name: /Old Place/i })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /New Place/i })).toBeInTheDocument();
  });

  it("does not immediately search again after a suggestion is selected", async () => {
    searchMapplsPlaces.mockResolvedValue([result("RS Puram")]);
    render(<Harness />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "RS Puram" } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});
    fireEvent.click(screen.getByRole("option", { name: /RS Puram/i }));
    await act(async () => { vi.advanceTimersByTime(300); });

    expect(screen.getByRole("combobox")).toHaveValue("RS Puram, Coimbatore");
    expect(searchMapplsPlaces).toHaveBeenCalledTimes(1);
  });

  it("clears rendered suggestions as soon as the query changes", async () => {
    const onPlaceSelect = vi.fn();
    searchMapplsPlaces.mockResolvedValue([result("Resolved Old Place")]);
    render(<Harness onPlaceSelect={onPlaceSelect} />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "Resolved Old Place" } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});
    expect(screen.getByRole("option", { name: /Resolved Old Place/i })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Brand New Query" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.queryByRole("option", { name: /Resolved Old Place/i })).not.toBeInTheDocument();
    expect(onPlaceSelect).not.toHaveBeenCalled();
  });

  it("stops showing a pending spinner when switching to cached suggestions", async () => {
    let resolvePending: ((places: MapplsPlaceSearchResult[]) => void) | undefined;
    searchMapplsPlaces.mockImplementation((query: string) => {
      if (query === "Cached Location") return Promise.resolve([result("Cached Location")]);
      return new Promise((resolve) => { resolvePending = resolve; });
    });
    const view = render(<Harness />);
    const input = screen.getByRole("combobox");

    fireEvent.change(input, { target: { value: "Cached Location" } });
    await act(async () => { vi.advanceTimersByTime(300); });
    await act(async () => {});
    expect(screen.getByRole("option", { name: /Cached Location/i })).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Still Pending" } });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(view.container.querySelector(".animate-spin")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Cached Location" } });
    await act(async () => { vi.advanceTimersByTime(300); });
    expect(view.container.querySelector(".animate-spin")).not.toBeInTheDocument();

    await act(async () => { resolvePending?.([]); });
  });
});
