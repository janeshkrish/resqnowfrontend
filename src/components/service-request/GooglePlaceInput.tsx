import { useEffect, useRef, useState } from "react";
import { Input } from "../ui/input";
import { Loader2, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    google?: any;
    __resqnowGoogleMapsPromise?: Promise<void>;
  }
}

type GooglePlaceInputProps = {
  id: string;
  name: string;
  value: string;
  placeholder: string;
  iconTone?: "pickup" | "drop";
  onTextChange: (name: string, value: string) => void;
  onPlaceSelect: (place: { address: string; lat: number; lng: number }) => void;
  disabled?: boolean;
};

function loadGooglePlaces() {
  const apiKey = String(import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "").trim();
  if (!apiKey) return Promise.resolve(false);
  if (window.google?.maps?.places) return Promise.resolve(true);
  if (!window.__resqnowGoogleMapsPromise) {
    window.__resqnowGoogleMapsPromise = new Promise<void>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-resqnow-google-maps]");
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true });
        existing.addEventListener("error", reject, { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.dataset.resqnowGoogleMaps = "true";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Google Maps failed to load"));
      document.head.appendChild(script);
    });
  }
  return window.__resqnowGoogleMapsPromise.then(() => Boolean(window.google?.maps?.places)).catch(() => false);
}

export default function GooglePlaceInput({
  id,
  name,
  value,
  placeholder,
  iconTone = "pickup",
  onTextChange,
  onPlaceSelect,
  disabled,
}: GooglePlaceInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [placesReady, setPlacesReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    loadGooglePlaces()
      .then((ready) => {
        if (cancelled) return;
        setPlacesReady(ready);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!placesReady || !inputRef.current || autocompleteRef.current) return;
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      fields: ["formatted_address", "geometry", "name"],
      types: ["geocode", "establishment"],
    });
    autocompleteRef.current.addListener("place_changed", () => {
      const place = autocompleteRef.current?.getPlace?.();
      const location = place?.geometry?.location;
      if (!location) return;
      onPlaceSelect({
        address: place.formatted_address || place.name || inputRef.current?.value || "",
        lat: location.lat(),
        lng: location.lng(),
      });
    });
  }, [onPlaceSelect, placesReady]);

  const toneClass = iconTone === "drop" ? "text-rose-500" : "text-emerald-600";

  return (
    <div className="relative">
      <MapPin className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", toneClass)} />
      <Input
        ref={inputRef}
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        onChange={(event) => onTextChange(name, event.target.value)}
        placeholder={placeholder}
        className="h-12 rounded-xl border-slate-200 bg-white pl-10 pr-10 text-sm font-semibold text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:ring-slate-300"
        autoComplete="off"
      />
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
      </div>
    </div>
  );
}
