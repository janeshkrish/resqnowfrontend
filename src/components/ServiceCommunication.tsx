import { useState } from "react";
import { MessageCircle, MapPin, Car, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface ServiceProvider {
  id: string;
  name: string;
  specialties: string[];
  location: string;
  distance: string;
  rating: number;
  responseTime: string;
  verified: boolean;
}

interface ServiceCommunicationProps {
  serviceType: string;
  vehicleInfo?: any;
  location?: string;
  onClose: () => void;
}

const ServiceCommunication = ({ serviceType, vehicleInfo, location, onClose }: ServiceCommunicationProps) => {
  const [message, setMessage] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mock data for nearby service providers
  const nearbyProviders: ServiceProvider[] = [
    {
      id: "1",
      name: "QuickFix Auto Services",
      specialties: ["Engine Repair", "Brake Service", "Tyre Change"],
      location: "2.5 km away",
      distance: "2.5 km",
      rating: 4.8,
      responseTime: "15-20 mins",
      verified: true
    },
    {
      id: "2",
      name: "SpeedyTech Motors",
      specialties: ["Battery Service", "AC Repair", "General Maintenance"],
      location: "3.2 km away",
      distance: "3.2 km",
      rating: 4.6,
      responseTime: "20-25 mins",
      verified: true
    },
    {
      id: "3",
      name: "ProCare Auto Hub",
      specialties: ["Electrical Work", "Tyre Service", "Oil Change"],
      location: "4.1 km away",
      distance: "4.1 km",
      rating: 4.7,
      responseTime: "25-30 mins",
      verified: false
    }
  ];

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedProvider) {
      toast.error("Please select a service provider and enter a message");
      return;
    }

    setIsSubmitting(true);
    try {
      // TODO: Implement service communications once the table is created
      // For now, just show success message
      toast.success("Your request has been sent to the service provider!");
      setMessage("");
      onClose();
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/10 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Connect with Nearby Services
          </h1>
          <p className="text-muted-foreground">
            Send your service request to verified providers in your area
          </p>
        </div>

        {/* Service Details Card */}
        <Card className="mb-6 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              Service Request Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Service Type</p>
                <p className="font-semibold text-primary">{serviceType}</p>
              </div>
              {location && (
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-semibold flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {location}
                  </p>
                </div>
              )}
              {vehicleInfo && (
                <div>
                  <p className="text-sm text-muted-foreground">Vehicle</p>
                  <p className="font-semibold">{vehicleInfo.type} - {vehicleInfo.model}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Service Providers */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-4">Available Service Providers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nearbyProviders.map((provider) => (
              <Card
                key={provider.id}
                className={`cursor-pointer transition-all duration-300 hover:shadow-lg ${selectedProvider === provider.id
                    ? 'ring-2 ring-primary bg-primary/5'
                    : 'hover:bg-accent/10'
                  }`}
                onClick={() => setSelectedProvider(provider.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{provider.name}</CardTitle>
                    {provider.verified && (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        ✓ Verified
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{provider.location}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-yellow-500">★</span>
                      <span>{provider.rating}</span>
                      <span className="text-muted-foreground">• {provider.responseTime}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {provider.specialties.slice(0, 2).map((specialty) => (
                        <Badge key={specialty} variant="outline" className="text-xs">
                          {specialty}
                        </Badge>
                      ))}
                      {provider.specialties.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{provider.specialties.length - 2} more
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Message Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              Send Your Request
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Describe your service requirement
              </label>
              <Textarea
                placeholder="Please describe your service requirement in detail. Include any specific issues, preferred time, and additional information that would help the service provider..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                className="mt-1"
              />
            </div>

            {!selectedProvider && (
              <p className="text-sm text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-200">
                Please select a service provider above to continue
              </p>
            )}
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSendMessage}
              disabled={!selectedProvider || !message.trim() || isSubmitting}
              className="flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? "Sending..." : "Send Request"}
            </Button>
          </CardFooter>
        </Card>

        {/* Info Card */}
        <Card className="mt-6 bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <MessageCircle className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">How it works</h3>
                <p className="text-sm text-blue-700">
                  Your request will be sent directly to the selected service provider.

                  They will contact you within their response time to discuss details and confirm the service.
                  All communication happens through our secure platform.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ServiceCommunication;