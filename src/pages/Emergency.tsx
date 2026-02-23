
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ArrowRight, MapPin, AlertTriangle, Loader } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/use-toast";

const Emergency = () => {
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [progress, setProgress] = useState(10);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    // Auto-detect location when component mounts
    detectLocation();
    
    // Simulate progress
    const interval = setInterval(() => {
      setProgress((prevProgress) => {
        const newProgress = prevProgress + 10;
        if (newProgress >= 100) {
          clearInterval(interval);
        }
        return newProgress > 100 ? 100 : newProgress;
      });
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const detectLocation = () => {
    setIsLoadingLocation(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError("Geolocation is not supported by your browser");
      setIsLoadingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Use reverse geocoding to get human-readable address
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
          );
          
          if (!response.ok) throw new Error("Failed to fetch location data");
          
          const data = await response.json();
          const address = data.display_name || "Unknown location";
          
          setCurrentLocation(address);
          toast({
            title: "Location detected",
            description: "We've found your location in Tamil Nadu automatically.",
          });
        } catch (error) {
          console.error("Error getting location:", error);
          setLocationError("Could not determine your exact address. Please enter it manually.");
          setCurrentLocation(`Lat: ${position.coords.latitude}, Long: ${position.coords.longitude}`);
        } finally {
          setIsLoadingLocation(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        setLocationError(
          error.code === 1
            ? "Location access denied. Please enable location services."
            : "Could not get your location. Please try again or enter it manually."
        );
        setIsLoadingLocation(false);
      }
    );
  };

  const handleContinue = () => {
    navigate(`/request-service/emergency`, { 
      state: { 
        location: currentLocation,
        isEmergency: true
      } 
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white py-12">
      <div className="container max-w-md mx-auto px-4">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-red-100">
          <div className="bg-gradient-to-r from-red-600 to-red-700 p-6 text-white">
            <h1 className="text-2xl font-bold mb-2">Emergency Assistance</h1>
            <p className="opacity-90">We're locating you to send help anywhere in Tamil Nadu</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Processing your emergency request</span>
                <span className="text-sm font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="space-y-4">
              <div className="border border-gray-200 rounded-lg p-4">
                <h2 className="font-semibold flex items-center gap-2 mb-3">
                  <MapPin className="h-5 w-5 text-red-600" />
                  Your Location in Tamil Nadu
                </h2>

                {isLoadingLocation ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-3/4" />
                    <div className="flex items-center gap-2 text-gray-500 text-sm mt-3">
                      <Loader className="h-4 w-4 animate-spin" />
                      Detecting your location...
                    </div>
                  </div>
                ) : locationError ? (
                  <Alert variant="destructive" className="mb-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{locationError}</AlertDescription>
                  </Alert>
                ) : (
                  <div className="bg-green-50 p-3 rounded border border-green-100 text-green-800">
                    <p className="text-sm">{currentLocation}</p>
                  </div>
                )}

                {locationError && (
                  <Button 
                    onClick={detectLocation} 
                    variant="outline" 
                    size="sm" 
                    className="mt-3 text-xs"
                  >
                    Try Again
                  </Button>
                )}
              </div>

              <Button 
                onClick={handleContinue}
                className="w-full bg-red-600 hover:bg-red-700"
                disabled={isLoadingLocation && !currentLocation && !locationError}
              >
                Continue to Emergency Service
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>

              <p className="text-xs text-center text-gray-500 mt-2">
                Our emergency team will contact you immediately.
                Standard service charges apply (₹).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Emergency;
