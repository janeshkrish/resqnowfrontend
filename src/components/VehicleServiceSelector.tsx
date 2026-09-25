import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { getUserToken } from "@/lib/api";
import { getServiceCatalogItem, type VehicleFlowType } from "@/config/serviceCatalog";

type VehicleOption = {
  id: VehicleFlowType;
  /** Used in the desktop "Continue with …" button. */
  name: string;
  lead: string;
  word: string;
  detail: string;
  label: string;
  image: string;
  width: number;
  height: number;
};

// Studio renders live in public/images/vehicles; each one sits on a white backdrop
// that the card blends away (mix-blend-mode: multiply in index.css).
const VEHICLE_OPTIONS: VehicleOption[] = [
  {
    id: "car",
    name: "Car",
    lead: "I have",
    word: "CAR",
    detail: "Hatchback · Sedan · SUV",
    label: "Car: hatchback, sedan or SUV",
    image: "/images/vehicles/car.webp",
    width: 840,
    height: 328,
  },
  {
    id: "bike",
    name: "Bike",
    lead: "I have",
    word: "BIKE",
    detail: "Motorcycle · Scooter",
    label: "Bike: motorcycle or scooter",
    image: "/images/vehicles/bike.webp",
    width: 620,
    height: 385,
  },
  {
    id: "commercial",
    name: "Commercial vehicle",
    lead: "I have a",
    word: "TRUCK",
    detail: "Truck · Van · Bus",
    label: "Commercial vehicle: truck, van or bus",
    image: "/images/vehicles/truck.webp",
    width: 900,
    height: 331,
  },
  {
    id: "ev",
    name: "EV",
    lead: "I have an",
    word: "EV",
    detail: "E-car · E-scooter",
    label: "Electric vehicle: e-car or e-scooter",
    image: "/images/vehicles/ev.webp",
    width: 860,
    height: 331,
  },
];

// Vehicle type, then Vehicle Details, Location and Contact Info.
const FLOW_STEP_COUNT = 4;
const AUTO_ADVANCE_MS = 300;

const VehicleServiceSelector = () => {
  const { serviceId } = useParams();
  const navigate = useNavigate();
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleFlowType | null>(null);
  const isMobile = useIsMobile();
  const advanceTimerRef = useRef<number | null>(null);

  const service = getServiceCatalogItem(serviceId);
  const selectedOption = VEHICLE_OPTIONS.find((option) => option.id === selectedVehicle);

  useEffect(() => () => {
    if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
  }, []);

  const handleContinue = (overrideId?: string) => {
    const idToUse = overrideId || selectedVehicle;

    if (idToUse && serviceId) {
      const urlParams = new URLSearchParams(window.location.search);
      const techId = urlParams.get('techId');
      const techParam = techId ? `?techId=${techId}` : '';

      const targetUrl = `/request-service/${serviceId}/${idToUse}${techParam}`;

      // Prefer token check over a simple localStorage flag for robustness
      const token = getUserToken();
      if (!token) {
        // Store the intended destination
        sessionStorage.setItem('returnUrl', targetUrl);
        navigate('/login');
      } else {
        navigate(targetUrl, { state: { reset: true } });
      }
    }
  };

  const handleVehicleSelect = (vehicleId: VehicleFlowType) => {
    setSelectedVehicle(vehicleId);

    // Auto-advance on mobile, after the selected state has had a moment to show.
    if (isMobile) {
      if (advanceTimerRef.current !== null) window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = window.setTimeout(() => {
        advanceTimerRef.current = null;
        handleContinue(vehicleId);
      }, AUTO_ADVANCE_MS);
    }
  };

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };

  return (
    <div className="rq-vs">
      <div className="rq-vs-inner">
        <div className="rq-vs-top rq-vs-enter">
          <button type="button" className="rq-vs-back rq-press" onClick={handleBack} aria-label="Go back">
            <span className="rq-symbol" aria-hidden="true">arrow_back</span>
          </button>
          <p className="rq-vs-steps">
            Step 1 of {FLOW_STEP_COUNT}
            <span className="rq-vs-step-bar" aria-hidden="true">
              {Array.from({ length: FLOW_STEP_COUNT }, (_, index) => (
                <span key={index} className={cn(index === 0 && "is-done")} />
              ))}
            </span>
          </p>
        </div>

        <div className="rq-vs-intro rq-vs-enter" style={{ animationDelay: "50ms" }}>
          <p className="rq-vs-kicker">{service.name}</p>
          <h1 className="rq-vs-title">
            Which vehicle
            <br />
            needs <span>help?</span>
          </h1>
          <p className="rq-vs-subtitle">Pick one to continue. Save more vehicles anytime in My Garage.</p>
        </div>

        <div className="rq-vs-grid">
          {VEHICLE_OPTIONS.map((option, index) => {
            const isSelected = selectedVehicle === option.id;
            return (
              <button
                key={option.id}
                type="button"
                className={cn("rq-vs-card rq-vs-enter", isSelected && "is-selected")}
                style={{ animationDelay: `${120 + index * 60}ms` }}
                onClick={() => handleVehicleSelect(option.id)}
                aria-pressed={isSelected}
                aria-label={option.label}
              >
                <img
                  className={cn("rq-vs-art", `rq-vs-art-${option.id}`)}
                  src={option.image}
                  width={option.width}
                  height={option.height}
                  alt=""
                  decoding="async"
                  draggable={false}
                />
                <span className="rq-vs-copy">
                  {isSelected ? (
                    <span className="rq-vs-lead">
                      <span className="rq-symbol rq-symbol-sm rq-vs-pop" aria-hidden="true">check_circle</span>
                      Selected
                    </span>
                  ) : (
                    <span className="rq-vs-lead">{option.lead}</span>
                  )}
                  <span className="rq-vs-word">{option.word}</span>
                  <span className="rq-vs-detail">{option.detail}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Mobile moves on as soon as a card is tapped; desktop confirms with a button. */}
        {!isMobile && (
          <button
            type="button"
            className="rq-vs-continue rq-press"
            onClick={() => handleContinue()}
            disabled={!selectedVehicle}
          >
            Continue{selectedOption ? ` with ${selectedOption.name}` : ""}
            <span className="rq-symbol" aria-hidden="true">arrow_forward</span>
          </button>
        )}

        <p className="rq-vs-trust rq-vs-enter" style={{ animationDelay: "360ms" }}>
          <span className="rq-symbol" aria-hidden="true">verified_user</span>
          Verified experts · Secure payments · 24/7 support
        </p>
      </div>
    </div>
  );
};

export default VehicleServiceSelector;
