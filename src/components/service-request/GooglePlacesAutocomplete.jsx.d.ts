import type { FC } from "react";

export type GooglePlacesAutocompleteSelection = {
  address: string;
  formatted_address?: string;
  lat: number;
  lng: number;
  placeId?: string | null;
};

export type GooglePlacesAutocompleteProps = {
  id: string;
  name: string;
  value: string | Record<string, unknown> | null | undefined;
  placeholder: string;
  iconTone?: "pickup" | "drop";
  onTextChange: (name: string, value: string) => void;
  onPlaceSelect: (place: GooglePlacesAutocompleteSelection) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

declare const GooglePlacesAutocomplete: FC<GooglePlacesAutocompleteProps>;

export default GooglePlacesAutocomplete;
