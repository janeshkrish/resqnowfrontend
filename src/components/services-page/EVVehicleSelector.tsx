import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, MapPin, Battery, Car, Bike } from "lucide-react";
import { evVehiclesIndia } from "./ServicesData";

interface EVVehicleSelectorProps {
  onVehicleSelect: (vehicle: any) => void;
  onRequestService: () => void;
}

const EVVehicleSelector = ({ onVehicleSelect, onRequestService }: EVVehicleSelectorProps) => {
  const [selectedVehicleType, setSelectedVehicleType] = useState<string>("");
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);
  const [nearbyStations, setNearbyStations] = useState<any[]>([]);
  const [loadingStations, setLoadingStations] = useState(false);

  const vehicleTypes = ["Electric Cars", "Electric Bikes", "Electric Scooters", "Electric Auto"];
  
  const filteredVehicles = selectedVehicleType 
    ? evVehiclesIndia.filter(vehicle => vehicle.type === selectedVehicleType)
    : [];

  const handleVehicleTypeChange = (value: string) => {
    setSelectedVehicleType(value);
    setSelectedVehicle(null);
  };

  const handleVehicleChange = (value: string) => {
    const vehicle = evVehiclesIndia.find(v => v.id === value);
    setSelectedVehicle(vehicle);
    onVehicleSelect(vehicle);
  };

  const findNearbyChargingStations = async () => {
    setLoadingStations(true);
    try {
      // Get user's current location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const { latitude, longitude } = position.coords;
      
      // Mock data for charging stations (in real app, you'd call an API)
      const mockStations = [
        {
          id: 1,
          name: "Tata Power Charging Station",
          address: "MG Road, Bangalore",
          distance: "2.3 km",
          type: "DC Fast Charger",
          power: "50 kW",
          status: "Available",
          lat: latitude + 0.01,
          lng: longitude + 0.01
        },
        {
          id: 2,
          name: "Ather Grid Station", 
          address: "Indiranagar, Bangalore",
          distance: "3.1 km",
          type: "DC Fast Charger",
          power: "30 kW", 
          status: "Available",
          lat: latitude + 0.02,
          lng: longitude + 0.02
        },
        {
          id: 3,
          name: "Fortum Charge & Drive",
          address: "Koramangala, Bangalore",
          distance: "4.2 km",
          type: "AC Charger",
          power: "22 kW",
          status: "Occupied",
          lat: latitude + 0.03,
          lng: longitude + 0.03
        },
        {
          id: 4,
          name: "ChargeZone Station",
          address: "Whitefield, Bangalore", 
          distance: "5.8 km",
          type: "DC Fast Charger",
          power: "60 kW",
          status: "Available",
          lat: latitude + 0.04,
          lng: longitude + 0.04
        }
      ];

      setNearbyStations(mockStations);
    } catch (error) {
      console.error("Error getting location:", error);
      // Fallback to mock data without location
      const fallbackStations = [
        {
          id: 1,
          name: "Tata Power Charging Station",
          address: "MG Road, Bangalore",
          distance: "N/A",
          type: "DC Fast Charger", 
          power: "50 kW",
          status: "Available"
        }
      ];
      setNearbyStations(fallbackStations);
    } finally {
      setLoadingStations(false);
    }
  };

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case "Electric Cars":
        return Car;
      case "Electric Bikes":
      case "Electric Scooters":
        return Bike;
      default:
        return Zap;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Select Your Electric Vehicle
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Vehicle Type</label>
            <Select value={selectedVehicleType} onValueChange={handleVehicleTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select vehicle type" />
              </SelectTrigger>
              <SelectContent>
                {vehicleTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const IconComponent = getVehicleIcon(type);
                        return <IconComponent className="h-4 w-4" />;
                      })()}
                      {type}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedVehicleType && (
            <div>
              <label className="text-sm font-medium mb-2 block">Vehicle Model</label>
              <Select value={selectedVehicle?.id || ""} onValueChange={handleVehicleChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select your vehicle model" />
                </SelectTrigger>
                <SelectContent>
                  {filteredVehicles.map((vehicle) => (
                    <SelectItem key={vehicle.id} value={vehicle.id}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{vehicle.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {vehicle.batteryCapacity} • {vehicle.range} range
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedVehicle && (
            <Card className="bg-accent/50">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-2">
                    <Battery className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-sm font-medium">Battery Capacity</div>
                      <div className="text-xs text-muted-foreground">{selectedVehicle.batteryCapacity}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-sm font-medium">Range</div>
                      <div className="text-xs text-muted-foreground">{selectedVehicle.range}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-sm font-medium">Charging Type</div>
                      <div className="text-xs text-muted-foreground">{selectedVehicle.chargingType}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    <div>
                      <div className="text-sm font-medium">Brand</div>
                      <div className="text-xs text-muted-foreground">{selectedVehicle.brand}</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {selectedVehicle && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-primary" />
              Nearby Charging Stations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={findNearbyChargingStations}
              disabled={loadingStations}
              className="w-full mb-4"
            >
              {loadingStations ? "Finding Stations..." : "Find Nearby Charging Stations"}
            </Button>

            {nearbyStations.length > 0 && (
              <div className="space-y-3">
                {nearbyStations.map((station) => (
                  <Card key={station.id} className="bg-background border">
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h4 className="font-medium">{station.name}</h4>
                          <p className="text-sm text-muted-foreground">{station.address}</p>
                          <div className="flex items-center gap-4 mt-2">
                            <Badge variant="outline" className="text-xs">
                              {station.distance}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {station.type}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {station.power}
                            </Badge>
                          </div>
                        </div>
                        <Badge 
                          variant={station.status === "Available" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {station.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {selectedVehicle && (
        <Button onClick={onRequestService} className="w-full" size="lg">
          Request Emergency EV Charging
        </Button>
      )}
    </div>
  );
};

export default EVVehicleSelector;