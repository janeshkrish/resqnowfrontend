import { useState, useCallback } from 'react';

export interface GeolocationCoordinates {
  lat: number;
  lng: number;
}

export interface UseGeolocationReturn {
  coordinates: GeolocationCoordinates | null;
  address: string | null;
  loading: boolean;
  error: string | null;
  requestLocation: () => void;
  reset: () => void;
}

/**
 * Custom hook for geolocation with reverse geocoding
 * Handles permission states, errors, and address auto-fill
 */
export function useGeolocation(): UseGeolocationReturn {
  const [coordinates, setCoordinates] = useState<GeolocationCoordinates | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Helper: Reverse geocode coordinates to address
  const reverseGeocode = useCallback(async (lat: number, lng: number): Promise<string> => {
    try {
      const response = await fetch(
        `/api/public/reverse-geocode?lat=${lat}&lng=${lng}`
      );

      if (!response.ok) {
        console.warn('[Geocode] API failed, using fallback coordinates');
        return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }

      const data = await response.json();
      const resolvedAddress = data.display_name || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      console.log('[Geocode] Success:', resolvedAddress);
      return resolvedAddress;
    } catch (err) {
      console.error('[Geocode] Error:', err);
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }, []);

  // Helper: Check if geolocation API is available
  const isSupported = (): boolean => {
    const isHttps = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
    return !!navigator.geolocation && isHttps;
  };

  // Main function: Request user location
  const requestLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    // Validate browser & security
    if (!navigator.geolocation) {
      setError('Geolocation API not available. Please use a modern browser.');
      setLoading(false);
      console.error('[Geolocation] API not supported');
      return;
    }

    // HTTPS check for production
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      setError('Geolocation requires HTTPS. Please connect securely.');
      setLoading(false);
      console.error('[Geolocation] Not HTTPS or localhost');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const newCoordinates = { lat: latitude, lng: longitude };

          console.log('[Geolocation] Success:', { latitude, longitude });
          setCoordinates(newCoordinates);

          // Reverse geocode to get address
          const resolvedAddress = await reverseGeocode(latitude, longitude);
          setAddress(resolvedAddress);

          setLoading(false);
        } catch (err) {
          console.error('[Geolocation] Processing error:', err);
          setError('Error processing location data');
          setLoading(false);
        }
      },
      (err) => {
        console.error('[Geolocation] Error code:', err.code, 'Message:', err.message);

        // Meaningful error messages based on permission state
        let errorMessage = 'Unable to get location. Please try again.';

        if (err.code === 1) {
          // PERMISSION_DENIED
          errorMessage = 'Location permission denied. Please enable location access in browser settings.';
        } else if (err.code === 2) {
          // POSITION_UNAVAILABLE
          errorMessage = 'Location unavailable. Check GPS/location services.';
        } else if (err.code === 3) {
          // TIMEOUT
          errorMessage = 'Location request timed out. Please try again.';
        } else if (err.code === 5) {
          // UNKNOWN_ERROR or permission prompt dismissed
          errorMessage = 'Location access not granted. Tap "Find Me" again to try.';
        }

        setError(errorMessage);
        setCoordinates(null);
        setAddress(null);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }, [reverseGeocode]);

  // Reset state
  const reset = useCallback(() => {
    setCoordinates(null);
    setAddress(null);
    setLoading(false);
    setError(null);
  }, []);

  return {
    coordinates,
    address,
    loading,
    error,
    requestLocation,
    reset
  };
}
