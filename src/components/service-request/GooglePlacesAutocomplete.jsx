import { useEffect, useMemo, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { AlertCircle, Loader2, MapPin, Search } from "lucide-react";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import { getGoogleMapsApiKey } from "@/lib/googlePlaces";

const GOOGLE_LIBRARIES = ["places"];
const COIMBATORE_CENTER = { lat: 11.0168, lng: 76.9558 };
const SEARCH_DEBOUNCE_MS = 300;

const normalizeAddressValue = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value.formatted_address || value.address || value.description || "";
};

const predictionLabel = (prediction) => {
  const formatting = prediction?.structured_formatting || {};
  return {
    main: formatting.main_text || prediction?.description || "Location",
    secondary: formatting.secondary_text || prediction?.description || "",
  };
};

export default function GooglePlacesAutocomplete({
  id,
  name,
  value,
  placeholder,
  iconTone = "pickup",
  onTextChange,
  onPlaceSelect,
  disabled,
  autoFocus,
}) {
  const wrapperRef = useRef(null);
  const autocompleteServiceRef = useRef(null);
  const placesServiceRef = useRef(null);
  const selectedValueRef = useRef("");
  const [predictions, setPredictions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputValue = normalizeAddressValue(value);
  const query = inputValue.trim();
  const apiKey = getGoogleMapsApiKey();

  const { isLoaded, loadError } = useJsApiLoader({
    id: "resqnow-google-places-script",
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_LIBRARIES,
  });

  const cacheKey = useMemo(() => query.toLowerCase(), [query]);
  const cacheRef = useRef(new Map());

  useEffect(() => {
    if (!isLoaded || !window.google?.maps?.places) return;
    if (!autocompleteServiceRef.current) {
      autocompleteServiceRef.current = new window.google.maps.places.AutocompleteService();
    }
    if (!placesServiceRef.current) {
      placesServiceRef.current = new window.google.maps.places.PlacesService(document.createElement("div"));
    }
  }, [isLoaded]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (disabled || query.length < 2) {
      setPredictions([]);
      setError("");
      setIsSearching(false);
      return;
    }

    if (query === selectedValueRef.current) {
      setPredictions([]);
      setError("");
      setIsSearching(false);
      return;
    }

    if (!apiKey || loadError) {
      setPredictions([]);
      setError("Unable to fetch locations");
      setIsOpen(true);
      setIsSearching(false);
      return;
    }

    if (!isLoaded || !autocompleteServiceRef.current) {
      setIsSearching(true);
      setError("");
      setIsOpen(true);
      return;
    }

    if (cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey) || [];
      setPredictions(cached);
      setActiveIndex(cached.length > 0 ? 0 : -1);
      setError("");
      setIsSearching(false);
      setIsOpen(true);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setError("");
    setIsOpen(true);

    const timer = window.setTimeout(() => {
      const request = {
        input: query,
        componentRestrictions: { country: "in" },
        location: new window.google.maps.LatLng(COIMBATORE_CENTER.lat, COIMBATORE_CENTER.lng),
        radius: 70000,
        region: "in",
      };

      autocompleteServiceRef.current.getPlacePredictions(request, (nextPredictions, status) => {
        if (cancelled) return;

        const placesStatus = window.google.maps.places.PlacesServiceStatus;
        setIsSearching(false);

        if (status === placesStatus.OK && Array.isArray(nextPredictions)) {
          cacheRef.current.set(cacheKey, nextPredictions);
          setPredictions(nextPredictions);
          setActiveIndex(nextPredictions.length > 0 ? 0 : -1);
          setError("");
          return;
        }

        if (status === placesStatus.ZERO_RESULTS) {
          cacheRef.current.set(cacheKey, []);
          setPredictions([]);
          setActiveIndex(-1);
          setError("");
          return;
        }

        setPredictions([]);
        setActiveIndex(-1);
        setError("Unable to fetch locations");
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiKey, cacheKey, disabled, isLoaded, loadError, query]);

  const selectPrediction = (prediction) => {
    if (!prediction || !placesServiceRef.current) return;

    setIsSearching(true);
    setError("");

    placesServiceRef.current.getDetails(
      {
        placeId: prediction.place_id,
        fields: ["formatted_address", "geometry", "place_id", "name"],
      },
      (place, status) => {
        setIsSearching(false);
        const placesStatus = window.google.maps.places.PlacesServiceStatus;

        if (status !== placesStatus.OK || !place?.geometry?.location) {
          setError("Unable to fetch locations");
          setIsOpen(true);
          return;
        }

        const address = place.formatted_address || prediction.description;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        const placeId = place.place_id || prediction.place_id;

        selectedValueRef.current = address.trim();
        onTextChange(name, address);
        onPlaceSelect({
          address,
          formatted_address: address,
          lat,
          lng,
          placeId,
        });
        setPredictions([]);
        setActiveIndex(-1);
        setIsOpen(false);
      }
    );
  };

  const handleKeyDown = (event) => {
    if (!isOpen && ["ArrowDown", "ArrowUp"].includes(event.key)) {
      setIsOpen(true);
      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(predictions.length - 1, index + 1));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
      return;
    }

    if (event.key === "Enter" && isOpen && activeIndex >= 0 && predictions[activeIndex]) {
      event.preventDefault();
      selectPrediction(predictions[activeIndex]);
    }
  };

  const toneClass = iconTone === "drop" ? "text-rose-500" : "text-emerald-600";
  const statusIcon = isSearching ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : error ? (
    <AlertCircle className="h-4 w-4 text-amber-500" />
  ) : (
    <Search className="h-4 w-4" />
  );

  const showDropdown = isOpen && (predictions.length > 0 || error || isSearching || query.length >= 2);

  return (
    <div ref={wrapperRef} className="relative">
      <MapPin className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", toneClass)} />
      <Input
        id={id}
        name={name}
        value={inputValue}
        disabled={disabled}
        autoFocus={autoFocus}
        onChange={(event) => {
          if (event.target.value.trim() !== selectedValueRef.current) {
            selectedValueRef.current = "";
          }
          onTextChange(name, event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-12 rounded-xl border-slate-200 bg-white pl-10 pr-10 text-sm font-semibold text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:ring-slate-300"
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={`${id}-google-places-results`}
      />
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
        {statusIcon}
      </div>

      {showDropdown && (
        <div
          id={`${id}-google-places-results`}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-[900] max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          {isSearching && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs font-semibold text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Searching locations...
            </div>
          )}

          {!isSearching &&
            predictions.map((prediction, index) => {
              const label = predictionLabel(prediction);
              return (
                <button
                  key={prediction.place_id || `${prediction.description}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectPrediction(prediction)}
                  className={cn(
                    "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    activeIndex === index ? "bg-slate-100" : "hover:bg-slate-50"
                  )}
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100">
                    <MapPin className={cn("h-4 w-4", toneClass)} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900">{label.main}</span>
                    <span className="line-clamp-2 text-xs font-medium leading-snug text-slate-500">{label.secondary}</span>
                  </span>
                </button>
              );
            })}

          {!isSearching && error && (
            <div className="flex items-center gap-2 px-3 py-3 text-xs font-semibold text-amber-700">
              <AlertCircle className="h-3.5 w-3.5" />
              Unable to fetch locations
            </div>
          )}

          {!isSearching && !error && predictions.length === 0 && query.length >= 2 && (
            <p className="px-3 py-3 text-xs font-semibold text-slate-500">No matching places found.</p>
          )}
        </div>
      )}
    </div>
  );
}
