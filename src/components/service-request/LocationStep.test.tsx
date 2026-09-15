import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import LocationStep from "./LocationStep";
import type { ServiceRequestFormData } from "./types";

const { searchMapplsPlaces } = vi.hoisted(() => ({
  searchMapplsPlaces: vi.fn(),
}));

vi.mock("@/lib/mapProvider/mapplsSdk", () => ({ searchMapplsPlaces }));
vi.mock("@/lib/mapProvider/MapplsMapSurface", () => ({
  MapplsMapSurface: (props: any) => (
    <div role="application" aria-label={props.ariaLabel}>
      <button type="button" onClick={() => props.onMapClick?.({ lat: 11.03, lng: 76.98 })}>
        Choose map point
      </button>
      {props.markers.map((marker: any) => (
        <button
          key={marker.id}
          type="button"
          onClick={() => marker.onDragEnd?.({ lat: 11.04, lng: 76.99 })}
        >
          Drag {marker.id}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("react-leaflet", () => ({
  MapContainer: () => <div>Leaflet map</div>,
  TileLayer: () => <div>OpenStreetMap layer</div>,
  Marker: ({ children }: any) => <div>{children}</div>,
  Popup: ({ children }: any) => <div>{children}</div>,
  Polyline: () => null,
  useMap: () => ({ flyTo: vi.fn(), fitBounds: vi.fn() }),
  useMapEvents: vi.fn(),
}));
vi.mock("leaflet", () => ({
  default: {
    icon: vi.fn(() => ({})),
    Marker: { prototype: { options: {} } },
  },
}));
vi.mock("@react-google-maps/api", () => ({
  useJsApiLoader: () => ({ isLoaded: false, loadError: null }),
}));
vi.mock("@/lib/geo", () => ({
  fetchRoute: vi.fn(),
  reverseGeocode: vi.fn().mockResolvedValue({ address: "Pinned address" }),
  routePolylineFromMetadata: vi.fn(() => []),
  searchLocations: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/googlePlaces", () => ({
  getGoogleMapsApiKey: () => "",
  reverseGeocodeWithGoogle: vi.fn().mockResolvedValue({ address: "Pinned address", placeId: null }),
}));

const formData: ServiceRequestFormData = {
  name: "",
  phone: "",
  vehicleType: "car",
  vehicleSubtype: "",
  vehicleModel: "",
  location: "",
  locationLat: 11.0168,
  locationLng: 76.9558,
  locationCoordinates: { lat: 11.0168, lng: 76.9558 },
  details: "",
  selectedTechnicianId: null,
};

function LocationHarness({
  onInputChange,
  onLocationSelect,
  initialData = formData,
}: {
  onInputChange: ReturnType<typeof vi.fn>;
  onLocationSelect: ReturnType<typeof vi.fn>;
  initialData?: ServiceRequestFormData;
}) {
  const [data, setData] = useState(initialData);
  return (
    <LocationStep
      formData={data}
      onInputChange={(event) => {
        onInputChange(event);
        setData((previous) => ({ ...previous, [event.target.name]: event.target.value }));
      }}
      currentLocation=""
      isGettingLocation={false}
      onGetCurrentLocation={vi.fn()}
      onLocationSelect={onLocationSelect}
    />
  );
}

describe("service request Mappls location step", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchMapplsPlaces.mockResolvedValue([{
      id: "ABC123",
      placeId: "ABC123",
      label: "RS Puram, Coimbatore, Tamil Nadu, 641002",
      name: "RS Puram",
      address: "RS Puram, Coimbatore, Tamil Nadu, 641002",
      lat: 11.0086,
      lng: 76.9504,
      provider: "mappls",
      category: "LOCALITY",
    }]);
  });

  it("uses Mappls search while preserving the pickup selection contract", async () => {
    const onInputChange = vi.fn();
    const onLocationSelect = vi.fn();
    render(<LocationHarness onInputChange={onInputChange} onLocationSelect={onLocationSelect} />);

    expect(screen.getByRole("application", { name: "Service request location map" })).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Pickup Location" }), {
      target: { value: "RS Puram" },
    });
    fireEvent.click(await screen.findByRole("option", { name: /RS Puram, Coimbatore/i }));

    expect(onLocationSelect).toHaveBeenCalledWith(
      11.0086,
      76.9504,
      "RS Puram, Coimbatore, Tamil Nadu, 641002",
      "ABC123",
    );
    expect(onInputChange).toHaveBeenCalledWith(expect.objectContaining({
      target: { name: "location", value: "RS Puram, Coimbatore, Tamil Nadu, 641002" },
    }));
  });

  it("keeps towing pickup/drop map interactions on their existing callbacks", async () => {
    const onLocationSelect = vi.fn();
    const onDropLocationSelect = vi.fn();
    render(
      <LocationStep
        formData={{ ...formData, dropLocation: "", dropLat: 11.05, dropLng: 77.01 }}
        onInputChange={vi.fn()}
        currentLocation=""
        isGettingLocation={false}
        onGetCurrentLocation={vi.fn()}
        onLocationSelect={onLocationSelect}
        requiresDropLocation
        onDropLocationSelect={onDropLocationSelect}
      />,
    );

    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Choose map point" }));
    await waitFor(() => expect(onDropLocationSelect).toHaveBeenCalledWith(11.03, 76.98));

    fireEvent.click(screen.getByRole("button", { name: "Drag pickup" }));
    await waitFor(() => expect(onLocationSelect).toHaveBeenCalledWith(11.04, 76.99));
  });

  it("does not bias Mappls search to the display fallback before coordinates are acquired", async () => {
    const onInputChange = vi.fn();
    render(
      <LocationHarness
        initialData={{
          ...formData,
          locationCoordinates: undefined,
          locationLat: 0,
          locationLng: 0,
        }}
        onInputChange={onInputChange}
        onLocationSelect={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Pickup Location" }), {
      target: { value: "Coimbatore" },
    });

    await waitFor(() => expect(searchMapplsPlaces).toHaveBeenCalledWith(
      "Coimbatore",
      { limit: 7, location: null },
    ));
  });
});
