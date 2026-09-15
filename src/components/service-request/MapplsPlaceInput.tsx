import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { AlertCircle, Loader2, MapPin, RotateCw, Search } from "lucide-react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import {
  searchMapplsPlaces,
  type MapplsPlaceSearchResult,
} from "@/lib/mapProvider/mapplsSdk";

type MapplsPlaceInputProps = {
  id: string;
  name: string;
  value: string;
  placeholder: string;
  iconTone?: "pickup" | "drop";
  locationBias?: { lat: number; lng: number } | null;
  onTextChange: (name: string, value: string) => void;
  onPlaceSelect: (place: {
    address: string;
    formatted_address: string;
    lat: number;
    lng: number;
    placeId: string;
  }) => void;
  disabled?: boolean;
};

const searchCache = new Map<string, MapplsPlaceSearchResult[]>();

export default function MapplsPlaceInput({
  id,
  name,
  value,
  placeholder,
  iconTone = "pickup",
  locationBias,
  onTextChange,
  onPlaceSelect,
  disabled,
}: MapplsPlaceInputProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const requestRevisionRef = useRef(0);
  const selectedValueRef = useRef<string | null>(null);
  const [results, setResults] = useState<MapplsPlaceSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const query = value.trim();
  const cacheKey = useMemo(
    () => [
      query.toLowerCase(),
      Number.isFinite(locationBias?.lat) ? locationBias?.lat.toFixed(3) : "",
      Number.isFinite(locationBias?.lng) ? locationBias?.lng.toFixed(3) : "",
    ].join(":"),
    [locationBias?.lat, locationBias?.lng, query],
  );

  const runSearch = useCallback(async (
    useCache = true,
    requestRevision = ++requestRevisionRef.current,
  ) => {
    if (disabled || query.length < 2) {
      if (requestRevision === requestRevisionRef.current) {
        setResults([]);
        setError(null);
        setIsLoading(false);
      }
      return;
    }
    if (useCache && searchCache.has(cacheKey)) {
      const cached = searchCache.get(cacheKey) || [];
      if (requestRevision === requestRevisionRef.current) {
        setResults(cached);
        setActiveIndex(cached.length > 0 ? 0 : -1);
        setIsOpen(true);
        setIsLoading(false);
        setError(null);
      }
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsOpen(true);
    try {
      const nextResults = await searchMapplsPlaces(query, {
        limit: 7,
        location: locationBias,
      });
      searchCache.set(cacheKey, nextResults);
      if (requestRevision === requestRevisionRef.current) {
        setResults(nextResults);
        setActiveIndex(nextResults.length > 0 ? 0 : -1);
      }
    } catch (searchError: unknown) {
      if (requestRevision === requestRevisionRef.current) {
        setResults([]);
        setError(searchError instanceof Error ? searchError.message : "Mappls location search failed.");
        setActiveIndex(-1);
      }
    } finally {
      if (requestRevision === requestRevisionRef.current) setIsLoading(false);
    }
  }, [cacheKey, disabled, locationBias, query]);

  useEffect(() => {
    const requestRevision = ++requestRevisionRef.current;
    if (selectedValueRef.current === query) {
      selectedValueRef.current = null;
      setResults([]);
      setError(null);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }
    setResults([]);
    setActiveIndex(-1);
    setError(null);
    if (disabled || query.length < 2) {
      setIsLoading(false);
      setIsOpen(false);
      return;
    }
    setIsLoading(true);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      void runSearch(true, requestRevision);
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [cacheKey, disabled, query, runSearch]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const selectResult = (result: MapplsPlaceSearchResult) => {
    selectedValueRef.current = result.address;
    requestRevisionRef.current += 1;
    onTextChange(name, result.address);
    onPlaceSelect({
      address: result.address,
      formatted_address: result.address,
      lat: result.lat,
      lng: result.lng,
      placeId: result.placeId,
    });
    setResults([]);
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
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
      setActiveIndex((index) => Math.min(results.length - 1, index + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "Enter" && isOpen && activeIndex >= 0 && results[activeIndex]) {
      event.preventDefault();
      selectResult(results[activeIndex]);
    }
  };

  const toneClass = iconTone === "drop" ? "text-rose-500" : "text-emerald-600";
  const statusIcon = isLoading ? (
    <Loader2 className="h-4 w-4 animate-spin" />
  ) : error ? (
    <AlertCircle className="h-4 w-4 text-amber-500" />
  ) : (
    <Search className="h-4 w-4" />
  );

  return (
    <div ref={wrapperRef} className="relative">
      <MapPin className={cn("pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2", toneClass)} />
      <Input
        id={id}
        name={name}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          selectedValueRef.current = null;
          requestRevisionRef.current += 1;
          setResults([]);
          setActiveIndex(-1);
          setError(null);
          setIsLoading(event.target.value.trim().length >= 2);
          onTextChange(name, event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (results.length > 0 || error) setIsOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-12 rounded-xl border-slate-200 bg-white pl-10 pr-10 text-sm font-semibold text-slate-900 shadow-none placeholder:text-slate-400 focus-visible:ring-slate-300"
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={`${id}-mappls-results`}
      />
      <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
        {statusIcon}
      </div>

      {isOpen && (results.length > 0 || error || (query.length >= 2 && !isLoading)) && (
        <div
          id={`${id}-mappls-results`}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+0.4rem)] z-[900] max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl"
        >
          {results.map((result, index) => (
            <button
              key={`${result.id}-${index}`}
              type="button"
              role="option"
              aria-selected={activeIndex === index}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectResult(result)}
              className={cn(
                "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                activeIndex === index ? "bg-slate-100" : "hover:bg-slate-50",
              )}
            >
              <MapPin className={cn("mt-0.5 h-4 w-4 shrink-0", toneClass)} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-900">{result.name || result.label}</span>
                <span className="line-clamp-2 text-xs font-medium leading-snug text-slate-500">{result.address}</span>
              </span>
            </button>
          ))}

          {error && (
            <div className="space-y-2 px-3 py-3">
              <p className="text-xs font-semibold text-amber-700">Unable to fetch Mappls locations.</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-8 gap-2 rounded-lg text-xs"
                onClick={() => void runSearch(false)}
              >
                <RotateCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          )}

          {!error && !isLoading && results.length === 0 && query.length >= 2 && (
            <p className="px-3 py-3 text-xs font-semibold text-slate-500">No matching Mappls locations found.</p>
          )}
        </div>
      )}
    </div>
  );
}
