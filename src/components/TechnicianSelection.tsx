import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import TechnicianCard from "./technician/TechnicianCard";
import SortControls from "./technician/SortControls";
import { Technician } from "./technician/types";
import defaultAvatar from "@/assets/default-avatar.png";
import { apiFetch } from "@/lib/api";
import LoadingAnimation from "./LoadingAnimation";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { Card } from "./ui/card";

interface TechnicianSelectionProps {
  serviceType: string;
  onSelect: (technicianId: string) => void;
  vehicleType?: string;
  location?: string;
  latitude?: number;
  longitude?: number;
}

const TechnicianSelection = ({ serviceType, onSelect, vehicleType, location, latitude, longitude }: TechnicianSelectionProps) => {
  const [selectedTechnician, setSelectedTechnician] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"price" | "rating" | "arrival">("arrival");
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiRecommendation, setAiRecommendation] = useState<string>("");
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    fetchTechnicians();
  }, [serviceType, latitude, longitude]);

  useEffect(() => {
    if (technicians.length > 0 && !aiRecommendation) {
      fetchAIRecommendation();
    }
  }, [technicians]);

  const fetchTechnicians = async () => {
    try {
      setLoading(true);
      setError(null);
      setAiRecommendation(""); // Reset

      let lat = latitude || 0;
      let lng = longitude || 0;

      // Fallback: Try to parse if props are missing but location string exists (and looks like coords)
      if (!lat && !lng && location) {
        const parts = location.split(',').map(s => s.trim());
        if (parts.length === 2 && !isNaN(parseFloat(parts[0]))) {
          lat = parseFloat(parts[0]);
          lng = parseFloat(parts[1]);
        }
      }

      // If no location, we can't really fetch nearby, but let's try with 0,0 or handle gracefully
      // For now, if no location, maybe show empty or ask for location.
      // Assuming parent ensures location before this step.

      // Include vehicle type when available so backend can pick service+vehicle pricing
      const vtParam = vehicleType ? `&vehicle_type=${encodeURIComponent(vehicleType)}` : "";
      const res = await apiFetch(`/api/technicians/nearby?lat=${lat}&lng=${lng}&service_type=${serviceType}${vtParam}`);

      if (!res.ok) {
        throw new Error("Failed to fetch technicians");
      }

      const data = await res.json();
      let transformedTechnicians: Technician[] = [];
      let topRecommendations: string[] = [];

      if (data && data.length > 0) {
        transformedTechnicians = data.map((tech: any) => {
          if (tech.aiRecommended) {
            topRecommendations.push(`${tech.name} (${tech.rating}★, ${parseFloat(tech.distance).toFixed(1)}km)`);
          }

          return {
            id: String(tech.id),
            name: tech.name,
            avatar: defaultAvatar,
            rating: parseFloat(tech.rating) || 4.5,
            // Do NOT show a generic fallback price. If backend does not provide one, keep it null and let the card hide it.
            price: tech.price ?? null,
            currency: tech.currency || "₹",
            distance: `${parseFloat(tech.distance).toFixed(1)} km`,
            estimatedArrival: `${Math.round(parseFloat(tech.distance) * 2 + 5)}-${Math.round(parseFloat(tech.distance) * 2 + 15)} min`,
            completedJobs: tech.jobs_completed || 0,
            specialties: tech.specialties || [],
            verified: tech.verification_status === 'verified',
            badges: getBadges(tech),
            score: tech.score // internal use for sorting if needed
          };
        });

        // Populate AI Recommendation Text
        if (topRecommendations.length > 0) {
          setAiRecommendation(`Top picks for you:\n${topRecommendations.map(t => "• " + t).join("\n")}`);
        } else {
          setAiRecommendation("No specific recommendations found nearby.");
        }

      } else {
        setAiRecommendation("No technicians found in your area.");
      }

      setTechnicians(transformedTechnicians);
    } catch (err) {
      console.error('Error fetching technicians:', err);
      // Fallback to mock NOT desired by user ("Fetch Technicians from Database"), but helpful if API fails?
      // User said "Technician cards must be fetched dynamically from TiDB".
      // I will show error if API fails.
      setError('Failed to load available technicians. Ensure location is enabled.');
    } finally {
      setLoading(false);
    }
  };

  const fetchAIRecommendation = async () => {
    // Handled in fetchTechnicians now
  };

  // Helper functions
  const getBadges = (tech: any): string[] => {
    const badges = [];
    if ((tech.jobs_completed || tech.experience) >= 50) badges.push("Expert");
    else if ((tech.jobs_completed || tech.experience) >= 20) badges.push("Experienced");

    if (tech.rating >= 4.8) badges.push("Top Rated");
    return badges;
  };

  const sortedTechnicians = [...technicians].sort((a, b) => {
    if (sortBy === "price") {
      const pa = typeof a.price === 'number' ? a.price : Number.POSITIVE_INFINITY;
      const pb = typeof b.price === 'number' ? b.price : Number.POSITIVE_INFINITY;
      return pa - pb;
    } else if (sortBy === "rating") {
      return b.rating - a.rating;
    } else { // arrival (default) - implicitly distance
      // Extract numbers from "2.5 km" strings
      const distA = parseFloat(a.distance);
      const distB = parseFloat(b.distance);
      return distA - distB;
    }
  });

  const handleTechnicianClick = (techId: string) => {
    setSelectedTechnician(techId);
    onSelect(techId);
  };

  const confirmSelection = () => {
    if (selectedTechnician) {
      onSelect(selectedTechnician);
    }
  };

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-12 space-y-4">
        <LoadingAnimation />
        <p className="text-gray-600">Finding available technicians near you...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchTechnicians}
            className="ml-2"
          >
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="w-full space-y-6 animate-fade-in">
      <div className="flex flex-col space-y-4">
        <h3 className="text-2xl font-bold text-center sm:text-left">Available Technicians Near You</h3>
        <p className="text-gray-600 text-center sm:text-left">
          Select a technician for your {serviceType} service
        </p>

        {aiRecommendation && (
          <Card className="p-4 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
            <div className="flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
                  AI-Powered Recommendations
                  {loadingAI && <Loader2 className="h-4 w-4 animate-spin" />}
                </h4>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{aiRecommendation}</p>
              </div>
            </div>
          </Card>
        )}

        <SortControls sortBy={sortBy} onSortChange={setSortBy} />
      </div>

      <div className="grid grid-cols-1 gap-3 pb-24">
        {sortedTechnicians.map((tech) => (
          <TechnicianCard
            key={tech.id}
            technician={tech}
            isSelected={selectedTechnician === tech.id}
            onSelect={handleTechnicianClick}
          />
        ))}
      </div>


      {/* 
      <div className="flex justify-end pt-4">
        <Button
          className="bg-red-600 hover:bg-red-700"
          disabled={!selectedTechnician}
          onClick={confirmSelection}
        >
          Continue with Selected Technician
        </Button>
      </div> 
      */}
    </div >
  );
};

export default TechnicianSelection;
